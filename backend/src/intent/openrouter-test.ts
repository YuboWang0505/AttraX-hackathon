import "dotenv/config";
import type { Intensity } from "@attrax/shared";

interface TestCase {
  text: string;
  /** Legacy label kept only for human reference in test output. */
  expected_code: string;
  /** null = HOLD (not a directive, intensity should stay unchanged). */
  expected_intensity: Intensity | null;
  note?: string;
}

// Prompt MUST stay in sync with backend/src/intent/llm.ts
// (duplicated here so the test script is self-contained).
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

const TEST_CASES: TestCase[] = [
  // ── clearly directive: warm-up / aftercare / denial (intensity 1) ──
  { text: "乖,放松", expected_code: "S_WARM_UP", expected_intensity: 1 },
  { text: "宝贝,慢慢来", expected_code: "S_WARM_UP", expected_intensity: null, note: "pacing, not softening" },
  { text: "在干嘛呢", expected_code: "S_GREET_WARM", expected_intensity: null, note: "check-in" },
  { text: "轻一点,感受一下", expected_code: "S_TEASE_LIGHT", expected_intensity: 1 },
  { text: "不准丢,忍住", expected_code: "S_DENIAL_CONTROL", expected_intensity: 1, note: "denial control = hold level low" },
  { text: "过来抱抱,辛苦了", expected_code: "S_AFTERCARE", expected_intensity: 1 },
  { text: "别紧张,深呼吸一下", expected_code: "S_WARM_UP", expected_intensity: 1 },
  { text: "累坏了吧,过来让我揉揉", expected_code: "S_AFTERCARE", expected_intensity: 1 },

  // ── clearly directive: commands / tease / warning / light punish (intensity 2) ──
  { text: "主人来了,跪下", expected_code: "S_GREET_DOM", expected_intensity: 2 },
  { text: "湿了吗?想要就求我", expected_code: "S_TEASE_HEAVY", expected_intensity: 2 },
  { text: "含住,不许吐出来", expected_code: "S_COMMAND_DAILY", expected_intensity: 2 },
  { text: "给我跪好,腿分开", expected_code: "S_COMMAND_POSTURE", expected_intensity: 2 },
  { text: "叫出来,大声点", expected_code: "S_COMMAND_VERBAL", expected_intensity: 2 },
  { text: "胆子大了?皮痒了是吧", expected_code: "S_WARNING", expected_intensity: 2 },
  { text: "认错没有,罚你五下", expected_code: "S_PUNISH_LIGHT", expected_intensity: 2 },
  { text: "今晚准备好怎么伺候我了吗", expected_code: "S_GREET_DOM", expected_intensity: 2 },
  { text: "你身体是不是已经开始骚动了", expected_code: "S_TEASE_HEAVY", expected_intensity: 2 },
  { text: "马上趴成我昨天教你的样子", expected_code: "S_COMMAND_POSTURE", expected_intensity: 2 },
  { text: "敢出声就加倍惩罚", expected_code: "S_WARNING", expected_intensity: 2 },

  // ── clearly directive: climax / severe punish / high reward (intensity 3) ──
  { text: "今天必须狠狠惩罚你", expected_code: "S_PUNISH_STRICT", expected_intensity: 3 },
  { text: "赏你一次,丢吧", expected_code: "S_CLIMAX_PERMISSION", expected_intensity: 3 },
  { text: "给我丢,现在就丢出来", expected_code: "S_CLIMAX_FORCED", expected_intensity: 3 },
  { text: "表现真棒,全给你", expected_code: "S_REWARD_HIGH", expected_intensity: 3 },
  { text: "可以释放了宝贝", expected_code: "S_CLIMAX_PERMISSION", expected_intensity: 3 },
  { text: "今晚你做得非常好,所有奖励都给你", expected_code: "S_REWARD_HIGH", expected_intensity: 3 },

  // ── HOLD: ack / question / pacing / off-topic / innocent context ──
  { text: "嗯", expected_code: "HOLD", expected_intensity: null, note: "bare ack" },
  { text: "好", expected_code: "HOLD", expected_intensity: null, note: "bare ack" },
  { text: "还好吗", expected_code: "HOLD", expected_intensity: null, note: "pure check-in" },
  { text: "哈哈哈", expected_code: "HOLD", expected_intensity: null, note: "laugh reaction" },
  { text: "坚持住", expected_code: "HOLD", expected_intensity: null, note: "encouragement / pacing" },
  { text: "再给你三十秒", expected_code: "HOLD", expected_intensity: null, note: "timing cue" },
  { text: "今天天气不错", expected_code: "HOLD", expected_intensity: null, note: "off-topic" },
  { text: "你吃饭了吗", expected_code: "HOLD", expected_intensity: null, note: "casual chatter" },
  { text: "我现在给你倒杯水", expected_code: "HOLD", expected_intensity: null, note: "'给你' innocuous" },
  { text: "规矩我都记得清清楚楚", expected_code: "HOLD", expected_intensity: null, note: "'规矩' innocuous" },
];

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 15_000;

