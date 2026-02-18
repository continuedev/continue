import { describe, expect, it } from "vitest";
import { RuleWithSource, UserChatMessage } from "../..";
import { getApplicableRules } from "./getSystemMessageWithRules";

describe("Implicit global rules application", () => {
  // Create a rule with no alwaysApply and no globs - should behave like a global rule
  const implicitGlobalRule: RuleWithSource = {
    name: "Implicit Global Rule",
    rule: "This rule should be applied to all messages (implicit global)",
    source: "rules-block",
    sourceFile: ".continue/global-rule.md",
    // No alwaysApply specified
    // No globs specified
  };

  // Create a rule with explicit alwaysApply: true for comparison
  const explicitGlobalRule: RuleWithSource = {
    name: "Explicit Global Rule",
    rule: "This rule should always be applied (explicit global)",
    alwaysApply: true,
    source: "rules-block",
    sourceFile: ".continue/explicit-global.md",
  };

  // Create a colocated rule in a nested directory
  const nestedDirRule: RuleWithSource = {
    name: "Nested Directory Rule",
    rule: "This rule applies to files in the nested directory",
    source: "rules-block",
    sourceFile: "nested-folder/rules.md",
  };

  it("should apply rules with no alwaysApply and no globs to all messages, even with no file references", () => {
    // Message with no code blocks or file references
    const simpleMessage: UserChatMessage = {
      role: "user",
      content: "Can you help me understand how this works?",
    };

    // Apply rules with no context items
    const applicableRules = getApplicableRules(
      simpleMessage,
      [implicitGlobalRule, explicitGlobalRule, nestedDirRule],
      [],
    );

    // Both global rules should be included regardless of context
    expect(applicableRules).toHaveLength(2);
    expect(applicableRules.map((r) => r.name)).toContain(
      "Implicit Global Rule",
    );
    expect(applicableRules.map((r) => r.name)).toContain(
      "Explicit Global Rule",
    );
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Nested Directory Rule",
    );
  });

  it("should treat root-level rules with no globs as global rules", () => {
    // Root rule with no globs
    const rootNoGlobsRule: RuleWithSource = {
      name: "Root No Globs Rule",
      rule: "This is a root-level rule with no globs",
      source: "rules-block",
      sourceFile: ".continue/rules.md",
      // No alwaysApply, no globs
    };

    // Test with no file context
    const applicableRules = getApplicableRules(
      undefined,
      [rootNoGlobsRule],
      [],
    );

    // Should include the rule even with no context
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Root No Globs Rule");
  });

  it("should apply implicit global rules alongside file-specific rules", () => {
    // File-specific message
    const messageWithFile: UserChatMessage = {
      role: "user",
      content:
        "Can you help with this file?\n```ts nested-folder/example.ts\nexport const example = () => {...}\n```",
    };

    // Apply all rule types together
    const applicableRules = getApplicableRules(
      messageWithFile,
      [implicitGlobalRule, explicitGlobalRule, nestedDirRule],
      [],
    );

    // Should include all rules
    expect(applicableRules).toHaveLength(3);
    expect(applicableRules.map((r) => r.name)).toContain(
      "Implicit Global Rule",
    );
    expect(applicableRules.map((r) => r.name)).toContain(
      "Explicit Global Rule",
    );
    expect(applicableRules.map((r) => r.name)).toContain(
      "Nested Directory Rule",
    );
  });

  it("should apply implicit global rules for first message without code", () => {
    // Simple first message
    const firstMessage: UserChatMessage = {
      role: "user",
      content: "Hello, can you help me?",
    };

    // Assistant rules that should always apply
    const assistantRule: RuleWithSource = {
      name: "Assistant Guidelines",
      rule: "SOLID Design Principles - Coding Assistant Guidelines",
      source: "rules-block",
      sourceFile: ".continue/rules.md",
      // No alwaysApply, no globs - should still apply
    };

    const applicableRules = getApplicableRules(
      firstMessage,
      [assistantRule],
      [],
    );

    // Should include the assistant rule even though there's no code
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Assistant Guidelines");
  });
});
