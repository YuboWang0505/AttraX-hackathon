import { describe, expect, it } from "vitest";
import { matchKeywords } from "./keywords.js";

describe("matchKeywords", () => {
  it("returns null for plain text with no keyword", () => {
    expect(matchKeywords("今天天气不错")).toBeNull();
  });

  it("hits S_AFTERCARE on '抱抱' → intensity 1", () => {
    expect(matchKeywords("抱抱我")).toEqual({
      intent_code: "S_AFTERCARE",
      intensity: 1,
    });
  });

  it("hits S_COMMAND_POSTURE on '给我跪好' → intensity 2", () => {
    expect(matchKeywords("给我跪好")).toEqual({
      intent_code: "S_COMMAND_POSTURE",
      intensity: 2,
    });
  });

  it("hits S_CLIMAX_FORCED on '给我丢' → intensity 3", () => {
    expect(matchKeywords("给我丢")).toEqual({
      intent_code: "S_CLIMAX_FORCED",
      intensity: 3,
    });
  });

  it("takes max intensity on multi-hit: '乖，给我丢' → 3", () => {
    const res = matchKeywords("乖，给我丢");
    expect(res?.intensity).toBe(3);
    expect(res?.intent_code).toBe("S_CLIMAX_FORCED");
  });

  it("does NOT trip 3-档 on ambiguous '我现在给你倒水' (ambiguous words removed)", () => {
    const res = matchKeywords("我现在给你倒水");
    expect(res).toBeNull();
  });

  it("does NOT trip 3-档 on '你彻底改变了我' (ambiguous '彻底' removed)", () => {
    expect(matchKeywords("你彻底改变了我")).toBeNull();
  });

  it("S_WARNING wins over S_TEASE_LIGHT when both could match '试试看'", () => {
    // "试试看" used to be in both tables; after dedup it only lives in S_WARNING (intensity 2)
    const res = matchKeywords("再乱动一下试试看");
    expect(res?.intensity).toBe(2);
    expect(res?.intent_code).toBe("S_WARNING");
  });

  it("hits S_REWARD_HIGH on '表现真棒' → 3", () => {
    expect(matchKeywords("你今天表现真棒")).toEqual({
      intent_code: "S_REWARD_HIGH",
      intensity: 3,
    });
  });
});
