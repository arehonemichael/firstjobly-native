import { useCallback, useState } from "react";
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
      void (async () => {
        try {
          const [profile, experience, documents, saved, applications] =
            await Promise.all([
              getHomeProfile(userId)
                .then((data) => ({ data, error: null }))
                .catch((error) => ({ data: null, error })),
              supabase
                .from("work_experience")
                .select("user_id")
                .eq("user_id", userId)
                .limit(1),
              supabase
                .from("user_documents")
                .select("kind")
                .eq("user_id", userId),
              supabase
                .from("saved_jobs")
                .select("job_id", { count: "exact", head: true })
                .eq("user_id", userId),
              supabase
                .from("applications")
                .select("id,is_draft,status,jobs!inner(id,title,company_name)")
                .eq("user_id", userId)
                .eq("is_draft", true)
                .order("applied_at", { ascending: false })
                .limit(1),
            ]);
          if (!active) return;
          setSummary({
            userId,
            profile: profile.error ? null : profile.data,
            completion:
              profile.error || experience.error || documents.error
                ? null
                : computeProfileCompletion(
                    profile.data,
                    experience.data ?? [],
                    documents.data ?? [],
                  ),
            savedCount: saved.error ? null : saved.count,
            applications: applications.error
              ? null
              : (applications.data as unknown as HomeApplication[]),
            failed: [profile, experience, documents, saved, applications].some(
              (result) => !!result.error,
            ),
          });
        } catch {
          if (active)
            setSummary({
              userId,
              profile: null,
              completion: null,
              savedCount: null,
              applications: null,
              failed: true,
            });
        } finally {
          if (active) setLoading(false);
        }
      })();
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
