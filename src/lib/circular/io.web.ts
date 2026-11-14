import type { Batch } from "./contract";
import { externalURL } from "./contract";
export async function copy(value: string) {
  await navigator.clipboard.writeText(value);
}
export async function openURL(value: string | null | undefined) {
  const url = externalURL(value);
  if (!url)
    throw Error(
      "This link is unavailable. Please check the official circular.",
    );
  window.open(url, "_blank", "noopener,noreferrer");
}
export async function downloadBatch(batch: Batch) {
  const url = externalURL(batch.pdf_download_url);
  if (!url)
    throw Error("The circular PDF is not available yet. Please try again.");
  const link = document.createElement("a");
  link.href = url;
  link.download = `public-service-vacancy-circular-${batch.circular_number}-of-${batch.circular_year}.pdf`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
}
export async function chooseCV(): Promise<{
  uri: string;
  name: string;
} | null> {
  throw Error(
    "Use the iOS or Android app to attach a CV and send your Z83 with it.",
  );
}
export async function compose(
  _email: string,
  _subject: string,
  _z83: string,
  _cv: string,
  _body?: string,
  _supporting?: string[],
  _stillOwner?: () => boolean,
): Promise<"manual" | "cancelled" | "handoff"> {
  throw Error("Email attachments are available in the iOS or Android app.");
}
export async function deleteTemporary(uri: string) {
  if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
}
export async function saveApplicationPDF(_uri: string, _name?: string) {
  throw Error("Use the iOS or Android app to save this application PDF.");
}

export async function chooseSupporting(): Promise<
  { uri: string; name: string }[] | null
> {
  throw Error(
    "Use the installed iOS or iOS or Android app to attach documents.",
  );
}
export async function emailPaths() {
  return {
    composer: false,
    defaultApp: false,
    clients: [] as { label: string; url: string }[],
  };
}
export async function openEmail(
  _email: string,
  _subject: string,
  _body: string,
  _clientURL?: string,
) {
  throw Error(
    "Use the installed app for email attachments. Copy application details from this page.",
  );
}
