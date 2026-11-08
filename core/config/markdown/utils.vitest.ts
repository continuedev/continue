import { describe, expect, it } from "vitest";
import { createRuleFilePath } from "./utils";

describe("createRuleFilePath", () => {
  it("should create correct rule file path", () => {
    const result = createRuleFilePath("/workspace", "My Test Rule");
    expect(result).toBe("/workspace/.continuous/rules/my-test-rule.md");
  });

  it("should handle special characters in rule name", () => {
    const result = createRuleFilePath("/home/user", "Rule with @#$% chars");
    expect(result).toBe("/home/user/.continuous/rules/rule-with-chars.md");
  });

  it("should handle edge case rule names", () => {
    const result = createRuleFilePath("/test", "   Multiple   Spaces   ");
    expect(result).toBe("/test/.continuous/rules/multiple-spaces.md");
  });
});