interface ClassifyResult {
  /** undefined = key missing from JSON, null = LLM returned explicit null. */
  intensity: number | null | undefined;
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
      return { intensity: undefined, reason: null, raw: body, error: `HTTP ${res.status}`, latencyMs };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParse(raw);
    if (!parsed) {
      return { intensity: undefined, reason: null, raw, error: "JSON parse failed", latencyMs };
    }
    let intensity: number | null | undefined;
    if (parsed.intensity === null) intensity = null;
    else if (typeof parsed.intensity === "number") intensity = parsed.intensity;
    else intensity = undefined;
    return {
      intensity,
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
      raw,
      latencyMs,
    };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startedAt;
    const msg = (err as Error)?.message ?? String(err);
    return { intensity: undefined, reason: null, raw: "", error: msg, latencyMs };
  }
}

function safeParse(raw: string): { intensity?: unknown; reason?: unknown } | null {
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

function pad(s: string, n: number): string {
  const visualLen = Array.from(s).reduce(
    (acc, ch) => acc + (ch.charCodeAt(0) > 0x7f ? 2 : 1),
    0,
  );
  return s + " ".repeat(Math.max(0, n - visualLen));
}

function label(v: number | null | undefined): string {
  if (v === null) return "HOLD";
  if (v === undefined) return "?";
  return String(v);
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
  console.log(`Mode:    intensity + HOLD (null = no-change directive)`);
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

  let correct = 0;
  let totalLatency = 0;
  // Confusion matrix rows = expected, cols = got; keys: "0"|"1"|"2"|"3"|"HOLD"
  const buckets = ["0", "1", "2", "3", "HOLD"] as const;
  const confusion: Record<string, Record<string, number>> = {};
  for (const r of buckets) {
    confusion[r] = {};
    for (const c of buckets) confusion[r][c] = 0;
  }
  const misses: {
    i: number;
    tc: TestCase;
    got: number | null | undefined;
    reason: string | null;
  }[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const r = await classify(tc.text, apiKey, model, systemPrompt);
    totalLatency += r.latencyMs;

    const expStr = label(tc.expected_intensity);
    const gotStr = label(r.intensity);
    const ok = r.intensity === tc.expected_intensity;
    if (ok) correct++;
    else misses.push({ i: i + 1, tc, got: r.intensity, reason: r.reason });
    if (confusion[expStr] && confusion[expStr][gotStr] !== undefined) {
      confusion[expStr][gotStr]++;
    }

    const flag = ok ? "✓" : "✗";
    const reasonOrNote = r.error ? `ERROR: ${r.error}` : r.reason ?? tc.note ?? "";

    console.log(
      [
        pad(String(i + 1), 4),
        pad(flag, 4),
        pad(tc.text, 40),
        pad(expStr, 5),
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
  console.log(`exact correct : ${correct}/${n} (${pct(correct)})`);
  console.log(`avg latency   : ${Math.round(totalLatency / n)} ms`);

  console.log("\nConfusion matrix (rows=expected, cols=got):");
  const header = ["exp\\got", ...buckets].map((s) => pad(s, 7)).join("");
  console.log(header);
  for (const r of buckets) {
    const row = [pad(r, 7)];
    for (const c of buckets) {
      row.push(pad(String(confusion[r][c]), 7));
    }
    console.log(row.join(""));
  }

  if (misses.length) {
    console.log("\nMisses:");
    for (const m of misses) {
      console.log(
        `  #${m.i}  "${m.tc.text}"  expected=${label(m.tc.expected_intensity)}  got=${label(m.got)}  reason="${m.reason ?? ""}"`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
