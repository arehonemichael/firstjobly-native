import { supabase } from "./supabase";

const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://firstjobly.co.za").replace(/\/$/, "");

export type CvAiPurpose = "summary" | "experience";

type CvAiInput = {
  purpose: CvAiPurpose;
  professionalTitle?: string;
  skills?: string;
  jobTitle?: string;
  company?: string;
  existingText?: string;
};

type CvAiResponse = {
  text?: string;
  error?: string;
};

export async function generateCvText(input: CvAiInput): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Sign in to use AI Assist.");
  }

  const response = await fetch(`${WEB_APP_URL}/api/public/cv-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const raw = await response.text();
  console.log("CV AI status:", response.status);

  let payload: CvAiResponse | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as CvAiResponse) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.text) {
    if (response.status === 401) {
      throw new Error("Sign in again to use AI Assist.");
    }
    if (response.status === 402) {
      throw new Error(payload?.error || "AI credits exhausted.");
    }
    if (response.status === 403) {
      throw new Error(payload?.error || "AI Assist is currently unavailable.");
    }
    if (response.status === 429) {
      throw new Error(payload?.error || "Too many requests. Try again shortly.");
    }
    if (response.status === 503) {
      throw new Error(payload?.error || "AI Assist is not configured.");
    }
    if (response.status === 504) {
      throw new Error(payload?.error || "AI request timed out. Please retry.");
    }
    throw new Error(payload?.error || `AI generation failed (${response.status}).`);
  }

  return payload.text.trim();
}
