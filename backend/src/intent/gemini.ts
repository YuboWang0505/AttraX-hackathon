import type { IntentCode, Intensity } from "@attrax/shared";
import { INTENT_TABLE } from "./table.js";

export interface ClassifyResult {
  intent_code: IntentCode;
  intensity: Intensity;
  source: "gemini" | "fallback" | "timeout" | "parse_error" | "no_key";
}

const FALLBACK: Omit<ClassifyResult, "source"> = {
  intent_code: "S_TEASE_LIGHT",
  intensity: 1,
};

const KNOWN_CODES = new Set(INTENT_TABLE.map((r) => r.code));

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 1500;

/**
 * Layer-2 semantic classifier. When GEMINI_API_KEY is absent, returns the
 * documented fallback (S_TEASE_LIGHT / intensity=1) synchronously — this is
 * the primary path during hackathon development. When the key is present,
 * calls the real API with a 1.5s timeout and JSON-only structured output.
 */
export async function classify(text: string): Promise<ClassifyResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ...FALLBACK, source: "no_key" };
  }

  const systemPrompt = buildSystemPrompt();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 128,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ...FALLBACK, source: "fallback" };
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeParse(raw);
    if (!parsed) {
      return { ...FALLBACK, source: "parse_error" };
    }
    const intent_code = KNOWN_CODES.has(parsed.intent_code as IntentCode)
      ? (parsed.intent_code as IntentCode)
      : "S_TEASE_LIGHT";
    const intensity = coerceIntensity(parsed.intensity);
    return { intent_code, intensity, source: "gemini" };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = (err as Error)?.name === "AbortError";
    return { ...FALLBACK, source: isAbort ? "timeout" : "fallback" };
  }
}

function safeParse(raw: string): { intent_code?: string; intensity?: number } | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function coerceIntensity(v: unknown): Intensity {
  if (v === 0 || v === 1 || v === 2 || v === 3) return v;
  return 1;
}

function buildSystemPrompt(): string {
  const lines = INTENT_TABLE.map(
    (r) =>
      `${r.code} (intensity=${r.intensity}, ${r.description}): ${r.keywords.join(", ")}`,
  ).join("\n");
  return `You classify Chinese SM-dialog text from the dominant partner into a vibration intensity level (0-3) for a remote toy.

Intents:
${lines}

Rules:
- Pick exactly one intent_code from the list above.
- intensity must equal the level for that intent_code, in {0,1,2,3}.
- If the message is soft / warm / aftercare, prefer intensity 1.
- If the message is a command / tease / warning, prefer intensity 2.
- Only use intensity 3 for explicit climax / severe-punishment / high-reward content.
- When unsure, default to S_TEASE_LIGHT (intensity=1).

Respond with JSON only: {"intent_code":"...", "intensity":0|1|2|3}`;
}
