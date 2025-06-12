import { describe, expect, it } from "vitest";
import {
  createMarkdownWithFrontmatter,
  createRuleFilePath,
  createRuleMarkdown,
  sanitizeRuleName,
} from "./createMarkdownRule";
import { parseMarkdownRule } from "./parseMarkdownRule";

describe("sanitizeRuleName", () => {
  it("should sanitize rule names for filenames", () => {
    expect(sanitizeRuleName("My Test Rule")).toBe("my-test-rule");
    expect(sanitizeRuleName("Rule with @#$% chars")).toBe("rule-with-chars");
    expect(sanitizeRuleName("Multiple   spaces")).toBe("multiple-spaces");
    expect(sanitizeRuleName("UPPERCASE-rule")).toBe("uppercase-rule");
    expect(sanitizeRuleName("already-sanitized")).toBe("already-sanitized");
  });

  it("should handle empty and edge case inputs", () => {
    expect(sanitizeRuleName("")).toBe("");
    expect(sanitizeRuleName("   ")).toBe("");
    expect(sanitizeRuleName("123")).toBe("123");
    expect(sanitizeRuleName("rule-with-numbers-123")).toBe(
      "rule-with-numbers-123",
    );
  });
});

describe("createRuleFilePath", () => {
  it("should create correct rule file path", () => {
    const result = createRuleFilePath("/workspace", "My Test Rule");
    expect(result).toBe("/workspace/.continue/rules/my-test-rule.md");
  });

  it("should handle special characters in rule name", () => {
    const result = createRuleFilePath("/home/user", "Rule with @#$% chars");
    expect(result).toBe("/home/user/.continue/rules/rule-with-chars.md");
  });

  it("should handle edge case rule names", () => {
    const result = createRuleFilePath("/test", "   Multiple   Spaces   ");
    expect(result).toBe("/test/.continue/rules/multiple-spaces.md");
  });
});

describe("createMarkdownWithFrontmatter", () => {
  it("should create properly formatted markdown with frontmatter", () => {
    const frontmatter = {
      name: "Test Rule",
      description: "A test rule",
      globs: "*.ts",
    };
    const markdown = "# Test Rule\n\nThis is a test rule.";

    const result = createMarkdownWithFrontmatter(frontmatter, markdown);

    // The exact quote style doesn't matter as long as it parses correctly
    expect(result).toContain("name: Test Rule");
    expect(result).toContain("description: A test rule");
    expect(result).toContain("globs:");
    expect(result).toContain("*.ts");
    expect(result).toContain("---\n\n# Test Rule\n\nThis is a test rule.");
  });

  it("should handle empty frontmatter", () => {
    const frontmatter = {};
    const markdown = "# Simple Rule\n\nJust markdown content.";

    const result = createMarkdownWithFrontmatter(frontmatter, markdown);

    const expected = `---
{}
---

# Simple Rule

Just markdown content.`;

    expect(result).toBe(expected);
  });

  it("should create content that can be parsed back correctly", () => {
    const originalFrontmatter = {
      name: "Roundtrip Test",
      description: "Testing roundtrip parsing",
      globs: ["*.js", "*.ts"],
      alwaysApply: true,
    };
    const originalMarkdown =
      "# Roundtrip Test\n\nThis should parse back correctly.";

    const created = createMarkdownWithFrontmatter(
      originalFrontmatter,
      originalMarkdown,
    );
    const parsed = parseMarkdownRule(created);

    expect(parsed.frontmatter).toEqual(originalFrontmatter);
    expect(parsed.markdown).toBe(originalMarkdown);
  });
});

describe("createRuleMarkdown", () => {
  it("should create rule markdown with all options", () => {
    const result = createRuleMarkdown("Test Rule", "This is the rule content", {
      description: "Test description",
      globs: ["*.ts", "*.js"],
      alwaysApply: true,
    });

    const parsed = parseMarkdownRule(result);

    expect(parsed.frontmatter.description).toBe("Test description");
    expect(parsed.frontmatter.globs).toEqual(["*.ts", "*.js"]);
    expect(parsed.frontmatter.alwaysApply).toBe(true);
    expect(parsed.markdown).toBe("# Test Rule\n\nThis is the rule content");
  });

  it("should create rule markdown with minimal options", () => {
    const result = createRuleMarkdown("Simple Rule", "Simple content");

    const parsed = parseMarkdownRule(result);

    expect(parsed.frontmatter.description).toBeUndefined();
    expect(parsed.frontmatter.globs).toBeUndefined();
    expect(parsed.frontmatter.alwaysApply).toBeUndefined();
    expect(parsed.markdown).toBe("# Simple Rule\n\nSimple content");
  });

  it("should handle string globs", () => {
    const result = createRuleMarkdown("String Glob Rule", "Content", {
      globs: "*.py",
    });

    const parsed = parseMarkdownRule(result);
    expect(parsed.frontmatter.globs).toBe("*.py");
  });

  it("should trim description and globs", () => {
    const result = createRuleMarkdown("Trim Test", "Content", {
      description: "  spaced description  ",
      globs: "  *.ts  ",
    });

    const parsed = parseMarkdownRule(result);
    expect(parsed.frontmatter.description).toBe("spaced description");
    expect(parsed.frontmatter.globs).toBe("*.ts");
  });

  it("should handle alwaysApply false explicitly", () => {
    const result = createRuleMarkdown("Always Apply False", "Content", {
      alwaysApply: false,
    });

    const parsed = parseMarkdownRule(result);
    expect(parsed.frontmatter.alwaysApply).toBe(false);
  });
});
