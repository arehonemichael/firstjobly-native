import { Platform, Linking } from "react-native";
import * as FS from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as MailComposer from "expo-mail-composer";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { savePdfToDownloads } from "../save-pdf";
import type { Batch } from "./contract";
import { externalURL, pdfFilename } from "./contract";
export async function copy(value: string) {
  await Clipboard.setStringAsync(value);
}
export async function openURL(value: string | null | undefined) {
  const url = externalURL(value);
  if (!url)
    throw Error(
      "This link is unavailable. Please check the official circular.",
    );
  await Linking.openURL(url);
}
export async function downloadBatch(batch: Batch) {
  const url = externalURL(batch.pdf_download_url);
  if (!url)
    throw Error("The circular PDF is not available yet. Please try again.");
  const name = pdfFilename(batch);
  const file = await FS.downloadAsync(url, FS.cacheDirectory + name);
  try {
    if (file.status !== 200)
      throw Error("Could not download the circular. Please try again.");
    const disposition = Object.entries(file.headers || {}).find(
      ([key]) => key.toLowerCase() === "content-disposition",
    )?.[1];
    const target = await savePDF(file.uri, pdfFilename(batch, disposition));
    if (Platform.OS === "android") {
      const uri = target.startsWith("content:")
        ? target
        : await FS.getContentUriAsync(target);
      try {
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: uri,
          flags: 1,
          type: "application/pdf",
        });
      } catch {
        throw Error("PDF saved. Open it from Downloads using a PDF viewer.");
      }
    } else if (await Sharing.isAvailableAsync())
      await Sharing.shareAsync(target, { mimeType: "application/pdf" });
  } finally {
    await FS.deleteAsync(file.uri, { idempotent: true });
  }
}
export async function chooseCV() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });
  return result.canceled ? null : result.assets[0];
}
export async function compose(
  email: string,
  subject: string,
  z83: string,
  cv: string,
) {
  if (!(await MailComposer.isAvailableAsync()))
    throw Error(
      "No mail app is set up. Set up email on this device and try again.",
    );
  await MailComposer.composeAsync({
    recipients: [email],
    subject,
    body: "Please find my Z83 and CV attached.",
    attachments: [z83, cv],
  });
}
export async function deleteTemporary(uri: string) {
  try {
    if (FS.cacheDirectory && uri.startsWith(FS.cacheDirectory))
      await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    /* Best-effort cache cleanup. */
  }
}
export async function saveApplicationPDF(uri: string) {
  await savePDF(uri, "Z83-application.pdf");
}

async function savePDF(uri: string, name: string) {
  try {
    return await savePdfToDownloads(uri, name);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DOWNLOAD_PERMISSION_DENIED"
    )
      throw Error("PDF was not saved. Choose a Downloads folder to continue.");
    throw Error(
      "Could not save the PDF. Check your folder access and try again.",
    );
  }
}
