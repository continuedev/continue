import { describe, expect, it } from "vitest";
import { RuleWithSource } from "../..";
import { convertRuleBlockToSlashCommand } from "./ruleBlockSlashCommand";

describe("convertRuleBlockToSlashCommand", () => {
  it("should convert a rule with all properties to a slash command", () => {
    const rule: RuleWithSource = {
      name: "Code Review",
      rule: "Review this code for best practices",
      description: "Performs a code review",
      source: "rules-block",
      sourceFile: "file:///path/to/rules.yaml",
      invokable: true,
    };

    const result = convertRuleBlockToSlashCommand(rule);

    expect(result).toEqual({
      name: "Code Review",
      description: "Performs a code review",
      prompt: "Review this code for best practices",
      source: "invokable-rule",
      sourceFile: "file:///path/to/rules.yaml",
    });
  });

  it("should handle a rule without name", () => {
    const rule: RuleWithSource = {
      rule: "Review this code",
      source: "rules-block",
      invokable: true,
    };

    const result = convertRuleBlockToSlashCommand(rule);

    expect(result.name).toBe("Review this code");
    expect(result.prompt).toBe("Review this code");
  });

  it("should truncate long rule text when used as name", () => {
    const rule: RuleWithSource = {
      rule: "This is a very long rule text that should be truncated",
      source: "rules-block",
      invokable: true,
    };

    const result = convertRuleBlockToSlashCommand(rule);

    expect(result.name).toBe("This is a very long ...");
    expect(result.prompt).toBe(
      "This is a very long rule text that should be truncated",
    );
  });

  it("should handle a rule without description", () => {
    const rule: RuleWithSource = {
      name: "Test Rule",
      rule: "Test rule content",
      source: "rules-block",
      invokable: true,
    };

    const result = convertRuleBlockToSlashCommand(rule);

    expect(result.description).toBe("");
  });

  it("should use rule text as the prompt", () => {
    const rule: RuleWithSource = {
      name: "Explain Code",
      rule: "Explain what this code does in simple terms",
      source: "rules-block",
      invokable: true,
    };

    const result = convertRuleBlockToSlashCommand(rule);

    expect(result.prompt).toBe("Explain what this code does in simple terms");
  });

  it("should always set source to 'invokable-rule'", () => {
    const rule: RuleWithSource = {
      name: "Test",
      rule: "Test",
      source: "default-chat",
      invokable: true,
    };

    const result = convertRuleBlockToSlashCommand(rule);

    expect(result.source).toBe("invokable-rule");
  });
});
