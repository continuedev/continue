/* eslint-disable max-lines-per-function */
import { ContextItemWithId, RuleWithSource, UserChatMessage } from "../..";
import {
  getSystemMessageWithRules,
  shouldApplyRule,
} from "./getSystemMessageWithRules";

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

  // Tests for alwaysApply property
  describe("alwaysApply property", () => {
    const alwaysApplyTrueRule: RuleWithSource = {
      name: "Always Apply True Rule",
      rule: "This rule should always be applied",
      globs: "**/*.nonexistent",
      alwaysApply: true,
      source: "rules-block",
    };

    const alwaysApplyFalseRule: RuleWithSource = {
      name: "Always Apply False Rule",
      rule: "This rule should never be applied",
      alwaysApply: false,
      source: "rules-block",
    };

    const alwaysApplyFalseWithMatchingGlobs: RuleWithSource = {
      name: "Always Apply False with Matching Globs",
      rule: "This rule should never be applied even with matching globs",
      globs: "**/*.ts?(x)",
      alwaysApply: false,
      source: "rules-block",
    };

    it("should always include rules with alwaysApply: true regardless of globs or file paths", () => {
      const userMessage: UserChatMessage = {
        role: "user",
        content: "```js main.js\nconsole.log('hello');\n```",
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage,
        rules: [alwaysApplyTrueRule, tsRule],
        contextItems: emptyContextItems,
      });

      // Should include the alwaysApply:true rule even though globs don't match
      const expected = `${baseSystemMessage}\n\n${alwaysApplyTrueRule.rule}`;
      expect(result).toBe(expected);
    });

    it("should include rules with alwaysApply: false when globs match", () => {
      const userMessage: UserChatMessage = {
        role: "user",
        content:
          "```tsx Component.tsx\nexport const Component = () => <div>Hello</div>;\n```",
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage,
        rules: [alwaysApplyFalseWithMatchingGlobs, tsRule, generalRule],
        contextItems: emptyContextItems,
      });

      // Should include alwaysApply:false rule because globs match
      const expected = `${baseSystemMessage}\n\n${alwaysApplyFalseWithMatchingGlobs.rule}\n\n${tsRule.rule}\n\n${generalRule.rule}`;
      expect(result).toBe(expected);
    });

    it("should include rules with alwaysApply: false when globs match", () => {
      const userMessage: UserChatMessage = {
        role: "user",
        content:
          "```ts Component.tsx\nexport const Component = () => <div>Hello</div>;\n```",
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage,
        rules: [alwaysApplyFalseWithMatchingGlobs, tsRule, generalRule],
        contextItems: emptyContextItems,
      });

      // Should include alwaysApply:false rule because globs match
      const expected = `${baseSystemMessage}\n\n${alwaysApplyFalseWithMatchingGlobs.rule}\n\n${tsRule.rule}\n\n${generalRule.rule}`;
      expect(result).toBe(expected);
    });

    it("should NOT include rules with alwaysApply: false when globs don't match", () => {
      const userMessage: UserChatMessage = {
        role: "user",
        content: "```py script.py\nprint('hello')\n```",
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage,
        rules: [alwaysApplyFalseWithMatchingGlobs, generalRule],
        contextItems: emptyContextItems,
      });

      // Should only include general rule (alwaysApply:false rule doesn't match .py files)
      const expected = `${baseSystemMessage}\n\n${generalRule.rule}`;
      expect(result).toBe(expected);
    });

    it("should NOT include rules with alwaysApply: false when no globs are specified", () => {
      const userMessage: UserChatMessage = {
        role: "user",
        content: "```js main.js\nconsole.log('hello');\n```",
      };

      const alwaysApplyFalseNoGlobs: RuleWithSource = {
        name: "Always Apply False No Globs",
        rule: "This rule has alwaysApply false and no globs",
        alwaysApply: false,
        source: "rules-block",
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage,
        rules: [alwaysApplyFalseNoGlobs, jsRule, generalRule],
        contextItems: emptyContextItems,
      });

      // Should NOT include alwaysApply:false rule when no globs specified
      const expected = `${baseSystemMessage}\n\n${jsRule.rule}\n\n${generalRule.rule}`;
      expect(result).toBe(expected);
    });

    it("should include rules with alwaysApply: true even when no files are present", () => {
      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage: undefined,
        rules: [alwaysApplyTrueRule, tsRule, pythonRule],
        contextItems: emptyContextItems,
      });

      // Should only include the alwaysApply:true rule
      const expected = `${baseSystemMessage}\n\n${alwaysApplyTrueRule.rule}`;
      expect(result).toBe(expected);
    });

    it("should handle mixed alwaysApply values correctly", () => {
      const userMessage: UserChatMessage = {
        role: "user",
        content:
          "```ts Component.tsx\nexport const Component = () => <div>Hello</div>;\n```",
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage,
        rules: [
          alwaysApplyTrueRule,
          alwaysApplyFalseRule,
          alwaysApplyFalseWithMatchingGlobs,
          tsRule,
          generalRule,
        ],
        contextItems: emptyContextItems,
      });

      // Should include:
      // - alwaysApplyTrueRule (always applies)
      // - alwaysApplyFalseWithMatchingGlobs (has globs that match .tsx)
      // - tsRule (globs match .tsx)
      // - generalRule (no globs, so applies to all)
      // Should NOT include:
      // - alwaysApplyFalseRule (alwaysApply: false and no globs)
      const expected = `${baseSystemMessage}\n\n${alwaysApplyTrueRule.rule}\n\n${alwaysApplyFalseWithMatchingGlobs.rule}\n\n${tsRule.rule}\n\n${generalRule.rule}`;
      expect(result).toBe(expected);
    });

    it("should use glob matching when alwaysApply is false", () => {
      // This tests that rules with alwaysApply: false follow glob matching
      const ruleWithAlwaysApplyFalse: RuleWithSource = {
        name: "Rule With Always Apply False",
        rule: "This rule follows glob matching behavior",
        globs: "**/*.ts?(x)",
        alwaysApply: false,
        source: "rules-block",
      };

      const userMessage: UserChatMessage = {
        role: "user",
        content:
          "```ts Component.tsx\nexport const Component = () => <div>Hello</div>;\n```",
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage,
        rules: [ruleWithAlwaysApplyFalse],
        contextItems: emptyContextItems,
      });

      // Should include the rule because it matches the file path
      const expected = `${baseSystemMessage}\n\n${ruleWithAlwaysApplyFalse.rule}`;
      expect(result).toBe(expected);
    });

    it("should include rules with globs when context file paths match (alwaysApply false)", () => {
      const ruleWithGlobsOnly: RuleWithSource = {
        name: "TypeScript Only Rule",
        rule: "This rule should apply to TypeScript files only",
        globs: "**/*.ts",
        alwaysApply: false,
        source: "rules-block",
      };

      const tsContextItem: ContextItemWithId = {
        content: "TypeScript file content",
        name: "utils.ts",
        description: "A TypeScript utility file",
        id: { providerTitle: "file", itemId: "src/utils.ts" },
        uri: { type: "file", value: "src/utils.ts" },
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage: undefined, // No message, only context
        rules: [ruleWithGlobsOnly, pythonRule], // Include a non-matching rule
        contextItems: [tsContextItem],
      });

      // Should include the TypeScript rule but not the Python rule
      const expected = `${baseSystemMessage}\n\n${ruleWithGlobsOnly.rule}`;
      expect(result).toBe(expected);
    });

    it("should NOT include rules with globs when context file paths don't match (alwaysApply false)", () => {
      const ruleWithGlobsOnly: RuleWithSource = {
        name: "TypeScript Only Rule",
        rule: "This rule should apply to TypeScript files only",
        globs: "**/*.ts",
        alwaysApply: false,
        source: "rules-block",
      };

      const pyContextItem: ContextItemWithId = {
        content: "Python file content",
        name: "utils.py",
        description: "A Python utility file",
        id: { providerTitle: "file", itemId: "src/utils.py" },
        uri: { type: "file", value: "src/utils.py" },
      };

      const result = getSystemMessageWithRules({
        baseSystemMessage,
        userMessage: undefined, // No message, only context
        rules: [ruleWithGlobsOnly],
        contextItems: [pyContextItem], // Python file doesn't match *.ts pattern
      });

      // Should NOT include the rule because context doesn't match the glob
      expect(result).toBe(baseSystemMessage);
    });
  });
});

