export type ProfileLike = Record<string, any> | null | undefined;

export function hasProfileValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

export function computeProfileCompletion(
  profile: ProfileLike,
  experience: { user_id?: string }[],
  documents: { kind: string }[],
): number {
  const p = profile ?? {};
  const hasCv = documents.some((d) => d.kind === "cv");
  const extraDocs = documents.filter((d) => d.kind !== "cv").length;

  const personalFields = [
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.province,
    p.city,
    p.date_of_birth,
    p.address,
  ];

  const educationFields = [
    p.highest_qualification,
    p.institution,
    p.field_of_study,
    p.year_completed,
  ];

  const preferenceFields = [
    p.preferred_job_types,
    p.preferred_province,
    p.preferred_city,
    p.available_immediately,
    p.willing_to_relocate,
  ];

  let earned = 0;
  earned +=
    (personalFields.filter(hasProfileValue).length / personalFields.length) * 30;
  earned += hasProfileValue(p.about) ? 6 : 0;
  earned +=
    (educationFields.filter(hasProfileValue).length / educationFields.length) * 15;
  earned += experience.length > 0 ? 6 : 0;
  earned += (Math.min((p.skills ?? []).length, 3) / 3) * 5;
  earned += (p.languages ?? []).length > 0 ? 3 : 0;
  earned +=
    (preferenceFields.filter(hasProfileValue).length / preferenceFields.length) * 5;
  earned += (hasCv ? 20 : 0) + Math.min(extraDocs, 2) * 5;

  return Math.min(100, Math.round(earned));
}