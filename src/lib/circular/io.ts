import { assertPdf } from "../document-export";
import { mailtoURL, type EmailPaths } from "./email-contract";
import { Platform, Linking } from "react-native";
import * as FS from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as MailComposer from "expo-mail-composer";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
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
    await assertPdf(file.uri);
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
    }
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
  if (result.canceled) return null;
  const file = result.assets[0];
  try {
    await assertPdf(file.uri);
    return file;
  } catch (e) {
    await deleteTemporary(file.uri);
    throw e;
  }
}
export async function chooseSupporting() {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return null;
  try {
    if (result.assets.length > 4)
      throw Error("Choose up to four supporting PDFs.");
    for (const file of result.assets) {
      if (file.size && file.size > 5 * 1024 * 1024)
        throw Error("Supporting PDFs must be 5 MB or smaller.");
      await assertPdf(file.uri);
    }
    return result.assets.map((file) => ({ uri: file.uri, name: file.name }));
  } catch (e) {
    for (const file of result.assets) await deleteTemporary(file.uri);
    throw e;
  }
}
export async function emailPaths(): Promise<EmailPaths> {
  const composer = await MailComposer.isAvailableAsync().catch(() => false);
  let clients: EmailPaths["clients"] = [];
  if (Platform.OS === "ios") {
    try {
      clients = MailComposer.getClients()
        .filter((client) => !!client.url)
        .map((client) => ({ label: client.label, url: client.url! }));
    } catch {
      /* Older builds may not support discovery. */
    }
  }
  const defaultApp = await Linking.canOpenURL(
    "mailto:test@example.invalid",
  ).catch(() => false);
  return { composer, clients, defaultApp };
}
export async function openEmail(
  email: string,
  subject: string,
  body: string,
  clientURL?: string,
) {
  if (clientURL) {
    const known = (await emailPaths()).clients.find(
      (client) => client.url === clientURL,
    );
    if (!known || !(await Linking.canOpenURL(known.url)))
      throw Error(
        "This email app is unavailable. Copy the details and save your documents instead.",
      );
    await Linking.openURL(known.url); // Opens the app only; no prefill/attachment promise.
  } else {
    const url = mailtoURL(email, subject, body);
    if (!(await Linking.canOpenURL(url)))
      throw Error(
        "No default email app could be opened. Copy the details and save your documents, then attach them in your email app.",
      );
    await Linking.openURL(url);
  }
}
export async function compose(
  email: string,
  subject: string,
  z83: string,
  cv: string,
  body = "Please find my Z83 and CV attached.",
  supporting: string[] = [],
  stillOwner?: () => boolean,
) {
  for (const uri of [z83, cv, ...supporting]) await assertPdf(uri);
  if (stillOwner && !stillOwner())
    throw Error("Your application session ended. Reopen the job.");
  if (!(await MailComposer.isAvailableAsync())) {
    if (Platform.OS === "ios") return "manual" as const;
    throw Error(
      "No mail app is set up. Copy the email details and save your documents to attach them manually.",
    );
  }
  const result = await MailComposer.composeAsync({
    recipients: [email],
    subject,
    body,
    attachments: [z83, cv, ...supporting],
  });
  return result.status === "cancelled" || result.status === "saved"
    ? ("cancelled" as const)
    : ("handoff" as const);
}
export async function deleteTemporary(uri: string) {
  try {
    if (FS.cacheDirectory && uri.startsWith(FS.cacheDirectory))
      await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    /* Best-effort cache cleanup. */
  }
}
export async function saveApplicationPDF(
  uri: string,
  name = "Z83-application.pdf",
) {
  await assertPdf(uri);
  await savePDF(uri, name);
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
    if (Platform.OS === "ios" && error instanceof Error) throw error;
    throw Error(
      "Could not save the PDF. Check your folder access and try again.",
    );
  }
}
