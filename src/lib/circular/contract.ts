import type { Z83Data } from "../z83/types";
export type Method = "email" | "online" | "post" | "hand_delivery" | "other";
export type Batch = {
  id: string;
  title: string;
  description: string | null;
  circular_number: number;
  circular_year: number;
  issue_date: string;
  published_at: string;
  page_count: number;
  job_count: number;
  earliest_closing_date: string | null;
  pdf_download_url: string | null;
  pdf_download_expires_in: number;
  official_pdf_url: string | null;
};
export type CircularJob = {
  id: string;
  batch_id: string;
  post_number: string;
  post_title: string;
  department: string;
  reference_number: string | null;
  centre: string | null;
  province: string | null;
  salary_text: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_level: string | null;
  job_type: string;
  posts_count: number;
  closing_date: string | null;
  min_qualification: string;
  published_at: string;
  closes_in_days: number | null;
  is_closing_soon: boolean;
  is_expired: boolean;
  circular: { id: string; number: number; year: number; issue_date: string };
  saved: boolean;
  application_stage: "started" | "sent" | null;
};
export type Detail = {
  job: CircularJob & {
    closing_date_text: string | null;
    salary_period: string;
    requirements: { kind: string; text: string }[];
    fields_of_study: string[];
    min_experience_years: number | null;
    drivers_licence_required: boolean;
    professional_registration: string | null;
    duties: string[];
    enquiries: {
      name: string | null;
      phone: string | null;
      email: string | null;
    };
    documents_required: string[];
    notes: string | null;
    is_readvertisement: boolean;
    source: {
      circular_title: string;
      circular_id: string;
      issue_date: string;
      page: number | null;
      official_pdf_url: string | null;
    };
  };
  apply: {
    methods: Method[];
    emails: string[];
    urls: string[];
    postal_address: string | null;
    hand_delivery_address: string | null;
    instructions: string | null;
    email_subject: string;
  };
  z83_prefill: Partial<Z83Data>;
  z83_requirements: {
    from_job: string[];
    from_profile: { field: string; source: string; filled: boolean }[];
    at_apply_time: string[];
    session_only: string[];
    job_specific: { field: string; reason: string }[];
  };
  requirements_match: {
    overall: "meets" | "check" | "unmet";
    items: {
      criterion: string;
      status: "meets" | "check" | "unmet";
      detail: string;
    }[];
  };
  missing_profile_fields: string[];
  saved: boolean;
  application: {
    started_at: string | null;
    sent_at: string | null;
    method: Method | null;
  };
};
export type Page = {
  items: CircularJob[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
};
export type Filters = {
  search?: string;
  province?: string;
  closing_soon?: string;
  qualification?: string;
  batch_id?: string;
  sort?: "closing" | "newest";
};
export const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];
export const qualifications = [
  { value: "grade_12", label: "Grade 12" },
  { value: "certificate", label: "Certificate" },
  { value: "diploma", label: "Diploma" },
  { value: "degree", label: "Degree" },
];
export const methodLabels: Record<Method, string> = {
  email: "Email",
  online: "Online",
  post: "Post",
  hand_delivery: "Hand delivery",
  other: "Other",
};
export function saDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date not provided";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value.length === 10 ? value + "T12:00:00+02:00" : value));
}
export function titleCase(value: string) {
  return value.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
export function salary(value: string | null) {
  return (value || "Salary not stated")
    .replace(/per annum/gi, "per year")
    .replace(
      /R\s*([\d, ]+)(?=\s|$|\()/g,
      (_, n: string) =>
        "R" + n.replace(/[, ]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " "),
    );
}
export function externalURL(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
// Only audited profile/post fields may enter the filler; never accept Section B from an API.
export function safePrefill(data: Partial<Z83Data>): Partial<Z83Data> {
  const out: Record<string, unknown> = {};
  for (const key of [
    "position",
    "department",
    "reference",
    "surnameAndNames",
    "contactDetails",
    "method",
    "dateOfBirth",
    "languages",
    "qualifications",
    "currentStudy",
    "jobs",
  ] as const) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}
export const profileLabels: Record<string, string> = {
  first_name_last_name: "Name",
  phone: "Phone number",
  date_of_birth: "Date of birth",
  languages: "Languages",
  highest_qualification: "Qualification",
  field_of_study: "Field of study",
  work_experience: "Work experience",
  drivers_licence: "Driver’s licence",
};
/** Preserve the download's filename when supplied, without accepting paths. */
export function pdfFilename(batch: Batch, disposition?: string) {
  const match = disposition?.match(
    /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i,
  );
  let candidate = match?.[1] || match?.[2] || match?.[3];
  if (candidate) {
    try {
      candidate = decodeURIComponent(candidate.trim());
    } catch {
      candidate = undefined;
    }
  }
  if (candidate && /^[^\\/\x00-\x1f]{1,160}\.pdf$/i.test(candidate))
    return candidate;
  return `public-service-vacancy-circular-${batch.circular_number}-of-${batch.circular_year}.pdf`;
}
/** Omit cleared controls rather than sending the literal string "undefined". */
export function listPath(filters: Filters, page = 1) {
  const params = new URLSearchParams();
  for (const key of [
    "search",
    "province",
    "closing_soon",
    "qualification",
    "batch_id",
    "sort",
  ] as const) {
    const value = filters[key];
    if (typeof value === "string" && value.trim()) params.set(key, value);
  }
  params.set("page", String(page));
  params.set("page_size", "20");
  return "/circular-jobs?" + params;
}

/** Explicit Home entries clear a previous notification batch and UI controls. */
export function governmentHomeDestination() {
  return {
    pathname: "/circular-jobs" as const,
    params: { batch: "", reset: String(Date.now()) },
  };
}
