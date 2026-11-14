import {
  rememberGeneratedFile,
  assertGeneratedOwnerActive,
} from "./account/owned-files";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

const DOWNLOADS_URI_KEY = "firstjobly.downloads.directory.v1";

function fileBase(name: string) {
  return (
    name
      .replace(/\.pdf$/i, "")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .trim() || "document"
  );
}

/**
 * Saves a generated local PDF into the user's Downloads directory.
 *
 * Android uses Storage Access Framework. The first download opens Android's
 * directory picker already pointed at Download; after the user grants access,
 * FirstJobly remembers that folder and future taps save there directly.
 *
 * iOS has no Android-style public Downloads directory. We keep the generated
 * PDF in the app's Documents directory and return that path.
 */
export async function savePdfToDownloads(
  sourceUri: string,
  fileName: string,
  options: { shareOnIos?: boolean; ownerId?: string | null } = {},
): Promise<string> {
  assertGeneratedOwnerActive(options.ownerId);
  const cleanName = fileName.toLowerCase().endsWith(".pdf")
    ? fileName
    : `${fileName}.pdf`;

  if (Platform.OS !== "android") {
    if (!FileSystem.documentDirectory) {
      throw new Error("Documents directory is unavailable");
    }
    const folder = options.ownerId
      ? `${FileSystem.documentDirectory}firstjobly-generated/${encodeURIComponent(options.ownerId)}/`
      : FileSystem.documentDirectory;
    if (options.ownerId)
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const destination = `${folder}${cleanName}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destination });
    await rememberGeneratedFile(options.ownerId ?? null, destination);
    if (Platform.OS === "ios" && options.shareOnIos) {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error(
          "PDF saved in FirstJobly, but sharing is unavailable on this device.",
        );
      await Sharing.shareAsync(destination, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Save PDF",
      });
    }
    return destination;
  }

  let directoryUri = await AsyncStorage.getItem(DOWNLOADS_URI_KEY);

  if (!directoryUri) {
    const initialUri =
      FileSystem.StorageAccessFramework.getUriForDirectoryInRoot("Download");

    const permission =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
        initialUri,
      );

    if (!permission.granted) {
      throw new Error("DOWNLOAD_PERMISSION_DENIED");
    }

    directoryUri = permission.directoryUri;
    await AsyncStorage.setItem(DOWNLOADS_URI_KEY, directoryUri);
  }

  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      fileBase(cleanName),
      "application/pdf",
    );

    assertGeneratedOwnerActive(options.ownerId);
    await FileSystem.writeAsStringAsync(targetUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return targetUri;
  } catch (error) {
    // Android can revoke a persisted SAF grant (folder moved, storage reset,
    // app restored, etc.). Forget it so the next tap asks for Download again.
    await AsyncStorage.removeItem(DOWNLOADS_URI_KEY);
    throw error;
  }
}
