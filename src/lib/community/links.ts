/** Accept only the audited internal destinations. Never navigate a notification
 * to an arbitrary URL, even if it contains a Community-looking path. */
export function communityDestination(value: unknown): string | null {
  if (typeof value !== "string" || /[\\\s?#%]/.test(value)) return null;
  return /^\/community(?:\/[a-zA-Z0-9_-]+)?\/?$/.test(value) ? value : null;
}
