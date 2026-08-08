import { getAdjustedTokenCountFromModel } from "./getAdjustedTokenCount";

describe("getAdjustedTokenCountFromModel", () => {
  it("should return base tokens for non-special models", () => {
    expect(getAdjustedTokenCountFromModel(100, "gpt-4")).toBe(100);
    expect(getAdjustedTokenCountFromModel(100, "llama2")).toBe(100);
    expect(getAdjustedTokenCountFromModel(100, "random-model")).toBe(100);
  });

  it("should apply multiplier for Claude models", () => {
    expect(getAdjustedTokenCountFromModel(100, "claude-3-opus")).toBe(123);
    expect(getAdjustedTokenCountFromModel(100, "claude-3.5-sonnet")).toBe(123);
    expect(getAdjustedTokenCountFromModel(100, "CLAUDE-2")).toBe(123);
    expect(getAdjustedTokenCountFromModel(50, "claude")).toBe(62); // 50 * 1.23 = 61.5, ceiled to 62
  });

  it("should apply multiplier for Gemini models", () => {
    expect(getAdjustedTokenCountFromModel(100, "gemini-pro")).toBe(118);
    expect(getAdjustedTokenCountFromModel(100, "gemini-1.5-pro")).toBe(118);
    expect(getAdjustedTokenCountFromModel(100, "GEMINI-flash")).toBe(118);
    expect(getAdjustedTokenCountFromModel(50, "gemini")).toBe(59); // 50 * 1.18 = 59
  });

  it("should apply multiplier for Mistral family models", () => {
    expect(getAdjustedTokenCountFromModel(100, "mistral-large")).toBe(126);
    expect(getAdjustedTokenCountFromModel(100, "mixtral-8x7b")).toBe(126);
    expect(getAdjustedTokenCountFromModel(100, "devstral")).toBe(126);
    expect(getAdjustedTokenCountFromModel(100, "CODESTRAL")).toBe(126);
    expect(getAdjustedTokenCountFromModel(50, "mistral")).toBe(63); // 50 * 1.26 = 63
  });

  it("should handle edge cases", () => {
    expect(getAdjustedTokenCountFromModel(0, "claude")).toBe(0);
    expect(getAdjustedTokenCountFromModel(1, "gemini")).toBe(2); // 1 * 1.18 = 1.18, ceiled to 2
    expect(getAdjustedTokenCountFromModel(1000, "mixtral")).toBe(1260);
  });

  it("should handle empty or undefined model names", () => {
    expect(getAdjustedTokenCountFromModel(100, "")).toBe(100);
    expect(getAdjustedTokenCountFromModel(100, undefined as any)).toBe(100);
  });

  it("should be case-insensitive", () => {
    expect(getAdjustedTokenCountFromModel(100, "ClAuDe-3-OpUs")).toBe(123);
    expect(getAdjustedTokenCountFromModel(100, "GeMiNi-PrO")).toBe(118);
    expect(getAdjustedTokenCountFromModel(100, "MiXtRaL")).toBe(126);
  });
});
