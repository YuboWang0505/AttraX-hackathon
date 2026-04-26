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
 * v1.5: bilingual keyword pool. Each rule's `keywords` list now contains
 * both Chinese and English triggers. Match runs against the lowercased
 * input so "Kneel" / "kneel" / "KNEEL" all hit. Chinese terms are
 * unaffected by lowercasing.
 *
 * Safe word (SYS_SAFE_WORD) is NOT here — it lives at the rule layer above
 * this one and uses exact-string equality, not substring matching.
 *
 * When adding a new entry:
 *   1. Prefer phrases of 2+ chars; single chars ("乖") are OK only for very
 *      specific tokens.
 *   2. Ensure no keyword false-triggers in common daily speech (especially
 *      English — "ass" / "hit" etc. would over-fire; avoid).
 *   3. English keywords MUST be lowercase (matched against lowercased input).
 *   4. Intensity must be 1/2/3 (never null/HOLD — that's LLM's job).
 */
export const KEYWORD_TABLE: KeywordRule[] = [
  { reason: "前戏安抚 / Warm-up", intensity: 1, keywords: [
    "乖", "想我吗", "放松", "好孩子", "舒服点", "慢慢来", "宝贝", "我的乖",
    "good girl", "good boy", "miss me", "relax", "easy now", "take it slow", "sweetheart", "baby",
  ] },
  { reason: "开场温和 / Greet warm", intensity: 1, keywords: [
    "在干嘛", "准备好",
    "what are you doing", "are you ready", "ready for me",
  ] },
  { reason: "开场宣示 / Greet dom", intensity: 2, keywords: [
    "主人", "跪下", "问好", "连上",
    "master", "mistress", "kneel down", "greet me", "connected",
  ] },
  { reason: "轻度撩拨 / Tease light", intensity: 1, keywords: [
    "痒", "轻轻", "慢点", "感受", "舒服吗", "有点感觉", "轻一点", "骚动",
    "itch", "gently", "softly", "slow down", "feel it", "feels good", "tingle",
  ] },
  { reason: "重度挑逗 / Tease heavy", intensity: 2, keywords: [
    "想要", "求我", "叫主人", "自己动", "憋着", "忍着", "湿了", "难受", "痒死", "夹紧",
    "want it", "beg me", "beg for it", "call me master", "do it yourself", "hold it in", "you're wet", "squeeze",
  ] },
  { reason: "日常指令 / Command daily", intensity: 2, keywords: [
    "听话", "含住", "坐好", "脱掉", "转过去",
    "obey", "behave", "hold it in your mouth", "sit properly", "take it off", "turn around",
  ] },
  { reason: "姿态指令 / Command posture", intensity: 2, keywords: [
    "跪好", "腿分开", "看着我", "不许动", "趴下",
    "kneel for me", "kneel", "spread your legs", "look at me", "don't move", "lie down", "face down",
  ] },
  { reason: "言语指令 / Command verbal", intensity: 2, keywords: [
    "叫出来", "说你想要", "闭嘴", "大声点", "回答",
    "moan", "say you want it", "shut up", "louder", "answer me",
  ] },
  { reason: "边缘控制 / Denial control", intensity: 1, keywords: [
    "不准丢", "忍住", "咽回去", "收回去",
    "don't cum", "hold back", "swallow it back", "edge",
  ] },
  { reason: "警告敲打 / Warning", intensity: 2, keywords: [
    "胆子大了", "皮痒", "再动一下", "态度", "忘了", "试试看", "不乖",
    "getting bold", "asking for it", "move again", "attitude", "forgot", "try me", "naughty",
  ] },
  { reason: "轻度惩戒 / Punish light", intensity: 2, keywords: [
    "挨打", "掌嘴", "认错", "罚你", "长记性",
    "spank you", "slap", "apologize", "punishing you", "remember this",
  ] },
  { reason: "严厉惩罚 / Punish strict", intensity: 3, keywords: [
    "惩罚", "教训", "废物", "狠狠", "弄坏",
    "punish hard", "discipline you", "useless", "harshly", "break you", "ruin you",
  ] },
  { reason: "高潮恩赐 / Climax permission", intensity: 3, keywords: [
    "丢吧", "释放", "赏你", "高潮",
    "you may cum", "release", "let go", "reward you with", "climax",
  ] },
  { reason: "强制高潮 / Climax forced", intensity: 3, keywords: [
    "给我丢", "坏掉", "喷出来",
    "cum for me", "break apart", "squirt", "lose control",
  ] },
  { reason: "重度奖励 / Reward high", intensity: 3, keywords: [
    "表现真棒", "全给你", "太乖了", "奖励", "极品", "表现得太棒了", "最高奖励", "you've been amazing",
    "amazing", "all yours", "too good", "highest reward",
  ] },
  { reason: "事后安抚 / Aftercare", intensity: 1, keywords: [
    "抱抱", "摸摸", "辛苦了", "睡觉", "亲亲",
    "hug", "well done", "rest now", "kiss",
  ] },
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
 *
 * v1.5: input is lowercased before matching so English keywords (which are
 * stored lowercase) match regardless of the user's casing. Chinese characters
 * are unaffected by toLowerCase().
 */
export function matchKeywordTable(text: string): KeywordMatch | null {
  const haystack = text.toLowerCase();
  let best: KeywordMatch | null = null;
  let bestIdx = -1;
  for (let i = 0; i < KEYWORD_TABLE.length; i++) {
    const rule = KEYWORD_TABLE[i];
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
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
