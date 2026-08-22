export type Job = {
  id: string;
  slug: string | null;
  title: string;
  company_name: string;
  company_logo_url: string | null;
  company_id: string | null;

  city: string | null;
  province: string;
  category: string;
  job_type: string | null;

  experience_level: string | null;
  education_level: string | null;

  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;

  closing_date: string | null;
  posted_at: string;
  created_at?: string;

  apply_type: string;
  external_url: string | null;

  is_urgent: boolean;
  is_featured: boolean;
  is_active: boolean;

  description: string;
  requirements: string[];
  responsibilities: string[];
  required_documents: string[];
};

export const JOB_LIST_COLUMNS = [
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
].join(",");
