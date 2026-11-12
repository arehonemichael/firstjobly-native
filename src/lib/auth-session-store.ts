import type { Session, SupabaseClient } from "@supabase/supabase-js";

type AuthClient = {
  auth: Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange">;
};
type Snapshot = Readonly<{
  session: Session | null;
  loading: boolean;
  error: string | null;
}>;
const INITIAL: Snapshot = Object.freeze({
  session: null,
  loading: true,
  error: null,
});
const RESTORE_ERROR =
  "We couldn’t restore your session. Check your connection and try again.";

/** One restoration and auth subscription for the app, shared by every useAuth.
 * A timeout is a recoverable failure, never permission to enter with unknown auth. */
export function createAuthSessionStore(client: AuthClient, timeoutMs = 10000) {
  let snapshot = INITIAL;
  let started = false,
    restoring = false,
    generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let subscription: { unsubscribe(): void } | undefined;
  let pendingEvent: { session: Session | null } | null = null;
  const listeners = new Set<() => void>();
  function publish(next: Snapshot) {
    snapshot = Object.freeze(next);
    listeners.forEach((listener) => listener());
  }
  function clearDeadline() {
    clearTimeout(timer);
    timer = undefined;
  }
  function restore() {
    if (restoring) return;
    restoring = true;
    pendingEvent = null;
    const ticket = ++generation;
    publish({ session: null, loading: true, error: null });
    clearDeadline();
    timer = setTimeout(() => {
      if (ticket !== generation) return;
      generation++;
      restoring = false;
      timer = undefined;
      publish({ session: null, loading: false, error: RESTORE_ERROR });
    }, timeoutMs);
    void Promise.resolve()
      .then(() => client.auth.getSession())
      .then(({ data, error }) => {
        if (ticket !== generation) return;
        clearDeadline();
        restoring = false;
        if (error) {
          publish({ session: null, loading: false, error: RESTORE_ERROR });
          return;
        }
        const session = pendingEvent ? pendingEvent.session : data.session;
        pendingEvent = null;
        publish({ session, loading: false, error: null });
      })
      .catch(() => {
        if (ticket !== generation) return;
        clearDeadline();
        restoring = false;
        publish({ session: null, loading: false, error: RESTORE_ERROR });
      });
  }
  function start() {
    if (started) return;
    started = true;
    restoring = true;
    subscription = client.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is also emitted by the SDK while getSession resolves.
      // Wait for that result, including its error, instead of racing it to ready.
      if (restoring) {
        if (event !== "INITIAL_SESSION") pendingEvent = { session };
        return;
      }
      if (snapshot.error || event === "INITIAL_SESSION") return;
      publish({ session, loading: false, error: null });
    }).data.subscription;
    restoring = false;
    restore();
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL,
    subscribe(listener: () => void) {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
      };
    },
    retry: restore,
    // The SDK subscription intentionally lives at app scope, not per screen.
    // Tests/explicit teardown can dispose it without leaking timers or callbacks.
    dispose() {
      generation++;
      clearDeadline();
      subscription?.unsubscribe();
      subscription = undefined;
      listeners.clear();
      started = false;
      restoring = false;
      snapshot = INITIAL;
    },
  };
}
