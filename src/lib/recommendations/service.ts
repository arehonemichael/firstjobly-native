import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_PREFERENCES,
  RANKING_VERSION,
  type ActivityKind,
  type DismissReason,
  type FeedFilters,
  type FeedPage,
  type Preferences,
  type RankedJob,
} from "./contracts";
import {
  effectivePreferences,
  hasExplicitSignals,
  johannesburgDate,
  latestSafeJobs,
  rankJobs,
  type Candidate,
  type Signals,
} from "./engine";
import { RULES } from "./config";

export class RecommendationError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
  }
}
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
type LocalEvent = { jobId: string; kind: ActivityKind; at: string };
type LocalFeedback = {
  jobId: string;
  kind: "dismissed" | "more_like_this";
  at: string;
  reason?: DismissReason;
};
type LocalState = {
  settings: Partial<Preferences>;
  events: LocalEvent[];
  feedback: LocalFeedback[];
};
const emptyLocal = (): LocalState => ({
  settings: {},
  events: [],
  feedback: [],
});
const profileColumns =
  "first_name,last_name,email,phone,province,city,date_of_birth,address,about,highest_qualification,institution,field_of_study,year_completed,skills,languages,preferred_categories,preferred_job_types,preferred_province,preferred_city,available_immediately,willing_to_relocate,onboarding_completed";
const jobColumns =
  "id,slug,title,company_name,company_logo_url,company_id,city,province,category,job_type,experience_level,education_level,salary_min,salary_max,salary_period,closing_date,posted_at,apply_type,external_url,is_urgent,is_featured,is_active,requirements,approval_status";
const referenceColumns = "id,category,company_id,company_name";
const confirmedStatuses = new Set([
  "submitted",
  "viewed",
  "shortlisted",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]);
type Snapshot = {
  id: string;
  key: string;
  owner: string | null;
  expires: number;
  rows: RankedJob[];
  label: FeedPage["label"];
  personalized: boolean;
};

/** All remote reads/writes use the existing Data API and the caller's RLS session.
 * Extra controls are stored per account on this device, never in invented tables. */
