import { useCallback, useEffect, useSyncExternalStore } from "react";
import { recordRecommendationActivity } from "../lib/recommendations/api";
import { useAuth } from "./use-auth";
import { supabase } from "../lib/supabase";
import { createSavedStore } from "../lib/saved/store";
const saved = createSavedStore({
  async read(owner) {
    const { data, error } = await supabase
      .from("saved_jobs")
      .select("job_id")
      .eq("user_id", owner);
    if (error) throw error;
    return (data ?? []).map((row) => row.job_id as string);
  },
  async write(owner, job, selected) {
    const result = selected
      ? await supabase
          .from("saved_jobs")
          .upsert(
            { user_id: owner, job_id: job },
            { onConflict: "user_id,job_id" },
          )
      : await supabase
          .from("saved_jobs")
          .delete()
          .eq("user_id", owner)
          .eq("job_id", job);
    if (result.error) throw result.error;
    void recordRecommendationActivity(job, selected ? "saved" : "unsaved");
  },
});
supabase.auth.onAuthStateChange((_event, session) =>
  saved.setOwner(session?.user.id ?? null),
);
const EMPTY: string[] = [];
export function useSavedJobs() {
  const { userId, loading: authLoading } = useAuth();
  const state = useSyncExternalStore(
    saved.subscribe,
    saved.getSnapshot,
    saved.getSnapshot,
  );
  useEffect(() => {
    if (authLoading) return;
    saved.setOwner(userId);
    if (userId) void saved.load(userId);
  }, [userId, authLoading]);
  const ids = state.owner === userId ? state.ids : EMPTY;
  const refreshSaved = useCallback(async () => {
    if (userId) await saved.load(userId, true);
  }, [userId]);
  const toggleSave = useCallback(
    async (job: string) =>
      userId
        ? saved.toggle(userId, job)
        : { ok: false as const, reason: "not-signed-in" as const },
    [userId],
  );
  return {
    savedIds: ids,
    error: state.owner === userId ? state.error : null,
    loading:
      authLoading || (!!userId && (state.owner !== userId || state.loading)),
    isSaved: useCallback((job: string) => ids.includes(job), [ids]),
    toggleSave,
    canSave: !!userId,
    refreshSaved,
  };
}
