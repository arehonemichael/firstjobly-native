import type { Job } from "./jobs";

export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

export const CATEGORIES = [
  { key: "government", label: "Government Vacancies" },
  { key: "learnership", label: "Learnerships" },
  { key: "internship", label: "Internships" },
  { key: "graduate_programme", label: "Graduate Programmes" },
  { key: "apprenticeship", label: "Apprenticeships" },
  { key: "bursary", label: "Bursaries" },
  { key: "skills_programme", label: "Skills Programmes" },
  { key: "part_time", label: "Part-time" },
  { key: "remote", label: "Remote / Work from home" },
  { key: "permanent", label: "Permanent roles" },
  { key: "contract", label: "Contract roles" },
] as const;

export const EXPERIENCE_LEVELS = [
  "No experience",
  "Entry level",
  "Graduate",
  "Mid level",
  "Senior",
] as const;

export const EDUCATION_LEVELS = [
  "Matric",
  "Certificate",
  "Diploma",
  "Degree",
  "Postgraduate",
] as const;

export type JobSort = "newest" | "relevance" | "closing";

export type JobFilters = {
  q: string;
  category?: string;
  province?: string;
  city?: string;
  experience?: string;
  education?: string;
  minSalary?: number;
  closingWithin?: number;
  sort: JobSort;
};

export const EMPTY_FILTERS: JobFilters = {
  q: "",
  sort: "newest",
};

export function categoryLabel(key: string) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function daysUntil(date?: string | null): number | null {
  if (!date) return null;

  const target = new Date(date);
  const now = new Date();

  target.setHours(23, 59, 59, 999);
  now.setHours(0, 0, 0, 0);

  return Math.ceil(
    (target.getTime() - now.getTime()) / 86_400_000
  );
}

export function filterJobs(
  jobs: Job[],
  filters: JobFilters
): Job[] {
  let list = [...jobs];

  const q = filters.q.trim().toLowerCase();

  if (q) {
    list = list.filter((job) =>
      [
        job.title,
        job.company_name,
        job.city ?? "",
        job.province,
        job.description ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  if (filters.category) {
    list = list.filter(
      (job) => job.category === filters.category
    );
  }

  if (filters.province) {
    list = list.filter(
      (job) => job.province === filters.province
    );
  }

  if (filters.city) {
    const city = filters.city.trim().toLowerCase();

    list = list.filter((job) =>
      (job.city ?? "").toLowerCase().includes(city)
    );
  }

  if (filters.experience) {
    list = list.filter(
      (job) => job.experience_level === filters.experience
    );
  }

  if (filters.education) {
    list = list.filter(
      (job) => job.education_level === filters.education
    );
  }

  if (filters.minSalary) {
    list = list.filter((job) => {
      const amount =
        job.salary_max ??
        job.salary_min ??
        0;

      const monthly =
        job.salary_period === "year"
          ? Math.round(amount / 12)
          : amount;

      return monthly >= filters.minSalary!;
    });
  }

  if (filters.closingWithin) {
    list = list.filter((job) => {
      const days = daysUntil(job.closing_date);

      return (
        days !== null &&
        days >= 0 &&
        days <= filters.closingWithin!
      );
    });
  }

  if (filters.sort === "closing") {
    list.sort(
      (a, b) =>
        (daysUntil(a.closing_date) ?? 9999) -
        (daysUntil(b.closing_date) ?? 9999)
    );
  } else if (filters.sort === "relevance" && q) {
    list.sort(
      (a, b) =>
        Number(b.title.toLowerCase().includes(q)) -
        Number(a.title.toLowerCase().includes(q))
    );
  } else {
    list.sort(
      (a, b) =>
        new Date(b.posted_at).getTime() -
        new Date(a.posted_at).getTime()
    );
  }

  return list;
}
