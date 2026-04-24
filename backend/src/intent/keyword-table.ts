import type { Intensity } from "@attrax/shared";

export interface KeywordRule {
  /** Human-readable label, emitted as the broadcast `reason` on match. */
  reason: string;
  /** Rule fires regardless of current room intensity. Table never emits HOLD. */
  intensity: Intensity;
  /** Substring triggers. Tie-break within equal-intensity rules: earlier wins. */
  keywords: string[];
}

/**
 * 16-row substring lookup table from PRD v1.2 Appendix A.
 *
 * Dedup'd and stripped of high-risk ambiguous words ("给你" / "现在" / "彻底"
 * / "规矩" / "现在就做") that would false-trigger in everyday speech. The
 * cleanup rationale is still in git history (PRD v1.1 → v1.2).
 *
 * Safe word (SYS_SAFE_WORD) is NOT here — it lives at the rule layer above
 * this one and uses exact-string equality, not substring matching.
 *
 * When adding a new entry:
 *   1. Prefer phrases of 2+ chars; single chars ("乖") are OK only for very
 *      specific tokens.
 *   2. Ensure no keyword false-triggers in common daily speech.
 *   3. Intensity must be 1/2/3 (never null/HOLD — that's LLM's job).
 */
export const KEYWORD_TABLE: KeywordRule[] = [
  { reason: "前戏安抚", intensity: 1, keywords: ["乖", "想我吗", "放松", "好孩子", "舒服点", "慢慢来", "宝贝", "我的乖"] },
  { reason: "开场温和", intensity: 1, keywords: ["在干嘛", "准备好"] },
  { reason: "开场宣示", intensity: 2, keywords: ["主人", "跪下", "问好", "连上"] },
  { reason: "轻度撩拨", intensity: 1, keywords: ["痒", "轻轻", "慢点", "感受", "舒服吗", "有点感觉", "轻一点", "骚动"] },
  { reason: "重度挑逗", intensity: 2, keywords: ["想要", "求我", "叫主人", "自己动", "憋着", "忍着", "湿了", "难受", "痒死", "夹紧"] },
  { reason: "日常指令", intensity: 2, keywords: ["听话", "含住", "坐好", "脱掉", "转过去"] },
  { reason: "姿态指令", intensity: 2, keywords: ["跪好", "腿分开", "看着我", "不许动", "趴下"] },
  { reason: "言语指令", intensity: 2, keywords: ["叫出来", "说你想要", "闭嘴", "大声点", "回答"] },
  { reason: "边缘控制", intensity: 1, keywords: ["不准丢", "忍住", "咽回去", "收回去"] },
  { reason: "警告敲打", intensity: 2, keywords: ["胆子大了", "皮痒", "再动一下", "态度", "忘了", "试试看", "不乖"] },
  { reason: "轻度惩戒", intensity: 2, keywords: ["挨打", "掌嘴", "认错", "罚你", "长记性"] },
  { reason: "严厉惩罚", intensity: 3, keywords: ["惩罚", "教训", "废物", "狠狠", "弄坏"] },
  { reason: "高潮恩赐", intensity: 3, keywords: ["丢吧", "释放", "赏你", "高潮"] },
  { reason: "强制高潮", intensity: 3, keywords: ["给我丢", "坏掉", "喷出来"] },
  { reason: "重度奖励", intensity: 3, keywords: ["表现真棒", "全给你", "太乖了", "奖励", "极品"] },
  { reason: "事后安抚", intensity: 1, keywords: ["抱抱", "摸摸", "辛苦了", "睡觉", "亲亲"] },
];

export interface KeywordMatch {
  intensity: Intensity;
  reason: string;
}

/**
 * Substring match across all rules. Tie-break:
 *   1. Higher intensity wins ("乖,给我丢" → 3 档 via 强制高潮, not 1 档 via 乖)
 *   2. Same intensity: earlier rule wins (table order = priority)
 * Returns null when no keyword matches (caller should fall through to LLM).
 */
export function matchKeywordTable(text: string): KeywordMatch | null {
  let best: KeywordMatch | null = null;
  let bestIdx = -1;
  for (let i = 0; i < KEYWORD_TABLE.length; i++) {
    const rule = KEYWORD_TABLE[i];
    if (rule.keywords.some((kw) => text.includes(kw))) {
      if (
        best === null ||
        rule.intensity > best.intensity ||
        (rule.intensity === best.intensity && i < bestIdx)
      ) {
        best = { intensity: rule.intensity, reason: rule.reason };
        bestIdx = i;
      }
    }
  }
  return best;
}
