import { PackageIdentifier } from "../browser.js";
import { getRuleName, markdownToRule } from "./markdownToRule.js";

describe("markdownToRule", () => {
  // Use a mock PackageIdentifier for testing
  const mockId: PackageIdentifier = {
    uriType: "file",
    fileUri: "file:///path/to/file",
  };

  it("should convert markdown with frontmatter to a rule", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Custom Name
---

# Test Rule

This is a test rule.`;

    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.globs).toBe("/path/to/**/test/**/*.kt");
    expect(result.name).toBe("Custom Name");
  });

  it("should correctly parse markdown with YAML frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

# Test Rule

This is a test rule.`;

    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.globs).toBe("/path/to/**/test/**/*.kt");
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.name).toBe("to/file"); // Should use last two path segments
  });

  it("should handle missing frontmatter", () => {
    const content = `# Test Rule

This is a test rule without frontmatter.`;

    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.globs).toBe("/path/to/**/*");
    expect(result.rule).toBe(content);
    expect(result.name).toBe("to/file"); // Should use last two path segments
  });

  it("should handle empty frontmatter", () => {
    const content = `---
---

# Test Rule

This is a test rule with empty frontmatter.`;

    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.globs).toBe("/path/to/**/*");
    expect(result.rule).toBe(
      "# Test Rule\n\nThis is a test rule with empty frontmatter.",
    );
    expect(result.name).toBe("to/file"); // Should use last two path segments
  });

  describe("glob patterns", () => {
    // we want to ensure the following glob changes happen
    // *.ts -> path/to/**/*.ts
    // **/subdir/** -> path/to/**/**/subdir/** OR path/to/**/subdir/**
    // myfile -> path/to/**/myfile (any depth including 0)
    // mydir/ -> path/to/**/mydir/**
    // **abc** -> path/to/**abc**
    // *xyz* -> path/to/**/*xyz*

    it("should match glob pattern for file extensions", () => {
      const content = `---
globs: "*.ts"
name: glob pattern testing
---
  
  # Test Rule
  
  This is a test rule.`;

      const result = markdownToRule(content, mockId, "/path/to/");
      expect(result.globs).toBe("/path/to/**/*.ts");
    });

    it("should match glob pattern for dotfiles", () => {
      const content = `---
globs: ".gitignore"
name: glob pattern testing
---
  
  # Test Rule
  
  This is a test rule.`;

      const result = markdownToRule(content, mockId, "/path/to/");
      expect(result.globs).toBe("/path/to/**/.gitignore");
    });

    it("should also work in root as base directory", () => {
      const content = `---
globs: "src/**/Dockerfile"
name: glob pattern testing
---
  
  # Test Rule
  
  This is a test rule.`;

      const result = markdownToRule(content, {
        uriType: "file",
        fileUri: "file:///",
      });
      expect(result.globs).toBe("src/**/Dockerfile");
    });

    it("should match for multiple globs", () => {
      const content = `---
globs: ["**/nested/**/deeper/**/*.rs", ".zshrc1", "**abc**", "*xyz*"]
name: glob pattern testing
---

# Test Rule

This is a test rule.`;

      const result = markdownToRule(content, mockId, "/path/to/");
      expect(result.globs).toEqual([
        "/path/to/**/nested/**/deeper/**/*.rs",
        "/path/to/**/.zshrc1",
        "/path/to/**abc**",
        "/path/to/**/*xyz*",
      ]);
    });

    it("should not prepend when inside .continue", () => {
      const content = `---
globs: ".git"
name: glob pattern testing
---
  
  # Test Rule
  
  This is a test rule.`;

      const result = markdownToRule(
        content,
        {
          uriType: "file",
          fileUri: "file:///Documents/myproject/.continue/rules/rule1.md",
        },
        "/Documents/myproject/.continue/",
      );
      expect(result.globs).toBe(".git");
    });
  });

  it("should handle frontmatter with whitespace", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

# Test Rule

This is a test rule.`;

    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.globs).toBe("/path/to/**/test/**/*.kt");
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.name).toBe("to/file"); // Should use last two path segments
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

    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.globs).toBe("/path/to/**/test/**/*.kt");
    // The result should be normalized to \n
    expect(result.rule).toBe("# Test Rule\n\nThis is a test rule.");
    expect(result.name).toBe("to/file"); // Should use last two path segments
  });

  it("should handle malformed frontmatter", () => {
    const content = `---
globs: - "**/test/**/*.kt"
invalid: yaml: content
---

# Test Rule

This is a test rule.`;

    // Should treat as only markdown when frontmatter is malformed
    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.globs).toBe("/path/to/**/*");
    expect(result.rule).toBe(content);
    expect(result.name).toBe("to/file"); // Should use last two path segments
  });

  it("should use packageIdentifierToDisplayName if no heading or frontmatter name", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

# Test Rule Title

This is a test rule.`;

    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.name).toBe("to/file"); // Should use last two path segments
  });

  it("should use packageIdentifierToDisplayName if no heading or frontmatter name (no heading)", () => {
    const content = `---
globs: "**/test/**/*.kt"
---

This is a test rule without a heading.`;

    const result = markdownToRule(content, mockId, "/path/to/");
    expect(result.name).toBe("to/file"); // Should use last two path segments
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

  it("should include invokable from frontmatter when true", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Test Rule
invokable: true
---

# Test Rule

This is an invokable rule.`;

    const result = markdownToRule(content, mockId);
    expect(result.invokable).toBe(true);
  });

  it("should include invokable from frontmatter when false", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Test Rule
invokable: false
---

# Test Rule

This is a non-invokable rule.`;

    const result = markdownToRule(content, mockId);
    expect(result.invokable).toBe(false);
  });

  it("should handle invokable with alwaysApply together", () => {
    const content = `---
alwaysApply: true
invokable: true
name: Test Rule
---

# Test Rule

This is a rule with both alwaysApply and invokable.`;

    const result = markdownToRule(content, mockId);
    expect(result.alwaysApply).toBe(true);
    expect(result.invokable).toBe(true);
  });

  it("should not include invokable when not in frontmatter", () => {
    const content = `---
globs: "**/test/**/*.kt"
name: Test Rule
---

# Test Rule

This is a rule without invokable property.`;

    const result = markdownToRule(content, mockId);
    expect(result.invokable).toBeUndefined();
  });
});

