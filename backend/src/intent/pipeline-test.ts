import "dotenv/config";
import type { Intensity } from "@attrax/shared";
import { runPipeline } from "./pipeline.js";

interface TestCase {
  text: string;
  /** null = HOLD (expected no intensity change). */
  expected_intensity: Intensity | null;
  note?: string;
}

const SAFE_WORD = "安全词";

const TEST_CASES: TestCase[] = [
  // ── 1 档 ──
  { text: "乖,放松", expected_intensity: 1 },
  { text: "宝贝,慢慢来", expected_intensity: 1, note: "在表里, layer=keyword" },
  { text: "在干嘛呢", expected_intensity: 1, note: "在表里, layer=keyword" },
  { text: "轻一点,感受一下", expected_intensity: 1 },
  { text: "不准丢,忍住", expected_intensity: 1 },
  { text: "过来抱抱,辛苦了", expected_intensity: 1 },
  { text: "别紧张,深呼吸一下", expected_intensity: 1, note: "非表中, layer=llm" },
  { text: "累坏了吧,过来让我揉揉", expected_intensity: 1, note: "非表中, layer=llm" },

  // ── 2 档 ──
  { text: "主人来了,跪下", expected_intensity: 2 },
  { text: "湿了吗?想要就求我", expected_intensity: 2 },
  { text: "含住,不许吐出来", expected_intensity: 2 },
  { text: "给我跪好,腿分开", expected_intensity: 2 },
  { text: "叫出来,大声点", expected_intensity: 2 },
  { text: "胆子大了?皮痒了是吧", expected_intensity: 2 },
  { text: "认错没有,罚你五下", expected_intensity: 2 },
  { text: "马上趴成我昨天教你的样子", expected_intensity: 2, note: "非表中, layer=llm" },
  { text: "敢出声就加倍惩罚", expected_intensity: 2, note: "'惩罚'命中严厉惩罚 3 档, 边界" },

  // ── 3 档 ──
  { text: "今天必须狠狠惩罚你", expected_intensity: 3 },
  { text: "赏你一次,丢吧", expected_intensity: 3 },
  { text: "给我丢,现在就丢出来", expected_intensity: 3 },
  { text: "表现真棒,全给你", expected_intensity: 3 },
  { text: "可以释放了宝贝", expected_intensity: 3, note: "释放(3档)vs宝贝(1档) → 3" },
  { text: "今晚你做得非常好,所有奖励都给你", expected_intensity: 3 },

  // ── HOLD（都应当走 LLM） ──
  { text: "嗯", expected_intensity: null },
  { text: "好", expected_intensity: null },
  { text: "还好吗", expected_intensity: null },
  { text: "哈哈哈", expected_intensity: null },
  { text: "坚持住", expected_intensity: null },
  { text: "再给你三十秒", expected_intensity: null },
  { text: "今天天气不错", expected_intensity: null },
  { text: "你吃饭了吗", expected_intensity: null },
  { text: "我现在给你倒杯水", expected_intensity: null, note: "清洗过'给你'" },
  { text: "规矩我都记得清清楚楚", expected_intensity: null, note: "清洗过'规矩'" },

  // ── 安全词 ──
  { text: "安全词", expected_intensity: 0, note: "layer=safe_word, 终止" },
  { text: "安全词！", expected_intensity: 0, note: "标点标准化" },
];

function pad(s: string, n: number): string {
  const visualLen = Array.from(s).reduce(
    (acc, ch) => acc + (ch.charCodeAt(0) > 0x7f ? 2 : 1),
    0,
  );
  return s + " ".repeat(Math.max(0, n - visualLen));
}

function label(v: Intensity | null): string {
  return v === null ? "HOLD" : String(v);
}

async function main(): Promise<void> {
  console.log(`Cases:   ${TEST_CASES.length}`);
  console.log(`Safe:    "${SAFE_WORD}"`);
  console.log(
    `LLM key: ${process.env.OPENROUTER_API_KEY ? "present" : "absent (HOLD fallback on all LLM-layer cases)"}`,
  );
  console.log("─".repeat(130));
  console.log(
    [pad("#", 4), pad("ok", 4), pad("input", 38), pad("exp", 5), pad("got", 5), pad("layer", 10), pad("ms", 6), "reason / note"].join(""),
  );
  console.log("─".repeat(130));

  const layerCount: Record<string, number> = { safe_word: 0, keyword: 0, llm: 0, fallback: 0 };
  let correct = 0;
  let totalLatency = 0;
  const misses: { i: number; tc: TestCase; got: Intensity | null; layer: string; reason: string | null }[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const t0 = Date.now();
    const r = await runPipeline(tc.text, SAFE_WORD);
    const latency = Date.now() - t0;
    totalLatency += latency;
    layerCount[r.layer] = (layerCount[r.layer] ?? 0) + 1;

    const ok = r.intensity === tc.expected_intensity;
    if (ok) correct++;
    else misses.push({ i: i + 1, tc, got: r.intensity, layer: r.layer, reason: r.reason });

    const flag = ok ? "✓" : "✗";
    const expStr = label(tc.expected_intensity);
    const gotStr = label(r.intensity);
    const reasonOrNote = r.reason ?? tc.note ?? "";

    console.log(
      [pad(String(i + 1), 4), pad(flag, 4), pad(tc.text, 38), pad(expStr, 5), pad(gotStr, 5), pad(r.layer, 10), pad(String(latency), 6), reasonOrNote].join(""),
    );
  }

  console.log("─".repeat(130));
  const n = TEST_CASES.length;
  const pct = (x: number) => ((x / n) * 100).toFixed(1) + "%";
  console.log(`correct        : ${correct}/${n} (${pct(correct)})`);
  console.log(`layer breakdown: safe_word=${layerCount.safe_word}  keyword=${layerCount.keyword}  llm=${layerCount.llm}  fallback=${layerCount.fallback}`);
  console.log(`avg latency    : ${Math.round(totalLatency / n)} ms (keyword: <10ms, llm: ~750ms)`);

  if (misses.length) {
    console.log("\nMisses:");
    for (const m of misses) {
      console.log(`  #${m.i}  "${m.tc.text}"  expected=${label(m.tc.expected_intensity)}  got=${label(m.got)}  layer=${m.layer}  reason="${m.reason ?? ""}"`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
