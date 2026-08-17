export type TemplateId =
  | "classic"
  | "professional"
  | "graduate"
  | "skills"
  | "compact";

export type SectionId =
  | "summary"
  | "education"
  | "experience"
  | "skills"
  | "certifications"
  | "languages"
  | "references";

export type Experience = {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string;
};

export type Education = {
  id: string;
  qualification: string;
  institution: string;
  nqfLevel: string;
  year: string;
  notes: string;
};

export type Certification = {
  id: string;
  name: string;
  issuer: string;
  year: string;
};

export type Reference = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
};

export type CvData = {
  firstName: string;
  lastName: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  link: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string;
  languages: string;
  certifications: Certification[];
  references: Reference[];
  referencesOnRequest: boolean;
  includeCertifications: boolean;
  includeLanguages: boolean;
};

type Template = {
  id: TemplateId;
  name: string;
  tagline: string;
  bestFor: string;
  notes: string;
  recommended?: boolean;
  order: SectionId[];
  style: {
    font: string;
    body: number;
    lineHeight: number;
    sectionGap: number;
    itemGap: number;
    paddingMm: number;
    nameSize: number;
    nameColor: string;
    nameCaps: boolean;
    nameRule: string;
    contactColor: string;
    headlineColor: string;
    headingSize: number;
    headingColor: string;
    headingCaps: boolean;
    headingRule: string;
    bodyColor: string;
    metaColor: string;
  };
};

const STANDARD: SectionId[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "languages",
  "references",
];

