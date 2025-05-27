import { getRequestRuleDescription } from "./requestRule";
import { RuleWithSource } from "../..";

describe("getRequestRuleDescription", () => {
  it("should return no rules message when no agent-requested rules exist", () => {
    const rules: RuleWithSource[] = [
      {
        name: "Always Apply Rule",
        description: "This rule always applies",
        source: "default-chat",
        rule: "Always use semicolons",
        alwaysApply: true,
        ruleFile: "/path/to/rule1.md",
      },
      {
        name: "Rule with Globs",
        description: "This rule has globs",
        source: "rules-block",
        rule: "Use TypeScript",
        globs: "**/*.ts",
        ruleFile: "/path/to/rule2.md",
      },
    ];

    const result = getRequestRuleDescription(rules);

    expect(result).toBe(
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\nNo rules available."
    );
  });

  it("should return formatted rules when agent-requested rules exist", () => {
    const rules: RuleWithSource[] = [
      {
        name: "Agent Rule 1",
        description: "First agent-requested rule",
        source: "rules-block",
        rule: "Use consistent formatting",
        alwaysApply: false,
        ruleFile: "/path/to/agent-rule1.md",
      },
      {
        name: "Agent Rule 2",
        description: "Second agent-requested rule",
        source: "default-agent",
        rule: "Follow naming conventions",
        alwaysApply: false,
        ruleFile: "/path/to/agent-rule2.md",
      },
      // These should be filtered out
      {
        name: "Always Apply Rule",
        description: "This rule always applies",
        source: "default-chat",
        rule: "Always use semicolons",
        alwaysApply: true,
        ruleFile: "/path/to/rule1.md",
      },
      {
        name: "Rule with Globs",
        description: "This rule has globs",
        source: "rules-block",
        rule: "Use TypeScript",
        globs: "**/*.ts",
        ruleFile: "/path/to/rule2.md",
      },
    ];

    const result = getRequestRuleDescription(rules);

    const expected = 
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n" +
      "Rule: Agent Rule 1\n" +
      "Description: First agent-requested rule\n" +
      "Filepath: /path/to/agent-rule1.md\n\n" +
      "Rule: Agent Rule 2\n" +
      "Description: Second agent-requested rule\n" +
      "Filepath: /path/to/agent-rule2.md";

    expect(result).toBe(expected);
  });

  it("should handle rules with missing description", () => {
    const rules: RuleWithSource[] = [
      {
        name: "Rule Without Description",
        source: "rules-block",
        rule: "Some rule content",
        alwaysApply: false,
        ruleFile: "/path/to/no-desc-rule.md",
      },
    ];

    const result = getRequestRuleDescription(rules);

    const expected = 
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n" +
      "Rule: Rule Without Description\n" +
      "Description: undefined\n" +
      "Filepath: /path/to/no-desc-rule.md";

    expect(result).toBe(expected);
  });

  it("should handle rules with missing name", () => {
    const rules: RuleWithSource[] = [
      {
        description: "Rule without name",
        source: "rules-block",
        rule: "Some rule content",
        alwaysApply: false,
        ruleFile: "/path/to/no-name-rule.md",
      },
    ];

    const result = getRequestRuleDescription(rules);

    const expected = 
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n" +
      "Rule: undefined\n" +
      "Description: Rule without name\n" +
      "Filepath: /path/to/no-name-rule.md";

    expect(result).toBe(expected);
  });

  it("should handle rules with missing ruleFile", () => {
    const rules: RuleWithSource[] = [
      {
        name: "Rule Without File",
        description: "Rule without file path",
        source: "rules-block",
        rule: "Some rule content",
        alwaysApply: false,
      },
    ];

    const result = getRequestRuleDescription(rules);

    const expected = 
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n" +
      "Rule: Rule Without File\n" +
      "Description: Rule without file path\n" +
      "Filepath: undefined";

    expect(result).toBe(expected);
  });

  it("should filter out rules with alwaysApply undefined (truthy)", () => {
    const rules: RuleWithSource[] = [
      {
        name: "Rule with undefined alwaysApply",
        description: "This should be filtered out",
        source: "rules-block",
        rule: "Some rule",
        ruleFile: "/path/to/rule.md",
        // alwaysApply is undefined, which is truthy in the filter condition
      },
      {
        name: "Valid Agent Rule",
        description: "This should be included",
        source: "rules-block",
        rule: "Some rule",
        alwaysApply: false,
        ruleFile: "/path/to/valid-rule.md",
      },
    ];

    const result = getRequestRuleDescription(rules);

    const expected = 
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n" +
      "Rule: Valid Agent Rule\n" +
      "Description: This should be included\n" +
      "Filepath: /path/to/valid-rule.md";

    expect(result).toBe(expected);
  });

  it("should filter out rules with any globs defined", () => {
    const rules: RuleWithSource[] = [
      {
        name: "Rule with string globs",
        description: "This should be filtered out",
        source: "rules-block",
        rule: "Some rule",
        alwaysApply: false,
        globs: "**/*.ts",
        ruleFile: "/path/to/rule1.md",
      },
      {
        name: "Rule with array globs",
        description: "This should also be filtered out",
        source: "rules-block", 
        rule: "Some rule",
        alwaysApply: false,
        globs: ["**/*.ts", "**/*.js"],
        ruleFile: "/path/to/rule2.md",
      },
      {
        name: "Valid Agent Rule",
        description: "This should be included",
        source: "rules-block",
        rule: "Some rule",
        alwaysApply: false,
        ruleFile: "/path/to/valid-rule.md",
      },
    ];

    const result = getRequestRuleDescription(rules);

    const expected = 
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n" +
      "Rule: Valid Agent Rule\n" +
      "Description: This should be included\n" +
      "Filepath: /path/to/valid-rule.md";

    expect(result).toBe(expected);
  });

  it("should handle empty rules array", () => {
    const rules: RuleWithSource[] = [];

    const result = getRequestRuleDescription(rules);

    expect(result).toBe(
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\nNo rules available."
    );
  });

  it("should handle single agent-requested rule", () => {
    const rules: RuleWithSource[] = [
      {
        name: "Single Rule",
        description: "The only agent-requested rule",
        source: "rules-block",
        rule: "Follow this guideline",
        alwaysApply: false,
        ruleFile: "/path/to/single-rule.md",
      },
    ];

    const result = getRequestRuleDescription(rules);

    const expected = 
      "Use this tool to select additional rules, specifically based on their descriptions. Available rules:\n" +
      "Rule: Single Rule\n" +
      "Description: The only agent-requested rule\n" +
      "Filepath: /path/to/single-rule.md";

    expect(result).toBe(expected);
  });
});