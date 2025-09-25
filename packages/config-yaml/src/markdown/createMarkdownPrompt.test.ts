import {
  createMarkdownWithPromptFrontmatter,
  createPromptMarkdown,
} from "./createMarkdownPrompt.js";

describe("createMarkdownWithPromptFrontmatter", () => {
  test("should create properly formatted markdown with frontmatter", () => {
    const frontmatter = {
      name: "Test Prompt",
      description: "A test prompt",
      invokable: true,
    };
    const prompt = "This is the prompt content";

    const result = createMarkdownWithPromptFrontmatter(frontmatter, prompt);

    expect(result).toBe(`---
name: Test Prompt
description: A test prompt
invokable: true
---

This is the prompt content`);
  });

  test("should handle empty frontmatter", () => {
    const frontmatter = {};
    const prompt = "Simple prompt content";

    const result = createMarkdownWithPromptFrontmatter(frontmatter, prompt);

    expect(result).toBe(`---
{}
---

Simple prompt content`);
  });
});

describe("createPromptMarkdown", () => {
  test("should create properly formatted markdown with all options", () => {
    const result = createPromptMarkdown(
      "Test Prompt",
      "This is the prompt content",
      {
        description: "A test prompt",
        invokable: true,
      },
    );

    expect(result).toBe(`---
name: Test Prompt
description: A test prompt
invokable: true
---

This is the prompt content`);
  });

  test("should handle minimal configuration", () => {
    const result = createPromptMarkdown("Simple Prompt", "Simple content");

    expect(result).toBe(`---
name: Simple Prompt
---

Simple content`);
  });

  test("should handle description only", () => {
    const result = createPromptMarkdown("Prompt with Description", "Content", {
      description: "Test description",
    });

    expect(result).toBe(`---
name: Prompt with Description
description: Test description
---

Content`);
  });

  test("should trim name and description", () => {
    const result = createPromptMarkdown("  Trim Test  ", "Content", {
      description: "  Trimmed Description  ",
    });

    expect(result).toBe(`---
name: Trim Test
description: Trimmed Description
---

Content`);
  });

  test("should handle invokable false", () => {
    const result = createPromptMarkdown("Invokable False", "Content", {
      invokable: false,
    });

    expect(result).toBe(`---
name: Invokable False
invokable: false
---

Content`);
  });
});