describe("getRuleName", () => {
  it("should return frontmatter name when provided", () => {
    const frontmatter = { name: "Custom Rule Name" };
    const id: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///path/to/my-rule.md",
    };

    const result = getRuleName(frontmatter, id);
    expect(result).toBe("Custom Rule Name");
  });

  it("should return last two path segments for file identifier when no name", () => {
    const frontmatter = {};
    const id: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///long/path/to/rules/my-rule.md",
    };

    const result = getRuleName(frontmatter, id);
    expect(result).toBe("rules/my-rule.md");
  });
  it("should handle mixed forward and back slashes", () => {
    const frontmatter = {};
    const id: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///path/to\\rules/my-rule.md",
    };

    const result = getRuleName(frontmatter, id);
    expect(result).toBe("rules/my-rule.md");
  });

  it("should handle single segment path", () => {
    const frontmatter = {};
    const id: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///my-rule.md",
    };

    const result = getRuleName(frontmatter, id);
    expect(result).toBe("my-rule.md");
  });

  it("should handle two segment path", () => {
    const frontmatter = {};
    const id: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///rules/my-rule.md",
    };

    const result = getRuleName(frontmatter, id);
    expect(result).toBe("rules/my-rule.md");
  });

  it("should return display name for non-file identifiers", () => {
    const frontmatter = {};
    const id: PackageIdentifier = {
      uriType: "slug",
      fullSlug: {
        ownerSlug: "test-owner",
        packageSlug: "my-rule-package",
        versionSlug: "v1.0.0",
      },
    };

    const result = getRuleName(frontmatter, id);
    expect(result).toBe("my-rule-package"); // packageIdentifierToDisplayName returns just the packageSlug
  });

  it("should prioritize frontmatter name over file path", () => {
    const frontmatter = { name: "Override Name" };
    const id: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///very/long/path/to/rules/original-name.md",
    };

    const result = getRuleName(frontmatter, id);
    expect(result).toBe("Override Name");
  });

  it("should handle empty string name in frontmatter by falling back to path", () => {
    const frontmatter = { name: "" };
    const id: PackageIdentifier = {
      uriType: "file",
      fileUri: "file:///path/to/rules/my-rule.md",
    };

    const result = getRuleName(frontmatter, id);
    expect(result).toBe("rules/my-rule.md"); // Empty string is falsy, so falls back to path logic
  });
});
