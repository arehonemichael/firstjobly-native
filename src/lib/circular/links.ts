import { communityDestination } from "../community/links";
/** Strict audited destinations only. Ignore arbitrary host names and queries. */
export function notificationDestination(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;
  const community = communityDestination(data.link);
  if (community) return community;
  const id = (value: unknown) =>
    typeof value === "string" && /^[a-zA-Z0-9_-]+$/.test(value) ? value : null;
  if (data.kind === "new_circular") {
    const batch = id(data.batchId);
    return batch ? "/circular-jobs?batch=" + batch : "/circular-jobs";
  }
  if (data.kind === "circular_closing") {
    const job = id(data.jobId);
    return job ? "/circular-jobs/" + job : null;
  }
  return null;
}
