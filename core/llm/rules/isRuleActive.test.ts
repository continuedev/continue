import { isRuleActive } from "./isRuleActive";

describe("isRuleActive", () => {
  it("should correctly evaluate combined contains and glob conditions", () => {
    const rule = {
      name: "My Rule",
      rule: "Do no harm",
      if: "${{ and(contains(current.model.model, 'claude-3-7-sonnet'), glob('*.tsx')) }}",
    };

    // Should be false when activePaths is empty
    expect(
      isRuleActive({
        rule,
        activePaths: [],
        currentModel: "claude-3-7-sonnet",
      }),
    ).toBe(false);

    // Should be false when no matching paths
    expect(
      isRuleActive({
        rule,
        activePaths: ["test.py", "main.js"],
        currentModel: "claude-3-7-sonnet",
      }),
    ).toBe(false);

    // Should be true when both conditions are met
    expect(
      isRuleActive({
        rule,
        activePaths: ["Component.tsx", "main.js"],
        currentModel: "claude-3-7-sonnet",
      }),
    ).toBe(true);

    // Should be false when only glob matches
    expect(
      isRuleActive({
        rule,
        activePaths: ["Component.tsx"],
        currentModel: "gpt-4",
      }),
    ).toBe(false);
  });
});
