const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 20000;

const MAX = {
  professionalTitle: 120,
  skills: 1200,
  jobTitle: 120,
  company: 120,
  existingText: 1600,
};

const SA_CONTEXT = `You write CVs for job seekers in South Africa. Use South African English
(organise, programme, matric, NQF, learnership, R for rands). Never invent qualifications,
employers, dates, achievements, metrics, software or numbers that were not supplied. Never mention
race, gender, age, ID number, marital status or a photo. Plain professional language a recruiter can
skim, no buzzword padding, no em dashes.`;

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function promptFor(input) {
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

async function verifyUser(token) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase verification is not configured");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
}

function extractText(payload) {
  return (
    payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim() || ""
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Sign in to use AI Assist." });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error("[cv-ai] GEMINI_API_KEY is missing");
    return res.status(503).json({ error: "AI service is not configured." });
  }

  try {
    const user = await verifyUser(token);
    if (!user) {
      return res.status(401).json({ error: "Sign in to use AI Assist." });
    }
  } catch (error) {
    console.error("[cv-ai] user verification failed", error);
    return res.status(503).json({ error: "Authentication service unavailable." });
  }

  const body = req.body || {};
  if (body.purpose !== "summary" && body.purpose !== "experience") {
    return res.status(400).json({ error: "Invalid AI request purpose." });
  }

  const input = {
    purpose: body.purpose,
    professionalTitle: clean(body.professionalTitle, MAX.professionalTitle),
    skills: clean(body.skills, MAX.skills),
    jobTitle: clean(body.jobTitle, MAX.jobTitle),
    company: clean(body.company, MAX.company),
    existingText: clean(body.existingText, MAX.existingText),
  };

  if (input.purpose === "summary" && !input.professionalTitle) {
    return res.status(400).json({ error: "Add a professional title before using AI Assist." });
  }
  if (input.purpose === "experience" && !input.jobTitle) {
    return res.status(400).json({ error: "Add a job title before using AI Assist." });
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
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SA_CONTEXT }] },
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
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {}

    if (!response.ok) {
      const message = payload?.error?.message || raw.slice(0, 300) || "Unknown Gemini error";
      console.error("[cv-ai] Gemini failed", { status: response.status, message });

      if (response.status === 429) {
        return res.status(429).json({ error: "Too many AI requests. Try again shortly." });
      }
      if (response.status === 401 || response.status === 403) {
        return res.status(502).json({ error: "AI service authentication failed." });
      }
      return res.status(502).json({ error: "AI generation failed. Please retry." });
    }

    const text = extractText(payload);
    if (!text) {
      console.error("[cv-ai] Gemini returned no text", raw.slice(0, 500));
      return res.status(502).json({ error: "AI returned no text. Please retry." });
    }

    return res.status(200).json({ text: text.slice(0, 2400) });
  } catch (error) {
    if (error?.name === "AbortError") {
      console.error("[cv-ai] Gemini request timed out");
      return res.status(504).json({ error: "AI request timed out. Please retry." });
    }

    console.error("[cv-ai] Unexpected failure", error);
    return res.status(502).json({ error: "AI generation failed. Please retry." });
  } finally {
    clearTimeout(timer);
  }
}
