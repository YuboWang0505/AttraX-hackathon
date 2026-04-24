import type { IntentCode, Intensity } from "@attrax/shared";

export interface IntentRow {
  code: IntentCode;
  intensity: Intensity;
  description: string;
  keywords: string[];
}

/**
 * 17 intents per PRD v1.2 Appendix A.
 * Deduplicated (shared keywords moved to the more specific / higher-intensity intent)
 * and stripped of high-risk ambiguous words ("给你" / "现在" / "彻底" / "规矩" / "现在就做")
 * that could false-trigger 3-档 in everyday speech.
 *
 * SYS_SAFE_WORD is not in the substring-matching pool — it is handled
 * upstream via exact-string equality in safe-word.ts.
 */
export const INTENT_TABLE: IntentRow[] = [
  {
    code: "S_WARM_UP",
    intensity: 1,
    description: "前戏安抚",
    keywords: ["乖", "想我吗", "放松", "好孩子", "舒服点", "慢慢来", "宝贝", "我的乖"],
  },
  {
    code: "S_GREET_WARM",
    intensity: 1,
    description: "开场温和",
    keywords: ["在干嘛", "准备好"],
  },
  {
    code: "S_GREET_DOM",
    intensity: 2,
    description: "开场宣示",
    keywords: ["主人", "跪下", "问好", "连上"],
  },
  {
    code: "S_TEASE_LIGHT",
    intensity: 1,
    description: "轻度撩拨",
    keywords: ["痒", "轻轻", "慢点", "感受", "舒服吗", "有点感觉", "轻一点", "骚动"],
  },
  {
    code: "S_TEASE_HEAVY",
    intensity: 2,
    description: "重度挑逗",
    keywords: ["想要", "求我", "叫主人", "自己动", "憋着", "忍着", "湿了", "难受", "痒死", "夹紧"],
  },
  {
    code: "S_COMMAND_DAILY",
    intensity: 2,
    description: "日常指令",
    keywords: ["听话", "含住", "坐好", "脱掉", "转过去"],
  },
  {
    code: "S_COMMAND_POSTURE",
    intensity: 2,
    description: "姿态指令",
    keywords: ["跪好", "腿分开", "看着我", "不许动", "趴下"],
  },
  {
    code: "S_COMMAND_VERBAL",
    intensity: 2,
    description: "言语指令",
    keywords: ["叫出来", "说你想要", "闭嘴", "大声点", "回答"],
  },
  {
    code: "S_DENIAL_CONTROL",
    intensity: 1,
    description: "边缘控制",
    keywords: ["不准丢", "忍住", "咽回去", "收回去"],
  },
  {
    code: "S_WARNING",
    intensity: 2,
    description: "警告敲打",
    keywords: ["胆子大了", "皮痒", "再动一下", "规矩", "态度", "忘了", "试试看", "不乖"],
  },
  {
    code: "S_PUNISH_LIGHT",
    intensity: 2,
    description: "轻度惩戒",
    keywords: ["挨打", "掌嘴", "认错", "罚你", "长记性"],
  },
  {
    code: "S_PUNISH_STRICT",
    intensity: 3,
    description: "严厉惩罚",
    keywords: ["惩罚", "教训", "废物", "狠狠", "弄坏"],
  },
  {
    code: "S_CLIMAX_PERMISSION",
    intensity: 3,
    description: "高潮恩赐",
    keywords: ["丢吧", "释放", "赏你", "高潮"],
  },
  {
    code: "S_CLIMAX_FORCED",
    intensity: 3,
    description: "强制高潮",
    keywords: ["给我丢", "坏掉", "喷出来"],
  },
  {
    code: "S_REWARD_HIGH",
    intensity: 3,
    description: "重度奖励",
    keywords: ["表现真棒", "全给你", "太乖了", "奖励", "极品"],
  },
  {
    code: "S_AFTERCARE",
    intensity: 1,
    description: "事后安抚",
    keywords: ["抱抱", "摸摸", "辛苦了", "睡觉", "亲亲"],
  },
];
