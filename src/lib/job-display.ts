import type { Job } from "./jobs";
import { formatCategoryLabel } from "./job-formatters";

export function formatJobSalary(job: Pick<Job, "salary_min" | "salary_max">): string | null {
  const format = (value: number) => `R${Math.round(value).toLocaleString("en-ZA")}`;
  if (job.salary_min != null && job.salary_max != null) return `${format(job.salary_min)} - ${format(job.salary_max)}`;
  if (job.salary_min != null) return `From ${format(job.salary_min)}`;
  if (job.salary_max != null) return `Up to ${format(job.salary_max)}`;
  return null;
}

export function formatJobLocation(job: Pick<Job, "city" | "province">): string {
  return job.city ? `${job.city}, ${job.province}` : job.province || "South Africa";
}

export function postedJobLabel(job: Pick<Job, "created_at" | "posted_at">): string {
  const value = job.created_at ?? job.posted_at;
  const time = value ? new Date(value).getTime() : 0;
  if (!time || !Number.isFinite(time)) return "Recently posted";
  const hours = Math.max(1, Math.floor((Date.now() - time) / 3_600_000));
  if (hours < 24) return `Posted ${hours}h ago`;
  return `Posted ${Math.floor(hours / 24)}d ago`;
}

function johannesburgTodayUtc() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);
    if (year && month && day) return Date.UTC(year, month - 1, day);
  } catch {}
  const now = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function closingJobCountdown(job: Pick<Job, "closing_date">): string | null {
  if (!job.closing_date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(job.closing_date));
  if (!match) return null;
  const closingUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const days = Math.round((closingUtc - johannesburgTodayUtc()) / 86_400_000);
  if (days < 0 || days > 10) return null;
  if (days === 0) return "Closing today";
  if (days === 1) return "Closing tomorrow";
  return `Closing in ${days} days`;
}

export function jobDisplayTags(job: Pick<Job, "category" | "job_type" | "experience_level">): string[] {
  return [job.category, job.job_type, job.experience_level]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 3)
    .map(formatCategoryLabel);
}
