import { RuleWithSource, UserChatMessage } from "../..";
import { getSystemMessageWithRules } from "./getSystemMessageWithRules";

describe("getSystemMessageWithRules", () => {
  const baseSystemMessage = "Base system message";
  const tsRule: RuleWithSource = {
    name: "TypeScript Rule",
    rule: "Follow TypeScript best practices",
    globs: "**/*.ts?(x)",
    source: "rules-block",
  };

  // Rule without pattern (always active)
  const generalRule: RuleWithSource = {
    name: "General Rule",
    rule: "Always write clear comments",
    source: "rules-block",
  };

  // Rule with a different pattern
  const pythonRule: RuleWithSource = {
    name: "Python Rule",
    rule: "Follow PEP 8 guidelines",
    globs: "**/*.py",
    source: "rules-block",
  };

  it("should not include pattern-matched rules when no file paths are mentioned", () => {
    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage: undefined,
      rules: [tsRule],
    });

    expect(result).toBe(baseSystemMessage);
  });

  it("should include general rules (without matches) regardless of file paths", () => {
    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage: undefined,
      rules: [generalRule],
    });

    expect(result).toBe(`${baseSystemMessage}\n\n${generalRule.rule}`);
  });

  it("should include only matching rules based on file paths", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```tsx Component.tsx\nexport const Component = () => <div>Hello</div>;\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [tsRule, pythonRule, generalRule],
    });

    // Should include TS rule and general rule, but not Python rule
    const expected = `${baseSystemMessage}\n\n${tsRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  it("should include multiple matching rules", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```tsx Component.tsx\nexport const Component = () => <div>Hello</div>;\n```\n```python test.py\nprint('hello')\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [tsRule, pythonRule, generalRule],
    });

    // Should include all rules
    const expected = `${baseSystemMessage}\n\n${tsRule.rule}\n\n${pythonRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  it("should include only general rules when no paths match pattern-specific rules", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content: "```ruby test.rb\nputs 'hello'\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [tsRule, pythonRule, generalRule],
    });

    // Should only include the general rule
    const expected = `${baseSystemMessage}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  it("should NOT match with comma-separated glob patterns", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```ts src/main.ts\nconsole.log('hello');\n```\n```ts tests/example.test.ts\ntest('should work', () => {});\n```",
    };

    // Rule with comma-separated glob patterns
    const commaRule: RuleWithSource = {
      name: "TypeScript Standards",
      rule: "Use TypeScript best practices for comma-separated globs",
      globs: "src/**/*.ts, tests/**/*.ts",
      source: "rules-block",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [commaRule],
    });

    // With the current implementation, the comma-separated pattern is treated as a single string,
    // so it won't match any of the file paths (minimatch doesn't support comma-separated patterns)
    expect(result).toBe(baseSystemMessage);
  });

  it("should match with an array of glob patterns", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```ts src/main.ts\nconsole.log('hello');\n```\n```ts tests/example.test.ts\ntest('should work', () => {});\n```\n```ts config/settings.ts\nconst config = {};\n```",
    };

    // Rule with an array of glob patterns
    const arrayGlobRule: RuleWithSource = {
      name: "TypeScript Standards",
      rule: "Use TypeScript best practices for array globs",
      globs: ["src/**/*.ts", "tests/**/*.ts"],
      source: "rules-block",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [arrayGlobRule],
    });

    // With our new implementation, the array of patterns should match both src/main.ts and tests/example.test.ts
    expect(result).toBe(`${baseSystemMessage}\n\n${arrayGlobRule.rule}`);
  });

  it("should match only patterns in the array", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```ts src/main.ts\nconsole.log('hello');\n```\n```ts config/settings.ts\nconst config = {};\n```",
    };

    // Rule with an array of glob patterns
    const arrayGlobRule: RuleWithSource = {
      name: "TypeScript Standards",
      rule: "Use TypeScript best practices for array globs",
      globs: ["src/**/*.ts", "tests/**/*.ts"],
      source: "rules-block",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [arrayGlobRule],
    });

    // Should match src/main.ts but not config/settings.ts
    expect(result).toBe(`${baseSystemMessage}\n\n${arrayGlobRule.rule}`);
  });

  it("should not match any when no patterns in the array match", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```ts config/settings.ts\nconst config = {};\n```\n```ruby test.rb\nputs 'hello'\n```",
    };

    // Rule with an array of glob patterns
    const arrayGlobRule: RuleWithSource = {
      name: "TypeScript Standards",
      rule: "Use TypeScript best practices for array globs",
      globs: ["src/**/*.ts", "tests/**/*.ts"],
      source: "rules-block",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [arrayGlobRule],
    });

    // Should not match any file paths
    expect(result).toBe(baseSystemMessage);
  });
});
