import type { Job } from "../jobs";
export const RANKING_VERSION = "firstjobly-device-rules-2";
export type Preferences = {
  categories: string[];
  provinces: string[];
  cities: string[];
  employmentTypes: string[];
  experienceLevels: string[];
  excludedCategories: string[];
  excludedEmployers: string[];
  remoteOnly: boolean;
  learningEnabled: boolean;
  useProfilePreferences: boolean;
  learnedResetAt: string | null;
};
export const EMPTY_PREFERENCES: Preferences = {
  categories: [],
  provinces: [],
  cities: [],
  employmentTypes: [],
  experienceLevels: [],
  excludedCategories: [],
  excludedEmployers: [],
  remoteOnly: false,
  learningEnabled: true,
  useProfilePreferences: true,
  learnedResetAt: null,
};
export type FeedFilters = {
  q?: string;
  category?: string;
  province?: string;
  city?: string;
};
export type ReasonCode =
  | "saved_search"
  | "interest"
  | "province"
  | "city"
  | "employment"
  | "experience"
  | "skill"
  | "education"
  | "remote"
  | "saved_activity"
  | "application_activity"
  | "feedback_activity"
  | "view_activity"
  | "no_experience_listed"
  | "fresh"
  | "discovery";
export type Reason = { code: ReasonCode; value?: string };
export type RequirementEvidence = {
  field: "education" | "experience";
  state: "match" | "mismatch" | "unknown";
  mandatory: boolean;
  listed: string;
};
export type Ranking = {
  jobId: string;
  score: number;
  contributions: { code: string; points: number }[];
  reasons: Reason[];
  version: string;
  discovery: boolean;
  eligibility: {
    excluded: boolean;
    evidence: RequirementEvidence[];
    needsReview: boolean;
  };
};
export type RankedJob = { job: Job; ranking: Ranking };
export type FeedPage = {
  items: RankedJob[];
  nextCursor: string | null;
  version: string;
  label:
    | "Latest opportunities"
    | "Based on your selected interests"
    | "Based on your profile"
    | "Based on your activity";
  personalized: boolean;
  sparse: boolean;
  candidateLimit: number;
  total: number;
};
export type FeedbackKind = "more_like_this" | "dismissed";
export type DismissReason =
  "not_relevant" | "location" | "requirements" | "already_seen" | "other";
export type ActivityKind =
  | "opened"
  | "saved"
  | "unsaved"
  | "application_started"
  | "application_submitted";
