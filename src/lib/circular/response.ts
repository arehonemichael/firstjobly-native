/** Validate envelopes rather than converting incompatible 200s into empty feeds.
 * Do not infer eligibility or drop individual jobs returned by the server. */
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function jobs(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        object(item) &&
        typeof item.id === "string" &&
        typeof item.post_title === "string",
    )
  );
}
export function validCircularResponse(
  path: string,
  method: string,
  payload: unknown,
) {
  if (method !== "GET") return true;
  const route = path.split("?")[0];
  if (route === "/circular-jobs")
    return (
      object(payload) &&
      jobs(payload.items) &&
      Number.isInteger(payload.page) &&
      Number(payload.page) >= 1 &&
      Number.isInteger(payload.page_size) &&
      Number(payload.page_size) >= 1 &&
      Number.isInteger(payload.total) &&
      Number(payload.total) >= 0 &&
      typeof payload.has_more === "boolean"
    );
  if (route === "/circular-jobs/saved")
    return object(payload) && jobs(payload.items);
  if (route === "/circular-batches/latest")
    return (
      object(payload) &&
      "batch" in payload &&
      (payload.batch === null ||
        (object(payload.batch) &&
          typeof payload.batch.id === "string" &&
          typeof payload.batch.circular_number === "number" &&
          typeof payload.batch.circular_year === "number" &&
          typeof payload.batch.job_count === "number"))
    );
  if (/^\/circular-jobs\/[^/]+$/.test(route))
    return (
      object(payload) &&
      object(payload.job) &&
      typeof payload.job.id === "string" &&
      typeof payload.job.post_title === "string" &&
      Array.isArray(payload.job.requirements) &&
      Array.isArray(payload.job.duties) &&
      Array.isArray(payload.job.documents_required) &&
      object(payload.apply) &&
      Array.isArray(payload.apply.methods) &&
      object(payload.requirements_match) &&
      Array.isArray(payload.requirements_match.items) &&
      Array.isArray(payload.missing_profile_fields) &&
      object(payload.z83_prefill)
    );
  return true;
}
