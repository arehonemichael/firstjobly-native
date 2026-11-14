import { assertGeneratedOwnerActive } from "./account/owned-files";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

let exportSerial = 0;
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
 * iOS uses the system share sheet: choose Save to Files. Completion is only
 * a handoff, not evidence the user saved. Temporary export copies are removed
 * after the sheet closes; the caller retains its original document.
 */
export async function savePdfToDownloads(
  sourceUri: string,
  fileName: string,
  options: {
    shareOnIos?: boolean;
    ownerId?: string | null;
    isCurrent?: () => Promise<boolean>;
  } = {},
): Promise<string> {
  assertGeneratedOwnerActive(options.ownerId);
  if (options.isCurrent && !(await options.isCurrent()))
    throw Error("Your account changed. Reopen the document.");
  const cleanName = fileName.toLowerCase().endsWith(".pdf")
    ? fileName
    : `${fileName}.pdf`;

  if (Platform.OS === "ios") {
    if (!(await Sharing.isAvailableAsync()) || !FileSystem.cacheDirectory)
      throw new Error(
        "Save to Files is unavailable on this device. Your original PDF has not been changed.",
      );
    const folder = `${FileSystem.cacheDirectory}firstjobly-export-${Date.now()}-${++exportSerial}/`;
    const destination = folder + fileBase(cleanName) + ".pdf";
    try {
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      await FileSystem.copyAsync({ from: sourceUri, to: destination });
      assertGeneratedOwnerActive(options.ownerId);
      if (options.isCurrent && !(await options.isCurrent()))
        throw Error("Your account changed. Reopen the document.");
      await Sharing.shareAsync(destination, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Save to Files",
      });
      return sourceUri;
    } finally {
      await FileSystem.deleteAsync(folder, { idempotent: true }).catch(
        () => undefined,
      );
    }
  }
  if (Platform.OS !== "android")
    throw Error("Use the installed app to export this document.");

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
    if (options.isCurrent && !(await options.isCurrent()))
      throw Error("Your account changed. Reopen the document.");
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
