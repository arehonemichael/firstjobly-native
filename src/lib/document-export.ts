import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
export type StoredDocument = {
  file_path: string;
  file_name: string;
  kind: string;
};
const types: Record<string, { mime: string; uti: string }> = {
  pdf: { mime: "application/pdf", uti: "com.adobe.pdf" },
  doc: { mime: "application/msword", uti: "com.microsoft.word.doc" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    uti: "org.openxmlformats.wordprocessingml.document",
  },
  jpg: { mime: "image/jpeg", uti: "public.jpeg" },
  jpeg: { mime: "image/jpeg", uti: "public.jpeg" },
  png: { mime: "image/png", uti: "public.png" },
};
export async function assertPdf(uri: string) {
  const info = await FS.getInfoAsync(uri);
  if (!info.exists || info.isDirectory || !info.size || info.size < 8)
    throw Error("The PDF is empty or unavailable.");
  const prefix = await FS.readAsStringAsync(uri, {
    encoding: FS.EncodingType.Base64,
    position: 0,
    length: 5,
  });
  if (!prefix.startsWith("JVBERi0"))
    throw Error("This file is not a readable PDF. Download it again.");
  try {
    // Load the existing PDF parser only for a document action, not app startup.
    const { PDFDocument } = await import("./z83/pdf-lib");
    const bytes = await FS.readAsStringAsync(uri, {
      encoding: FS.EncodingType.Base64,
    });
    const document = await PDFDocument.load(bytes);
    if (document.getPageCount() < 1) throw Error("Empty PDF");
  } catch {
    throw Error(
      "This PDF could not be read. It may be damaged or password-protected. Choose another copy.",
    );
  }
}
let serial = 0;
/** Fresh signed URL for every explicit export, with one safe GET retry if expired.
 * Native UI cannot confirm a Files destination. Never return saved:true. */
export async function exportStoredDocument(
  doc: StoredDocument,
  signedURL: () => Promise<string>,
  stillOwner: () => Promise<boolean>,
) {
  const ext = doc.file_name.split(".").pop()?.toLowerCase() ?? "";
  const type = types[ext];
  if (!type || !FS.cacheDirectory)
    throw Error("This document type cannot be exported here.");
  if (!(await Sharing.isAvailableAsync()))
    throw Error("File export is unavailable on this device.");
  const folder =
    FS.cacheDirectory + `firstjobly-document-export-${Date.now()}-${++serial}/`;
  const labels: Record<string, string> = {
    cv: "CV",
    matric_certificate: "Matric-certificate",
    academic_transcript: "Academic-transcript",
    qualification_certificate: "Qualification-certificate",
    cover_letter: "Cover-letter",
  };
  const uri = folder + (labels[doc.kind] ?? "Supporting-document") + "." + ext;
  try {
    await FS.makeDirectoryAsync(folder, { intermediates: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!(await stillOwner()))
        throw Error("Your account changed. Reopen your documents.");
      const url = await signedURL();
      if (!url.startsWith("https://"))
        throw Error("The document link is unavailable.");
      const result = await FS.downloadAsync(url, uri);
      if ((result.status === 401 || result.status === 403) && attempt === 0)
        continue;
      if (result.status !== 200)
        throw Error("Could not download the document. Please try again.");
      const info = await FS.getInfoAsync(uri);
      if (!info.exists || info.isDirectory || !info.size)
        throw Error("The downloaded document is empty.");
      if (ext === "pdf") await assertPdf(uri);
      if (!(await stillOwner()))
        throw Error("Your account changed. Reopen your documents.");
      await Sharing.shareAsync(uri, {
        mimeType: type.mime,
        UTI: type.uti,
        dialogTitle: "Save to Files",
      });
      return { handedOff: true as const };
    }
    throw Error("The document link expired. Please try again.");
  } finally {
    await FS.deleteAsync(folder, { idempotent: true }).catch(() => undefined);
  }
}
