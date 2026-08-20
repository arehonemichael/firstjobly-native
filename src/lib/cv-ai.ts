import { supabase } from "./supabase";

const WEB_APP_URL = "https://firstjobly.co.za";

export type CvAiPurpose = "summary" | "experience";

type CvAiInput = {
  purpose: CvAiPurpose;
  professionalTitle?: string;
  skills?: string;
  jobTitle?: string;
  company?: string;
  existingText?: string;
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

  const rawText = await response.text();
  console.log("CV AI status:", response.status);
  console.log("CV AI raw response:", rawText);

  const payload = (() => {
    try {
      return JSON.parse(rawText) as { text?: string; error?: string };
    } catch {
      return null;
    }
  })();

  if (!response.ok || !payload?.text) {
    if (response.status === 401) {
      throw new Error("Sign in to use AI Assist.");
    }
    if (response.status === 429) {
      throw new Error("Too many requests — try again shortly.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted.");
    }
    throw new Error(payload?.error || `AI generation failed (${response.status})`);
  }

  return payload.text.trim();
}