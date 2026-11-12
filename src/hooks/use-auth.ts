import { useSyncExternalStore } from "react";
import { supabase } from "../lib/supabase";
import { createAuthSessionStore } from "../lib/auth-session-store";

const authSession = createAuthSessionStore(supabase);
export function useAuth() {
  const { session, loading, error } = useSyncExternalStore(
    authSession.subscribe,
    authSession.getSnapshot,
    authSession.getServerSnapshot,
  );
  const user = session?.user ?? null;
  return {
    session,
    user,
    userId: user?.id ?? null,
    loading,
    error,
    retry: authSession.retry,
    isAuthenticated: !!user,
  };
}
