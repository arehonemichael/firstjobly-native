export type YesNo = "" | "yes" | "no";
export type Race =
  | ""
  | "african"
  | "white"
  | "coloured"
  | "indian"
  | "other";
export type Gender = "" | "female" | "male";
export type CorrespondenceMethod =
  | ""
  | "post"
  | "email"
  | "fax"
  | "telephone";
export type SignMode = "digital" | "print";

export type Z83Language = { name: string; speak: string; write: string };
export type Z83Qualification = {
  institution: string;
  qualification: string;
  year: string;
};
export type Z83Job = {
  employer: string;
  post: string;
  fromMonth: string;
  fromYear: string;
  toMonth: string;
  toYear: string;
  reason: string;
};
export type Z83Reference = {
  name: string;
  relationship: string;
  phone: string;
};

export type Z83Data = {
  position: string;
  department: string;
  reference: string;
  availability: string;
  surnameAndNames: string;
  preferredLanguage: string;
  method: CorrespondenceMethod;
  contactDetails: string;
  languages: Z83Language[];
  qualifications: Z83Qualification[];
  currentStudy: string;
  jobs: Z83Job[];
  prevPublicServiceCondition: YesNo;
  prevPublicServiceDetail: string;
  references: Z83Reference[];
  initials: string;
  declarationDate: string;
  signMode: SignMode;

  dateOfBirth: string;
  idNumber: string;
  passportNumber: string;
  race: Race;
  gender: Gender;
  disability: YesNo;
  saCitizen: YesNo;
  nationality: string;
  workPermit: YesNo;
  criminalConviction: YesNo;
  criminalDetail: string;
  pendingCriminal: YesNo;
  pendingCriminalDetail: string;
  dismissedForMisconduct: YesNo;
  dismissedDetail: string;
  pendingDisciplinary: YesNo;
  pendingDisciplinaryDetail: string;
  resignedPendingDisciplinary: YesNo;
  resignedDetail: string;
  dischargedIllHealth: YesNo;
  businessWithState: YesNo;
  relinquishBusiness: YesNo;
  yearsPrivate: string;
  yearsPublic: string;
  registrationDate: string;
  registrationNumber: string;

  signature: string;
};

export const SA_LANGUAGES = [
  "English",
  "Afrikaans",
  "isiZulu",
  "isiXhosa",
  "Sepedi",
  "Setswana",
  "Sesotho",
  "itsonga",
  "siSwati",
  "Tshivenda",
  "isiNdebele",
];

const emptyLanguage = (): Z83Language => ({
  name: "",
  speak: "",
  write: "",
});
export const emptyQualification = (): Z83Qualification => ({
  institution: "",
  qualification: "",
  year: "",
});
export const emptyJob = (): Z83Job => ({
  employer: "",
  post: "",
  fromMonth: "",
  fromYear: "",
  toMonth: "",
  toYear: "",
  reason: "",
});
export const emptyReference = (): Z83Reference => ({
  name: "",
  relationship: "",
  phone: "",
});

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const emptyZ83 = (): Z83Data => ({
  position: "",
  department: "",
  reference: "",
  availability: "",
  surnameAndNames: "",
  preferredLanguage: "English",
  method: "email",
  contactDetails: "",
  languages: [emptyLanguage(), emptyLanguage()],
  qualifications: [emptyQualification(), emptyQualification()],
  currentStudy: "",
  jobs: [emptyJob()],
  prevPublicServiceCondition: "",
  prevPublicServiceDetail: "",
  references: [emptyReference(), emptyReference()],
  initials: "",
  declarationDate: today(),
  signMode: "digital",

  dateOfBirth: "",
  idNumber: "",
  passportNumber: "",
  race: "",
  gender: "",
  disability: "",
  saCitizen: "",
  nationality: "",
  workPermit: "",
  criminalConviction: "",
  criminalDetail: "",
  pendingCriminal: "",
  pendingCriminalDetail: "",
  dismissedForMisconduct: "",
  dismissedDetail: "",
  pendingDisciplinary: "",
  pendingDisciplinaryDetail: "",
  resignedPendingDisciplinary: "",
  resignedDetail: "",
  dischargedIllHealth: "",
  businessWithState: "",
  relinquishBusiness: "",
  yearsPrivate: "",
  yearsPublic: "",
  registrationDate: "",
  registrationNumber: "",

  signature: "",
});

export function deriveInitials(fullNames: string) {
  return fullNames
    .replace(/[,]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]!.toUpperCase()}.`)
    .slice(0, 4)
    .join("");
}

export function missingRequired(data: Z83Data) {
  const missing: string[] = [];
  if (!data.position.trim()) missing.push("Position applied for (Section A)");
  if (!data.department.trim()) missing.push("Department (Section A)");
  if (!data.surnameAndNames.trim())
    missing.push("Surname and full names (Section B)");
  if (!data.idNumber.trim() && !data.passportNumber.trim())
    missing.push("ID number or passport number (Section B)");
  if (!data.saCitizen)
    missing.push("South African citizenship (Section B)");
  if (!data.contactDetails.trim())
    missing.push("Contact details (Section C)");
  if (!data.declarationDate.trim()) missing.push("Declaration date");
  if (data.signMode === "digital" && !data.signature)
    missing.push("Signature");
  return missing;
}
