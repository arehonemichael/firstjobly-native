import { useSyncExternalStore } from "react";
import { hotJobs } from "../lib/hot-jobs/api";
export function useHotJobs() {
  const state = useSyncExternalStore(
    hotJobs.subscribe,
    hotJobs.getSnapshot,
    hotJobs.getSnapshot,
  );
  return { ...state, reload: () => hotJobs.load(true) };
}
