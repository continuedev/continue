import { describe, expect, it } from "vitest";
import { RuleWithSource } from "../..";
import { shouldApplyRule } from "./getSystemMessageWithRules";
import { RulePolicies } from "./types";

describe("Rule colocation glob matching", () => {
  // This test file demonstrates the expected behavior after our fix

  it("should restrict rules by their directory when no globs specified", () => {
    // Rule in a nested directory with no globs - should only apply to files in that directory
    const componentRule: RuleWithSource = {
      name: "Components Rule",
      rule: "Use functional components with hooks",
      source: "rules-block",
      ruleFile: "src/components/rules.md",
      // No explicit globs - should only apply to files in src/components/ directory
    };

    // Files in the same directory - should match
    const matchingFiles = [
      "src/components/Button.tsx",
      "src/components/Form.jsx",
    ];
    expect(shouldApplyRule(componentRule, matchingFiles)).toBe(true);

    // Files outside the directory - should NOT match
    const nonMatchingFiles = ["src/utils/helpers.ts", "src/redux/slice.ts"];
    expect(shouldApplyRule(componentRule, nonMatchingFiles)).toBe(false);
  });

  it("should combine directory restriction with explicit globs", () => {
    // Rule with explicit globs in a nested directory
    const tsxComponentRule: RuleWithSource = {
      name: "TSX Components Rule",
      rule: "Use TypeScript with React components",
      globs: "**/*.tsx", // Only .tsx files
      source: "rules-block",
      ruleFile: "src/components/rules.md",
      // Should only apply to .tsx files in src/components/ directory
    };

    // TSX files in the same directory - should match
    const matchingFiles = [
      "src/components/Button.tsx",
      "src/components/Form.tsx",
    ];
    expect(shouldApplyRule(tsxComponentRule, matchingFiles)).toBe(true);

    // Non-TSX files in the same directory - should NOT match
    const nonMatchingExtension = ["src/components/OldButton.jsx"];
    expect(shouldApplyRule(tsxComponentRule, nonMatchingExtension)).toBe(false);

    // TSX files outside the directory - should NOT match
    const nonMatchingDir = ["src/pages/Home.tsx", "src/App.tsx"];
    expect(shouldApplyRule(tsxComponentRule, nonMatchingDir)).toBe(false);
  });

  it("should apply root-level rules to all files", () => {
    // Rule at the root level
    const rootRule: RuleWithSource = {
      name: "Root Rule",
      rule: "Follow project standards",
      source: "rules-block",
      ruleFile: ".continue/rules.md",
      // No restriction, should apply to all files
    };

    // Files in various directories - should all match
    const files = [
      "src/components/Button.tsx",
      "src/redux/slice.ts",
      "src/utils/helpers.ts",
    ];
    expect(shouldApplyRule(rootRule, files)).toBe(true);
  });

  it("should respect alwaysApply override regardless of directory", () => {
    // Rule with alwaysApply: true
    const alwaysApplyRule: RuleWithSource = {
      name: "Always Apply Rule",
      rule: "Follow these guidelines always",
      alwaysApply: true,
      source: "rules-block",
      ruleFile: "src/specific/rules.md",
      // Should apply to all files regardless of directory
    };

    // Files in various directories - should all match due to alwaysApply: true
    const files = [
      "src/components/Button.tsx",
      "src/redux/slice.ts",
      "src/utils/helpers.ts",
    ];
    expect(shouldApplyRule(alwaysApplyRule, files)).toBe(true);

    // Rule with alwaysApply: false and no globs
    const neverApplyRule: RuleWithSource = {
      name: "Never Apply Rule",
      rule: "This rule should never apply",
      alwaysApply: false,
      source: "rules-block",
      ruleFile: "src/specific/rules.md",
      // Should never apply since alwaysApply is false and there are no globs
    };

    expect(shouldApplyRule(neverApplyRule, files)).toBe(false);
  });

  it("should support complex directory + glob combinations", () => {
    // Rule with complex glob pattern in a nested directory
    const testExclusionRule: RuleWithSource = {
      name: "Test Exclusion Rule",
      rule: "Apply to TS files but not test files",
      globs: ["**/*.ts", "!**/*.test.ts", "!**/*.spec.ts"],
      source: "rules-block",
      ruleFile: "src/utils/rules.md",
      // Should only apply to non-test TS files in src/utils/
    };

    // Regular TS file in utils - should match
    expect(shouldApplyRule(testExclusionRule, ["src/utils/helpers.ts"])).toBe(
      true,
    );

    // Test TS file in utils - should NOT match due to negative glob
    expect(
      shouldApplyRule(testExclusionRule, ["src/utils/helpers.test.ts"]),
    ).toBe(false);

    // Regular TS file outside utils - should NOT match due to directory restriction
    expect(shouldApplyRule(testExclusionRule, ["src/models/user.ts"])).toBe(
      false,
    );
  });
});

