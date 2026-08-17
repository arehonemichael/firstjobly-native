export const Z83_PAGE_HEIGHT = 792;
export type TextBox = {
  page: 0 | 1;
  x: number;
  y: number;
  w: number;
  lines?: number;
  size?: number;
  lineHeight?: number;
  align?: "left" | "center";
};
export type TickBox = { page: 0 | 1; x: number; y: number };
const T = (
  page: 0 | 1,
  x: number,
  y: number,
  w: number,
  extra: Partial<TextBox> = {}
): TextBox => ({ page, x, y, w, ...extra });

export const A = {
  position: T(0, 240, 150, 160, { lines: 2 }),
  department: T(0, 406, 141, 170, { lines: 2 }),
  reference: T(0, 240, 186, 160, { lines: 3 }),
  availability: T(0, 406, 209, 170, { lines: 2 }),
};
export const B = {
  surnameAndNames: T(0, 352, 269, 224, { lines: 2, lineHeight: 12.6 }),
  dateOfBirth: T(0, 285, 313, 62),
  nationality: T(0, 473, 395, 103, { size: 8 }),
  criminalDetail: T(0, 473, 440, 103, { size: 7, lines: 2, lineHeight: 7.5 }),
  pendingCriminalDetail: T(0, 473, 471, 103, { size: 7, lines: 2, lineHeight: 7.5 }),
  dismissedDetail: T(0, 473, 506, 103, { size: 7, lines: 2, lineHeight: 7.5 }),
  pendingDisciplinaryDetail: T(0, 473, 536, 103, { size: 7, lines: 2, lineHeight: 7.5 }),
  resignedDetail: T(0, 473, 567, 103, { size: 7, lines: 3, lineHeight: 7.5 }),
  yearsPrivate: T(0, 473, 705, 44, { align: "center" }),
  yearsPublic: T(0, 521, 705, 56, { align: "center" }),
  registrationDate: T(0, 473, 735, 44, { size: 8, align: "center" }),
  registrationNumber: T(0, 521, 735, 56, { size: 8, align: "center" }),
};
const ID_BOX_EDGES = [
  403.3, 421.3, 434.8, 448.3, 460.0, 475.3, 489.1, 501.9, 514.8,
  527.5, 540.3, 553.2, 565.9, 578.8,
];
export const ID_DIGIT_BOXES: TextBox[] = ID_BOX_EDGES.slice(0, 13).map(
  (left, i) =>
    T(0, left, 297, ID_BOX_EDGES[i + 1]! - left, {
      align: "center",
      size: 9,
    })
);
export const PASSPORT_BOXES: TextBox[] = ID_BOX_EDGES.slice(0, 13).map(
  (left, i) =>
    T(0, left, 316, ID_BOX_EDGES[i + 1]! - left, {
      align: "center",
      size: 9,
    })
);
export const RACE_TICKS: Record<string, TickBox> = {
  african: { page: 0, x: 341, y: 334 },
  white: { page: 0, x: 395, y: 334 },
  coloured: { page: 0, x: 462, y: 334 },
  indian: { page: 0, x: 510, y: 334 },
  other: { page: 0, x: 570, y: 334 },
};
export const GENDER_TICKS: Record<string, TickBox> = {
  female: { page: 0, x: 474, y: 349 },
  male: { page: 0, x: 565, y: 349 },
};
export const YESNO_ROWS = {
  disability: 364,
  saCitizen: 379,
  workPermit: 410,
  criminalConviction: 425,
  pendingCriminal: 456,
  dismissedForMisconduct: 489,
  pendingDisciplinary: 521,
  resignedPendingDisciplinary: 552,
  dischargedIllHealth: 594,
  businessWithState: 623,
  relinquishBusiness: 660,
} as const;
export type YesNoRow = keyof typeof YESNO_ROWS;
export const YES_X = 505;
export const NO_X = 565;

export const C = {
  preferredLanguage: T(1, 473, 82, 103, { size: 9 }),
  contactDetails: T(1, 330, 127, 246, {
    lines: 4,
    size: 9,
    lineHeight: 12,
  }),
};
export const METHOD_TICKS: Record<string, TickBox> = {
  post: { page: 1, x: 355, y: 114 },
  email: { page: 1, x: 420, y: 114 },
  fax: { page: 1, x: 483, y: 114 },
  telephone: { page: 1, x: 555, y: 114 },
};
const D_COLUMNS = [209.8, 281.8, 353.5, 425.8, 502.3];
const D_WIDTHS = [72, 71.7, 72.3, 76.5, 76.5];
export const D_LANGUAGE_NAME: TextBox[] = D_COLUMNS.map((x, i) =>
  T(1, x + 3, 214, D_WIDTHS[i]! - 6, { size: 8 })
);
export const D_SPEAK: TextBox[] = D_COLUMNS.map((x, i) =>
  T(1, x + 3, 229, D_WIDTHS[i]! - 6, { size: 9 })
);
export const D_WRITE: TextBox[] = D_COLUMNS.map((x, i) =>
  T(1, x + 3, 248, D_WIDTHS[i]! - 6, { size: 9 })
);
export const E_ROWS = [308.5, 327.5, 346.5, 365.5].map((y) => ({
  institution: T(1, 82, y, 183, { size: 8 }),
  qualification: T(1, 271, y, 174, { size: 8 }),
  year: T(1, 451, y, 125, { size: 8 }),
}));
export const E_CURRENT_STUDY = T(1, 252, 384, 322, { size: 8 });
export const F_ROWS = [453.5, 472.5, 491.5].map((y) => ({
  employer: T(1, 82, y, 134, { size: 7, lines: 2, lineHeight: 8 }),
  post: T(1, 221, y, 85, { size: 7, lines: 2, lineHeight: 8 }),
  fromMonth: T(1, 311, y, 29, { size: 8, align: "center" }),
  fromYear: T(1, 341, y, 29, { size: 8, align: "center" }),
  toMonth: T(1, 372, y, 26, { size: 8, align: "center" }),
  toYear: T(1, 400, y, 38, { size: 8, align: "center" }),
  reason: T(1, 442, y, 135, { size: 7, lines: 2, lineHeight: 8 }),
}));
export const F_PREV_CONDITION = {
  yes: { page: 1 as const, x: 466, y: 512 },
  no: { page: 1 as const, x: 505, y: 512 },
  detail: T(1, 374, 530, 202, { size: 8, lines: 2, lineHeight: 9 }),
};
export const G_ROWS = [592, 609.5, 627].map((y) => ({
  name: T(1, 82, y, 145, { size: 8 }),
  relationship: T(1, 232, y, 145, { size: 8 }),
  phone: T(1, 382, y, 194, { size: 8 }),
}));
export const DECLARATION = {
  signatureImage: { page: 1 as const, x: 128, y: 690, w: 168, h: 31 },
  signaturePrintNote: T(1, 128, 706, 170, { size: 7 }),
  date: T(1, 333, 697, 240, { size: 9 }),
};
export const INITIALS = [
  T(0, 545, 760, 34, { size: 8 }),
  T(1, 545, 760, 34, { size: 8 }),
];
