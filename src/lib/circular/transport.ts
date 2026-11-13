export class CircularError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAt = 0,
  ) {
    super(message);
  }
}
type Session = { access_token: string; user: { id: string } };
type Auth = {
  getSession(): Promise<{ data: { session: Session | null }; error?: unknown }>;
  refreshSession(): Promise<{
    data: { session: Session | null };
    error?: unknown;
  }>;
};
export function createCircularTransport(
  auth: Auth,
  send: typeof fetch = fetch,
  now: () => number = Date.now,
) {
  const blocked = new Map<string, number>();
  let refreshing: Promise<Session | null> | null = null;
  async function session() {
    const { data, error } = await auth.getSession();
    if (error || !data.session)
      throw new CircularError("Please sign in again.", 401);
    return data.session;
  }
  async function request<T>(
    owner: string,
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    if (
      !/^\/(circular-jobs(?:\/[a-zA-Z0-9_-]+(?:\/(?:save|apply-intent))?)?|circular-batches\/latest|circular-alerts)(?:\?[^#]*)?$/.test(
        path,
      )
    )
      throw new CircularError("Invalid government jobs request.");
    const blockedUntil = blocked.get(owner) || 0;
    if (blockedUntil > now())
      throw new CircularError(
        "Too many requests. Please try again in a minute.",
        429,
        blockedUntil,
      );
    let current = await session();
    if (current.user.id !== owner)
      throw new CircularError(
        "Your account changed. Please reopen this screen.",
        401,
      );
    for (let attempt = 0; attempt < 2; attempt++) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 20000);
      let response: Response;
      let payload: unknown;
      try {
        response = await send("https://firstjobly.co.za/api/app" + path, {
          method,
          headers: {
            Authorization: "Bearer " + current.access_token,
            "x-fj-token": current.access_token,
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: abort.signal,
          redirect: "error",
        });
        payload = await response.json().catch(() => null);
      } catch {
        throw new CircularError(
          "Could not connect. Check your connection and try again.",
        );
      } finally {
        clearTimeout(timer);
      }
      const latest = await session();
      if (latest.user.id !== owner)
        throw new CircularError(
          "Your account changed. Please reopen this screen.",
          401,
        );
      if (response.status === 401 && attempt === 0) {
        refreshing ??= auth
          .refreshSession()
          .then((r) => (r.error ? null : r.data.session))
          .catch(() => null)
          .finally(() => {
            refreshing = null;
          });
        const refreshed = await refreshing;
        if (!refreshed || refreshed.user.id !== owner)
          throw new CircularError("Please sign in again.", 401);
        current = refreshed;
        continue;
      }
      if (!response.ok) {
        if (response.status === 429) {
          blocked.set(owner, now() + 60000);
        }
        throw new CircularError(
          typeof (payload as { error?: unknown })?.error === "string"
            ? (payload as { error: string }).error
            : "Something went wrong. Please try again.",
          response.status,
          response.status === 429 ? blocked.get(owner)! : 0,
        );
      }
      if (payload === null)
        throw new CircularError(
          "Could not read the response. Please try again.",
        );
      return payload as T;
    }
    throw new CircularError("Please sign in again.", 401);
  }
  return { request };
}
