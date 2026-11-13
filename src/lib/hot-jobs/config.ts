/** Enable only after Lovable approves the review migration, the scheduled cache
 * has refreshed, and its deduplicated semantics have been verified. */
export const HOT_RULES = Object.freeze({
  enabled: process.env.EXPO_PUBLIC_HOT_JOBS_VERIFIED === "true",
  minimumActivity: 10,
  minimumSectionJobs: 3,
  maxJobs: 20,
  windowDays: 7,
  cacheMs: 5 * 60 * 1000,
  maximumAgeMs: 15 * 60 * 1000,
});
