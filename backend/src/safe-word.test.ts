import { describe, expect, it } from "vitest";
import { isSafeWordMatch, normalize, sanitizeSafeWord } from "./safe-word.js";

describe("normalize", () => {
  it("lowercases ASCII", () => {
    expect(normalize("SAFE")).toBe("safe");
  });

  it("converts fullwidth to halfwidth", () => {
    expect(normalize("ＳＡＦＥ")).toBe("safe");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalize("  安全词  ")).toBe("安全词");
  });

  it("strips ASCII punctuation at edges", () => {
    expect(normalize("安全词!!!")).toBe("安全词");
    expect(normalize("!!!安全词???")).toBe("安全词");
  });

  it("strips fullwidth punctuation at edges", () => {
    expect(normalize("安全词！")).toBe("安全词");
    expect(normalize("安全词。")).toBe("安全词");
    expect(normalize("安全词、")).toBe("安全词");
    expect(normalize("安全词？")).toBe("安全词");
  });

  it("preserves internal punctuation", () => {
    expect(normalize("say,hi")).toBe("say,hi");
  });
});

describe("isSafeWordMatch", () => {
  const safe = "安全词";

  it("matches bare equality", () => {
    expect(isSafeWordMatch("安全词", safe)).toBe(true);
  });

  it("matches with trailing fullwidth punctuation", () => {
    expect(isSafeWordMatch("安全词！", safe)).toBe(true);
    expect(isSafeWordMatch("安全词。", safe)).toBe(true);
    expect(isSafeWordMatch("安全词？", safe)).toBe(true);
  });

  it("matches with surrounding whitespace", () => {
    expect(isSafeWordMatch("  安全词  ", safe)).toBe(true);
  });

  it("does NOT match as substring", () => {
    expect(isSafeWordMatch("说了安全词", safe)).toBe(false);
    expect(isSafeWordMatch("安全词以后", safe)).toBe(false);
    expect(isSafeWordMatch("这个安全词对不对", safe)).toBe(false);
  });

  it("matches custom safe word with punctuation", () => {
    expect(isSafeWordMatch("红色！", "红色")).toBe(true);
    expect(isSafeWordMatch("  RED ", "red")).toBe(true);
  });

  it("rejects empty safe word", () => {
    expect(isSafeWordMatch("安全词", "")).toBe(false);
  });
});

describe("sanitizeSafeWord", () => {
  it("defaults to 安全词 when empty", () => {
    expect(sanitizeSafeWord(undefined)).toBe("安全词");
    expect(sanitizeSafeWord("")).toBe("安全词");
    expect(sanitizeSafeWord("   ")).toBe("安全词");
  });

  it("trims and caps at 16 chars", () => {
    expect(sanitizeSafeWord("  hello  ")).toBe("hello");
    const long = "a".repeat(30);
    expect(sanitizeSafeWord(long).length).toBe(16);
  });
});
