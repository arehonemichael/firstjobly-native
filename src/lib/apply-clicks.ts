import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";

const HOT_JOB_CACHE_MS = 5 * 60 * 1000;
const ANONYMOUS_ID_KEY = "firstjobly.apply-clicks.anonymous-id.v1";

let hotJobsCache: { expiresAt: number; value: Set<string> } | null = null;
let hotJobsInFlight: Promise<Set<string>> | null = null;

function makeAnonymousId() {
  // Persisted installation-scoped identifier. It is intentionally not tied to
  // hardware identifiers or personal data.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export async function getApplyAnonymousId(): Promise<string> {
  const existing = await AsyncStorage.getItem(ANONYMOUS_ID_KEY);
  if (existing) return existing;

  const created = makeAnonymousId();
  await AsyncStorage.setItem(ANONYMOUS_ID_KEY, created);
  return created;
}

export async function trackApplyClick(jobId: string, userId: string | null): Promise<void> {
  try {
    const anonymousId = await getApplyAnonymousId();
    const { error } = await supabase.from("apply_clicks").insert({
      job_id: jobId,
      user_id: userId,
      anonymous_id: anonymousId,
    });

    if (error) throw error;
    // A new event can change hot status, so expire the local aggregate cache.
    hotJobsCache = null;
  } catch (error) {
    // Analytics must never block the user's Apply action.
    console.warn("Apply click tracking failed:", error);
  }
}

export async function getHotJobIds(force = false): Promise<Set<string>> {
  const now = Date.now();
  if (!force && hotJobsCache && hotJobsCache.expiresAt > now) return hotJobsCache.value;
  if (!force && hotJobsInFlight) return hotJobsInFlight;

  const request: Promise<Set<string>> = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_hot_job_ids");

      if (error) throw error;

      const ids = new Set<string>(
        (data ?? [])
          .map((row: { job_id?: string | null }) => row.job_id)
          .filter(
            (value: string | null | undefined): value is string =>
              Boolean(value),
          ),
      );

      hotJobsCache = {
        expiresAt: Date.now() + HOT_JOB_CACHE_MS,
        value: ids,
      };

      return ids;
    } catch (error: unknown) {
      console.warn("Hot job lookup failed:", error);
      return hotJobsCache?.value ?? new Set<string>();
    } finally {
      hotJobsInFlight = null;
    }
  })();
  hotJobsInFlight = request;
  return request;
}
