import { getHotJobIds } from "./apply-clicks";
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

type ExperienceSignals = {
  known: boolean;
  years: number;
  entryCount: number;
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

type WorkExperienceRow = {
  start_date: string | null;
  end_date: string | null;
  currently_working: boolean | null;
};

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type ScoringContext = {
  profileTokens: Set<string>;
  averageSalary: number | null;
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

const CACHE_TTL_MS = 30_000;
const profileCache = new Map<string, CacheEntry<ProfileSignals>>();
const experienceCache = new Map<string, CacheEntry<ExperienceSignals>>();
const historyCache = new Map<string, CacheEntry<HistorySignals>>();
const jobsCache = new Map<string, CacheEntry<JobRow[]>>();

function cached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const current = cache.get(key);
  if (current && current.expiresAt > now) return current.promise;

  const promise = loader().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, promise });
  return promise;
}

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
      [job.title, job.category, job.job_type, job.experience_level]
        .filter(Boolean)
        .join(" "),
    );
    if (!wantedTokens.every((token) => roleHaystack.includes(token))) return false;
  }

  return true;
}

async function loadProfileUncached(userId: string): Promise<ProfileSignals> {
  const empty = { skills: [], preferredJobTypes: [], city: null, province: null };
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "skills,preferred_job_types,preferred_province,preferred_city,province,city,field_of_study,about",
    )
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
  const city = String(data?.preferred_city ?? data?.city ?? "").trim() || null;
  const province =
    String(data?.preferred_province ?? data?.province ?? "").trim() || null;

  return {
    skills: [...skills, ...careerText],
    preferredJobTypes,
    city,
    province,
  };
}

function loadProfile(userId?: string | null): Promise<ProfileSignals> {
  if (!userId) {
    return Promise.resolve({
      skills: [],
      preferredJobTypes: [],
      city: null,
      province: null,
    });
  }
  return cached(profileCache, userId, () => loadProfileUncached(userId));
}

function dateValue(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadExperienceUncached(userId: string): Promise<ExperienceSignals> {
  const { data, error } = await supabase
    .from("work_experience")
    .select("start_date,end_date,currently_working")
    .eq("user_id", userId);

  if (error) {
    console.warn("Recommendation work experience load failed:", error.message);
    return { known: false, years: 0, entryCount: 0 };
  }

  const rows = (data ?? []) as WorkExperienceRow[];
  const now = Date.now();
  let totalMs = 0;

  rows.forEach((row) => {
    const start = dateValue(row.start_date);
    if (start == null) return;
    const end = row.currently_working ? now : dateValue(row.end_date);
    if (end == null || end <= start) return;
    totalMs += end - start;
  });

  const years = totalMs / (365.25 * 24 * 60 * 60 * 1000);
  return {
    known: true,
    years: Math.max(0, years),
    entryCount: rows.length,
  };
}

function loadExperience(userId?: string | null): Promise<ExperienceSignals> {
  if (!userId) return Promise.resolve({ known: false, years: 0, entryCount: 0 });
  return cached(experienceCache, userId, () => loadExperienceUncached(userId));
}

async function loadJobsUncached(): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(HOME_JOB_COLUMNS)
    .eq("approval_status", "approved")
    .eq("is_active", true)
    .or(openClosingDateFilter())
    .order("created_at", { ascending: false })
    .limit(180);

  if (error) {
    const fallback = await supabase
      .from("jobs")
      .select(HOME_JOB_COLUMNS.replace(",created_at", ""))
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .or(openClosingDateFilter())
      .order("posted_at", { ascending: false })
      .limit(180);

    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as unknown as JobRow[];
  }

  return (data ?? []) as unknown as JobRow[];
}

async function loadJobs(limit = 120): Promise<JobRow[]> {
  const [rows, hotJobIds] = await Promise.all([
    cached(jobsCache, "open-jobs-180", loadJobsUncached),
    getHotJobIds(),
  ]);
  return rows
    .slice(0, limit)
    .map((job) => ({ ...job, is_urgent: hotJobIds.has(job.id) }));
}

async function loadHistoryUncached(userId: string): Promise<HistorySignals> {
  const result: HistorySignals = {
    appliedIds: new Set(),
    savedIds: new Set(),
    categories: new Map(),
    companies: new Map(),
    salaryMidpoints: [],
  };

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

  if (savedRes.error) {
    console.warn("Recommendation saved history failed:", savedRes.error.message);
  }
  if (applicationsRes.error) {
    console.warn(
      "Recommendation application history failed:",
      applicationsRes.error.message,
    );
  }

  const increment = (map: Map<string, number>, value: unknown, weight = 1) => {
    const key = normalize(value);
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + weight);
  };

  const absorb = (rows: any[], kind: "saved" | "applied") => {
    rows.forEach((row) => {
      const id = String(row?.job_id ?? row?.jobs?.id ?? "");
      if (id) (kind === "applied" ? result.appliedIds : result.savedIds).add(id);
      const job = Array.isArray(row?.jobs) ? row.jobs[0] : row?.jobs;
      if (!job) return;
      const weight = kind === "applied" ? 2 : 1;
      increment(result.categories, job.category, weight);
      increment(result.companies, job.company_name, weight);
      const salary = midpoint(job);
      if (salary != null) result.salaryMidpoints.push(salary);
    });
  };

  absorb((savedRes.data ?? []) as any[], "saved");
  absorb((applicationsRes.data ?? []) as any[], "applied");
  return result;
}

function loadHistory(userId?: string | null): Promise<HistorySignals> {
  if (!userId) {
    return Promise.resolve({
      appliedIds: new Set(),
      savedIds: new Set(),
      categories: new Map(),
      companies: new Map(),
      salaryMidpoints: [],
    });
  }
  return cached(historyCache, userId, () => loadHistoryUncached(userId));
}

