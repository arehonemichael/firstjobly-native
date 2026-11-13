export type CircularDiagnostic = {
  url: string;
  method: string;
  attempt: number;
  authorization: boolean;
  xFjToken: boolean;
  tokenLength: number;
  status: number | null;
  bodyPreview: string;
  total?: number;
  itemCount?: number;
  page?: number;
  hasMore?: boolean;
  batchJobCount?: number;
};
export type CircularTrace = (entry: CircularDiagnostic) => void;
/** Diagnostics must never expose a credential, even if a server echoes it. */
export function emitDiagnostic(
  trace: CircularTrace | undefined,
  entry: CircularDiagnostic,
  token: string,
) {
  if (!trace) return;
  const redact = (value: string) =>
    (token ? value.split(token).join("[redacted]") : value)
      .replace(
        /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
        "[redacted]",
      )
      .replace(
        /("(?:access_token|refresh_token|token|jwt)"\s*:\s*")[^"]*/gi,
        "$1[redacted]",
      )
      .replace(
        /([?&](?:access_token|refresh_token|token|jwt|apikey)=)[^&\s"]+/gi,
        "$1[redacted]",
      );
  try {
    trace({
      ...entry,
      url: redact(entry.url),
      bodyPreview: redact(entry.bodyPreview).slice(0, 300),
    });
  } catch {
    /* Logging cannot break a request. */
  }
}

export function responseSummary(payload: unknown) {
  if (!payload || typeof payload !== "object") return {};
  const value = payload as Record<string, unknown>;
  const batch =
    value.batch && typeof value.batch === "object"
      ? (value.batch as Record<string, unknown>)
      : undefined;
  return {
    ...(typeof value.total === "number" ? { total: value.total } : {}),
    ...(Array.isArray(value.items) ? { itemCount: value.items.length } : {}),
    ...(typeof value.page === "number" ? { page: value.page } : {}),
    ...(typeof value.has_more === "boolean" ? { hasMore: value.has_more } : {}),
    ...(typeof batch?.job_count === "number"
      ? { batchJobCount: batch.job_count }
      : {}),
  };
}
