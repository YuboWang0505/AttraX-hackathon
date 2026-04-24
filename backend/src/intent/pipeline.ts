import type { Intensity } from "@attrax/shared";
import { isSafeWordMatch } from "../safe-word.js";
import { classify } from "./llm.js";

export interface PipelineResult {
  intensity: Intensity;
  reason: string | null;
  safeWordTriggered: boolean;
  layer: "safe_word" | "llm" | "fallback";
}

/**
 * 2-layer intent pipeline per REFACTOR-llm-direct.md.
 *
 *   Layer 0 — safe word (exact equality after normalization). Rule-based,
 *             sub-millisecond, must never depend on LLM for safety reasons.
 *   Layer 1 — LLM direct intensity classification via OpenRouter.
 *             ~900ms typical, 1500ms hard timeout. On no-key / timeout /
 *             HTTP error / parse failure, falls back to intensity=1.
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

  const r = await classify(text);
  return {
    intensity: r.intensity,
    reason: r.reason,
    safeWordTriggered: false,
    layer: r.source === "llm" ? "llm" : "fallback",
  };
}
