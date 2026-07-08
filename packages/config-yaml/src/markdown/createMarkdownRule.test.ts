import { PackageIdentifier } from "../browser.js";
import {
  createMarkdownWithFrontmatter,
  createRuleMarkdown,
  sanitizeRuleName,
} from "./createMarkdownRule.js";
import { markdownToRule } from "./markdownToRule.js";

// Mock package identifier for testing
const mockPackageId: PackageIdentifier = {
  uriType: "file",
  fileUri: "/path/to/folder",
};

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
    const parsed = markdownToRule(created, mockPackageId);

    expect(parsed.name).toBe(originalFrontmatter.name);
    expect(parsed.description).toBe(originalFrontmatter.description);
    expect(parsed.globs).toEqual(originalFrontmatter.globs);
    expect(parsed.alwaysApply).toBe(originalFrontmatter.alwaysApply);
    expect(parsed.rule).toBe(originalMarkdown);
  });
});

describe("createRuleMarkdown", () => {
  it("should create rule markdown with all options", () => {
    const result = createRuleMarkdown("Test Rule", "This is the rule content", {
      description: "Test description",
      globs: ["*.ts", "*.js"],
      alwaysApply: true,
    });

    const parsed = markdownToRule(result, mockPackageId);

    expect(parsed.description).toBe("Test description");
    expect(parsed.globs).toEqual(["*.ts", "*.js"]);
    expect(parsed.alwaysApply).toBe(true);
    expect(parsed.rule).toBe("This is the rule content");
  });

  it("should create rule markdown with minimal options", () => {
    const result = createRuleMarkdown("Simple Rule", "Simple content");

    const parsed = markdownToRule(result, mockPackageId);

    expect(parsed.description).toBeUndefined();
    expect(parsed.globs).toBeUndefined();
    expect(parsed.alwaysApply).toBeUndefined();
    expect(parsed.rule).toBe("Simple content");
  });

  it("should handle string globs", () => {
    const result = createRuleMarkdown("String Glob Rule", "Content", {
      globs: "*.py",
    });

    const parsed = markdownToRule(result, mockPackageId);
    expect(parsed.globs).toBe("*.py");
  });

  it("should trim description and globs", () => {
    const result = createRuleMarkdown("Trim Test", "Content", {
      description: "  spaced description  ",
      globs: "  *.ts  ",
    });

    const parsed = markdownToRule(result, mockPackageId);
    expect(parsed.description).toBe("spaced description");
    expect(parsed.globs).toBe("*.ts");
  });

  it("should handle alwaysApply false explicitly", () => {
    const result = createRuleMarkdown("Always Apply False", "Content", {
      alwaysApply: false,
    });

    const parsed = markdownToRule(result, mockPackageId);
    expect(parsed.alwaysApply).toBe(false);
  });
});
