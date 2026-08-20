import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./use-auth";
import { supabase } from "../lib/supabase";

export function useSavedJobs() {
  const { userId, loading: authLoading } = useAuth();

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = useCallback(async () => {
    if (authLoading) return;

    if (!userId) {
      setSavedIds([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("saved_jobs")
        .select("job_id")
        .eq("user_id", userId);

      if (error) throw error;

      setSavedIds((data ?? []).map((row) => row.job_id));
    } catch (error) {
      console.error("Could not load saved jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, authLoading]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const isSaved = useCallback(
    (jobId: string) => savedIds.includes(jobId),
    [savedIds]
  );

  const toggleSave = useCallback(
    async (jobId: string) => {
      if (!userId) {
        return {
          ok: false as const,
          reason: "not-signed-in" as const,
        };
      }

      const currentlySaved = savedIds.includes(jobId);

      try {
        if (currentlySaved) {
          const { error } = await supabase
            .from("saved_jobs")
            .delete()
            .eq("user_id", userId)
            .eq("job_id", jobId);

          if (error) throw error;

          setSavedIds((current) =>
            current.filter((id) => id !== jobId)
          );

          return {
            ok: true as const,
            saved: false as const,
          };
        }

        const { error } = await supabase
          .from("saved_jobs")
          .insert({
            user_id: userId,
            job_id: jobId,
          });

        if (error) throw error;

        setSavedIds((current) =>
          current.includes(jobId)
            ? current
            : [...current, jobId]
        );

        return {
          ok: true as const,
          saved: true as const,
        };
      } catch (error) {
        console.error("Could not update saved job:", error);

        return {
          ok: false as const,
          reason: "error" as const,
        };
      }
    },
    [savedIds, userId]
  );

  return {
    savedIds,
    isSaved,
    toggleSave,
    loading,
    canSave: !!userId,
    refreshSaved: loadSaved,
  };
}

