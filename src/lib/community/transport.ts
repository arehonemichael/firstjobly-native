export class CommunityError extends Error {
  constructor(
    message: string,
    public code = "UNKNOWN",
    public retryAt = 0,
  ) {
    super(message);
  }
}
type Session = {
  access_token: string;
  expires_at?: number;
  user: { id: string };
};
type Auth = {
  getSession(): Promise<{ data: { session: Session | null }; error?: unknown }>;
  refreshSession(): Promise<{
    data: { session: Session | null };
    error?: unknown;
  }>;
};
export type Action =
  | "viewer-state"
  | "list-posts"
  | "get-post"
  | "list-comments"
  | "create-post"
  | "edit-post"
  | "create-comment"
  | "edit-comment"
  | "toggle-vote"
  | "toggle-save"
  | "toggle-follow"
  | "delete-post"
  | "delete-comment"
  | "report";
const READS = new Set<Action>([
  "viewer-state",
  "list-posts",
  "get-post",
  "list-comments",
]);
/** Only an explicit authentication rejection is replayed. Network/5xx/timeout
 * results never repeat a mutation whose server outcome could be unknown. */
export function createCommunityTransport(
  auth: Auth,
  send: typeof fetch = fetch,
  now = Date.now,
) {
  let refreshing: Promise<Session | null> | null = null;
  const blockedUntil = new Map<string, number>();
  async function refresh() {
    if (!refreshing)
      refreshing = auth
        .refreshSession()
        .then((r) => (r.error ? null : r.data.session))
        .catch(() => null)
        .finally(() => {
          refreshing = null;
        });
    return refreshing;
  }
  return async function request<T>(
    owner: string,
    action: Action,
    data: Record<string, unknown> = {},
  ): Promise<T> {
    let session = (await auth.getSession()).data.session;
    const assertOwner = (s: Session | null) => {
      if (!s || s.user.id !== owner)
        throw new CommunityError("Please sign in again.", "AUTH_REQUIRED");
    };
    assertOwner(session);
    let refreshed = false;
    if (session!.expires_at && session!.expires_at * 1000 <= now() + 30000) {
      session = await refresh();
      refreshed = true;
      assertOwner(session);
    }
    const rateKey = `${owner}:${action}`;
    if ((blockedUntil.get(rateKey) || 0) > now())
      throw new CommunityError(
        "Please wait before trying again.",
        "RATE_LIMITED",
        blockedUntil.get(rateKey),
      );
    for (;;) {
      // Re-read before sending so an account switch cannot send the old token.
      const current = (await auth.getSession()).data.session;
      assertOwner(current);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      let response: Response;
      let payload: { error?: string; code?: string } & T;
      try {
        response = await send("https://firstjobly.co.za/api/community", {
          method: "POST",
          redirect: "error",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session!.access_token}`,
          },
          body: JSON.stringify({ action, data }),
        });
        payload = await response.json();
      } catch {
        throw new CommunityError(
          READS.has(action)
            ? "Couldn't connect. Check your connection and try again."
            : "We couldn't confirm the result. Your text is preserved. Check the discussion or My posts before trying again.",
          "NETWORK",
        );
      } finally {
        clearTimeout(timeout);
      }
      assertOwner((await auth.getSession()).data.session);
      if (
        (response.status === 401 || payload.code === "AUTH_REQUIRED") &&
        !refreshed
      ) {
        session = await refresh();
        refreshed = true;
        assertOwner(session);
        continue;
      }
      if (!response.ok) {
        let retryAt = 0;
        if (response.status === 429) {
          const header = response.headers.get("Retry-After");
          const seconds = Number(header);
          retryAt =
            now() +
            (header && Number.isFinite(seconds)
              ? Math.max(0, seconds) * 1000
              : Math.max(0, Date.parse(header || "") - now()) || 60000);
          blockedUntil.set(rateKey, retryAt);
        }
        throw new CommunityError(
          payload.error || "Something went wrong. Please try again.",
          payload.code ||
            (response.status === 401 ? "AUTH_REQUIRED" : "UNKNOWN"),
          retryAt,
        );
      }
      return payload;
    }
  };
}
