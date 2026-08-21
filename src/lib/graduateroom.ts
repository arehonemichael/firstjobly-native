import { supabase } from "./supabase";

export type VerificationStatus =
  | "none"
  | "pending"
  | "verified"
  | "rejected"
  | "revoked";

export type VerificationState = {
  status: VerificationStatus;
  method: "email" | "document" | null;
  institutionName: string | null;
  institutionEmail: string | null;
  reviewNote: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
  codePending: boolean;
  lockedUntil: string | null;
  attemptsLeft: number;
};

export type PostType =
  | "question"
  | "cv_review"
  | "interview_experience"
  | "referral_request"
  | "company_review"
  | "success_story";

export type PostScope = "all" | "saved" | "mine";

export type PostAuthor = {
  name: string | null;
  anonymous: boolean;
  institution: string | null;
  verified: boolean;
  isMine: boolean;
};

export type CommunityPost = {
  id: string;
  postType: PostType;
  institution: string | null;
  title: string;
  body: string;
  author: PostAuthor;
  upvoteCount: number;
  commentCount: number;
  viewerVoted: boolean;
  viewerSaved: boolean;
  removed: boolean;
  createdAt: string;
};

export type CommunityComment = {
  id: string;
  parentId: string | null;
  body: string;
  author: PostAuthor;
  removed: boolean;
  createdAt: string;
};

export const INSTITUTIONS = [
  "University of Cape Town",
  "University of the Witwatersrand",
  "Stellenbosch University",
  "University of Pretoria",
  "University of Johannesburg",
  "University of KwaZulu-Natal",
  "North-West University",
  "Rhodes University",
  "University of the Free State",
  "Nelson Mandela University",
  "University of the Western Cape",
  "University of Limpopo",
  "University of Venda",
  "University of Zululand",
  "University of Fort Hare",
  "University of Mpumalanga",
  "Sol Plaatje University",
  "Walter Sisulu University",
  "Sefako Makgatho Health Sciences University",
  "University of South Africa (UNISA)",
  "Tshwane University of Technology",
  "Durban University of Technology",
  "Cape Peninsula University of Technology",
  "Vaal University of Technology",
  "Central University of Technology",
  "Mangosuthu University of Technology",
  "Central Johannesburg TVET College",
  "Ekurhuleni East TVET College",
  "Ekurhuleni West TVET College",
  "Sedibeng TVET College",
  "South West Gauteng TVET College",
  "Tshwane North TVET College",
  "Tshwane South TVET College",
  "Boland TVET College",
  "College of Cape Town",
  "False Bay TVET College",
  "Northlink TVET College",
  "South Cape TVET College",
  "West Coast TVET College",
  "Coastal KZN TVET College",
  "Elangeni TVET College",
  "Esayidi TVET College",
  "Majuba TVET College",
  "Mthashana TVET College",
  "Thekwini TVET College",
  "Umfolozi TVET College",
  "Umgungundlovu TVET College",
  "Buffalo City TVET College",
  "East Cape Midlands TVET College",
  "King Hintsa TVET College",
  "Lovedale TVET College",
  "Port Elizabeth TVET College",
  "Capricorn TVET College",
  "Lephalale TVET College",
  "Mopani South East TVET College",
  "Sekhukhune TVET College",
  "Vhembe TVET College",
  "Waterberg TVET College",
  "Ehlanzeni TVET College",
  "Gert Sibande TVET College",
  "Nkangala TVET College",
  "Orbit TVET College",
  "Taletso TVET College",
  "Vuselela TVET College",
  "Flavius Mareka TVET College",
  "Goldfields TVET College",
  "Maluti TVET College",
  "Motheo TVET College",
  "Northern Cape Rural TVET College",
  "Northern Cape Urban TVET College",
  "Rosebank College (IIE)",
  "Varsity College (IIE)",
  "IIE MSA (Monash South Africa)",
  "Vega School (IIE)",
  "Boston City Campus & Business College",
  "Damelin",
  "Eduvos",
  "CTI Education Group",
  "Milpark Education",
  "Regent Business School",
  "Mancosa",
  "AFDA (School for the Creative Economy)",
  "Stadio Higher Education",
  "Richfield Graduate Institute of Technology",
  "Akademia",
  "SACAP (South African College of Applied Psychology)",
  "Da Vinci Institute",
  "Henley Business School Africa",
  "IMM Graduate School",
  "Oxbridge Academy",
  "Lyceum College",
  "Cornerstone Institute",
  "Helderberg College of Higher Education",
  "St Augustine College of South Africa",
  "Red & Yellow Creative School of Business",
  "The Open Window Institute",
  "Inscape Education Group",
  "Prestige Academy",
  "SAE Institute South Africa",
  "Berea Technical College",
  "Central Technical College",
  "Optimi College",
  "Other institution",
] as const;

export const POST_TYPES: {
  value: PostType;
  label: string;
  hint: string;
}[] = [
  {
    value: "question",
    label: "General question",
    hint: "Ask the community anything career-related",
  },
  {
    value: "cv_review",
    label: "CV review request",
    hint: "Ask for feedback on your CV",
  },
  {
    value: "interview_experience",
    label: "Interview experience",
    hint: "What the process was actually like",
  },
  {
    value: "referral_request",
    label: "Internship / referral request",
    hint: "Looking for a lead or a referral",
  },
  {
    value: "company_review",
    label: "Company review",
    hint: "Your honest experience of an employer",
  },
  {
    value: "success_story",
    label: "Success story",
    hint: "Share a win to help others",
  },
];

export const POST_TYPE_LABELS = Object.fromEntries(
  POST_TYPES.map((item) => [item.value, item.label]),
) as Record<PostType, string>;

export const COMMUNITY_REPORT_REASONS = [
  "Harassment or abuse",
  "Hate speech or discrimination",
  "Spam or advertising",
  "Scam or fraudulent offer",
  "Personal information shared",
  "Sexual or explicit content",
  "Misinformation",
  "Other",
] as const;

const API_BASE =
  process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") ||
  "https://firstjobly.co.za";

const inFlightListRequests = new Map<string, Promise<unknown>>();

async function requestGraduateRoom<T>(
  action: string,
  data: Record<string, unknown>,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) throw new Error("Please sign in to use GraduateRoom.");

  const response = await fetch(`${API_BASE}/api/graduateroom`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, data }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new Error(payload.error || "GraduateRoom request failed.");
  }

  return payload as T;
}

export async function graduateRoomApi<T>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  if (action !== "list-posts") {
    return requestGraduateRoom<T>(action, data);
  }

  const key = JSON.stringify(data);
  const existing = inFlightListRequests.get(key);
  if (existing) return existing as Promise<T>;

  const request = requestGraduateRoom<T>(action, data).finally(() => {
    if (inFlightListRequests.get(key) === request) {
      inFlightListRequests.delete(key);
    }
  });

  inFlightListRequests.set(key, request);
  return request;
}

export function relativeTime(value: string) {
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString();
}
