import type { Job } from "../jobs";
import { JOB_LIST_COLUMNS } from "../jobs";
import { johannesburgDate } from "../recommendations/engine";
export type HotJobSource = Omit<
  Job,
  "description" | "requirements" | "responsibilities" | "required_documents"
> & { approval_status: string };
export type HotJob = Job & {
  approval_status: string;
  activityCount: number;
  activityRefreshedAt: number;
};
export type HotState = {
  jobs: HotJob[];
  loading: boolean;
  error: string | null;
  asOf: number;
};
type CacheRow = {
  job_id: string;
  rank: number;
  click_count: number | string;
  refreshed_at: string;
};
export type HotRules = {
  enabled: boolean;
  minimumActivity: number;
  maxJobs: number;
  cacheMs: number;
  maximumAgeMs: number;
};
export function hotJobOpen(
  job: Pick<HotJob, "is_active" | "approval_status" | "closing_date">,
  now: number,
) {
  return (
    job.is_active === true &&
    job.approval_status === "approved" &&
    (!job.closing_date ||
      (/^\d{4}-\d{2}-\d{2}$/.test(job.closing_date) &&
        job.closing_date >= johannesburgDate(now)))
  );
}
export function createHotJobsService(
  ports: {
    onActive?(callback: () => void): () => void;
    cache(): PromiseLike<{ data: CacheRow[] | null; error: unknown }>;
    jobs(ids: string[]): PromiseLike<{
      data: HotJobSource[] | null;
      error: unknown;
    }>;
  },
  rules: HotRules,
  now = Date.now,
) {
  let state: HotState = { jobs: [], loading: false, error: null, asOf: now() };
  let expires = 0,
    day = "";
  let pending: Promise<HotState> | null = null;
  let attempted = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();
  let stopActive: (() => void) | undefined;
  function publish(next: Omit<HotState, "asOf">) {
    state = { ...next, asOf: now() };
    listeners.forEach((fn) => fn());
  }
  function valid(jobs: HotJob[]) {
    return jobs.filter(
      (job) =>
        hotJobOpen(job, now()) &&
        now() - job.activityRefreshedAt <= rules.maximumAgeMs,
    );
  }
  async function load(force = false): Promise<HotState> {
    if (!rules.enabled) return state;
    if (pending) return pending;
    if (!force && now() < expires && day === johannesburgDate(now()))
      return state;
    const retained = valid(state.jobs);
    publish({
      jobs: retained,
      loading: !retained.length && (!attempted || force),
      error: force ? null : state.error,
    });
    attempted = true;
    pending = (async () => {
      try {
        const cache = await ports.cache();
        if (cache.error || !cache.data) throw Error("ranking");
        const rows = [...cache.data]
          .filter(
            (row) =>
              Number.isInteger(row.rank) &&
              row.rank >= 1 &&
              row.rank <= rules.maxJobs &&
              Number(row.click_count) >= rules.minimumActivity &&
              Number.isFinite(Number(row.click_count)) &&
              Number.isFinite(Date.parse(row.refreshed_at)) &&
              now() - Date.parse(row.refreshed_at) <= rules.maximumAgeMs &&
              Date.parse(row.refreshed_at) <= now() + 60000,
          )
          .sort((a, b) => a.rank - b.rank || a.job_id.localeCompare(b.job_id))
          .slice(0, rules.maxJobs);
        const unique = [
          ...new Map(rows.map((row) => [row.job_id, row])).values(),
        ];
        let jobs: HotJob[] = [];
        if (unique.length) {
          const response = await ports.jobs(unique.map((row) => row.job_id));
          if (response.error || !response.data) throw Error("jobs");
          const byId = new Map(response.data.map((job) => [job.id, job]));
          jobs = unique.flatMap((row) => {
            const job = byId.get(row.job_id);
            return job && hotJobOpen(job, now())
              ? [
                  {
                    ...job,
                    description: "",
                    requirements: [],
                    responsibilities: [],
                    required_documents: [],
                    activityCount: Number(row.click_count),
                    activityRefreshedAt: Date.parse(row.refreshed_at),
                  },
                ]
              : [];
          });
        }
        expires = now() + rules.cacheMs;
        day = johannesburgDate(now());
        publish({ jobs, loading: false, error: null });
      } catch {
        expires = now() + 30000;
        day = johannesburgDate(now());
        publish({
          jobs: valid(state.jobs),
          loading: false,
          error: "Trending opportunities couldn't load. Please try again.",
        });
      }
      return state;
    })().finally(() => {
      pending = null;
    });
    return pending;
  }
  return {
    getSnapshot: () => state,
    load,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1 && rules.enabled) {
        void load();
        stopActive = ports.onActive?.(() => void load());
        timer = setInterval(() => void load(), 30000);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearInterval(timer);
          timer = undefined;
          stopActive?.();
          stopActive = undefined;
        }
      };
    },
  };
}
export const HOT_JOB_COLUMNS = JOB_LIST_COLUMNS.split(",")
  .filter((name) => name !== "description")
  .concat("approval_status")
  .join(",");
