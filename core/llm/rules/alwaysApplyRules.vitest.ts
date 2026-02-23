import { describe, expect, it } from "vitest";
import {
  ContextItemId,
  ContextItemWithId,
  RuleWithSource,
  UserChatMessage,
} from "../..";
import { getApplicableRules } from "./getSystemMessageWithRules";
import { RulePolicies } from "./types";

describe("Rule application with alwaysApply", () => {
  // Create an always-apply rule
  const alwaysApplyRule: RuleWithSource = {
    name: "Always Apply Rule",
    rule: "This rule should always be applied",
    alwaysApply: true,
    source: "rules-block",
    sourceFile: ".continue/always-apply.md",
  };

  // Create a colocated rule in a nested directory
  const nestedDirRule: RuleWithSource = {
    name: "Nested Directory Rule",
    rule: "This rule applies to files in the nested directory",
    source: "rules-block",
    sourceFile: "nested-folder/rules.md",
  };

  it("should apply alwaysApply rules even with no file references", () => {
    // Message with no code blocks or file references
    const simpleMessage: UserChatMessage = {
      role: "user",
      content: "Can you help me understand how this works?",
    };

    // Apply rules with no context items
    const applicableRules = getApplicableRules(
      simpleMessage,
      [alwaysApplyRule, nestedDirRule],
      [],
    );

    // The always apply rule should be included regardless of context
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules.map((r) => r.name)).toContain("Always Apply Rule");
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Nested Directory Rule",
    );
  });

  it("should apply nested directory rules to files in that directory", () => {
    // Context with a file in the nested directory
    const nestedFileContext: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "context1" } as ContextItemId,
      uri: { type: "file", value: "nested-folder/example.ts" },
      content: "export const example = () => {...}",
      name: "example.ts",
      description: "Example file",
    };

    // Apply rules with file context in nested directory
    const applicableRules = getApplicableRules(
      undefined, // No message needed
      [alwaysApplyRule, nestedDirRule],
      [nestedFileContext],
    );

    // Both rules should apply
    expect(applicableRules).toHaveLength(2);
    expect(applicableRules.map((r) => r.name)).toContain("Always Apply Rule");
    expect(applicableRules.map((r) => r.name)).toContain(
      "Nested Directory Rule",
    );
  });

  it("should NOT apply nested directory rules to files outside that directory", () => {
    // Context with a file outside the nested directory
    const outsideFileContext: ContextItemWithId = {
      id: { providerTitle: "file", itemId: "context2" } as ContextItemId,
      uri: { type: "file", value: "src/utils/helper.ts" },
      content: "export const helper = () => {...}",
      name: "helper.ts",
      description: "Helper utility",
    };

    // Apply rules with file context outside nested directory
    const applicableRules = getApplicableRules(
      undefined, // No message needed
      [alwaysApplyRule, nestedDirRule],
      [outsideFileContext],
    );

    // Only the always apply rule should be included
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules.map((r) => r.name)).toContain("Always Apply Rule");
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Nested Directory Rule",
    );
  });

  it("should correctly apply rules when a file is mentioned in a message", () => {
    // Message with a file reference
    const messageWithFile: UserChatMessage = {
      role: "user",
      content:
        "Can you help with this file?\n```ts nested-folder/example.ts\nexport const example = () => {...}\n```",
    };

    // Apply rules with a message containing a file reference
    const applicableRules = getApplicableRules(
      messageWithFile,
      [alwaysApplyRule, nestedDirRule],
      [],
    );

    // Both rules should apply
    expect(applicableRules).toHaveLength(2);
    expect(applicableRules.map((r) => r.name)).toContain("Always Apply Rule");
    expect(applicableRules.map((r) => r.name)).toContain(
      "Nested Directory Rule",
    );
  });

  it("should always apply rules with alwaysApply regardless of message or context", () => {
    // Test with no message or context
    let applicableRules = getApplicableRules(undefined, [alwaysApplyRule], []);
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules.map((r) => r.name)).toContain("Always Apply Rule");

    // Test with message but no file references and no context
    const simpleMessage: UserChatMessage = {
      role: "user",
      content: "Hello, can you help me?",
    };

    applicableRules = getApplicableRules(simpleMessage, [alwaysApplyRule], []);
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules.map((r) => r.name)).toContain("Always Apply Rule");
  });

  it("should respect 'off' rulePolicies over alwaysApply when there are no file paths", () => {
    // Rule with alwaysApply: true
    const globalRule: RuleWithSource = {
      name: "Global Rule",
      rule: "This rule has alwaysApply: true but is blocked by rulePolicies",
      alwaysApply: true,
      source: "rules-block",
      sourceFile: "src/some/path.md",
    };

    // Message with no code blocks or file references
    const simpleMessage: UserChatMessage = {
      role: "user",
      content: "Can you help me with something?",
    };

    // Create a rule policy that blocks the rule
    const rulePolicies: RulePolicies = {
      "Global Rule": "off",
    };

    // The rule should NOT be applied due to the "off" policy,
    // even though it has alwaysApply: true and there are no file paths
    const applicableRules = getApplicableRules(
      simpleMessage,
      [globalRule],
      [],
      rulePolicies,
    );

    expect(applicableRules).toHaveLength(0);
    expect(applicableRules.map((r) => r.name)).not.toContain("Global Rule");
  });
});
