import { openClosingDateFilter } from "./job-availability";
import { supabase } from "./supabase";
import type { Job } from "./jobs";

export type RecommendationFilter = {
  location?: string | null;
  role?: string | null;
  category?: string | null;
};

type ProfileSignals = {
  skills: string[];
  preferredJobTypes: string[];
  city: string | null;
  province: string | null;
};

type LocationTarget = {
  city: string | null;
  province: string | null;
};

type HistorySignals = {
  appliedIds: Set<string>;
  savedIds: Set<string>;
  categories: Map<string, number>;
  companies: Map<string, number>;
  salaryMidpoints: number[];
};

type JobRow = Job & {
  created_at?: string | null;
  requirements?: string[] | null;
};

const HOME_JOB_COLUMNS = [
  "id",
  "slug",
  "title",
  "company_name",
  "company_logo_url",
  "company_id",
  "city",
  "province",
  "category",
  "job_type",
  "experience_level",
  "education_level",
  "salary_min",
  "salary_max",
  "salary_period",
  "closing_date",
  "posted_at",
  "created_at",
  "apply_type",
  "external_url",
  "is_urgent",
  "is_featured",
  "is_active",
  "description",
  "requirements",
].join(",");

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+.#\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (value: unknown) =>
  new Set(
    normalize(value)
      .split(" ")
      .map((item) => item.trim())
      .filter((item) => item.length >= 2),
  );

function midpoint(job: Pick<JobRow, "salary_min" | "salary_max">) {
  if (job.salary_min != null && job.salary_max != null) {
    return (job.salary_min + job.salary_max) / 2;
  }
  return job.salary_min ?? job.salary_max ?? null;
}

function isRemote(job: JobRow) {
  const haystack = normalize(
    [job.city, job.province, job.title, job.description].filter(Boolean).join(" "),
  );
  return haystack.includes("remote") || haystack.includes("work from home");
}

function recencyValue(job: JobRow) {
  const value = job.created_at ?? job.posted_at;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLocationFilter(value?: string | null): LocationTarget | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { city: parts[0], province: parts[parts.length - 1] };
  }

  // A single filter value can be either a province or a city. Keep it in both
  // slots so it can match the corresponding normalized job field exactly.
  return { city: raw, province: raw };
}

function matchesFilter(job: JobRow, filter?: RecommendationFilter | null) {
  if (!filter) return true;

  if (filter.location?.trim()) {
    const wanted = parseLocationFilter(filter.location);
    const cityMatch = wanted?.city && normalize(job.city) === normalize(wanted.city);
    const provinceMatch =
      wanted?.province && normalize(job.province) === normalize(wanted.province);
    if (!cityMatch && !provinceMatch && !isRemote(job)) return false;
  }

  if (filter.category?.trim()) {
    const wanted = normalize(filter.category);
    if (!normalize(job.category).includes(wanted)) return false;
  }

  if (filter.role?.trim()) {
    const wantedTokens = [...tokens(filter.role)];
    const roleHaystack = normalize(
      [job.title, job.category, job.job_type, job.experience_level].filter(Boolean).join(" "),
    );
    if (!wantedTokens.every((token) => roleHaystack.includes(token))) return false;
  }

  return true;
}

async function loadProfile(userId?: string | null): Promise<ProfileSignals> {
  const empty = { skills: [], preferredJobTypes: [], city: null, province: null };
  if (!userId) return empty;

  const { data, error } = await supabase
    .from("profiles")
    .select("skills,preferred_job_types,preferred_province,preferred_city,province,city,field_of_study,about")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Recommendation profile load failed:", error.message);
    return empty;
  }

  const skills = Array.isArray(data?.skills) ? data.skills.map(String) : [];
  const preferredJobTypes = Array.isArray(data?.preferred_job_types)
    ? data.preferred_job_types.map(String)
    : [];
  const careerText = [data?.field_of_study, data?.about].filter(Boolean).map(String);

  // Profiles and jobs both store city/province separately. Prefer explicit job
  // preferences when present, otherwise use the user's residential location.
  const city = String(data?.preferred_city ?? data?.city ?? "").trim() || null;
  const province = String(data?.preferred_province ?? data?.province ?? "").trim() || null;

  return {
    skills: [...skills, ...careerText],
    preferredJobTypes,
    city,
    province,
  };
}

async function loadJobs(limit = 120): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(HOME_JOB_COLUMNS)
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .or(openClosingDateFilter())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const fallback = await supabase
      .from("jobs")
      .select(HOME_JOB_COLUMNS.replace(",created_at", ""))
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .or(openClosingDateFilter())
      .order("posted_at", { ascending: false })
      .limit(limit);

    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as JobRow[];
  }

  return (data ?? []) as JobRow[];
}

