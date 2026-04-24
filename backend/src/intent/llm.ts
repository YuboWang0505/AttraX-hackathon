import type { Intensity } from "@attrax/shared";

export interface LlmResult {
  intensity: Intensity;
  reason: string | null;
  source: "llm" | "fallback" | "timeout" | "parse_error" | "no_key";
}

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 1500;
const DEFAULT_MODEL = "x-ai/grok-4-fast";
const MAX_REASON_LEN = 40;

const FALLBACK: Omit<LlmResult, "source"> = {
  intensity: 1,
  reason: null,
};

function buildSystemPrompt(): string {
  return `You are the control brain of a remote vibrator worn by the submissive partner (M). You read each message from the dominant partner (S) and decide how the toy should respond RIGHT NOW.

Output one integer intensity 0-3:

- 0 = STOP. Safety word invoked or an explicit command to halt.
- 1 = LIGHT. Soft mood — warm-up, tease-lite, aftercare, ambiguous or off-topic chit-chat, denial/hold-back phrases ("不准丢, 忍住").
- 2 = MEDIUM. Active command, heavy tease, warning / reprimand, light punishment. The dom is issuing an order or escalating heat.
- 3 = STRONG. Explicit climax permission/force, severe punishment, or high praise/reward marking a peak.

Guidance:
- Judge by overall tone + intent, not isolated words.
- Do NOT pattern-match individual words. "我给你倒杯水" is intensity 1 (innocuous daily speech), not 3.
- When unclear, default to 1.

Respond with JSON only: {"intensity": 0|1|2|3, "reason": "short phrase, ≤ 12 Chinese chars"}`;
}

export async function classify(text: string): Promise<LlmResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ...FALLBACK, source: "no_key" };
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost/attrax-hackathon",
        "X-Title": "AttraX",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: text },
        ],
        temperature: 0.2,
        max_tokens: 80,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return { ...FALLBACK, source: "fallback" };

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParse(raw);
    if (!parsed) return { ...FALLBACK, source: "parse_error" };

    return {
      intensity: coerceIntensity(parsed.intensity),
      reason:
        typeof parsed.reason === "string"
          ? parsed.reason.slice(0, MAX_REASON_LEN)
          : null,
      source: "llm",
    };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = (err as Error)?.name === "AbortError";
    return { ...FALLBACK, source: isAbort ? "timeout" : "fallback" };
  }
}

function safeParse(
  raw: string,
): { intensity?: unknown; reason?: unknown } | null {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function coerceIntensity(v: unknown): Intensity {
  if (v === 0 || v === 1 || v === 2 || v === 3) return v;
  return 1;
}
