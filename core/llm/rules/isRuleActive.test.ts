import { RuleWithSource } from "../..";
import { isRuleActive } from "./isRuleActive";

describe("isRuleActive", () => {
  const rule: RuleWithSource = {
    name: "My Rule",
    rule: "Do no harm",
    if: '${{ contains(current.model.model, "claude-3-7-sonnet") and glob("*.tsx") }}',
    source: "rules-block",
  };

  it("should return false when activePaths is empty", () => {
    expect(
      isRuleActive({
        rule,
        activePaths: [],
        currentModel: "claude-3-7-sonnet",
      }),
    ).toBe(false);
  });

  it("should return false when no matching paths exist", () => {
    expect(
      isRuleActive({
        rule,
        activePaths: ["test.py", "main.js"],
        currentModel: "claude-3-7-sonnet",
      }),
    ).toBe(false);
  });

  it("should return true when both conditions are met", () => {
    expect(
      isRuleActive({
        rule,
        activePaths: ["Component.tsx", "main.js"],
        currentModel: "claude-3-7-sonnet",
      }),
    ).toBe(true);
  });

  it("should return false when only glob matches but model doesn't", () => {
    expect(
      isRuleActive({
        rule,
        activePaths: ["Component.tsx"],
        currentModel: "gpt-4",
      }),
    ).toBe(false);
  });

  it("should return false when model matches but glob doesn't", () => {
    expect(
      isRuleActive({
        rule,
        activePaths: ["Component.ts"],
        currentModel: "claude-3-7-sonnet",
      }),
    ).toBe(false);
  });
});
