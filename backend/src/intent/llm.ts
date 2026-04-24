import type { Intensity } from "@attrax/shared";

export interface LlmResult {
  /** null means "not a directive, hold current intensity". */
  intensity: Intensity | null;
  reason: string | null;
  source: "llm" | "fallback" | "timeout" | "parse_error" | "no_key";
}

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 1500;
const DEFAULT_MODEL = "x-ai/grok-4-fast";
const MAX_REASON_LEN = 40;

// Safe fallback on any error: do NOT force a level. Holding current
// intensity is safer than dropping to 1 when the network hiccups.
const FALLBACK: Omit<LlmResult, "source"> = {
  intensity: null,
  reason: null,
};

function buildSystemPrompt(): string {
  return `You read the dominant partner (S)'s chat message and decide whether it is a DIRECTIVE to change a remote vibrator's intensity level. Most chat messages are NOT directives — they are acknowledgements, questions, pacing cues, or casual conversation. Only return an intensity value when the message clearly wants to change the current level.

Output:
- 0 = STOP (safe word — rarely needed, handled elsewhere)
- 1 = LIGHT — clearly softening, aftercare, or calming down ("乖,放松", "抱抱,辛苦了", "别紧张", "过来让我揉揉")
- 2 = MEDIUM — clearly commanding or escalating ("给我跪好", "湿了吗,想要就求我", "皮痒了是吧", "认错没有", "叫出来大声点")
- 3 = STRONG — explicit climax permit/force, severe punishment, or peak reward ("给我丢", "赏你一次,丢吧", "狠狠惩罚你", "表现真棒,全给你")
- null = HOLD — the message is NOT an intensity directive. Keep current level unchanged. This is the DEFAULT.

Return null for ALL of these (non-exhaustive):
- Acknowledgements: "嗯", "好", "哦", "对"
- Questions or pure check-ins: "还好吗", "听得到吗"
- Emotional reactions / laughter: "哈哈", "真乖", "可爱"
- Pacing cues without level change: "慢慢来", "坚持住", "再给你三十秒", "数到三"
- Off-topic / daily chatter: "今天天气不错", "你吃饭了吗"
- Sentences containing keywords in innocent context: "我给你倒杯水", "规矩我都记得"
- Anything where you are not confident it is a directive

Note: a question can still be a directive when it's teasing pressure, not a real question. "湿了吗,想要就求我" is 2 (tease pushing), "还好吗" is null (pure check-in).

When in doubt, return null. Do NOT default to 1.

Respond with JSON only: {"intensity": 0|1|2|3|null, "reason": "short phrase, ≤ 12 Chinese chars"}`;
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
    } satisfies LlmResult;
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

function coerceIntensity(v: unknown): Intensity | null {
  if (v === 0 || v === 1 || v === 2 || v === 3) return v;
  // null / undefined / "null" string all collapse to HOLD
  return null;
}
