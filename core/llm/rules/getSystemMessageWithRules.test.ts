import { ContextItemWithId, RuleWithSource, UserChatMessage } from "../..";
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

  // JavaScript rule
  const jsRule: RuleWithSource = {
    name: "JavaScript Rule",
    rule: "Follow JavaScript best practices",
    globs: "**/*.js",
    source: "rules-block",
  };

  // Empty context items
  const emptyContextItems: ContextItemWithId[] = [];

  // Context items with file paths
  const tsContextItem: ContextItemWithId = {
    content: "TypeScript file content",
    name: "Component.tsx",
    description: "A TypeScript component",
    id: { providerTitle: "file", itemId: "src/Component.tsx" },
    uri: { type: "file", value: "src/Component.tsx" },
  };

  const pyContextItem: ContextItemWithId = {
    content: "Python file content",
    name: "utils.py",
    description: "A Python utility file",
    id: { providerTitle: "file", itemId: "utils.py" },
    uri: { type: "file", value: "utils.py" },
  };

  const jsContextItem: ContextItemWithId = {
    content: "JavaScript file content",
    name: "utils.js",
    description: "A JavaScript utility file",
    id: { providerTitle: "file", itemId: "src/utils.js" },
    uri: { type: "file", value: "src/utils.js" },
  };

  it("should not include pattern-matched rules when no file paths are mentioned", () => {
    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage: undefined,
      rules: [tsRule],
      contextItems: emptyContextItems,
    });

    expect(result).toBe(baseSystemMessage);
  });

  it("should include general rules (without matches) regardless of file paths", () => {
    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage: undefined,
      rules: [generalRule],
      contextItems: emptyContextItems,
    });

    expect(result).toBe(`${baseSystemMessage}\n\n${generalRule.rule}`);
  });

  it("should include only matching rules based on file paths in message", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```tsx Component.tsx\nexport const Component = () => <div>Hello</div>;\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [tsRule, pythonRule, generalRule],
      contextItems: emptyContextItems,
    });

    // Should include TS rule and general rule, but not Python rule
    const expected = `${baseSystemMessage}\n\n${tsRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  it("should include matching rules based on file paths in context items", () => {
    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage: undefined,
      rules: [tsRule, pythonRule, generalRule],
      contextItems: [tsContextItem],
    });

    // Should include TS rule and general rule, but not Python rule
    const expected = `${baseSystemMessage}\n\n${tsRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  it("should include matching rules from both message and context items", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content: "```python test.py\nprint('hello')\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [tsRule, pythonRule, generalRule],
      contextItems: [tsContextItem],
    });

    // Should include TS rule, Python rule, and general rule
    const expected = `${baseSystemMessage}\n\n${tsRule.rule}\n\n${pythonRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  it("should include multiple matching rules from message", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```tsx Component.tsx\nexport const Component = () => <div>Hello</div>;\n```\n```python test.py\nprint('hello')\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [tsRule, pythonRule, generalRule],
      contextItems: emptyContextItems,
    });

    // Should include all rules
    const expected = `${baseSystemMessage}\n\n${tsRule.rule}\n\n${pythonRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  it("should include multiple matching rules from context items", () => {
    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage: undefined,
      rules: [tsRule, pythonRule, generalRule],
      contextItems: [tsContextItem, pyContextItem],
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
      contextItems: emptyContextItems,
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
      contextItems: emptyContextItems,
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
      contextItems: emptyContextItems,
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
      contextItems: emptyContextItems,
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
      contextItems: emptyContextItems,
    });

    // Should not match any file paths
    expect(result).toBe(baseSystemMessage);
  });

  // New test for code block with filename only (no language)
  it("should handle code blocks with filename only (no language identifier)", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content: "```test.js\nclass Calculator { /* code */ }\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [jsRule, tsRule, generalRule],
      contextItems: emptyContextItems,
    });

    // Should include JS rule and general rule
    const expected = `${baseSystemMessage}\n\n${jsRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  // New test for code blocks with line ranges
  it("should handle code blocks with line ranges", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content: "```js test.js (19-25)\ndivide(number) { /* code */ }\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [jsRule, tsRule, generalRule],
      contextItems: emptyContextItems,
    });

    // Should include JS rule and general rule
    const expected = `${baseSystemMessage}\n\n${jsRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  // New test for mixed code block formats
  it("should handle mixed code block formats in the same message", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content:
        "```test.js\nclass Calculator { /* code */ }\n```\n" +
        "```js utils.js (19-25)\ndivide(number) { /* code */ }\n```\n" +
        "```ts config/settings.ts\nconst config = {};\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [jsRule, tsRule, generalRule],
      contextItems: emptyContextItems,
    });

    // Should include JS rule, TS rule, and general rule
    const expected = `${baseSystemMessage}\n\n${jsRule.rule}\n\n${tsRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  // Test for context items when there's no message
  it("should apply rules based on context items only when no message is present", () => {
    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage: undefined,
      rules: [jsRule, tsRule, generalRule],
      contextItems: [jsContextItem],
    });

    // Should include JS rule and general rule
    const expected = `${baseSystemMessage}\n\n${jsRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  // Test for non-file context items
  it("should ignore non-file context items", () => {
    const nonFileContextItem: ContextItemWithId = {
      content: "Some search result",
      name: "Search result",
      description: "A search result",
      id: { providerTitle: "search", itemId: "search-result" },
      // No uri with type "file"
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage: undefined,
      rules: [jsRule, tsRule, generalRule],
      contextItems: [nonFileContextItem],
    });

    // Should only include general rule
    const expected = `${baseSystemMessage}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });

  // Test combining context items with message
  it("should match rules from both message code blocks and context items", () => {
    const userMessage: UserChatMessage = {
      role: "user",
      content: "```ts src/main.ts\nconsole.log('hello');\n```",
    };

    const result = getSystemMessageWithRules({
      baseSystemMessage,
      userMessage,
      rules: [jsRule, tsRule, pythonRule, generalRule],
      contextItems: [jsContextItem, pyContextItem],
    });

    // Should include JS, TS, Python rules and general rule
    const expected = `${baseSystemMessage}\n\n${jsRule.rule}\n\n${tsRule.rule}\n\n${pythonRule.rule}\n\n${generalRule.rule}`;
    expect(result).toBe(expected);
  });
});