function locationTarget(
  profile: ProfileSignals,
  filter?: RecommendationFilter | null,
): LocationTarget {
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

function jobExperienceText(job: JobRow) {
  return normalize(
    [
      job.experience_level,
      job.title,
      job.category,
      job.job_type,
      job.description,
      ...(job.requirements ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function explicitRequiredYears(job: JobRow): number | null {
  const structured = normalize(job.experience_level);
  const text = jobExperienceText(job);

  const yearPatterns = [
    /(?:minimum(?: of)?|at least)\s*(\d+)\s*\+?\s*years?/,
    /(\d+)\s*\+\s*years?/,
    /(\d+)\s*(?:-|to)\s*\d+\s*years?/,
    /(\d+)\s*years?\s+(?:of\s+)?experience/,
  ];

  for (const pattern of yearPatterns) {
    const match = pattern.exec(text);
    if (match) return Number(match[1]);
  }

  if (
    /no experience|no prior experience|entry level|entry-level|graduate|internship|intern\b|learnership|trainee/.test(
      structured,
    )
  ) {
    return 0;
  }
  if (/junior/.test(structured)) return 1;
  if (/intermediate|mid level|mid-level/.test(structured)) return 2;
  if (/senior/.test(structured)) return 4;
  if (/lead|manager|management/.test(structured)) return 5;

  if (
    /\b(entry level|entry-level|graduate programme|graduate program|internship|intern|learnership|trainee)\b/.test(
      text,
    )
  ) {
    return 0;
  }
  if (/\bjunior\b/.test(text)) return 1;
  if (/\bmid[- ]?level|\bintermediate\b/.test(text)) return 2;
  if (/\bsenior\b/.test(text)) return 4;
  if (/\blead\b|\bteam lead\b|\bmanager\b|\bmanagement\b/.test(text)) return 5;

  return null;
}

function experienceTier(job: JobRow, experience: ExperienceSignals) {
  if (!experience.known) return 0;

  const requiredYears = explicitRequiredYears(job);

  if (experience.entryCount === 0) {
    if (requiredYears === 0) return 0;
    if (requiredYears == null) return 1;
    if (requiredYears <= 1) return 1;
    if (requiredYears <= 2) return 2;
    return 3;
  }

  if (requiredYears == null) return 1;
  if (requiredYears <= experience.years + 1) return 0;
  if (requiredYears <= experience.years + 2) return 1;
  return 2;
}

function createScoringContext(
  profile: ProfileSignals,
  history: HistorySignals,
): ScoringContext {
  const averageSalary = history.salaryMidpoints.length
    ? history.salaryMidpoints.reduce((sum, value) => sum + value, 0) /
      history.salaryMidpoints.length
    : null;
  return {
    profileTokens: tokens(
      [...profile.skills, ...profile.preferredJobTypes].join(" "),
    ),
    averageSalary,
  };
}

function scorePersonalized(
  job: JobRow,
  history: HistorySignals,
  context: ScoringContext,
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

  let overlap = 0;
  context.profileTokens.forEach((token) => {
    if (jobTokens.has(token)) overlap += 1;
  });
  score += Math.min(overlap, 8) * 7;

  score += (history.categories.get(normalize(job.category)) ?? 0) * 10;
  score += (history.companies.get(normalize(job.company_name)) ?? 0) * 12;

  const salary = midpoint(job);
  if (salary != null && context.averageSalary != null) {
    const distance =
      Math.abs(salary - context.averageSalary) / Math.max(context.averageSalary, 1);
    score += Math.max(0, 12 - distance * 18);
  }

  if (history.savedIds.has(job.id)) score -= 14;
  return score;
}

function compareRanked(
  a: JobRow,
  b: JobRow,
  target: LocationTarget,
  experience: ExperienceSignals,
  scores: Map<string, number>,
) {
  if (hasLocation(target)) {
    const tierDifference = locationTier(a, target) - locationTier(b, target);
    if (tierDifference !== 0) return tierDifference;
  }

  if (experience.known) {
    const experienceDifference =
      experienceTier(a, experience) - experienceTier(b, experience);
    if (experienceDifference !== 0) return experienceDifference;
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
  const [profile, experience, history, jobs] = await Promise.all([
    loadProfile(userId),
    loadExperience(userId),
    loadHistory(userId),
    loadJobs(120),
  ]);
  const filtered = jobs.filter((job) => matchesFilter(job, filter));
  const target = locationTarget(profile, filter);
  const context = createScoringContext(profile, history);
  const scores = new Map(
    filtered.map((job) => [job.id, scorePersonalized(job, history, context)]),
  );

  filtered.sort((a, b) => compareRanked(a, b, target, experience, scores));
  return filtered.slice(0, limit);
}

export async function getPersonalizedMatches(
  userId?: string | null,
  filter?: RecommendationFilter | null,
  limit = 20,
): Promise<Job[]> {
  const [profile, experience, history, jobs] = await Promise.all([
    loadProfile(userId),
    loadExperience(userId),
    loadHistory(userId),
    loadJobs(180),
  ]);

  const candidates = jobs
    .filter((job) => !history.appliedIds.has(job.id))
    .filter((job) => matchesFilter(job, filter));

  const target = locationTarget(profile, filter);
  const context = createScoringContext(profile, history);
  const scores = new Map(
    candidates.map((job) => [job.id, scorePersonalized(job, history, context)]),
  );

  candidates.sort((a, b) => compareRanked(a, b, target, experience, scores));
  return candidates.slice(0, limit);
}
