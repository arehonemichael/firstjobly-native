import { emptyZ83, type Z83Data } from "./types";
// Explicit allowlist: no job identity, initials, signature, date or declaration.
export const REUSABLE_FIELDS = [
  "availability",
  "surnameAndNames",
  "preferredLanguage",
  "method",
  "contactDetails",
  "dateOfBirth",
  "idNumber",
  "passportNumber",
  "race",
  "gender",
  "disability",
  "saCitizen",
  "nationality",
  "workPermit",
  "criminalConviction",
  "criminalDetail",
  "pendingCriminal",
  "pendingCriminalDetail",
  "dismissedForMisconduct",
  "dismissedDetail",
  "pendingDisciplinary",
  "pendingDisciplinaryDetail",
  "resignedPendingDisciplinary",
  "resignedDetail",
  "dischargedIllHealth",
  "businessWithState",
  "relinquishBusiness",
  "yearsPrivate",
  "yearsPublic",
  "registrationDate",
  "registrationNumber",
  "currentStudy",
  "prevPublicServiceCondition",
  "prevPublicServiceDetail",
] as const;
const arrayFields = {
  languages: ["name", "speak", "write"],
  qualifications: ["institution", "qualification", "year"],
  jobs: [
    "employer",
    "post",
    "fromMonth",
    "fromYear",
    "toMonth",
    "toYear",
    "reason",
  ],
  references: ["name", "relationship", "phone"],
} as const;
export function reusableZ83(input: unknown): Partial<Z83Data> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of REUSABLE_FIELDS)
    if (typeof source[key] === "string") result[key] = source[key];
  for (const [key, fields] of Object.entries(arrayFields)) {
    if (Array.isArray(source[key]))
      result[key] = source[key]
        .slice(0, 5)
        .map((row) =>
          Object.fromEntries(
            fields.map((field) => [
              field,
              row && typeof row[field] === "string" ? row[field] : "",
            ]),
          ),
        );
  }
  return result as Partial<Z83Data>;
}
const text = (value: unknown) => (typeof value === "string" ? value : "");
/** Only schema fields already read/written by the existing Profile screen.
 * No race/gender/citizenship/ID/medical guesses or unknown equity-table reads. */
export function z83FromProfile(
  p: Record<string, unknown> | null,
  work: Record<string, unknown>[],
): Partial<Z83Data> {
  if (!p) return {};
  const surname = text(p.last_name).toUpperCase(),
    first = text(p.first_name);
  const full =
    surname && first
      ? `${surname}, ${first}`
      : [surname, first].filter(Boolean).join(" ") || text(p.full_name);
  const dob = text(p.date_of_birth).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const result: Partial<Z83Data> = {};
  if (full) result.surnameAndNames = full;
  if (dob) result.dateOfBirth = `${dob[3]}/${dob[2]}/${dob[1]}`;
  const contact = [
    text(p.email),
    text(p.phone),
    [text(p.address), text(p.city), text(p.province)]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join("\n");
  if (contact) result.contactDetails = contact;
  if (p.institution || p.field_of_study || p.highest_qualification)
    result.qualifications = [
      {
        institution: text(p.institution),
        qualification: text(p.field_of_study) || text(p.highest_qualification),
        year: p.year_completed == null ? "" : String(p.year_completed),
      },
    ];
  if (p.currently_studying === true && (p.field_of_study || p.institution))
    result.currentStudy = [text(p.field_of_study), text(p.institution)]
      .filter(Boolean)
      .join(" — ");
  if (p.available_immediately === true) result.availability = "Immediately";
  if (Array.isArray(p.languages))
    result.languages = p.languages
      .filter((v) => typeof v === "string")
      .slice(0, 5)
      .map((name) => ({ name, speak: "", write: "" }));
  if (work.length)
    result.jobs = work.slice(0, 3).map((w) => {
      const from = text(w.start_date).match(/^(\d{4})-(\d{2})/),
        to = w.currently_working
          ? null
          : text(w.end_date).match(/^(\d{4})-(\d{2})/);
      return {
        employer: text(w.company),
        post: text(w.job_title),
        fromMonth: from?.[2] ?? "",
        fromYear: from?.[1].slice(-2) ?? "",
        toMonth: to?.[2] ?? "",
        toYear: to?.[1].slice(-2) ?? "",
        reason: "",
      };
    });
  return result;
}
export function initialZ83(
  profile: Partial<Z83Data>,
  saved: Partial<Z83Data> | null,
  job: Partial<Z83Data> = {},
): Z83Data {
  return {
    ...emptyZ83(),
    ...reusableZ83(profile),
    ...reusableZ83(saved),
    position: text(job.position),
    department: text(job.department),
    reference: text(job.reference),
    initials: "",
    signature: "",
    declarationDate: "",
  };
}

/** Editing job identity invalidates this application's signing details. */
export function editZ83(current: Z83Data, changes: Partial<Z83Data>): Z83Data {
  const changed = (["position", "department", "reference"] as const).some(
    (key) => changes[key] !== undefined && changes[key] !== current[key],
  );
  return {
    ...current,
    ...changes,
    ...(changed ? { initials: "", signature: "", declarationDate: "" } : {}),
  };
}
