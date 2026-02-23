import { longestCommonSubsequence as lcs } from "./lcs";

describe("longestCommonSubsequence", () => {
  test("should return the longest common subsequence for non-empty strings", () => {
    expect(lcs("abcde", "ace")).toBe("ace");
    expect(lcs("abc", "abc")).toBe("abc");
    expect(lcs("abc", "def")).toBe("");
  });

  test("should handle cases where one or both strings are empty", () => {
    expect(lcs("", "abc")).toBe("");
    expect(lcs("abc", "")).toBe("");
    expect(lcs("", "")).toBe("");
  });

  test("should handle cases with no common subsequence", () => {
    expect(lcs("abc", "def")).toBe("");
    expect(lcs("xyz", "abc")).toBe("");
  });

  test("should handle cases with special characters", () => {
    expect(lcs("a!@#b$c", "!@#$")).toBe("!@#$");
    expect(lcs("a!@#b$c", "xyz")).toBe("");
  });

  test("should handle long strings efficiently", () => {
    const str1 = "a".repeat(1000) + "b".repeat(1000);
    const str2 = "a".repeat(1000) + "c".repeat(1000);
    expect(lcs(str1, str2)).toBe("a".repeat(1000));
  });
});