export function createRecommendationService(
  client: SupabaseClient,
  storage: Storage,
  now = Date.now,
) {
  const snapshots = new Map<string, Snapshot>();
  const pending = new Map<string, Promise<Snapshot>>();
  let sequence = 0,
    revision = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let lastOwner: string | null | undefined;
  const profiles = new Map<
    string,
    { expires: number; data: Record<string, unknown> | null }
  >();
  const profileRequests = new Map<
    string,
    Promise<Record<string, unknown> | null>
  >();
  const invalidate = () => {
    revision++;
    snapshots.clear();
    pending.clear();
    profiles.clear();
    profileRequests.clear();
  };
  async function owner() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const id = data.session?.user.id ?? null;
    if (lastOwner !== id) {
      lastOwner = id;
      invalidate();
    }
    return id;
  }
  async function requireOwner() {
    const id = await owner();
    if (!id) throw new RecommendationError("SIGN_IN_REQUIRED");
    return id;
  }
  async function assertOwner(id: string | null) {
    if ((await owner()) !== id)
      throw new RecommendationError("ACCOUNT_CHANGED");
  }
  const keyFor = (id: string) =>
    `firstjobly:recommendations:${RANKING_VERSION}:${id}`;
  async function readLocal(id: string): Promise<LocalState> {
    const raw = await storage.getItem(keyFor(id));
    if (!raw) return emptyLocal();
    try {
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray(parsed.events) ||
        !Array.isArray(parsed.feedback) ||
        !parsed.settings ||
        typeof parsed.settings !== "object"
      )
        return emptyLocal();
      const cutoff = now() - RULES.behaviour.retentionDays * 86400000;
      const settings: Partial<Preferences> = {};
      for (const field of [
        "experienceLevels",
        "excludedCategories",
        "excludedEmployers",
      ] as const)
        if (Array.isArray(parsed.settings[field]))
          settings[field] = parsed.settings[field]
            .filter((v: unknown) => typeof v === "string")
            .slice(0, 30);
      for (const field of ["remoteOnly", "learningEnabled"] as const)
        if (typeof parsed.settings[field] === "boolean")
          settings[field] = parsed.settings[field];
      if (
        typeof parsed.settings.learnedResetAt === "string" &&
        Number.isFinite(Date.parse(parsed.settings.learnedResetAt))
      )
        settings.learnedResetAt = parsed.settings.learnedResetAt;
      return {
        settings,
        events: parsed.events
          .filter(
            (e: LocalEvent) =>
              typeof e.jobId === "string" && Date.parse(e.at) >= cutoff,
          )
          .slice(-300),
        feedback: parsed.feedback.filter(
          (e: LocalFeedback) =>
            typeof e.jobId === "string" &&
            ["dismissed", "more_like_this"].includes(e.kind),
        ),
      };
    } catch {
      return emptyLocal();
    }
  }
  function mutate(id: string, change: (state: LocalState) => void | boolean) {
    const work = queue
      .catch(() => undefined)
      .then(async () => {
        await assertOwner(id);
        const state = await readLocal(id);
        if (change(state) === false) return false;
        await storage.setItem(keyFor(id), JSON.stringify(state));
        invalidate();
        return true;
      });
    queue = work;
    return work;
  }
  async function profile(id: string): Promise<Record<string, unknown> | null> {
    const cached = profiles.get(id);
    if (cached && cached.expires > now()) return cached.data;
    const inFlight = profileRequests.get(id);
    if (inFlight) return inFlight;
    const ticket = revision;
    const request = (async () => {
      const { data, error } = await client
        .from("profiles")
        .select(profileColumns)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      const row = data as Record<string, unknown> | null;
      if (ticket === revision)
        profiles.set(id, { data: row, expires: now() + 60000 });
      return row;
    })();
    profileRequests.set(id, request);
    try {
      return await request;
    } finally {
      if (profileRequests.get(id) === request) profileRequests.delete(id);
    }
  }
  function preferences(
    p: Record<string, unknown> | null,
    local: LocalState,
  ): Preferences {
    const arrays = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : [];
    return {
      ...EMPTY_PREFERENCES,
      ...local.settings,
      categories: arrays(p?.preferred_categories),
      employmentTypes: arrays(p?.preferred_job_types),
      provinces:
        typeof p?.preferred_province === "string" && p.preferred_province
          ? [p.preferred_province]
          : [],
      cities:
        typeof p?.preferred_city === "string" && p.preferred_city
          ? [p.preferred_city]
          : [],
      useProfilePreferences: true,
    };
  }
  async function getPreferences() {
    const id = await requireOwner();
    const [p, local] = await Promise.all([profile(id), readLocal(id)]);
    await assertOwner(id);
    const prefs = preferences(p, local);
    return {
      preferences: prefs,
      hasSavedPreferences: !!(
        prefs.categories.length ||
        prefs.employmentTypes.length ||
        prefs.provinces.length ||
        prefs.cities.length
      ),
    };
  }
  async function savePreferences(p: Preferences) {
    const id = await requireOwner();
    if (p.provinces.length > 1 || p.cities.length > 1)
      throw new RecommendationError(
        "ONE_LOCATION",
        "Choose one preferred province and city.",
      );
    const { error } = await client
      .from("profiles")
      .update({
        preferred_categories: p.categories,
        preferred_job_types: p.employmentTypes,
        preferred_province: p.provinces[0] ?? null,
        preferred_city: p.cities[0] ?? null,
      })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error; // Preserve the server's maintenance/read-only message.
    await mutate(id, (s) => {
      s.settings = {
        ...s.settings,
        experienceLevels: p.experienceLevels,
        excludedCategories: p.excludedCategories,
        excludedEmployers: p.excludedEmployers,
        remoteOnly: p.remoteOnly,
        learningEnabled: p.learningEnabled,
      };
    });
  }
  async function build(
    id: string | null,
    filters: FeedFilters,
    latest: boolean,
    key: string,
  ): Promise<Snapshot> {
    const stamp = now(),
      version = revision;
    let query = client
      .from("jobs")
      .select(jobColumns)
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .or(`closing_date.is.null,closing_date.gte.${johannesburgDate(stamp)}`)
      .order("posted_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(300);
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.province) query = query.eq("province", filters.province);
    const privateInputs = async () => {
      if (!id) return null;
      const local = readLocal(id);
      const history = local.then((value) =>
        value.settings.learningEnabled === false || latest
          ? null
          : Promise.all([
              client
                .from("saved_jobs")
                .select("job_id,created_at")
                .eq("user_id", id)
                .order("created_at", { ascending: false })
                .limit(100),
              client
                .from("applications")
                .select("job_id,status,is_draft,applied_at")
                .eq("user_id", id)
                .order("applied_at", { ascending: false })
                .limit(100),
              client
                .from("job_views")
                .select("job_id,viewed_at")
                .eq("user_id", id)
                .order("viewed_at", { ascending: false })
                .limit(100),
            ]),
      );
      const [p, l, searches, experience, h] = await Promise.all([
        profile(id),
        local,
        client
          .from("saved_searches")
          .select("keyword,filters,notify")
          .eq("notify", true)
          .limit(300),
        client
          .from("work_experience")
          .select("start_date,end_date,currently_working")
          .eq("user_id", id)
          .order("start_date", { ascending: false })
          .limit(300),
        history,
      ]);
      for (const result of [searches, experience, ...(h ?? [])])
        if (result.error) throw result.error;
      return {
        p,
        l,
        searches: searches.data ?? [],
        experience: experience.data ?? [],
        saved: h?.[0].data ?? [],
        applications: h?.[1].data ?? [],
        views: h?.[2].data ?? [],
      };
    };
    // Independent private inputs begin alongside jobs, not after the candidate response.
    const [result, input] = await Promise.all([
      query.returns<Candidate[]>(),
      privateInputs(),
    ]);
    if (result.error) throw result.error;
    let candidates = (result.data ?? [])
      .filter(
        (j) =>
          typeof j.id === "string" &&
          typeof j.title === "string" &&
          typeof j.category === "string",
      )
      .map((j) => ({
        ...j,
        description: "",
        responsibilities: [],
        required_documents: [],
      }));
    const norm = (v: unknown) =>
      String(v ?? "")
        .toLowerCase()
        .trim();
    if (filters.city)
      candidates = candidates.filter((j) =>
        norm(j.city).includes(norm(filters.city)),
      );
    if (filters.q) {
      const words = norm(filters.q).split(/\s+/).filter(Boolean);
      candidates = candidates.filter((j) =>
        words.every((w) => norm(`${j.title} ${j.company_name}`).includes(w)),
      );
    }
    const signals: Signals = {
      userId: id,
      profile: null,
      preferences: { ...EMPTY_PREFERENCES },
      saved: [],
      applications: [],
      feedback: [],
      activity: [],
      experience: [],
      submittedIds: new Set(),
      dismissedIds: new Set(),
      savedSearches: [],
    };
    if (id && input) {
      // Completion/name/contact fields shared with Home are never scoring inputs.
      signals.profile = Object.fromEntries(
        [
          "preferred_categories",
          "preferred_job_types",
          "preferred_province",
          "preferred_city",
          "province",
          "skills",
          "field_of_study",
          "highest_qualification",
        ].map((k) => [k, input.p?.[k]]),
      );
      signals.preferences = preferences(input.p, input.l);
      signals.savedSearches = input.searches;
      signals.experience = input.experience;
      if (signals.experience.length === 300)
        signals.experience.push({
          start_date: null,
          end_date: null,
          currently_working: false,
        });
      signals.dismissedIds = new Set(
        input.l.feedback
          .filter((f) => f.kind === "dismissed")
          .map((f) => f.jobId),
      );
      const confirmed = input.applications.filter(
        (a) => a.is_draft === false && confirmedStatuses.has(a.status),
      );
      const refIds = [
        ...new Set([
          ...input.saved.map((r) => r.job_id),
          ...confirmed.map((r) => r.job_id),
          ...input.views.map((r) => r.job_id),
          ...input.l.events.map((r) => r.jobId),
          ...input.l.feedback
            .filter((f) => f.kind === "more_like_this")
            .map((r) => r.jobId),
        ]),
      ].slice(0, 300);
      const known = new Map<string, Candidate>(
        candidates.map((j) => [j.id, j]),
      );
      const missing = refIds.filter((r) => !known.has(r));
      // These depend on job IDs, but can run concurrently with each other.
      const [applied, references] = await Promise.all([
        candidates.length
          ? client
              .from("applications")
              .select("job_id,status,is_draft,applied_at")
              .eq("user_id", id)
              .in(
                "job_id",
                candidates.map((j) => j.id),
              )
              .limit(300)
          : Promise.resolve({ data: [], error: null }),
        missing.length
          ? client
              .from("jobs")
              .select(referenceColumns)
              .eq("approval_status", "approved")
              .in("id", missing)
              .limit(300)
              .returns<Candidate[]>()
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (applied.error) throw applied.error;
      if (references.error) throw references.error;
      signals.submittedIds = new Set(
        (applied.data ?? [])
          .filter(
            (a) => a.is_draft === false && confirmedStatuses.has(a.status),
          )
          .map((a) => a.job_id),
      );
      for (const j of references.data ?? []) known.set(j.id, j);
      const refs = (rows: { job_id: string; at: string }[]) =>
        rows.flatMap((r) => {
          const job = known.get(r.job_id);
          return job ? [{ job, occurredAt: r.at }] : [];
        });
      signals.saved = refs(
        input.saved.map((r) => ({ job_id: r.job_id, at: r.created_at })),
      );
      signals.applications = refs(
        confirmed.map((r) => ({ job_id: r.job_id, at: r.applied_at })),
      );
      signals.activity = [
        ...input.l.events.map((e) => ({
          job_id: e.jobId,
          at: e.at,
          kind: e.kind,
        })),
        ...input.views.map((e) => ({
          job_id: e.job_id,
          at: e.viewed_at,
          kind: "opened",
        })),
      ].flatMap((e) => refs([e]).map((r) => ({ ...r, kind: e.kind })));
      signals.feedback = input.l.feedback
        .filter((f) => f.kind === "more_like_this")
        .flatMap((f) =>
          refs([{ job_id: f.jobId, at: f.at }]).map((r) => ({
            ...r,
            kind: f.kind,
          })),
        );
    }
    await assertOwner(id);
    if (version !== revision) throw new RecommendationError("REFRESH_REQUIRED");
    let rows =
      latest || !id
        ? latestSafeJobs(candidates, signals, stamp)
        : rankJobs(candidates, signals, stamp);
    const personalized =
      !latest &&
      !!id &&
      rows.some((r) =>
        r.ranking.contributions.some(
          (c) => !["quality", "freshness"].includes(c.code),
        ),
      );
    if (!personalized && rows.length)
      rows = latestSafeJobs(
        rows.map((r) => r.job),
        signals,
        stamp,
      );
    const effective = effectivePreferences(signals);
    const label: FeedPage["label"] = !personalized
      ? "Latest opportunities"
      : effective.categories.length || effective.employmentTypes.length
        ? "Based on your selected interests"
        : hasExplicitSignals(signals) ||
            (Array.isArray(signals.profile?.skills) &&
              signals.profile.skills.length > 0) ||
            signals.savedSearches?.length
          ? "Based on your profile"
          : "Based on your activity";
    return {
      id: `${stamp}-${++sequence}`,
      key,
      owner: id,
      rows,
      expires: stamp + 180000,
      label,
      personalized,
    };
  }
  async function feed(
    filters: FeedFilters = {},
    cursor: string | null = null,
    latest = false,
  ): Promise<FeedPage> {
    const id = await owner();
    const key = JSON.stringify([
      RANKING_VERSION,
      id,
      filters,
      latest,
      johannesburgDate(now()),
    ]);
    let snapshot: Snapshot | undefined,
      offset = 0;
    if (cursor) {
      const [token, start] = cursor.split(":");
      offset = Number(start);
      snapshot = snapshots.get(key);
      if (
        !snapshot ||
        snapshot.id !== token ||
        snapshot.expires <= now() ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 300
      )
        throw new RecommendationError("REFRESH_REQUIRED");
    } else {
      snapshot = snapshots.get(key);
      if (!snapshot || snapshot.expires <= now()) {
        let promise = pending.get(key);
        if (!promise) {
          promise = build(id, filters, latest, key);
          pending.set(key, promise);
        }
        try {
          snapshot = await promise;
          snapshots.set(key, snapshot);
          if (snapshots.size > 12)
            snapshots.delete(snapshots.keys().next().value!);
        } finally {
          if (pending.get(key) === promise) pending.delete(key);
        }
      }
    }
    await assertOwner(id);
    const next = offset + RULES.pageSize;
    return {
      items: snapshot.rows.slice(offset, next),
      nextCursor: next < snapshot.rows.length ? `${snapshot.id}:${next}` : null,
      version: RANKING_VERSION,
      label: snapshot.label,
      personalized: snapshot.personalized,
      sparse: snapshot.rows.length < 10,
      total: snapshot.rows.length,
      candidateLimit: 300,
    };
  }
  return {
    feed,
    async readHomeProfile(id: string) {
      await assertOwner(id);
      const data = await profile(id);
      await assertOwner(id);
      return data;
    },
    peek(ownerId: string | null, filters: FeedFilters = {}) {
      if (lastOwner !== ownerId) return null;
      const key = JSON.stringify([
        RANKING_VERSION,
        ownerId,
        filters,
        false,
        johannesburgDate(now()),
      ]);
      const snapshot = snapshots.get(key);
      if (!snapshot || snapshot.expires <= now()) return null;
      const next = RULES.pageSize;
      return {
        items: snapshot.rows.slice(0, next),
        nextCursor:
          next < snapshot.rows.length ? `${snapshot.id}:${next}` : null,
        version: RANKING_VERSION,
        label: snapshot.label,
        personalized: snapshot.personalized,
        sparse: snapshot.rows.length < 10,
        total: snapshot.rows.length,
        candidateLimit: 300,
      } as FeedPage;
    },
    getPreferences,
    savePreferences,
    invalidate,
    async resetLearning() {
      const id = await requireOwner();
      await mutate(id, (s) => {
        s.events = [];
        s.feedback = s.feedback.filter((f) => f.kind === "dismissed");
        s.settings.learnedResetAt = new Date(now()).toISOString();
      });
    },
    async feedback(
      jobId: string,
      kind: "dismissed" | "more_like_this" | "undo",
      reason?: DismissReason,
    ) {
      const id = await requireOwner();
      await mutate(id, (s) => {
        s.feedback = s.feedback.filter(
          (f) =>
            f.jobId !== jobId || (kind === "undo" && f.kind !== "dismissed"),
        );
        if (kind !== "undo")
          s.feedback.push({
            jobId,
            kind,
            reason,
            at: new Date(now()).toISOString(),
          });
      });
    },
    async activity(jobId: string, kind: ActivityKind) {
      const id = await owner();
      if (!id) return;
      return mutate(id, (s) => {
        if (s.settings.learningEnabled === false) return false;
        const at = new Date(now()).toISOString();
        if (
          s.events.some(
            (e) =>
              e.jobId === jobId &&
              e.kind === kind &&
              e.at.slice(0, 10) === at.slice(0, 10),
          )
        )
          return false;
        if (
          !s.events.some(
            (e) =>
              e.jobId === jobId &&
              e.kind === kind &&
              e.at.slice(0, 10) === at.slice(0, 10),
          )
        )
          s.events.push({ jobId, kind, at });
        s.events = s.events.slice(-300);
      });
    },
  };
}
