import { describe, expect, it } from "vitest";
import {
  ContextItemId,
  ContextItemWithId,
  RuleWithSource,
  UserChatMessage,
} from "../..";
import {
  getApplicableRules,
  shouldApplyRule,
} from "./getSystemMessageWithRules";
import { RulePolicies } from "./types";

describe("Rule colocation glob matching", () => {
  // This test file demonstrates the expected behavior after our fix

  it("should restrict rules by their directory when no globs specified", () => {
    // Rule in a nested directory with no globs - should only apply to files in that directory
    const componentRule: RuleWithSource = {
      name: "Components Rule",
      rule: "Use functional components with hooks",
      source: "rules-block",
      sourceFile: "src/components/rules.md",
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
      sourceFile: "src/components/rules.md",
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
      sourceFile: "/path/to/repo/.continue/rules.md",
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
      sourceFile: "src/specific/rules.md",
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
      sourceFile: "src/specific/rules.md",
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
      sourceFile: "src/utils/rules.md",
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
    sourceFile: "src/components/rules.md",
  };

  const testFiles = ["src/components/Button.tsx"];
  const nonMatchingFiles = ["src/utils/helpers.ts"];

  it("should never apply rules with 'off' policy regardless of file paths", () => {
    const rulePolicies: RulePolicies = {
      "Components Rule": "off",
    };

    // Should not apply even to matching files
    expect(shouldApplyRule(componentRule, testFiles, rulePolicies)).toBe(false);

    // Rule with alwaysApply: true should still be overridden by 'off' policy
    const alwaysApplyRule: RuleWithSource = {
      name: "Always Apply Rule",
      rule: "This rule would normally always apply",
      alwaysApply: true,
      source: "rules-block",
      sourceFile: "src/components/rules.md",
    };

    const offPolicies: RulePolicies = {
      "Always Apply Rule": "off",
    };

    expect(shouldApplyRule(alwaysApplyRule, testFiles, offPolicies)).toBe(
      false,
    );
  });

  it("should apply 'on' policy rules based on normal matching logic", () => {
    const rulePolicies: RulePolicies = {
      "Components Rule": "on",
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
      sourceFile: "/my/project/.continue/rules.md",
    };

    // Off policy should override even global rules
    const offPolicies: RulePolicies = {
      "Root Rule": "off",
    };

    expect(shouldApplyRule(rootRule, testFiles, offPolicies)).toBe(false);

    // On policy should maintain global rule behavior
    const onPolicies: RulePolicies = {
      "Root Rule": "on",
    };

    expect(shouldApplyRule(rootRule, testFiles, onPolicies)).toBe(true);
  });

  it("should prioritize 'off' policy over alwaysApply and directory restrictions", () => {
    // Create rule with multiple matching criteria
    const complexRule: RuleWithSource = {
      name: "Complex Rule",
      rule: "This rule has complex matching logic",
      alwaysApply: true,
      globs: "**/*.ts",
      source: "rules-block",
      sourceFile: "src/utils/rules.md",
    };

    // Off policy should win over everything
    const offPolicies: RulePolicies = {
      "Complex Rule": "off",
    };

    // Even with matching files and alwaysApply: true, off policy wins
    expect(
      shouldApplyRule(complexRule, ["src/utils/test.ts"], offPolicies),
    ).toBe(false);
  });
});

describe("Content pattern matching", () => {
  it("should apply rules when file content matches pattern", () => {
    // Rule with pattern to match React component files
    const reactComponentRule: RuleWithSource = {
      name: "React Component Rule",
      rule: "Follow React component standards",
      regex: "export (function|const) \\w+.*\\(",
      source: "rules-block",
      sourceFile: "src/components/rules.md",
    };

    // File that matches the pattern
    const filePath = "src/components/Button.tsx";
    const fileContents = {
      [filePath]:
        "export function Button() { return <button>Click me</button> }",
    };

    expect(
      shouldApplyRule(reactComponentRule, [filePath], {}, fileContents),
    ).toBe(true);

    // File that doesn't match the pattern
    const nonMatchingContents = {
      [filePath]:
        "import React from 'react'; // Just an import, not a component",
    };

    expect(
      shouldApplyRule(reactComponentRule, [filePath], {}, nonMatchingContents),
    ).toBe(false);
  });

  it("should support multiple regex regex as an array", () => {
    // Rule with multiple regex
    const multiPatternRule: RuleWithSource = {
      name: "Multi-Pattern Rule",
      rule: "Apply to functions or classes",
      regex: ["function\\s+\\w+", "class\\s+\\w+"],
      source: "rules-block",
      sourceFile: "src/utils/rules.md",
    };

    const filePath = "src/utils/helper.ts";

    // Content with function - should match
    const functionContent = {
      [filePath]: "function formatDate(date) { return date.toISOString(); }",
    };
    expect(
      shouldApplyRule(multiPatternRule, [filePath], {}, functionContent),
    ).toBe(true);

    // Content with class - should match
    const classContent = {
      [filePath]:
        "class DateFormatter { format(date) { return date.toISOString(); } }",
    };
    expect(
      shouldApplyRule(multiPatternRule, [filePath], {}, classContent),
    ).toBe(true);

    // Content with neither - should not match
    const nonMatchingContent = {
      [filePath]: "const PI = 3.14159;",
    };
    expect(
      shouldApplyRule(multiPatternRule, [filePath], {}, nonMatchingContent),
    ).toBe(false);
  });

  it("should apply rules based on both globs and regex when both are specified", () => {
    // Rule with both glob and pattern restrictions
    const typescriptClassRule: RuleWithSource = {
      name: "TypeScript Class Rule",
      rule: "Follow class standards in TypeScript",
      globs: "**/*.ts",
      regex: "class\\s+\\w+",
      source: "rules-block",
      sourceFile: "src/models/rules.md",
    };

    const tsFilePath = "src/models/User.ts";
    const jsFilePath = "src/models/Product.js";

    // TypeScript file with class - should match
    const tsClassContent = {
      [tsFilePath]: "export class User { constructor(public name: string) {} }",
    };
    expect(
      shouldApplyRule(typescriptClassRule, [tsFilePath], {}, tsClassContent),
    ).toBe(true);

    // TypeScript file without class - should not match
    const tsNonClassContent = {
      [tsFilePath]: "export const createUser = (name: string) => ({ name });",
    };
    expect(
      shouldApplyRule(typescriptClassRule, [tsFilePath], {}, tsNonClassContent),
    ).toBe(false);

    // JavaScript file with class - should not match due to glob
    const jsClassContent = {
      [jsFilePath]:
        "export class Product { constructor(name) { this.name = name; } }",
    };
    expect(
      shouldApplyRule(typescriptClassRule, [jsFilePath], {}, jsClassContent),
    ).toBe(false);
  });

  it("should extract file content from messages for pattern matching", () => {
    // Rule with pattern
    const arrowFunctionRule: RuleWithSource = {
      name: "Arrow Function Rule",
      rule: "Use arrow functions for better this binding",
      regex: "const\\s+\\w+\\s*=\\s*\\(",
      source: "rules-block",
      sourceFile: "src/utils/rules.md",
    };

    // Message with code block containing a matching pattern
    const messageWithArrowFn: UserChatMessage = {
      role: "user",
      content:
        "Can you check this code?\n```typescript src/utils/formatter.ts\nconst format = (date) => {\n  return date.toISOString();\n};\n```",
    };

    // Create context item to match the file in the message
    const contextItem: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "formatter" } as ContextItemId,
      uri: { type: "file", value: "src/utils/formatter.ts" },
      content: "const format = (date) => {\n  return date.toISOString();\n};",
      name: "formatter.ts",
      description: "Utility formatter",
    };

    // Should match the pattern
    const applicableRules = getApplicableRules(
      messageWithArrowFn,
      [arrowFunctionRule],
      [contextItem],
    );

    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Arrow Function Rule");

    // Message with code block that doesn't match the pattern
    const messageWithoutArrowFn: UserChatMessage = {
      role: "user",
      content:
        "Can you check this code?\n```typescript src/utils/formatter.ts\nfunction format(date) {\n  return date.toISOString();\n}\n```",
    };

    // Context item with non-matching content
    const nonMatchingContextItem: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "formatter2" } as ContextItemId,
      uri: { type: "file", value: "src/utils/formatter.ts" },
      content: "function format(date) {\n  return date.toISOString();\n}",
      name: "formatter.ts",
      description: "Utility formatter",
    };

    // Should not match the pattern
    const nonApplicableRules = getApplicableRules(
      messageWithoutArrowFn,
      [arrowFunctionRule],
      [nonMatchingContextItem],
    );

    expect(nonApplicableRules).toHaveLength(0);
  });

  it("should handle invalid regex regex gracefully", () => {
    // Rule with invalid regex pattern
    const invalidRegexRule: RuleWithSource = {
      name: "Invalid Regex Rule",
      rule: "This rule has an invalid regex pattern",
      regex: "([unclosed parenthesis",
      source: "rules-block",
      sourceFile: "src/utils/rules.md",
    };

    const filePath = "src/utils/helper.ts";
    const fileContents = {
      [filePath]: "function helper() { return true; }",
    };

    // Should not throw an error but gracefully not apply the rule
    expect(
      shouldApplyRule(invalidRegexRule, [filePath], {}, fileContents),
    ).toBe(false);
  });

  it("should respect directory restrictions for pattern rules", () => {
    // Rule with pattern in a nested directory
    const nestedPatternRule: RuleWithSource = {
      name: "Nested Pattern Rule",
      rule: "Apply only to model files with interfaces",
      regex: "interface\\s+\\w+",
      source: "rules-block",
      sourceFile: "src/models/rules.md",
    };

    // File in the correct directory with matching content
    const modelFilePath = "src/models/User.ts";
    const modelContents = {
      [modelFilePath]: "export interface User { id: string; name: string; }",
    };
    expect(
      shouldApplyRule(nestedPatternRule, [modelFilePath], {}, modelContents),
    ).toBe(true);

    // File outside the directory with matching content - should not match
    const utilFilePath = "src/utils/types.ts";
    const utilContents = {
      [utilFilePath]:
        "export interface Config { apiUrl: string; timeout: number; }",
    };
    expect(
      shouldApplyRule(nestedPatternRule, [utilFilePath], {}, utilContents),
    ).toBe(false);
  });
});
