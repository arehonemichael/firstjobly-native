export const EASY_APPLY_MIN_PERCENT = 50;

type ProfileLike = Record<string, any> | null | undefined;
type GateJob = {
  category?: string | null;
  required_documents?: unknown;
};

function has(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function requiredDocKindsFor(job: GateJob | null | undefined) {
  const kinds = ["cv"];
  if (!job) return kinds;

  const listed = Array.isArray(job.required_documents)
    ? job.required_documents.filter((item): item is string => typeof item === "string")
    : [];

  const mentionsMatric = listed.some((item) =>
    /matric|grade\s*12|senior certificate/i.test(item)
  );

  if (job.category === "government" || mentionsMatric) {
    kinds.push("matric_certificate");
  }

  return kinds;
}

export function evaluateEasyApply(input: {
  profile: ProfileLike;
  experience: { user_id: string }[];
  documents: { kind: string }[];
  job: GateJob | null | undefined;
}) {
  const p = input.profile ?? {};
  const hasCv = input.documents.some((doc) => doc.kind === "cv");
  const extraDocs = input.documents.filter((doc) => doc.kind !== "cv").length;

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

  const sections = [
    {
      id: "personal",
      label: "Personal information",
      filled: personalFields.filter(has).length,
      total: personalFields.length,
      weight: 30,
    },
    {
      id: "summary",
      label: "Professional summary",
      filled: has(p.about) ? 1 : 0,
      total: 1,
      weight: 6,
    },
    {
      id: "education",
      label: "Education",
      filled: educationFields.filter(has).length,
      total: educationFields.length,
      weight: 15,
    },
    {
      id: "experience",
      label: "Work experience",
      filled: Math.min(input.experience.length, 1),
      total: 1,
      weight: 6,
    },
    {
      id: "skills",
      label: "Skills",
      filled: Math.min((p.skills ?? []).length, 3),
      total: 3,
      weight: 5,
    },
    {
      id: "languages",
      label: "Languages",
      filled: Math.min((p.languages ?? []).length, 1),
      total: 1,
      weight: 3,
    },
    {
      id: "preferences",
      label: "Employment preferences",
      filled: preferenceFields.filter(has).length,
      total: preferenceFields.length,
      weight: 5,
    },
  ];

  let earned = 0;

  for (const section of sections) {
    earned += (section.filled / section.total) * section.weight;
  }

  earned += (hasCv ? 20 : 0) + Math.min(extraDocs, 2) * 5;

  const percent = Math.min(100, Math.round(earned));
  const requiredDocs = requiredDocKindsFor(input.job);
  const missingDocs = requiredDocs.filter(
    (kind) => !input.documents.some((doc) => doc.kind === kind)
  );

  const docLabels: Record<string, string> = {
    cv: "CV upload",
    matric_certificate: "Matric certificate",
  };

  const incomplete = sections
    .filter((section) => section.filled < section.total)
    .sort((a, b) => b.weight - a.weight);

  const missing = [
    ...missingDocs.map((kind) => docLabels[kind] ?? kind),
    ...(percent < EASY_APPLY_MIN_PERCENT
      ? incomplete
          .slice(0, 3)
          .map(
            (section) =>
              `${section.label} (${section.filled}/${section.total})`
          )
      : []),
  ];

  return {
    ok: percent >= EASY_APPLY_MIN_PERCENT && missingDocs.length === 0,
    percent,
    shortfall: Math.max(0, EASY_APPLY_MIN_PERCENT - percent),
    missing,
  };
}
