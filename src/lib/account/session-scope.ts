// No Buffer/atob dependency: Hermes need not provide browser base64 helpers.
function payloadText(value: string) {
  if (!/^[A-Za-z0-9_-]{1,32768}$/.test(value)) throw Error("Invalid payload");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let buffer = 0,
    bits = 0,
    escaped = "";
  for (const char of value) {
    buffer = (buffer << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      escaped += "%" + ((buffer >> bits) & 255).toString(16).padStart(2, "0");
      buffer &= (1 << bits) - 1;
    }
  }
  return decodeURIComponent(escaped);
}
/** Client-side isolation only, never authentication. Server validates the JWT.
 * Stable over token refresh; different sign-in/email/account clears code UI. */
export function deletionSessionScope(token: string, owner: string, email = "") {
  let session = "unsupported";
  try {
    const payload = JSON.parse(payloadText(token.split(".")[1]));
    if (
      typeof payload.session_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        payload.session_id,
      )
    )
      session = payload.session_id;
  } catch {
    /* Missing claims remain for the server to reject, not to trust. */
  }
  return JSON.stringify([owner, email.trim().toLowerCase(), session]);
}
