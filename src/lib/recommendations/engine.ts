import { RULES } from "./config";
import {
  EMPTY_PREFERENCES,
  type Preferences,
  type Ranking,
  type RankedJob,
  type Reason,
  type RequirementEvidence,
} from "./contracts";
import type { Job } from "../jobs";

export type Candidate = Job & { approval_status?: string; source_id?: string };
export type Reference = { job: Candidate; occurredAt: string | null };
export type Activity = Reference & { kind: string };
export type Signals = {
  userId: string | null;
  profile: Record<string, unknown> | null;
  preferences: Preferences;
  saved: Reference[];
  applications: Reference[];
  feedback: (Reference & { kind: string })[];
  activity: Activity[];
  experience: {
    start_date: string | null;
    end_date: string | null;
    currently_working: boolean | null;
  }[];
  submittedIds: Set<string>;
  dismissedIds: Set<string>;
  savedSearches?: {
    keyword: string | null;
    filters: Record<string, unknown> | null;
    notify: boolean;
  }[];
};
export const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function values(value: unknown): string[] {
  if (Array.isArray(value))
    return value
      .filter((v): v is string => typeof v === "string")
      .map(normalize)
      .filter(Boolean);
  return typeof value === "string" && value.trim()
    ? value.split(",").map(normalize).filter(Boolean)
    : [];
}
export function canonicalType(value: unknown) {
  const n = normalize(value);
  return (
    (
      {
        internships: "internship",
        learnerships: "learnership",
        "full time": "full time",
        "part time": "part time",
        "entry level": "entry level",
        "no experience required": "no experience",
        "grade 12": "matric",
        "grade 12 / matric": "matric",
      } as Record<string, string>
    )[n] ?? n
  );
}
const match = (list: string[], value: unknown) =>
  list.map(canonicalType).includes(canonicalType(value));