export const TEMPLATES: Record<TemplateId, Template> = {
  classic: {
    id: "classic",
    name: "ATS Classic",
    tagline: "The safest option",
    bestFor: "Banks, corporates, government and ATS screening",
    notes:
      "Pure black on white, plain headings and maximum compatibility with automated screening.",
    recommended: true,
    order: STANDARD,
    style: {
      font: "Arial, Helvetica, sans-serif",
      body: 11,
      lineHeight: 1.38,
      sectionGap: 13,
      itemGap: 9,
      paddingMm: 18,
      nameSize: 17,
      nameColor: "#000000",
      nameCaps: false,
      nameRule: "0.75pt solid #000000",
      contactColor: "#000000",
      headlineColor: "#000000",
      headingSize: 12,
      headingColor: "#000000",
      headingCaps: true,
      headingRule: "none",
      bodyColor: "#000000",
      metaColor: "#000000",
    },
  },
  professional: {
    id: "professional",
    name: "Professional",
    tagline: "Restrained colour",
    bestFor: "Office, professional and management roles",
    notes:
      "Navy typography with a thin FirstJobly accent rule while staying fully machine-readable.",
    order: STANDARD,
    style: {
      font: "Calibri, Arial, sans-serif",
      body: 11.5,
      lineHeight: 1.42,
      sectionGap: 16,
      itemGap: 11,
      paddingMm: 19,
      nameSize: 19,
      nameColor: "#061A30",
      nameCaps: false,
      nameRule: "none",
      contactColor: "#333F4F",
      headlineColor: "#061A30",
      headingSize: 13,
      headingColor: "#061A30",
      headingCaps: true,
      headingRule: "1pt solid #E1225F",
      bodyColor: "#111111",
      metaColor: "#333F4F",
    },
  },
  graduate: {
    id: "graduate",
    name: "Graduate / First Job",
    tagline: "Education first",
    bestFor: "TVET, graduate and first-job applicants",
    notes:
      "Education and matric results appear early, with space for leadership, volunteering and activities.",
    order: [
      "summary",
      "education",
      "experience",
      "skills",
      "certifications",
      "languages",
      "references",
    ],
    style: {
      font: "Arial, Helvetica, sans-serif",
      body: 11,
      lineHeight: 1.45,
      sectionGap: 15,
      itemGap: 10,
      paddingMm: 18,
      nameSize: 18,
      nameColor: "#000000",
      nameCaps: false,
      nameRule: "0.75pt solid #9AA3AF",
      contactColor: "#1F2937",
      headlineColor: "#000000",
      headingSize: 12.5,
      headingColor: "#000000",
      headingCaps: true,
      headingRule: "0.5pt solid #9AA3AF",
      bodyColor: "#000000",
      metaColor: "#1F2937",
    },
  },
  skills: {
    id: "skills",
    name: "Skills-Based",
    tagline: "Competencies first",
    bestFor: "Trades, technical roles, career changers and employment gaps",
    notes:
      "Core skills lead and work history follows, using the SA-recognised functional format.",
    order: [
      "summary",
      "skills",
      "experience",
      "education",
          "certifications",
      "languages",
      "references",
    ],
    style: {
      font: "Calibri, Arial, sans-serif",
      body: 11.5,
      lineHeight: 1.4,
      sectionGap: 14,
      itemGap: 10,
      paddingMm: 18,
      nameSize: 18,
      nameColor: "#000000",
      nameCaps: true,
      nameRule: "0.75pt solid #000000",
      contactColor: "#000000",
      headlineColor: "#000000",
      headingSize: 12,
      headingColor: "#000000",
      headingCaps: true,
      headingRule: "none",
      bodyColor: "#000000",
      metaColor: "#222222",
    },
  },
  compact: {
    id: "compact",
    name: "Compact One-Page",
    tagline: "Built for phone screening",
    bestFor: "Retail, hospitality, general workers and high-volume roles",
    notes:
      "Tighter typography and spacing for recruiters scanning quickly on a phone.",
    order: [
      "summary",
      "experience",
      "skills",
      "education",
          "certifications",
      "languages",
      "references",
    ],
    style: {
      font: "Arial, Helvetica, sans-serif",
      body: 10,
      lineHeight: 1.3,
      sectionGap: 9,
      itemGap: 6,
      paddingMm: 14,
      nameSize: 17,
      nameColor: "#000000",
      nameCaps: true,
      nameRule: "1pt solid #000000",
      contactColor: "#000000",
      headlineColor: "#000000",
      headingSize: 13,
      headingColor: "#000000",
      headingCaps: true,
      headingRule: "none",
      bodyColor: "#000000",
      metaColor: "#000000",
    },
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

let counter = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${++counter}`;

export const emptyExperience = (): Experience => ({
  id: id("exp"),
  jobTitle: "",
  company: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  bullets: "",
});

export const emptyEducation = (): Education => ({
  id: id("edu"),
  qualification: "",
  institution: "",
  nqfLevel: "",
  year: "",
  notes: "",
});

export const emptyCertification = (): Certification => ({
  id: id("cert"),
  name: "",
  issuer: "",
  year: "",
});

export const emptyReference = (): Reference => ({
  id: id("ref"),
  name: "",
  relationship: "",
  phone: "",
  email: "",
});

export const emptyCv = (): CvData => ({
  firstName: "",
  lastName: "",
  headline: "",
  email: "",
  phone: "",
  city: "",
  province: "",
  link: "",
  summary: "",
  experience: [emptyExperience()],
  education: [emptyEducation()],
  skills: "",
  languages: "",
  certifications: [],
  references: [emptyReference(), emptyReference()],
  referencesOnRequest: false,
  includeCertifications: false,
  includeLanguages: true,
});

export const lines = (v: string) =>
  v
    .split("\n")
    .map((x) => x.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);

const esc = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const sectionTitle: Record<SectionId, string> = {
  summary: "Professional Summary",
  education: "Education",
  experience: "Work Experience",
  skills: "Core Skills",
  certifications: "Certifications",
  languages: "Languages",
  references: "References",
};

export function fileBase(data: CvData) {
  const parts = [data.firstName, data.lastName]
    .map((s) => s.trim().replace(/[^A-Za-z0-9]+/g, ""))
    .filter(Boolean);
  return parts.length ? `${parts.join("_")}_CV` : "My_CV";
}

export function cvHtml(data: CvData, templateId: TemplateId) {
  const t = TEMPLATES[templateId];
  const s = t.style;
  const name = `${data.firstName} ${data.lastName}`.trim() || "Your Name";

  const heading = (section: SectionId) =>
    `<h2>${esc(sectionTitle[section])}</h2>`;

  const render = (section: SectionId) => {
    if (section === "summary") {
      return data.summary.trim()
        ? `${heading(section)}<p>${esc(data.summary)}</p>`
        : "";
    }

    if (section === "experience") {
      const rows = data.experience.filter(
        (x) => x.jobTitle || x.company || x.bullets
      );
      if (!rows.length) return "";
      return `${heading(section)}${rows
        .map((x) => {
          const range = [
            x.startDate,
            x.current ? "Present" : x.endDate,
          ]
            .filter(Boolean)
            .join(" · ");
          return `<div class="item">
            <div class="entry-title">${esc(x.jobTitle)}</div>
            <div class="meta">${esc(
              [x.company, x.location, range].filter(Boolean).join(" · ")
            )}</div>
            ${
              lines(x.bullets).length
                ? `<ul>${lines(x.bullets)
                    .map((b) => `<li>${esc(b)}</li>`)
                    .join("")}</ul>`
                : ""
            }
          </div>`;
        })
        .join("")}`;
    }

    if (section === "education") {
      const rows = data.education.filter(
        (x) => x.qualification || x.institution
      );
      if (!rows.length) return "";
      return `${heading(section)}${rows
        .map(
          (x) => `<div class="item">
          <div class="entry-title">${esc(x.qualification)}</div>
          <div class="meta">${esc(
            [x.institution, x.nqfLevel, x.year].filter(Boolean).join(" · ")
          )}</div>
          ${x.notes ? `<p>${esc(x.notes)}</p>` : ""}
        </div>`
        )
        .join("")}`;
    }


    if (section === "skills") {
      return data.skills.trim()
        ? `${heading(section)}<ul>${lines(data.skills)
            .map((x) => `<li>${esc(x)}</li>`)
            .join("")}</ul>`
        : "";
    }

    if (section === "certifications") {
      if (!data.includeCertifications || !data.certifications.length) return "";
      const rows = data.certifications.filter((x) => x.name);
      if (!rows.length) return "";
      return `${heading(section)}${rows
        .map(
          (x) =>
            `<p><strong>${esc(x.name)}</strong>${esc(
              [x.issuer, x.year].filter(Boolean).length
                ? ` · ${[x.issuer, x.year].filter(Boolean).join(" · ")}`
                : ""
            )}</p>`
        )
        .join("")}`;
    }

    if (section === "languages") {
      return data.includeLanguages && data.languages.trim()
        ? `${heading(section)}<p>${lines(data.languages)
            .map(esc)
            .join(" · ")}</p>`
        : "";
    }

    if (section === "references") {
      if (data.referencesOnRequest) {
        return `${heading(section)}<p>Available on request.</p>`;
      }
      const rows = data.references.filter((x) => x.name);
      if (!rows.length) return "";
      return `${heading(section)}${rows
        .map(
          (x) => `<div class="item">
          <div class="entry-title">${esc(x.name)}</div>
          <div class="meta">${esc(
            [x.relationship, x.phone, x.email].filter(Boolean).join(" · ")
          )}</div>
        </div>`
        )
        .join("")}`;
    }

    return "";
  };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ${s.font};
  font-size: ${s.body}pt;
  line-height: ${s.lineHeight};
  color: ${s.bodyColor};
}
.page {
  width: 210mm;
  min-height: 297mm;
  padding: ${s.paddingMm}mm;
}
h1 {
  margin: 0;
  font-size: ${s.nameSize}pt;
  font-weight: 700;
  color: ${s.nameColor};
  text-transform: ${s.nameCaps ? "uppercase" : "none"};
  padding-bottom: 5pt;
  border-bottom: ${s.nameRule};
}
.headline {
  color: ${s.headlineColor};
  font-weight: 700;
  margin-top: 4pt;
}
.contact {
  color: ${s.contactColor};
  font-size: ${Math.max(9, s.body - 1)}pt;
  margin-top: 4pt;
}
h2 {
  font-size: ${s.headingSize}pt;
  color: ${s.headingColor};
  font-weight: 700;
  text-transform: ${s.headingCaps ? "uppercase" : "none"};
  margin: ${s.sectionGap}pt 0 5pt;
  padding-bottom: 3pt;
  border-bottom: ${s.headingRule};
  letter-spacing: .03em;
}
p { margin: 0 0 4pt; white-space: pre-wrap; }
.item { margin-bottom: ${s.itemGap}pt; }
.entry-title { font-weight: 700; }
.meta { color: ${s.metaColor}; font-size: ${Math.max(9, s.body - 1)}pt; }
ul { margin: 3pt 0 0; padding-left: 16pt; }
li { margin-bottom: 2pt; }
</style>
</head>
<body>
<div class="page">
  <h1>${esc(name)}</h1>
  ${data.headline ? `<div class="headline">${esc(data.headline)}</div>` : ""}
  <div class="contact">${[
    data.email,
    data.phone,
    [data.city, data.province].filter(Boolean).join(", "),
    data.link,
  ]
    .filter(Boolean)
    .map(esc)
    .join(" · ")}</div>
  ${t.order.map(render).join("")}
</div>
</body>
</html>`;
}
