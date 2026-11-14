import { subscribeHomeResume } from "../lib/resume/events";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { getHomeProfile } from "../lib/recommendations/api";
import { computeProfileCompletion } from "../lib/profile-contract";

export type HomeProfile = {
  first_name?: string;
  preferred_province?: string;
  preferred_city?: string;
  preferred_job_types?: string[];
} & Record<string, unknown>;
export type HomeApplication = {
  id: string;
  is_draft: boolean;
  status: string;
  jobs: { id: string; title: string; company_name: string } | null;
};
type Summary = {
  userId: string;
  profile: HomeProfile | null;
  completion: number | null;
  savedCount: number | null;
  applications: HomeApplication[] | null;
  failed: boolean;
};

/** Refresh when returning from profile editing, saving a job, or applying.
 * A failed query remains unknown; it must never become a fabricated zero. */
export function useHomeSummary(userId: string | null) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(
    () => subscribeHomeResume(() => setRevision((value) => value + 1)),
    [],
  );
  useFocusEffect(
    useCallback(() => {
      void revision; // Explicit retry invalidates this focused read.
      if (!userId) {
        setSummary(null);
        setLoading(false);
        return;
      }
      let active = true;
      setLoading(true);
      // Publish independent sections as they arrive. Optional drafts must not
      // gate the greeting/profile. Keep known content during a focused refresh.
      const empty: Summary = {
        userId,
        profile: null,
        completion: null,
        savedCount: null,
        applications: null,
        failed: false,
      };
      setSummary((old) =>
        old?.userId === userId ? { ...old, failed: false } : empty,
      );
      const publish = (patch: Partial<Summary>) => {
        if (active)
          setSummary((old) => ({
            ...(old?.userId === userId ? old : empty),
            ...patch,
          }));
      };
      const settle = async <T>(
        task: PromiseLike<T>,
        apply: (result: T) => void,
      ) => {
        try {
          apply(await task);
        } catch {
          publish({ failed: true });
        }
      };
      const profile = getHomeProfile(userId).then((data) => {
        publish({ profile: data });
        return data;
      });
      void Promise.allSettled([
        settle(
          Promise.all([
            profile,
            supabase
              .from("work_experience")
              .select("user_id")
              .eq("user_id", userId)
              .limit(1),
            supabase
              .from("user_documents")
              .select("kind")
              .eq("user_id", userId),
          ]),
          ([data, experience, documents]) => {
            if (experience.error || documents.error)
              throw Error("Profile details unavailable");
            publish({
              completion: computeProfileCompletion(
                data,
                experience.data ?? [],
                documents.data ?? [],
              ),
            });
          },
        ),
        settle(
          supabase
            .from("saved_jobs")
            .select("job_id", { count: "exact", head: true })
            .eq("user_id", userId),
          (saved) => {
            if (saved.error) throw saved.error;
            publish({ savedCount: saved.count });
          },
        ),
        settle(
          supabase
            .from("applications")
            .select("id,is_draft,status,jobs!inner(id,title,company_name)")
            .eq("user_id", userId)
            .eq("is_draft", true)
            .order("applied_at", { ascending: false })
            .limit(1),
          (applications) => {
            if (applications.error) throw applications.error;
            publish({
              applications: applications.data as unknown as HomeApplication[],
            });
          },
        ),
      ]).finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [userId, revision]),
  );
  return {
    summary: summary?.userId === userId ? summary : null,
    loading,
    retry: () => setRevision((value) => value + 1),
  };
}
