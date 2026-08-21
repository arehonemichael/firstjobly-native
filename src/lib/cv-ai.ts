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

export async function generateCvText(input: CvAiInput): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Sign in to use AI Assist.");
  }

  const { data, error } = await supabase.functions.invoke<CvAiResponse>("cv-ai", {
    body: input,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    console.error("CV AI function error:", error);
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const raw = await context.text();
        console.log("CV AI raw response:", raw);
        const payload = JSON.parse(raw) as CvAiResponse;
        throw new Error(payload.error || "AI generation failed.");
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== "AI generation failed.") {
          throw parseError;
        }
      }
    }
    throw new Error("AI generation failed. Please retry.");
  }

  const text = data?.text?.trim();
  if (!text) {
    throw new Error(data?.error || "AI returned no text. Please retry.");
  }

  return text;
}