async function loadHistory(userId?: string | null): Promise<HistorySignals> {
  const empty: HistorySignals = {
    appliedIds: new Set(),
    savedIds: new Set(),
    categories: new Map(),
    companies: new Map(),
    salaryMidpoints: [],
  };
  if (!userId) return empty;

  const [savedRes, applicationsRes] = await Promise.all([
    supabase
      .from("saved_jobs")
      .select("job_id,jobs(id,category,company_name,salary_min,salary_max)")
      .eq("user_id", userId),
    supabase
      .from("applications")
      .select("job_id,jobs(id,category,company_name,salary_min,salary_max)")
      .eq("user_id", userId),
  ]);

  if (savedRes.error) console.warn("Recommendation saved history failed:", savedRes.error.message);
  if (applicationsRes.error) console.warn("Recommendation application history failed:", applicationsRes.error.message);

  const increment = (map: Map<string, number>, value: unknown, weight = 1) => {
    const key = normalize(value);
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + weight);
  };

  const absorb = (rows: any[], kind: "saved" | "applied") => {
    rows.forEach((row) => {
      const id = String(row?.job_id ?? row?.jobs?.id ?? "");
      if (id) (kind === "applied" ? empty.appliedIds : empty.savedIds).add(id);
      const job = Array.isArray(row?.jobs) ? row.jobs[0] : row?.jobs;
      if (!job) return;
      const weight = kind === "applied" ? 2 : 1;
      increment(empty.categories, job.category, weight);
      increment(empty.companies, job.company_name, weight);
      const salary = midpoint(job);
      if (salary != null) empty.salaryMidpoints.push(salary);
    });
  };

  absorb((savedRes.data ?? []) as any[], "saved");
  absorb((applicationsRes.data ?? []) as any[], "applied");
  return empty;
}

function locationTarget(profile: ProfileSignals, filter?: RecommendationFilter | null): LocationTarget {
  return parseLocationFilter(filter?.location) ?? {
    city: profile.city,
    province: profile.province,
  };
}

function locationTier(job: JobRow, target: LocationTarget) {
  const wantedCity = normalize(target.city);
  const wantedProvince = normalize(target.province);
  const jobCity = normalize(job.city);
  const jobProvince = normalize(job.province);

  if (wantedCity && jobCity && jobCity === wantedCity) return 0;
  if (wantedProvince && jobProvince && jobProvince === wantedProvince) return 1;
  if (isRemote(job)) return 2;
  return 3;
}

function hasLocation(target: LocationTarget) {
  return Boolean(target.city?.trim() || target.province?.trim());
}

function scorePersonalized(
  job: JobRow,
  profile: ProfileSignals,
  history: HistorySignals,
) {
  let score = 0;
  const jobTokens = tokens(
    [
      job.title,
      job.category,
      job.job_type,
      job.experience_level,
      job.description,
      ...(job.requirements ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );

  const profileTokens = tokens([...profile.skills, ...profile.preferredJobTypes].join(" "));
  let overlap = 0;
  profileTokens.forEach((token) => {
    if (jobTokens.has(token)) overlap += 1;
  });
  score += Math.min(overlap, 8) * 7;

  score += (history.categories.get(normalize(job.category)) ?? 0) * 10;
  score += (history.companies.get(normalize(job.company_name)) ?? 0) * 12;

  const salary = midpoint(job);
  if (salary != null && history.salaryMidpoints.length) {
    const average = history.salaryMidpoints.reduce((sum, value) => sum + value, 0) / history.salaryMidpoints.length;
    const distance = Math.abs(salary - average) / Math.max(average, 1);
    score += Math.max(0, 12 - distance * 18);
  }

  if (history.savedIds.has(job.id)) score -= 14;
  return score;
}

function compareRanked(
  a: JobRow,
  b: JobRow,
  target: LocationTarget,
  scores: Map<string, number>,
) {
  if (hasLocation(target)) {
    const tierDifference = locationTier(a, target) - locationTier(b, target);
    if (tierDifference !== 0) return tierDifference;
  }

  const scoreDifference = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
  if (scoreDifference !== 0) return scoreDifference;
  return recencyValue(b) - recencyValue(a);
}

export async function getTopOpportunities(
  userId?: string | null,
  filter?: RecommendationFilter | null,
  limit = 10,
): Promise<Job[]> {
  const [profile, history, jobs] = await Promise.all([
    loadProfile(userId),
    loadHistory(userId),
    loadJobs(120),
  ]);
  const filtered = jobs.filter((job) => matchesFilter(job, filter));
  const target = locationTarget(profile, filter);
  const scores = new Map(filtered.map((job) => [job.id, scorePersonalized(job, profile, history)]));

  filtered.sort((a, b) => compareRanked(a, b, target, scores));
  return filtered.slice(0, limit);
}

export async function getPersonalizedMatches(
  userId?: string | null,
  filter?: RecommendationFilter | null,
  limit = 20,
): Promise<Job[]> {
  const [profile, history, jobs] = await Promise.all([
    loadProfile(userId),
    loadHistory(userId),
    loadJobs(180),
  ]);

  const candidates = jobs
    .filter((job) => !history.appliedIds.has(job.id))
    .filter((job) => matchesFilter(job, filter));

  const target = locationTarget(profile, filter);
  const scores = new Map(candidates.map((job) => [job.id, scorePersonalized(job, profile, history)]));

  candidates.sort((a, b) => compareRanked(a, b, target, scores));
  return candidates.slice(0, limit);
}
