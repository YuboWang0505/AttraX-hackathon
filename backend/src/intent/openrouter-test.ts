import "dotenv/config";
import type { Intensity } from "@attrax/shared";

interface TestCase {
  text: string;
  /** Legacy label kept only for human reference in test output. */
  expected_code: string;
  expected_intensity: Intensity;
  note?: string;
}

// Direct intensity mode — no intent_code middleman, no keyword table.
// LLM reads the message, infers dominant-partner intent, outputs intensity
// and a short natural-language reason (for debugging, not used by hardware).
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

const TEST_CASES: TestCase[] = [
  // ── direct keyword hits (sanity baseline) ──
  { text: "乖,放松", expected_code: "S_WARM_UP", expected_intensity: 1 },
  { text: "宝贝,慢慢来", expected_code: "S_WARM_UP", expected_intensity: 1 },
  { text: "在干嘛呢", expected_code: "S_GREET_WARM", expected_intensity: 1 },
  { text: "主人来了,跪下", expected_code: "S_GREET_DOM", expected_intensity: 2 },
  { text: "轻一点,感受一下", expected_code: "S_TEASE_LIGHT", expected_intensity: 1 },
  { text: "湿了吗?想要就求我", expected_code: "S_TEASE_HEAVY", expected_intensity: 2 },
  { text: "含住,不许吐出来", expected_code: "S_COMMAND_DAILY", expected_intensity: 2 },
  { text: "给我跪好,腿分开", expected_code: "S_COMMAND_POSTURE", expected_intensity: 2 },
  { text: "叫出来,大声点", expected_code: "S_COMMAND_VERBAL", expected_intensity: 2 },
  { text: "不准丢,忍住", expected_code: "S_DENIAL_CONTROL", expected_intensity: 1 },
  { text: "胆子大了?皮痒了是吧", expected_code: "S_WARNING", expected_intensity: 2 },
  { text: "认错没有,罚你五下", expected_code: "S_PUNISH_LIGHT", expected_intensity: 2 },
  { text: "今天必须狠狠惩罚你", expected_code: "S_PUNISH_STRICT", expected_intensity: 3 },
  { text: "赏你一次,丢吧", expected_code: "S_CLIMAX_PERMISSION", expected_intensity: 3 },
  { text: "给我丢,现在就丢出来", expected_code: "S_CLIMAX_FORCED", expected_intensity: 3 },
  { text: "表现真棒,全给你", expected_code: "S_REWARD_HIGH", expected_intensity: 3 },
  { text: "过来抱抱,辛苦了", expected_code: "S_AFTERCARE", expected_intensity: 1 },

  // ── paraphrased / no direct keyword (this is where LLM should shine) ──
  { text: "别紧张,深呼吸一下", expected_code: "S_WARM_UP", expected_intensity: 1 },
  { text: "今晚准备好怎么伺候我了吗", expected_code: "S_GREET_DOM", expected_intensity: 2 },
  { text: "你身体是不是已经开始骚动了", expected_code: "S_TEASE_HEAVY", expected_intensity: 2 },
  { text: "马上趴成我昨天教你的样子", expected_code: "S_COMMAND_POSTURE", expected_intensity: 2 },
  { text: "敢出声就加倍惩罚", expected_code: "S_WARNING", expected_intensity: 2 },
  { text: "可以释放了宝贝", expected_code: "S_CLIMAX_PERMISSION", expected_intensity: 3 },
  { text: "今晚你做得非常好,所有奖励都给你", expected_code: "S_REWARD_HIGH", expected_intensity: 3 },
  { text: "累坏了吧,过来让我揉揉", expected_code: "S_AFTERCARE", expected_intensity: 1 },

  // ── ambiguous / off-topic (should fall back to S_TEASE_LIGHT intensity=1) ──
  { text: "今天天气不错", expected_code: "S_TEASE_LIGHT", expected_intensity: 1, note: "off-topic → fallback" },
  { text: "你吃饭了吗", expected_code: "S_TEASE_LIGHT", expected_intensity: 1, note: "casual, no dom tone" },
  { text: "嗯", expected_code: "S_TEASE_LIGHT", expected_intensity: 1, note: "single particle" },

  // ── tricky: contains 3-档 keyword but in innocent context ──
  { text: "我现在给你倒杯水", expected_code: "S_TEASE_LIGHT", expected_intensity: 1, note: "'给你' is innocuous here" },
  { text: "规矩我都记得清清楚楚", expected_code: "S_TEASE_LIGHT", expected_intensity: 1, note: "'规矩' is not a warning" },
];

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 15_000;

