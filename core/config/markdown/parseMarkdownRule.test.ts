import {
  convertMarkdownRuleToContinueRule,
  parseMarkdownRule,
} from "./parseMarkdownRule";

describe("parseMarkdownRule", () => {
  it("should correctly parse markdown with YAML frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

# Test Rule

This is a test rule.`;

    const result = parseMarkdownRule(content);
    expect(result.frontmatter).toEqual({ globs: "**/test/**/*.kt" });
    expect(result.markdown).toBe("# Test Rule\n\nThis is a test rule.");
  });

  it("should handle missing frontmatter", () => {
    const content = `# Test Rule

This is a test rule without frontmatter.`;

    const result = parseMarkdownRule(content);
    expect(result.frontmatter).toEqual({});
    expect(result.markdown).toBe(content);
  });

  it("should handle empty frontmatter", () => {
    const content = `---
---

# Test Rule

This is a test rule with empty frontmatter.`;

    const result = parseMarkdownRule(content);

    // Log exact strings for debugging
    console.log("Actual:", JSON.stringify(result.markdown));
    console.log(
      "Expected:",
      JSON.stringify(
        "# Test Rule\n\nThis is a test rule with empty frontmatter.",
      ),
    );

    expect(result.frontmatter).toEqual({});
    expect(result.markdown).toBe(
      "# Test Rule\n\nThis is a test rule with empty frontmatter.",
    );
  });

  it("should handle frontmatter with whitespace", () => {
    const content = `---  
globs: "**/test/**/*.kt"
---  

# Test Rule

This is a test rule.`;

    const result = parseMarkdownRule(content);
    expect(result.frontmatter).toEqual({ globs: "**/test/**/*.kt" });
    expect(result.markdown).toBe("# Test Rule\n\nThis is a test rule.");
  });

  it("should handle Windows line endings (CRLF)", () => {
    // Using \r\n for CRLF line endings
    const content = `---\r
globs: "**/test/**/*.kt"\r
---\r
\r
# Test Rule\r
\r
This is a test rule.`;

    const result = parseMarkdownRule(content);
    expect(result.frontmatter).toEqual({ globs: "**/test/**/*.kt" });
    // The result should be normalized to \n
    expect(result.markdown).toBe("# Test Rule\n\nThis is a test rule.");
  });

  it("should handle malformed frontmatter", () => {
    const content = `---
globs: - "**/test/**/*.kt"
invalid: yaml: content
---

# Test Rule

This is a test rule.`;

    // Should treat as only markdown when frontmatter is malformed
    const result = parseMarkdownRule(content);
    expect(result.frontmatter).toEqual({});
    expect(result.markdown).toBe(content);
  });
});

describe("convertMarkdownRuleToContinueRule", () => {
  it("should convert markdown with frontmatter to a rule", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Custom Name
---

# Test Rule

This is a test rule.`;

    const result = convertMarkdownRuleToContinueRule(
      "/path/to/rule.md",
      content,
    );
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.globs).toBe("**/test/**/*.kt");
    expect(result.name).toBe("Custom Name");
    expect(result.source).toBe("rules-block");
    expect(result.ruleFile).toBe("/path/to/rule.md");
  });

  it("should use the first heading as name if not in frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

# Test Rule Title

This is a test rule.`;

    const result = convertMarkdownRuleToContinueRule(
      "/path/to/rule.md",
      content,
    );
    expect(result.name).toBe("Test Rule Title");
  });

  it("should use filename as name if no heading or frontmatter name", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

This is a test rule without a heading.`;

    const result = convertMarkdownRuleToContinueRule(
      "/path/to/custom-rule.md",
      content,
    );
    expect(result.name).toBe("custom-rule");
  });

  it("should include description from frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Test Rule
description: This is a rule description from frontmatter
---

# Test Rule

This is the content of the rule.`;

    const result = convertMarkdownRuleToContinueRule(
      "/path/to/rule.md",
      content,
    );
    expect(result.description).toBe(
      "This is a rule description from frontmatter",
    );
  });

  it("should include `alwaysApply` from frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Test Rule
alwaysApply: false
---

# Test Rule

This is a rule with alwaysApply explicitly set to false.`;

    const result = convertMarkdownRuleToContinueRule(
      "/path/to/rule.md",
      content,
    );
    expect(result.alwaysApply).toBe(false);
  });
});
