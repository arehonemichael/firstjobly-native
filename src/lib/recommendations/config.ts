import { RANKING_VERSION } from "./contracts";
/** Explicit signals individually outweigh the aggregate 10-point behaviour cap.
 * Freshness/quality do not represent qualification or probability of selection. */
export const RULES = Object.freeze({
  version: RANKING_VERSION,
  candidateLimit: 300,
  pageSize: 20,
  maxPageSize: 40,
  explorationShare: 0.2,
  maxEmployerShare: 0.3,
  maxCategoryShare: 0.5,
  maxSourceShare: 0.6,
  weights: {
    interest: 36,
    province: 28,
    city: 12,
    employment: 24,
    experience: 16,
    remote: 24,
    skill: 6,
    skillsCap: 24,
    education: 12,
    freshness: 6,
    quality: 3,
  },
  behaviour: {
    cap: 10,
    saved: 3,
    application: 3,
    moreLike: 6,
    opened: 0.25,
    started: 0.5,
    halfLifeDays: 30,
    retentionDays: 90,
  },
});
export const CATEGORIES = [
  "government",
  "learnership",
  "internship",
  "graduate_programme",
  "apprenticeship",
  "bursary",
  "skills_programme",
  "part_time",
  "remote",
  "permanent",
  "contract",
];
export const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "North West",
  "Northern Cape",
  "Western Cape",
  "Mpumalanga",
];
export const EXPERIENCE_LEVELS = [
  "No experience",
  "Entry level",
  "Graduate",
  "Mid level",
  "Senior",
];
