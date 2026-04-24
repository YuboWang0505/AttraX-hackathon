import type { IntentCode, Intensity } from "@attrax/shared";
import { INTENT_TABLE } from "./table.js";

export interface KeywordHit {
  intent_code: IntentCode;
  intensity: Intensity;
}

/**
 * Substring-match each row in the intent table against the input text.
 * Return the highest-intensity hit. When multiple hits share the top
 * intensity, the earliest row in INTENT_TABLE wins (stable tie-break).
 *
 * Returns null when no row has a substring match.
 */
export function matchKeywords(text: string): KeywordHit | null {
  let best: { row: number; intensity: Intensity; code: IntentCode } | null = null;

  for (let i = 0; i < INTENT_TABLE.length; i++) {
    const row = INTENT_TABLE[i];
    const hit = row.keywords.some((k) => text.includes(k));
    if (!hit) continue;

    if (!best || row.intensity > best.intensity) {
      best = { row: i, intensity: row.intensity, code: row.code };
    }
  }

  return best ? { intent_code: best.code, intensity: best.intensity } : null;
}
