type Detail = string | number | boolean | null | undefined;
const fields = new Set([
  "format",
  "placement",
  "platform",
  "build",
  "supported",
  "sdkAvailable",
  "testMode",
  "enabled",
  "unitMode",
  "hasUnit",
  "appVersion",
  "nativeBuildVersion",
  "status",
  "canRequestAds",
  "personalized",
  "initialized",
  "eligible",
  "reason",
  "attempt",
  "delayMs",
  "code",
  "message",
  "width",
  "loaded",
  "shown",
  "cachedPermission",
]);
export function sanitizeAdMessage(value: string) {
  return value
    .replace(
      /(?:IABTCF_\w*|IABGPP_\w*|IABUSPrivacy_?\w*|TCString|access_token|refresh_token|token|authorization)\s*[:=]\s*["']?[^\s,"']+/gi,
      "[private]",
    )
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(
      /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi,
      "[identifier]",
    )
    .replace(
      /\b(?:Bearer\s+)?[A-Za-z0-9_+/=-]{24,}(?:\.[A-Za-z0-9_+/=-]+)*/g,
      "[redacted]",
    )
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 280);
}
export function createAdDiagnostics(
  enabled: boolean,
  sink: (entry: Record<string, Detail>) => void,
) {
  const seen = new Set<string>();
  function record(
    event: string,
    details: Record<string, Detail> = {},
    once = false,
  ) {
    if (!enabled) return;
    const entry: Record<string, Detail> = { event };
    for (const [key, value] of Object.entries(details)) {
      if (!fields.has(key) || value === undefined) continue;
      entry[key] = typeof value === "string" ? sanitizeAdMessage(value) : value;
    }
    const key = JSON.stringify(entry);
    if (once && seen.has(key)) return;
    if (once) {
      if (seen.size >= 128) seen.clear();
      seen.add(key);
    }
    try {
      sink(entry);
    } catch {
      /* Diagnostics must never change ad/navigation behaviour. */
    }
  }
  function error(
    format: string,
    phase: string,
    error: unknown,
    details: Record<string, Detail> = {},
  ) {
    const candidate =
      error && typeof error === "object"
        ? (error as { code?: unknown; message?: unknown })
        : {};
    const code =
      typeof candidate.code === "string" || typeof candidate.code === "number"
        ? String(candidate.code)
        : "unknown";
    const message =
      typeof candidate.message === "string"
        ? candidate.message
        : "SDK operation failed";
    const text = `${code} ${message}`.toLowerCase();
    const reason =
      text.includes("no form") || text.includes("publisher misconfiguration")
        ? "publisher-configuration"
        : text.includes("no-fill") || text.includes("no fill")
          ? "no-fill"
          : text.includes("network")
            ? "network"
            : "sdk-error";
    record(phase, { ...details, format, reason, code, message });
  }
  return { record, error };
}
// Production never logs, including builds with test units enabled explicitly.
export const adDiagnostics = createAdDiagnostics(
  typeof __DEV__ !== "undefined" && __DEV__,
  (entry) => console.info("[FirstJobly ads]", JSON.stringify(entry)),
);
