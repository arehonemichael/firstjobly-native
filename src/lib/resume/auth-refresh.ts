type Auth = {
  startAutoRefresh(): Promise<void>;
  stopAutoRefresh(): Promise<void>;
};
/** Supabase's supported native lifecycle hint; never signs out on network failure. */
export function nativeAuthState(auth: Auth, state: string) {
  const task =
    state === "active" ? auth.startAutoRefresh() : auth.stopAutoRefresh();
  void task.catch(() => undefined);
}
