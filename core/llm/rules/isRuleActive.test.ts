import { isRuleActive } from "./isRuleActive";

describe("isRuleActive", () => {
  it("evaluates glob patterns correctly", () => {
    const activePaths = ["src/foo.ts", "src/bar.tsx", "README.md"];

    expect(
      isRuleActive({
        rule: {
          name: "Test Rule",
          rule: "Some rule",
          if: '${{ glob("src/*.ts") }}',
        },
        activePaths,
      }),
    ).toBe(true);

    expect(
      isRuleActive({
        rule: {
          name: "Test Rule",
          rule: "Some rule",
          if: '${{ glob("*.md") }}',
        },
        activePaths,
      }),
    ).toBe(true);

    expect(
      isRuleActive({
        rule: {
          name: "Test Rule",
          rule: "Some rule",
          if: '${{ glob("*.py") }}',
        },
        activePaths,
      }),
    ).toBe(false);
  });

  it("evaluates combined conditions correctly", () => {
    const activePaths = ["src/foo.ts"];

    expect(
      isRuleActive({
        rule: {
          name: "Test Rule",
          rule: "Some rule",
          if: '${{ glob("src/*.ts") && current.model === "gpt-4" }}',
        },
        activePaths,
      }),
    ).toBe(true);
  });
});
