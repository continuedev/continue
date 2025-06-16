import { PackageIdentifier } from "../browser.js";
import { markdownToRule } from "./markdownToRule.js";

describe("markdownToRule", () => {
  // Use a mock PackageIdentifier for testing
  const mockId: PackageIdentifier = {
    uriType: "file",
    filePath: "/path/to/file",
  };

  it("should convert markdown with frontmatter to a rule", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Custom Name
---

# Test Rule

This is a test rule.`;

    const result = markdownToRule(content, mockId);
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.globs).toBe("**/test/**/*.kt");
    expect(result.name).toBe("Custom Name");
  });

  it("should correctly parse markdown with YAML frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

# Test Rule

This is a test rule.`;

    const result = markdownToRule(content, mockId);
    expect(result.globs).toBe("**/test/**/*.kt");
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.name).toBe("/path/to/file"); // Should use packageIdentifierToDisplayName result
  });

  it("should handle missing frontmatter", () => {
    const content = `# Test Rule

This is a test rule without frontmatter.`;

    const result = markdownToRule(content, mockId);
    expect(result.globs).toBeUndefined();
    expect(result.rule).toBe(content);
    expect(result.name).toBe("/path/to/file"); // Should use packageIdentifierToDisplayName result
  });

  it("should handle empty frontmatter", () => {
    const content = `---
---

# Test Rule

This is a test rule with empty frontmatter.`;

    const result = markdownToRule(content, mockId);
    expect(result.globs).toBeUndefined();
    expect(result.rule).toBe(
      "# Test Rule\n\nThis is a test rule with empty frontmatter.",
    );
    expect(result.name).toBe("/path/to/file"); // Should use packageIdentifierToDisplayName result
  });

  it("should handle frontmatter with whitespace", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

# Test Rule

This is a test rule.`;

    const result = markdownToRule(content, mockId);
    expect(result.globs).toBe("**/test/**/*.kt");
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.name).toBe("/path/to/file"); // Should use packageIdentifierToDisplayName result
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

    const result = markdownToRule(content, mockId);
    expect(result.globs).toBe("**/test/**/*.kt");
    // The result should be normalized to \n
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.name).toBe("/path/to/file"); // Should use packageIdentifierToDisplayName result
  });

  it("should handle malformed frontmatter", () => {
    const content = `---
globs: - "**/test/**/*.kt"
invalid: yaml: content
---

# Test Rule

This is a test rule.`;

    // Should treat as only markdown when frontmatter is malformed
    const result = markdownToRule(content, mockId);
    expect(result.globs).toBeUndefined();
    expect(result.rule).toBe(content);
    expect(result.name).toBe("/path/to/file"); // Should use packageIdentifierToDisplayName result
  });

  it("should use packageIdentifierToDisplayName if no heading or frontmatter name", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

# Test Rule Title

This is a test rule.`;

    const result = markdownToRule(content, mockId);
    expect(result.name).toBe("/path/to/file"); // Should use packageIdentifierToDisplayName result
  });

  it("should use packageIdentifierToDisplayName if no heading or frontmatter name (no heading)", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

This is a test rule without a heading.`;

    const result = markdownToRule(content, mockId);
    expect(result.name).toBe("/path/to/file"); // Should use packageIdentifierToDisplayName result
  });

  it("should include description from frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Test Rule
description: This is a rule description from frontmatter
---

# Test Rule

This is the content of the rule.`;

    const result = markdownToRule(content, mockId);
    expect(result.description).toBe(
      "This is a rule description from frontmatter",
    );
  });

  it("should include alwaysApply from frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Test Rule
alwaysApply: false
---

# Test Rule

This is a rule with alwaysApply explicitly set to false.`;

    const result = markdownToRule(content, mockId);
    expect(result.alwaysApply).toBe(false);
  });
});
