import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsFocused } from "./use-is-focused";

import { useAuth } from "./use-auth";
import { supabase } from "../lib/supabase";

const SAVED_STALE_MS = 7 * 60 * 1000;

type SavedMutation = {
  userId: string;
  jobId: string;
  saved: boolean;
};

const savedMutationListeners = new Set<(mutation: SavedMutation) => void>();

function publishSavedMutation(mutation: SavedMutation) {
  savedMutationListeners.forEach((listener) => listener(mutation));
}

export function useSavedJobs() {
  const { userId, loading: authLoading } = useAuth();
  const isFocused = useIsFocused();

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFetchedAt = useRef(0);
  const inFlight = useRef(false);

  const loadSaved = useCallback(async (force = false) => {
    if (authLoading || inFlight.current) return;

    if (!userId) {
      setSavedIds([]);
      setLoading(false);
      lastFetchedAt.current = Date.now();
      return;
    }

    if (!force && Date.now() - lastFetchedAt.current < SAVED_STALE_MS) return;

    inFlight.current = true;
    try {
      setLoading((current) => current && savedIds.length === 0);

      const { data, error } = await supabase
        .from("saved_jobs")
        .select("job_id")
        .eq("user_id", userId);

      if (error) throw error;

      setSavedIds((data ?? []).map((row) => row.job_id));
      lastFetchedAt.current = Date.now();
    } catch (error) {
      console.error("Could not load saved jobs:", error);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [userId, authLoading, savedIds.length]);

  useEffect(() => {
    lastFetchedAt.current = 0;
    void loadSaved(true);
  }, [userId, authLoading]);

  useEffect(() => {
    const listener = (mutation: SavedMutation) => {
      if (!userId || mutation.userId !== userId) return;
      setSavedIds((current) =>
        mutation.saved
          ? current.includes(mutation.jobId)
            ? current
            : [...current, mutation.jobId]
          : current.filter((id) => id !== mutation.jobId),
      );
      lastFetchedAt.current = Date.now();
      setLoading(false);
    };

    savedMutationListeners.add(listener);
    return () => {
      savedMutationListeners.delete(listener);
    };
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadSaved(false);
    }, [loadSaved]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && isFocused) void loadSaved(false);
    });
    return () => subscription.remove();
  }, [isFocused, loadSaved]);

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
      const nextSaved = !currentlySaved;

      // Optimistic UI: reflect the user's tap immediately in this hook instance.
      setSavedIds((current) =>
        currentlySaved
          ? current.filter((id) => id !== jobId)
          : current.includes(jobId)
            ? current
            : [...current, jobId],
      );

      try {
        if (currentlySaved) {
          const { error } = await supabase
            .from("saved_jobs")
            .delete()
            .eq("user_id", userId)
            .eq("job_id", jobId);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("saved_jobs")
            .insert({
              user_id: userId,
              job_id: jobId,
            });

          if (error) throw error;
        }

        lastFetchedAt.current = Date.now();
        // Keep Home, Job Detail and Saved in sync without bypassing the normal
        // staleness window with another network request.
        publishSavedMutation({ userId, jobId, saved: nextSaved });
        return {
          ok: true as const,
          saved: nextSaved,
        };
      } catch (error) {
        // Roll back the optimistic state if persistence failed.
        setSavedIds((current) =>
          currentlySaved
            ? current.includes(jobId)
              ? current
              : [...current, jobId]
            : current.filter((id) => id !== jobId),
        );
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
    refreshSaved: () => loadSaved(true),
  };
}
