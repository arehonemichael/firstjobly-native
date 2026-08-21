import { supabase } from "./supabase";

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

const CV_AI_URL = process.env.EXPO_PUBLIC_CV_AI_URL?.trim();

export async function generateCvText(input: CvAiInput): Promise<string> {
  if (!CV_AI_URL) {
    throw new Error("AI Assist is not configured yet.");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Sign in to use AI Assist.");
  }

  const response = await fetch(CV_AI_URL, {
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
      throw new Error("Sign in to use AI Assist.");
    }
    if (response.status === 429) {
      throw new Error("Too many requests. Try again shortly.");
    }
    if (response.status === 504) {
      throw new Error("AI request timed out. Please retry.");
    }
    throw new Error(payload?.error || `AI generation failed (${response.status}).`);
  }

  return payload.text.trim();
}
