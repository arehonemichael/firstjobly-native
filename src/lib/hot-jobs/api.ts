import { AppState } from "react-native";
import { supabase } from "../supabase";
import { HOT_RULES } from "./config";
import {
  createHotJobsService,
  HOT_JOB_COLUMNS,
  type HotJobSource,
} from "./service";
export const hotJobs = createHotJobsService(
  {
    onActive: (callback) => {
      const listener = AppState.addEventListener("change", (next) => {
        if (next === "active") callback();
      });
      return () => listener.remove();
    },
    async cache() {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 8000);
      try {
        return await supabase
          .from("hot_job_cache")
          .select("job_id,rank,click_count,refreshed_at")
          .order("rank")
          .order("job_id")
          .limit(HOT_RULES.maxJobs)
          .abortSignal(controller.signal);
      } finally {
        clearTimeout(timer);
      }
    },
    async jobs(ids) {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 8000);
      try {
        return await supabase
          .from("jobs")
          .select(HOT_JOB_COLUMNS)
          .in("id", ids)
          .eq("is_active", true)
          .eq("approval_status", "approved")
          .returns<HotJobSource[]>()
          .abortSignal(controller.signal);
      } finally {
        clearTimeout(timer);
      }
    },
  },
  HOT_RULES,
);
