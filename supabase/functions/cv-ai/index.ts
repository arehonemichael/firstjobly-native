type Purpose = "summary" | "experience";

type CvAiInput = {
  purpose?: unknown;
  professionalTitle?: unknown;
  skills?: unknown;
  jobTitle?: unknown;
  company?: unknown;
  existingText?: unknown;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 20_000;

const MAX = {
  professionalTitle: 120,
  skills: 1200,
  jobTitle: 120,
  company: 120,
  existingText: 1600,
} as const;

const SA_CONTEXT = `You write CVs for job seekers in South Africa. Use South African English
(organise, programme, matric, NQF, learnership, R for rands). Never invent qualifications,
employers, dates, achievements, metrics, software or numbers that were not supplied. Never mention
race, gender, age, ID number, marital status or a photo. Plain professional language a recruiter can
skim, no buzzword padding, no em dashes.`;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function promptFor(input: {
  purpose: Purpose;
  professionalTitle: string;
  skills: string;
  jobTitle: string;
  company: string;
  existingText: string;
}) {
  if (input.purpose === "summary") {
    return [
      "Write the Professional Summary section of a CV.",
      `Professional title: ${input.professionalTitle}`,
      input.skills ? `Known skills: ${input.skills}` : "",
      input.existingText
        ? `Current draft (improve it without inventing facts): ${input.existingText}`
        : "",
      "",
      "Rules:",
      "- Output only the final summary paragraph.",
      "- 2 to 4 short sentences, ATS friendly.",
      "- Do not use first person pronouns.",
      "- Only use facts explicitly supplied above; stay general if information is limited.",
      "- No heading, quotation marks, bullets or preamble.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "Write CV-ready work experience bullet points for a South African job seeker.",
    `Job title: ${input.jobTitle}`,
    input.company ? `Company: ${input.company}` : "",
    input.professionalTitle ? `Professional title: ${input.professionalTitle}` : "",
    input.skills ? `Known skills: ${input.skills}` : "",
    input.existingText ? `Known duties or current draft: ${input.existingText}` : "",
    "",
    "Rules:",
    "- Output only 3 to 5 bullet points, one per line, no bullet symbols.",
    "- Clear action-led CV language.",
    "- Do not invent metrics, systems, tools, achievements or responsibilities.",
    "- If almost no duties are supplied, write conservative responsibilities inherent to the named role.",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractText(payload: GeminiResponse) {
  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Sign in to use AI Assist." }, 401);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[cv-ai] GEMINI_API_KEY is missing");
    return json({ error: "AI service is not configured." }, 503);
  }

  let body: CvAiInput;
  try {
    body = (await request.json()) as CvAiInput;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (body.purpose !== "summary" && body.purpose !== "experience") {
    return json({ error: "Invalid AI request purpose." }, 400);
  }

  const input = {
    purpose: body.purpose as Purpose,
    professionalTitle: clean(body.professionalTitle, MAX.professionalTitle),
    skills: clean(body.skills, MAX.skills),
    jobTitle: clean(body.jobTitle, MAX.jobTitle),
    company: clean(body.company, MAX.company),
    existingText: clean(body.existingText, MAX.existingText),
  };

  if (input.purpose === "summary" && !input.professionalTitle) {
    return json({ error: "Add a professional title before using AI Assist." }, 400);
  }
  if (input.purpose === "experience" && !input.jobTitle) {
    return json({ error: "Add a job title before using AI Assist." }, 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SA_CONTEXT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: promptFor(input) }],
            },
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 900,
          },
        }),
        signal: controller.signal,
      },
    );

    const raw = await response.text();
    let payload: GeminiResponse | null = null;
    try {
      payload = raw ? (JSON.parse(raw) as GeminiResponse) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const upstreamMessage = payload?.error?.message ?? raw.slice(0, 300);
      console.error("[cv-ai] Gemini request failed", {
        status: response.status,
        message: upstreamMessage,
      });

      if (response.status === 429) {
        return json({ error: "Too many AI requests. Try again shortly." }, 429);
      }
      if (response.status === 401 || response.status === 403) {
        return json({ error: "AI service authentication failed." }, 502);
      }
      return json({ error: "AI generation failed. Please retry." }, 502);
    }

    const text = payload ? extractText(payload) : "";
    if (!text) {
      console.error("[cv-ai] Gemini returned no text", { raw: raw.slice(0, 500) });
      return json({ error: "AI returned no text. Please retry." }, 502);
    }

    return json({ text: text.slice(0, 2400) });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[cv-ai] Gemini request timed out");
      return json({ error: "AI request timed out. Please retry." }, 504);
    }

    console.error("[cv-ai] Unexpected Gemini failure", error);
    return json({ error: "AI generation failed. Please retry." }, 502);
  } finally {
    clearTimeout(timer);
  }
});
