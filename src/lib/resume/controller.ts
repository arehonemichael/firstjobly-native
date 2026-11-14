/** Memory only: process death is a cold launch, never a background return. */
export const BACKGROUND_HOME_THRESHOLD_MS = 30 * 60 * 1000;
export const RESUME_LINK_GRACE_MS = 350;
export const safeResumeRoutes = new Set([
  "/",
  "/jobs",
  "/circular-jobs",
  "/saved",
  "/more",
  "/tools",
  "/applications",
  "/community",
  "/graduateroom",
  "/hot-jobs",
  "/discover",
]);
export function createResumeController(
  now = Date.now,
  threshold = BACKGROUND_HOME_THRESHOLD_MS,
) {
  let backgroundAt: number | null = null;
  let pendingAt: number | null = null;
  let destinationWins = false;
  return {
    state(next: string, protectedFlow = false) {
      if (next === "background" && backgroundAt === null && !protectedFlow) {
        backgroundAt = now();
        destinationWins = false;
      }
      if (next !== "active" || backgroundAt === null) return;
      const elapsed = now() - backgroundAt;
      backgroundAt = null;
      if (elapsed >= threshold && !destinationWins && !protectedFlow)
        pendingAt = now();
    },
    destination() {
      destinationWins = true;
      pendingAt = null;
    },
    cancel() {
      backgroundAt = null;
      pendingAt = null;
    },
    consume(path: string, blocked: boolean) {
      if (
        pendingAt === null ||
        blocked ||
        !safeResumeRoutes.has(path) ||
        now() - pendingAt < RESUME_LINK_GRACE_MS
      )
        return false;
      pendingAt = null; // Consume before navigating: reentrant renders cannot reset twice.
      return true;
    },
    pending: () => pendingAt !== null,
  };
}