interface ClassifyResult {
  intensity: number | null;
  reason: string | null;
  raw: string;
  error?: string;
  latencyMs: number;
}

async function classify(
  text: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
): Promise<ClassifyResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost/attrax-hackathon",
        "X-Title": "AttraX Intent Classifier Test",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.2,
        max_tokens: 80,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const body = await res.text();
      return { intensity: null, reason: null, raw: body, error: `HTTP ${res.status}`, latencyMs };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParse(raw);
    if (!parsed) {
      return { intensity: null, reason: null, raw, error: "JSON parse failed", latencyMs };
    }
    return {
      intensity: typeof parsed.intensity === "number" ? parsed.intensity : null,
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
      raw,
      latencyMs,
    };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    const msg = (err as Error)?.message ?? String(err);
    return { intensity: null, reason: null, raw: "", error: msg, latencyMs };
  }
}

function safeParse(raw: string): { intensity?: unknown; reason?: unknown } | null {
  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract JSON from code-fences or surrounding text
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function pad(s: string, n: number): string {
  const visualLen = Array.from(s).reduce(
    (acc, ch) => acc + (ch.charCodeAt(0) > 0x7f ? 2 : 1),
    0,
  );
  return s + " ".repeat(Math.max(0, n - visualLen));
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "x-ai/grok-4-fast";
  if (!apiKey) {
    console.error("Missing OPENROUTER_API_KEY in env (check backend/.env)");
    process.exit(1);
  }

  const systemPrompt = buildSystemPrompt();
  console.log(`Model:   ${model}`);
  console.log(`Cases:   ${TEST_CASES.length}`);
  console.log(`Mode:    direct intensity (no intent_code, no keyword table)`);
  console.log("─".repeat(120));
  console.log(
    [
      pad("#", 4),
      pad("ok", 4),
      pad("input", 40),
      pad("exp", 5),
      pad("got", 5),
      pad("ms", 6),
      "reason / note",
    ].join(""),
  );
  console.log("─".repeat(120));

  let correctIntensity = 0;
  let totalLatency = 0;
  const misses: { i: number; tc: TestCase; got: number | null; reason: string | null }[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const r = await classify(tc.text, apiKey, model, systemPrompt);
    totalLatency += r.latencyMs;

    const intenOk = r.intensity === tc.expected_intensity;
    if (intenOk) correctIntensity++;
    else misses.push({ i: i + 1, tc, got: r.intensity, reason: r.reason });

    const flag = intenOk ? "✓" : "✗";
    const gotStr = r.intensity === null ? "?" : String(r.intensity);
    const reasonOrNote = r.error ? `ERROR: ${r.error}` : r.reason ?? tc.note ?? "";

    console.log(
      [
        pad(String(i + 1), 4),
        pad(flag, 4),
        pad(tc.text, 40),
        pad(String(tc.expected_intensity), 5),
        pad(gotStr, 5),
        pad(String(r.latencyMs), 6),
        reasonOrNote,
      ].join(""),
    );

    if (r.error) {
      console.log(`      raw: ${r.raw.slice(0, 200)}`);
    }
  }

  console.log("─".repeat(120));
  const n = TEST_CASES.length;
  const pct = (x: number) => ((x / n) * 100).toFixed(1) + "%";
  console.log(`intensity correct : ${correctIntensity}/${n} (${pct(correctIntensity)})`);
  console.log(`avg latency       : ${Math.round(totalLatency / n)} ms`);

  if (misses.length) {
    console.log("\nIntensity misses:");
    for (const m of misses) {
      console.log(
        `  #${m.i}  "${m.tc.text}"  expected=${m.tc.expected_intensity}  got=${m.got}  reason="${m.reason ?? ""}"`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
