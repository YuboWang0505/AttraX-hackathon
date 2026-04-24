import type { IntentCode, Intensity } from "@attrax/shared";
import { isSafeWordMatch } from "../safe-word.js";
import { classify } from "./gemini.js";
import { matchKeywords } from "./keywords.js";

export interface PipelineResult {
  intent_code: IntentCode;
  intensity: Intensity;
  safeWordTriggered: boolean;
  layer: "safe_word" | "keywords" | "gemini" | "fallback";
}

/**
 * 3-layer intent pipeline per PRD §4.4.
 *
 *   Layer 0 — safe word (exact equality after normalization)
 *   Layer 1 — keyword substring match from INTENT_TABLE
 *   Layer 2 — Gemini classification (with no-key / timeout fallback to intensity=1)
 *
 * Safe word check is authoritative: on match, returns intensity=0 and
 * flags safeWordTriggered=true so the caller (rooms.ts) can skip broadcasting
 * a chat and emit safe_word_triggered instead.
 */
export async function runPipeline(
  text: string,
  safeWord: string,
): Promise<PipelineResult> {
  if (isSafeWordMatch(text, safeWord)) {
    return {
      intent_code: "SYS_SAFE_WORD",
      intensity: 0,
      safeWordTriggered: true,
      layer: "safe_word",
    };
  }

  const kw = matchKeywords(text);
  if (kw) {
    return {
      intent_code: kw.intent_code,
      intensity: kw.intensity,
      safeWordTriggered: false,
      layer: "keywords",
    };
  }

  const g = await classify(text);
  return {
    intent_code: g.intent_code,
    intensity: g.intensity,
    safeWordTriggered: false,
    layer: g.source === "gemini" ? "gemini" : "fallback",
  };
}