describe("Rule policies", () => {
  const componentRule: RuleWithSource = {
    name: "Components Rule",
    rule: "Use functional components with hooks",
    source: "rules-block",
    ruleFile: "src/components/rules.md",
  };

  const testFiles = ["src/components/Button.tsx"];
  const nonMatchingFiles = ["src/utils/helpers.ts"];

  it("should always apply rules with 'always' policy regardless of file paths", () => {
    const rulePolicies: RulePolicies = {
      "Components Rule": "always",
    };

    // Should apply even to non-matching files
    expect(shouldApplyRule(componentRule, nonMatchingFiles, rulePolicies)).toBe(
      true,
    );

    // Should apply to empty file list
    expect(shouldApplyRule(componentRule, [], rulePolicies)).toBe(true);
  });

  it("should never apply rules with 'never' policy regardless of file paths", () => {
    const rulePolicies: RulePolicies = {
      "Components Rule": "never",
    };

    // Should not apply even to matching files
    expect(shouldApplyRule(componentRule, testFiles, rulePolicies)).toBe(false);

    // Rule with alwaysApply: true should still be overridden by 'never' policy
    const alwaysApplyRule: RuleWithSource = {
      name: "Always Apply Rule",
      rule: "This rule would normally always apply",
      alwaysApply: true,
      source: "rules-block",
      ruleFile: "src/components/rules.md",
    };

    const alwaysNeverPolicies: RulePolicies = {
      "Always Apply Rule": "never",
    };

    expect(
      shouldApplyRule(alwaysApplyRule, testFiles, alwaysNeverPolicies),
    ).toBe(false);
  });

  it("should apply 'auto' policy rules based on normal matching logic", () => {
    const rulePolicies: RulePolicies = {
      "Components Rule": "auto",
    };

    // Should apply to matching files
    expect(shouldApplyRule(componentRule, testFiles, rulePolicies)).toBe(true);

    // Should not apply to non-matching files
    expect(shouldApplyRule(componentRule, nonMatchingFiles, rulePolicies)).toBe(
      false,
    );
  });

  it("should use default behavior when no policy is specified", () => {
    // Empty policies object should use default behavior
    const rulePolicies: RulePolicies = {};

    // Should apply to matching files
    expect(shouldApplyRule(componentRule, testFiles, rulePolicies)).toBe(true);

    // Should not apply to non-matching files
    expect(shouldApplyRule(componentRule, nonMatchingFiles, rulePolicies)).toBe(
      false,
    );
  });

  it("should handle policy interaction with global rules", () => {
    // Root level rule which would normally apply globally
    const rootRule: RuleWithSource = {
      name: "Root Rule",
      rule: "Follow project standards",
      source: "rules-block",
      ruleFile: ".continue/rules.md",
    };

    // Never policy should override even global rules
    const neverPolicies: RulePolicies = {
      "Root Rule": "never",
    };

    expect(shouldApplyRule(rootRule, testFiles, neverPolicies)).toBe(false);

    // Auto policy should maintain global rule behavior
    const autoPolicies: RulePolicies = {
      "Root Rule": "auto",
    };

    expect(shouldApplyRule(rootRule, testFiles, autoPolicies)).toBe(true);
  });

  it("should prioritize policies over alwaysApply and directory restrictions", () => {
    // Create rule with multiple matching criteria
    const complexRule: RuleWithSource = {
      name: "Complex Rule",
      rule: "This rule has complex matching logic",
      alwaysApply: true,
      globs: "**/*.ts",
      source: "rules-block",
      ruleFile: "src/utils/rules.md",
    };

    // Always policy should win over everything
    const alwaysPolicies: RulePolicies = {
      "Complex Rule": "always",
    };

    expect(shouldApplyRule(complexRule, [], alwaysPolicies)).toBe(true);

    // Never policy should also win over everything
    const neverPolicies: RulePolicies = {
      "Complex Rule": "never",
    };

    // Even with matching files and alwaysApply: true, never policy wins
    expect(
      shouldApplyRule(complexRule, ["src/utils/test.ts"], neverPolicies),
    ).toBe(false);
  });
});