const has = (v: unknown) => typeof v === "string" && !!v.trim();
function date(value: unknown): number | null {
  if (!has(value)) return null;
  const n = Date.parse(String(value));
  return Number.isFinite(n) ? n : null;
}
export function johannesburgDate(now: number): string {
  return new Date(now + 2 * 3600000).toISOString().slice(0, 10);
}
export function isOpen(job: Candidate, now: number): boolean {
  if (
    !job.is_active ||
    (job.approval_status && job.approval_status !== "approved")
  )
    return false;
  const closing = job.closing_date;
  if (
    closing &&
    /^\d{4}-\d{2}-\d{2}/.test(closing) &&
    date(closing) !== null &&
    closing.slice(0, 10) < johannesburgDate(now)
  )
    return false;
  return true;
}
// Only explicit listing labels establish remote work, never a guessed location.
export function isRemote(job: Candidate) {
  return (
    job.category === "remote" ||
    /^(remote|work from home)$/i.test(String(job.job_type ?? "")) ||
    /^(remote|work from home)$/i.test(String(job.city ?? ""))
  );
}
const levels: Record<string, number> = {
  matric: 1,
  certificate: 2,
  diploma: 3,
  degree: 4,
  postgraduate: 5,
};
function experienceYears(rows: Signals["experience"], now: number) {
  let complete = rows.length > 0;
  const intervals: [number, number][] = [];
  for (const row of rows) {
    const start = date(row.start_date),
      end = row.currently_working ? now : date(row.end_date);
    if (start === null || end === null || start > end || end > now) {
      complete = false;
      continue;
    }
    intervals.push([start, end]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0,
    left = 0,
    right = 0;
  for (const [start, end] of intervals) {
    if (start > right) {
      total += right - left;
      left = start;
      right = end;
    } else right = Math.max(right, end);
  }
  total += right - left;
  return { years: total / (365.25 * 86400000), complete };
}
/** The existing Easy Apply gate checks profile/docs readiness, not job eligibility.
 * Only these unambiguous, anchored mandatory labels can reject a candidate.
 * Other requirement prose remains for human review. No age/name/photo/address use. */
export function assessRequirements(
  job: Candidate,
  signals: Signals,
  now: number,
): Ranking["eligibility"] {
  const evidence: RequirementEvidence[] = [];
  const profileLevel =
    levels[normalize(signals.profile?.highest_qualification)];
  if (has(job.education_level)) {
    const listed = levels[canonicalType(job.education_level)];
    evidence.push({
      field: "education",
      mandatory: false,
      listed: job.education_level!,
      state:
        !profileLevel || !listed
          ? "unknown"
          : profileLevel >= listed
            ? "match"
            : "mismatch",
    });
  }
  const years = experienceYears(signals.experience, now);
  for (const raw of job.requirements ?? []) {
    if (typeof raw !== "string") continue;
    const qualification =
      /^(?:mandatory|minimum|required) qualification:\s*(matric|certificate|diploma|degree|postgraduate)\s*$/i.exec(
        raw,
      );
    const experience = /^minimum experience:\s*(\d{1,2}) years?\s*$/i.exec(raw);
    if (qualification)
      evidence.push({
        field: "education",
        mandatory: true,
        listed: raw,
        state: !profileLevel
          ? "unknown"
          : profileLevel >= levels[normalize(qualification[1])]
            ? "match"
            : "mismatch",
      });
    if (experience)
      evidence.push({
        field: "experience",
        mandatory: true,
        listed: raw,
        state:
          years.years >= Number(experience[1])
            ? "match"
            : years.complete
              ? "mismatch"
              : "unknown",
      });
  }
  return {
    excluded: evidence.some((e) => e.mandatory && e.state === "mismatch"),
    evidence,
    needsReview: true,
  };
}
function employer(job: Candidate) {
  return job.company_id || normalize(job.company_name) || `unknown:${job.id}`;
}
function source(job: Candidate) {
  try {
    return new URL(job.external_url || "").hostname || `unknown:${job.id}`;
  } catch {
    return job.apply_type === "easy_apply" ? "firstjobly" : `unknown:${job.id}`;
  }
}
function duplicateKeys(job: Candidate): string[] {
  const keys = [`id:${job.id}`];
  if (has(job.slug)) keys.push(`slug:${normalize(job.slug)}`);
  if (has(job.title) && (has(job.company_id) || has(job.company_name)))
    keys.push(
      `role:${employer(job)}:${normalize(job.title)}:${normalize(job.province)}:${normalize(job.city)}:${normalize(job.job_type)}`,
    );
  return keys;
}
export function effectivePreferences(signals: Signals): Preferences {
  const p = signals.preferences ?? EMPTY_PREFERENCES,
    profile = signals.profile;
  if (!p.useProfilePreferences) return p;
  const legacy = values(profile?.preferred_job_types).map(canonicalType);
  return {
    ...p,
    categories: p.categories.length
      ? p.categories
      : values(profile?.preferred_categories),
    employmentTypes: p.employmentTypes.length ? p.employmentTypes : legacy,
    provinces: p.provinces.length
      ? p.provinces
      : values(profile?.preferred_province ?? profile?.province),
    cities: p.cities.length ? p.cities : values(profile?.preferred_city),
  };
}
export function hasExplicitSignals(signals: Signals) {
  const p = effectivePreferences(signals);
  return !!(
    p.categories.length ||
    p.provinces.length ||
    p.cities.length ||
    p.employmentTypes.length ||
    p.experienceLevels.length ||
    p.remoteOnly
  );
}
function affinity(job: Candidate, reference: Candidate) {
  return (
    (normalize(job.category) &&
    normalize(job.category) === normalize(reference.category)
      ? 0.67
      : 0) + (employer(job) === employer(reference) ? 0.33 : 0)
  );
}
function decayed(at: string | null, now: number, resetAt: string | null) {
  const timestamp = date(at),
    reset = date(resetAt);
  if (reset !== null && (timestamp === null || timestamp < reset)) return 0;
  if (timestamp === null) return 1;
  const days = Math.max(0, (now - timestamp) / 86400000);
  return days > RULES.behaviour.retentionDays
    ? 0
    : Math.pow(0.5, days / RULES.behaviour.halfLifeDays);
}
export function eligibleCandidates(
  candidates: Candidate[],
  signals: Signals,
  now: number,
) {
  const prefs = effectivePreferences(signals),
    eligible: { job: Candidate; eligibility: Ranking["eligibility"] }[] = [];
  const seenKeys = new Set<string>();
  const sorted = [...candidates].sort(
    (a, b) =>
      (date(b.posted_at) ?? 0) - (date(a.posted_at) ?? 0) ||
      a.id.localeCompare(b.id),
  );
  for (const job of sorted) {
    if (
      !isOpen(job, now) ||
      signals.submittedIds.has(job.id) ||
      signals.dismissedIds.has(job.id)
    )
      continue;
    if (
      match(prefs.excludedCategories, job.category) ||
      match(prefs.excludedEmployers, job.company_id) ||
      match(prefs.excludedEmployers, job.company_name) ||
      (prefs.remoteOnly && !isRemote(job))
    )
      continue;
    const eligibility = assessRequirements(job, signals, now);
    if (eligibility.excluded) continue;
    const keys = duplicateKeys(job);
    if (keys.some((key) => seenKeys.has(key))) continue;
    keys.forEach((key) => seenKeys.add(key));
    eligible.push({ job, eligibility });
  }
  return eligible;
}
export function latestSafeJobs(
  candidates: Candidate[],
  signals: Signals,
  now: number,
): RankedJob[] {
  return eligibleCandidates(candidates, signals, now).map(
    ({ job, eligibility }) => ({
      job,
      ranking: {
        jobId: job.id,
        score: 0,
        contributions: [],
        reasons: job.posted_at ? [{ code: "fresh" as const }] : [],
        version: RULES.version,
        discovery: false,
        eligibility,
      },
    }),
  );
}
export function rankJobs(
  candidates: Candidate[],
  signals: Signals,
  now: number,
): RankedJob[] {
  const prefs = effectivePreferences(signals),
    ranked: RankedJob[] = [];
  for (const { job, eligibility } of eligibleCandidates(
    candidates,
    signals,
    now,
  )) {
    // Match the email digest: notified searches first, then province + category/type,
    // then province alone when no category/type is stated. Manual filters are separate.
    const searchMatch =
      signals.savedSearches?.some((search) => {
        if (!search.notify) return false;
        const f = search.filters ?? {},
          text = normalize(`${job.title} ${job.company_name}`);
        const words = normalize(search.keyword || f.q)
          .split(" ")
          .filter(Boolean);
        const salary = job.salary_max ?? job.salary_min;
        return (
          words.every((word) => text.includes(word)) &&
          (!f.province || match([String(f.province)], job.province)) &&
          (!f.category || match([String(f.category)], job.category)) &&
          (!f.minSalary || (salary !== null && salary >= Number(f.minSalary)))
        );
      }) ?? false;
    const statedType =
      prefs.categories.length > 0 || prefs.employmentTypes.length > 0;
    const typeMatch =
      match(prefs.categories, job.category) ||
      match(prefs.employmentTypes, job.job_type) ||
      match(prefs.employmentTypes, job.category);
    const geographyMatch =
      !prefs.provinces.length || match(prefs.provinces, job.province);
    if (
      signals.userId &&
      hasExplicitSignals(signals) &&
      !searchMatch &&
      (!geographyMatch || (statedType && !typeMatch && !prefs.provinces.length))
    )
      continue;
    const contributions: Ranking["contributions"] = [],
      reasons: Reason[] = [];
    function add(code: string, points: number, reason?: Reason) {
      if (points > 0) {
        contributions.push({ code, points: Math.round(points * 100) / 100 });
        if (reason) reasons.push(reason);
      }
    }
    add("saved_search", searchMatch ? 200 : 0, { code: "saved_search" });
    add(
      "interest",
      match(prefs.categories, job.category) ? RULES.weights.interest : 0,
      { code: "interest", value: job.category },
    );
    add(
      "province",
      match(prefs.provinces, job.province) ? RULES.weights.province : 0,
      { code: "province", value: job.province },
    );
    add("city", match(prefs.cities, job.city) ? RULES.weights.city : 0, {
      code: "city",
      value: job.city ?? undefined,
    });
    add(
      "employment",
      match(prefs.employmentTypes, job.job_type) ||
        match(prefs.employmentTypes, job.category)
        ? RULES.weights.employment
        : 0,
      {
        code: "employment",
        value: match(prefs.employmentTypes, job.job_type)
          ? (job.job_type ?? undefined)
          : job.category,
      },
    );
    add(
      "experience",
      match(prefs.experienceLevels, job.experience_level)
        ? RULES.weights.experience
        : 0,
      { code: "experience", value: job.experience_level ?? undefined },
    );
    add(
      "remote",
      prefs.remoteOnly && isRemote(job) ? RULES.weights.remote : 0,
      { code: "remote" },
    );
    const haystack = normalize(
      [
        job.title,
        ...(job.requirements ?? []).filter((x) => typeof x === "string"),
      ].join(" "),
    );
    const skills = [...new Set(values(signals.profile?.skills))].filter(
      (skill) =>
        skill.length >= 2 &&
        new RegExp(
          `(^|[^a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`,
          "i",
        ).test(haystack),
    );
    add(
      "skills",
      Math.min(RULES.weights.skillsCap, skills.length * RULES.weights.skill),
      skills[0] ? { code: "skill", value: skills[0] } : undefined,
    );
    add(
      "education",
      eligibility.evidence.some(
        (e) => e.field === "education" && e.state === "match",
      )
        ? RULES.weights.education
        : 0,
      { code: "education", value: job.education_level ?? undefined },
    );
    let behavioural = 0;
    if (prefs.learningEnabled && signals.userId) {
      const groups: [string, Reason["code"], Reference[], number][] = [
        ["saved", "saved_activity", signals.saved, RULES.behaviour.saved],
        [
          "applications",
          "application_activity",
          signals.applications,
          RULES.behaviour.application,
        ],
        [
          "more_like",
          "feedback_activity",
          signals.feedback.filter((f) => f.kind === "more_like_this"),
          RULES.behaviour.moreLike,
        ],
      ];
      for (const [code, reason, refs, cap] of groups) {
        const unique = new Map<string, Reference>();
        for (const r of refs) {
          const previous = unique.get(r.job.id);
          if (
            !previous ||
            (date(r.occurredAt) ?? 0) > (date(previous.occurredAt) ?? 0)
          )
            unique.set(r.job.id, r);
        }
        const score = Math.min(
          cap,
          [...unique.values()].reduce(
            (sum, r) =>
              sum +
              affinity(job, r.job) *
                cap *
                decayed(r.occurredAt, now, prefs.learnedResetAt),
            0,
          ),
        );
        const allowed = Math.min(score, RULES.behaviour.cap - behavioural);
        add(code, allowed, { code: reason });
        behavioural += allowed;
      }
      const opened = new Map<string, Activity>();
      for (const e of signals.activity.filter(
        (e) => e.kind === "opened" || e.kind === "application_started",
      )) {
        const key = `${e.kind}:${e.job.id}`,
          previous = opened.get(key);
        if (
          !previous ||
          (date(e.occurredAt) ?? 0) > (date(previous.occurredAt) ?? 0)
        )
          opened.set(key, e);
      }
      const score = Math.min(
        2,
        [...opened.values()].reduce(
          (sum, e) =>
            sum +
            affinity(job, e.job) *
              (e.kind === "opened"
                ? RULES.behaviour.opened
                : RULES.behaviour.started) *
              decayed(e.occurredAt, now, prefs.learnedResetAt),
          0,
        ),
      );
      add("views", Math.min(score, RULES.behaviour.cap - behavioural), {
        code: "view_activity",
      });
    }
    const posted = date(job.posted_at);
    const fresh =
      posted === null
        ? 0
        : Math.max(0, 1 - Math.max(0, now - posted) / (30 * 86400000)) *
          RULES.weights.freshness;
    add("freshness", fresh, { code: "fresh" });
    add(
      "quality",
      ([
        has(job.title),
        has(job.company_name),
        has(job.province) || isRemote(job),
      ].filter(Boolean).length *
        RULES.weights.quality) /
        3,
    );
    if (canonicalType(job.experience_level) === "no experience")
      reasons.push({ code: "no_experience_listed" });
    const personal = contributions.some(
      (c) => !["freshness", "quality"].includes(c.code),
    );
    if (
      (hasExplicitSignals(signals) ||
        signals.savedSearches?.some((s) => s.notify)) &&
      !personal
    )
      continue;
    const main = searchMatch || (geographyMatch && (!statedType || typeMatch));
    const discovery = !main;
    if (discovery) reasons.push({ code: "discovery" });
    const meaningful = reasons
      .filter((r) => r.code !== "fresh" && r.code !== "discovery")
      .slice(0, 3);
    if (!meaningful.length)
      meaningful.push(...reasons.filter((r) => r.code === "fresh").slice(0, 1));
    if (discovery) meaningful.push({ code: "discovery" });
    ranked.push({
      job,
      ranking: {
        jobId: job.id,
        score: contributions.reduce((sum, c) => sum + c.points, 0),
        contributions,
        reasons: meaningful,
        version: RULES.version,
        eligibility,
        discovery,
      },
    });
  }
  ranked.sort(
    (a, b) =>
      b.ranking.score - a.ranking.score ||
      (date(b.job.posted_at) ?? 0) - (date(a.job.posted_at) ?? 0) ||
      a.job.id.localeCompare(b.job.id),
  );
  return diversify(ranked);
}
/** Deterministic full-list order is computed before slicing pages. Quotas are
 * best-effort when inventory is narrow; exclusions/requirements never relax. */
function diversify(ranked: RankedJob[]): RankedJob[] {
  const remaining = [...ranked],
    output: RankedJob[] = [];
  // URL parsing/normalization happens once per job, not repeatedly in nested counts.
  const keys = new Map(
    ranked.map((r) => [
      r.job.id,
      {
        employer: employer(r.job),
        category: normalize(r.job.category),
        source: source(r.job),
      },
    ]),
  );
  const employers = new Map<string, number>(),
    categories = new Map<string, number>(),
    sources = new Map<string, number>();
  while (remaining.length) {
    if (output.length % RULES.pageSize === 0) {
      employers.clear();
      categories.clear();
      sources.clear();
    }
    const slot = (output.length % RULES.pageSize) + 1;
    const wantDiscovery = slot % Math.round(1 / RULES.explorationShare) === 0;
    const diverse = (r: RankedJob) => {
      const k = keys.get(r.job.id)!;
      return (
        (employers.get(k.employer) ?? 0) <
          Math.ceil(RULES.pageSize * RULES.maxEmployerShare) &&
        (categories.get(k.category) ?? 0) <
          Math.ceil(RULES.pageSize * RULES.maxCategoryShare) &&
        (sources.get(k.source) ?? 0) <
          Math.ceil(RULES.pageSize * RULES.maxSourceShare)
      );
    };
    let index = remaining.findIndex(
      (r) => r.ranking.discovery === wantDiscovery && diverse(r),
    );
    if (index < 0)
      index = remaining.findIndex((r) => r.ranking.discovery === wantDiscovery);
    if (index < 0) index = remaining.findIndex(diverse);
    if (index < 0) index = 0;
    const selected = remaining.splice(index, 1)[0],
      k = keys.get(selected.job.id)!;
    for (const [map, key] of [
      [employers, k.employer],
      [categories, k.category],
      [sources, k.source],
    ] as const)
      map.set(key, (map.get(key) ?? 0) + 1);
    output.push(selected);
  }
  return output;
}
