import { describe, expect, it } from "vitest";
import {
  ContextItemId,
  ContextItemWithId,
  RuleWithSource,
  UserChatMessage,
} from "../..";
import { getApplicableRules } from "./getSystemMessageWithRules";

describe("alwaysApply Behavior", () => {
  // Common test fixtures
  const testFile = "src/app.ts";
  const matchingFile = "src/components/Button.tsx";
  const nonMatchingFile = "src/utils/helper.js"; // Not matching *.tsx glob

  // File context items
  const matchingFileContext: ContextItemWithId = {
    id: { providerTitle: "file", itemId: "match1" } as ContextItemId,
    uri: { type: "file", value: matchingFile },
    content: "export const Button = () => {...}",
    name: "Button.tsx",
    description: "Component file",
  };

  const nonMatchingFileContext: ContextItemWithId = {
    id: { providerTitle: "file", itemId: "nonmatch1" } as ContextItemId,
    uri: { type: "file", value: nonMatchingFile },
    content: "export const helper = () => {...}",
    name: "helper.js",
    description: "Helper file",
  };

  // Message with no file references
  const messageWithoutFile: UserChatMessage = {
    role: "user",
    content: "Can you help me understand how this works?",
  };

  it("alwaysApply: true - Always include the rule, regardless of file context", () => {
    // Rule with alwaysApply: true
    const alwaysApplyRule: RuleWithSource = {
      name: "Always Apply Rule",
      rule: "This rule should always be applied",
      alwaysApply: true,
      globs: "**/*.tsx", // Should be ignored since alwaysApply is true
      source: "rules-block",
      sourceFile: ".continue/rules.md",
    };

    // Test with no file context
    let applicableRules = getApplicableRules(
      messageWithoutFile,
      [alwaysApplyRule],
      [],
    );
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Always Apply Rule");

    // Test with matching file
    applicableRules = getApplicableRules(
      undefined,
      [alwaysApplyRule],
      [matchingFileContext],
    );
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Always Apply Rule");

    // Test with non-matching file
    applicableRules = getApplicableRules(
      undefined,
      [alwaysApplyRule],
      [nonMatchingFileContext],
    );
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Always Apply Rule");
  });

  it("alwaysApply: false - Only include if globs exist AND match file context", () => {
    // Rule with alwaysApply: false and globs
    const conditionalRule: RuleWithSource = {
      name: "Conditional Rule",
      rule: "Apply only to matching files",
      alwaysApply: false,
      globs: "**/*.tsx",
      source: "rules-block",
      sourceFile: ".continue/rules.md",
    };

    // Rule with alwaysApply: false and no globs
    const neverApplyRule: RuleWithSource = {
      name: "Never Apply Rule",
      rule: "This rule should never apply",
      alwaysApply: false,
      // No globs
      source: "rules-block",
      sourceFile: ".continue/rules.md",
    };

    // Test with no file context
    let applicableRules = getApplicableRules(
      messageWithoutFile,
      [conditionalRule, neverApplyRule],
      [],
    );
    expect(applicableRules).toHaveLength(0); // No rules should apply

    // Test with matching file
    applicableRules = getApplicableRules(
      undefined,
      [conditionalRule, neverApplyRule],
      [matchingFileContext],
    );
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Conditional Rule");
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Never Apply Rule",
    );

    // Test with non-matching file
    applicableRules = getApplicableRules(
      undefined,
      [conditionalRule, neverApplyRule],
      [nonMatchingFileContext],
    );
    expect(applicableRules).toHaveLength(0); // No rules should apply
  });

  it("alwaysApply: undefined - Default behavior: include if no globs exist OR globs exist and match", () => {
    // Rule with undefined alwaysApply and no globs (should behave like a global rule)
    const defaultNoGlobsRule: RuleWithSource = {
      name: "Default No Globs Rule",
      rule: "Default rule with no globs",
      source: "rules-block",
      sourceFile: ".continue/rules.md",
      // No alwaysApply, no globs
    };

    // Rule with undefined alwaysApply and globs
    const defaultWithGlobsRule: RuleWithSource = {
      name: "Default With Globs Rule",
      rule: "Default rule with globs",
      globs: "**/*.tsx",
      source: "rules-block",
      sourceFile: ".continue/rules.md",
      // No alwaysApply, with globs
    };

    // Test with no file context
    let applicableRules = getApplicableRules(
      messageWithoutFile,
      [defaultNoGlobsRule, defaultWithGlobsRule],
      [],
    );
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Default No Globs Rule");
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Default With Globs Rule",
    );

    // Test with matching file
    applicableRules = getApplicableRules(
      undefined,
      [defaultNoGlobsRule, defaultWithGlobsRule],
      [matchingFileContext],
    );
    expect(applicableRules).toHaveLength(2);
    expect(applicableRules.map((r) => r.name)).toContain(
      "Default No Globs Rule",
    );
    expect(applicableRules.map((r) => r.name)).toContain(
      "Default With Globs Rule",
    );

    // Test with non-matching file
    applicableRules = getApplicableRules(
      undefined,
      [defaultNoGlobsRule, defaultWithGlobsRule],
      [nonMatchingFileContext],
    );
    expect(applicableRules).toHaveLength(1);
    expect(applicableRules[0].name).toBe("Default No Globs Rule");
    expect(applicableRules.map((r) => r.name)).not.toContain(
      "Default With Globs Rule",
    );
  });
});