describe("shouldApplyRule", () => {
  const ruleWithGlobs: RuleWithSource = {
    name: "Rule with Globs",
    rule: "Apply to TypeScript files",
    globs: "**/*.ts?(x)",
    alwaysApply: false,
    source: "rules-block",
  };

  const ruleWithoutGlobs: RuleWithSource = {
    name: "Rule without Globs",
    rule: "Apply to all files",
    alwaysApply: true,
    source: "rules-block",
  };

  const ruleAlwaysApplyTrue: RuleWithSource = {
    name: "Always Apply True",
    rule: "Always apply this rule",
    globs: "**/*.nonexistent",
    alwaysApply: true,
    source: "rules-block",
  };

  const ruleAlwaysApplyFalse: RuleWithSource = {
    name: "Always Apply False",
    rule: "Never apply this rule",
    globs: "**/*.ts?(x)",
    alwaysApply: false,
    source: "rules-block",
  };

  const ruleAlwaysApplyFalseNoGlobs: RuleWithSource = {
    name: "Always Apply False No Globs",
    rule: "Never apply this rule",
    alwaysApply: false,
    source: "rules-block",
  };

  describe("alwaysApply behavior", () => {
    it("should return true when alwaysApply is true, regardless of file paths", () => {
      expect(shouldApplyRule(ruleAlwaysApplyTrue, [])).toBe(true);
      expect(shouldApplyRule(ruleAlwaysApplyTrue, ["src/main.js"])).toBe(true);
      expect(shouldApplyRule(ruleAlwaysApplyTrue, ["Component.tsx"])).toBe(
        true,
      );
    });

    it("should use glob matching when alwaysApply is false", () => {
      // Should apply when globs match
      expect(shouldApplyRule(ruleAlwaysApplyFalse, ["src/main.ts"])).toBe(true);
      expect(shouldApplyRule(ruleAlwaysApplyFalse, ["Component.tsx"])).toBe(
        true,
      );

      // Should not apply when globs don't match
      expect(shouldApplyRule(ruleAlwaysApplyFalse, ["script.py"])).toBe(false);
      expect(shouldApplyRule(ruleAlwaysApplyFalse, [])).toBe(false);
    });

    it("should return false when alwaysApply is false and no globs specified", () => {
      expect(shouldApplyRule(ruleAlwaysApplyFalseNoGlobs, [])).toBe(false);
      expect(
        shouldApplyRule(ruleAlwaysApplyFalseNoGlobs, ["any-file.js"]),
      ).toBe(false);
    });
  });

  describe("default behavior (alwaysApply undefined)", () => {
    it("should return true for rules without globs regardless of file paths", () => {
      expect(shouldApplyRule(ruleWithoutGlobs, [])).toBe(true);
      expect(shouldApplyRule(ruleWithoutGlobs, ["src/main.js"])).toBe(true);
      expect(
        shouldApplyRule(ruleWithoutGlobs, ["Component.tsx", "utils.py"]),
      ).toBe(true);
    });

    it("should return false for rules with globs when no file paths are provided", () => {
      expect(shouldApplyRule(ruleWithGlobs, [])).toBe(false);
    });

    it("should return true for rules with globs when matching file paths are provided", () => {
      expect(shouldApplyRule(ruleWithGlobs, ["Component.tsx"])).toBe(true);
      expect(shouldApplyRule(ruleWithGlobs, ["src/main.ts"])).toBe(true);
      expect(
        shouldApplyRule(ruleWithGlobs, ["utils.js", "Component.tsx"]),
      ).toBe(true);
    });

    it("should return false for rules with globs when no matching file paths are provided", () => {
      expect(shouldApplyRule(ruleWithGlobs, ["utils.py"])).toBe(false);
      expect(shouldApplyRule(ruleWithGlobs, ["main.js", "script.rb"])).toBe(
        false,
      );
    });
  });

  describe("glob pattern matching", () => {
    const ruleWithArrayGlobs: RuleWithSource = {
      name: "Rule with Array Globs",
      rule: "Apply to specific patterns",
      globs: ["src/**/*.ts", "tests/**/*.test.js"],
      source: "rules-block",
    };

    const ruleWithSpecificPattern: RuleWithSource = {
      name: "Rule with Specific Pattern",
      rule: "Apply to Python files",
      globs: "**/*.py",
      source: "rules-block",
    };

    it("should handle array of glob patterns", () => {
      expect(shouldApplyRule(ruleWithArrayGlobs, ["src/main.ts"])).toBe(true);
      expect(shouldApplyRule(ruleWithArrayGlobs, ["tests/unit.test.js"])).toBe(
        true,
      );
      expect(
        shouldApplyRule(ruleWithArrayGlobs, ["config/settings.json"]),
      ).toBe(false);
    });

    it("should handle string glob patterns", () => {
      expect(shouldApplyRule(ruleWithSpecificPattern, ["utils.py"])).toBe(true);
      expect(
        shouldApplyRule(ruleWithSpecificPattern, ["src/models/user.py"]),
      ).toBe(true);
      expect(shouldApplyRule(ruleWithSpecificPattern, ["utils.js"])).toBe(
        false,
      );
    });

    it("should return true if any file path matches when multiple paths provided", () => {
      expect(
        shouldApplyRule(ruleWithSpecificPattern, [
          "utils.js",
          "models.py",
          "config.json",
        ]),
      ).toBe(true);
      expect(
        shouldApplyRule(ruleWithGlobs, [
          "utils.py",
          "Component.tsx",
          "script.rb",
        ]),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty globs array", () => {
      const ruleWithEmptyGlobs: RuleWithSource = {
        name: "Rule with Empty Globs",
        rule: "Test rule",
        globs: [],
        source: "rules-block",
      };

      // Empty array should be treated as "no globs" (truthy check fails)
      expect(shouldApplyRule(ruleWithEmptyGlobs, ["any-file.js"])).toBe(false);
    });

    it("should handle undefined globs", () => {
      const ruleUndefinedGlobs: RuleWithSource = {
        name: "Rule with Undefined Globs",
        rule: "Test rule",
        globs: undefined,
        source: "rules-block",
      };

      expect(shouldApplyRule(ruleUndefinedGlobs, ["any-file.js"])).toBe(true);
      expect(shouldApplyRule(ruleUndefinedGlobs, [])).toBe(true);
    });
  });
});
