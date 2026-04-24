import type { Intensity } from "@attrax/shared";
import { isSafeWordMatch } from "../safe-word.js";
import { matchKeywordTable } from "./keyword-table.js";
import { classify } from "./llm.js";

export interface PipelineResult {
  /** null means "not a directive, caller should hold current intensity". */
  intensity: Intensity | null;
  reason: string | null;
  safeWordTriggered: boolean;
  layer: "safe_word" | "keyword" | "llm" | "fallback";
}

/**
 * 3-layer intent pipeline.
 *
 *   Layer 0 — safe word (exact equality after normalization). Rule-based,
 *             sub-millisecond, must never depend on LLM for safety.
 *   Layer 1 — keyword-table substring match. 16 rules from PRD v1.2
 *             Appendix A (ambiguous words already cleaned). Sub-10ms,
 *             deterministic, emits intensity + fixed reason label.
 *             Never emits HOLD — LLM handles the long tail.
 *   Layer 2 — LLM direct classification via OpenRouter (Grok-4-Fast).
 *             ~750ms typical, 1500ms hard timeout. Returns one of:
 *             0/1/2/3 (directive) or null (HOLD — caller keeps current
 *             intensity). On no-key / timeout / HTTP / parse error,
 *             falls back to null (HOLD) so hardware never drifts.
 */
export async function runPipeline(
  text: string,
  safeWord: string,
): Promise<PipelineResult> {
  if (isSafeWordMatch(text, safeWord)) {
    return {
      intensity: 0,
      reason: null,
      safeWordTriggered: true,
      layer: "safe_word",
    };
  }

  const kw = matchKeywordTable(text);
  if (kw) {
    return {
      intensity: kw.intensity,
      reason: kw.reason,
      safeWordTriggered: false,
      layer: "keyword",
    };
  }

  const r = await classify(text);
  return {
    intensity: r.intensity,
    reason: r.reason,
    safeWordTriggered: false,
    layer: r.source === "llm" ? "llm" : "fallback",
  };
}
