const { load } = require("./load.cjs");
const { EMPTY_PREFERENCES } = load("src/lib/recommendations/contracts.ts");
const now = Date.parse("2026-11-12T10:00:00Z");
const uid = {
  alice: "00000000-0000-4000-8000-000000000001",
  bob: "00000000-0000-4000-8000-000000000002",
};
const jid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function job(n, patch = {}) {
  return {
    id: jid(n),
    slug: `role-${n}`,
    title: `Opportunity ${n}`,
    company_name: `Employer ${n % 8}`,
    company_id: null,
    company_logo_url: null,
    category: "internship",
    province: "Gauteng",
    city: "Pretoria",
    job_type: "full_time",
    experience_level: "No experience",
    education_level: null,
    salary_min: null,
    salary_max: null,
    salary_period: null,
    closing_date: "2099-01-01",
    posted_at: "2026-11-10T10:00:00Z",
    created_at: "2026-11-10T10:00:00Z",
    apply_type: "easy_apply",
    external_url: null,
    is_urgent: false,
    is_featured: false,
    is_active: true,
    approval_status: "approved",
    description: "Fixture opportunity",
    requirements: [],
    responsibilities: [],
    required_documents: [],
    ...patch,
  };
}
function signals(patch = {}) {
  return {
    userId: uid.alice,
    profile: null,
    preferences: { ...EMPTY_PREFERENCES },
    saved: [],
    applications: [],
    feedback: [],
    activity: [],
    experience: [],
    submittedIds: new Set(),
    dismissedIds: new Set(),
    ...patch,
  };
}
module.exports = { now, uid, jid, job, signals };
