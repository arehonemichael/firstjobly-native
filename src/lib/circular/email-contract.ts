export type EmailPaths = {
  composer: boolean;
  defaultApp: boolean;
  clients: { label: string; url: string }[];
};
export function mailtoURL(email: string, subject: string, body: string) {
  if (!/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email))
    throw Error(
      "The application email address is unavailable. Check the official circular.",
    );
  // mailto cannot carry file attachments. Callers must explain manual attachment.
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
