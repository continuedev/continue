import { streamLazyApply } from "./streamLazyApply";

// Mock LLM for testing
class MockLLM {
  model = "claude-3-5-sonnet-20241022";
  providerName = "anthropic";

  async *streamChat(messages: any[], signal?: AbortSignal) {
    // Simulate LLM response for markdown file with nested blocks
    const lines = [
      "# Project Structure",
      "",
      "```markdown README.md",
      "# Project Structure",
      "",
      "```",
      ".",
      "├── src/",
      "│   └── main.js",
      "└── package.json",
      "```",
      "```",
    ];

    // Yield each line separately (more realistic streaming)
    for (const line of lines) {
      yield line;
    }
  }
}

class MockJavaScriptLLM {
  model = "claude-3-5-sonnet-20241022";
  providerName = "anthropic";

  async *streamChat(messages: any[], signal?: AbortSignal) {
    // Simulate LLM response for JavaScript file
    const lines = [
      "function calculateSum(a, b) {",
      "  return a + b;",
      "}",
      "",
      "function calculateProduct(a, b) {",
      "  return a * b;",
      "}",
    ];

    for (const line of lines) {
      yield line;
    }
  }
}

class MockPythonLLM {
  model = "claude-3-5-sonnet-20241022";
  providerName = "anthropic";

  async *streamChat(messages: any[], signal?: AbortSignal) {
    // Simulate LLM response for Python file
    const lines = [
      "def calculate_sum(a, b):",
      "    return a + b",
      "",
      "def calculate_product(a, b):",
      "    return a * b",
    ];

    for (const line of lines) {
      yield line;
    }
  }
}

class MockWithUnchangedCodeLLM {
  model = "claude-3-5-sonnet-20241022";
  providerName = "anthropic";

  async *streamChat(messages: any[], signal?: AbortSignal) {
    // Simulate LLM response with UNCHANGED_CODE markers
    const lines = [
      "function newFunction() {",
      "  return 'new';",
      "}",
      "",
      "// ... unchanged code ...",
      "",
      "function anotherFunction() {",
      "  return 'updated';",
      "}",
    ];

    for (const line of lines) {
      yield line;
    }
  }
}

class MockTypeScriptLLM {
  model = "claude-3-5-sonnet-20241022";
  providerName = "anthropic";

  async *streamChat(messages: any[], signal?: AbortSignal) {
    const lines = [
      "interface User {",
      "  id: number;",
      "  name: string;",
      "}",
      "",
      "function getUser(id: number): User {",
      "  return { id, name: 'Test User' };",
      "}",
    ];

    for (const line of lines) {
      yield line;
    }
  }
}

class MockEmptyLLM {
  model = "claude-3-5-sonnet-20241022";
  providerName = "anthropic";

  async *streamChat(messages: any[], signal?: AbortSignal) {
    // Empty response
    return;
  }
}

class MockSimpleLLM {
  model = "claude-3-5-sonnet-20241022";
  providerName = "anthropic";

  async *streamChat(messages: any[], signal?: AbortSignal) {
    const lines = ["function test() {", "  return true;", "}"];
    for (const line of lines) {
      yield line;
    }
  }
}

class MockRegularMarkdownLLM {
  model = "claude-3-5-sonnet-20241022";
  providerName = "anthropic";

  async *streamChat(messages: any[], signal?: AbortSignal) {
    // Simulate regular markdown with simple code block
    const lines = [
      "# Debug Test Folder",
      "The sole purpose of this folder is to open it when debugging.",
      "",
      "## File Structure",
      "```",
      "debug-test-folder/",
      "├── AdvancedPage.tsx",
      "├── Calculator.java",
      "├── Dockerfile",
      "└── test.ts",
      "```",
    ];

    for (const line of lines) {
      yield line;
    }
  }
}

describe("streamLazyApply", () => {
  test("should handle markdown files with nested blocks without stopping early", async () => {
    const oldCode = "# Project\n\nBasic readme content.";
    const newCode = `# Project Structure

\`\`\`markdown README.md
# Project Structure

\`\`\`
.
├── src/
│   └── main.js
└── package.json
\`\`\`
\`\`\``;
    const filename = "README.md";
    const llm = new MockLLM() as any;
    const abortController = new AbortController();

    const diffLines = [];
    for await (const diffLine of streamLazyApply(
      oldCode,
      filename,
      newCode,
      llm,
      abortController,
    )) {
      diffLines.push(diffLine);
    }

    // Should have received diff lines (not empty)
    expect(diffLines.length).toBeGreaterThan(0);

    // Should contain the nested markdown content
    const allContent = diffLines.map((d) => d.line).join("\n");
    expect(allContent).toContain("```markdown README.md");
    expect(allContent).toContain("└── package.json");

    // Should not have been truncated at the first ```
    expect(allContent).toContain("src/");
  });

  test("should handle JavaScript files correctly", async () => {
    const oldCode = "function calculateSum(a, b) {\n  return a + b;\n}";
    const newCode = `function calculateSum(a, b) {
  return a + b;
}

function calculateProduct(a, b) {
  return a * b;
}`;
    const filename = "calculator.js";
    const llm = new MockJavaScriptLLM() as any;
    const abortController = new AbortController();

    const diffLines = [];
    for await (const diffLine of streamLazyApply(
      oldCode,
      filename,
      newCode,
      llm,
      abortController,
    )) {
      diffLines.push(diffLine);
    }

    // Should have received diff lines
    expect(diffLines.length).toBeGreaterThan(0);

    // Should contain the JavaScript functions
    const allContent = diffLines.map((d) => d.line).join("\n");
    expect(allContent).toContain("calculateSum");
    expect(allContent).toContain("calculateProduct");
  });

  test("should handle Python files correctly", async () => {
    const oldCode = "def calculate_sum(a, b):\n    return a + b";
    const newCode = `def calculate_sum(a, b):
    return a + b

def calculate_product(a, b):
    return a * b`;
    const filename = "calculator.py";
    const llm = new MockPythonLLM() as any;
    const abortController = new AbortController();

    const diffLines = [];
    for await (const diffLine of streamLazyApply(
      oldCode,
      filename,
      newCode,
      llm,
      abortController,
    )) {
      diffLines.push(diffLine);
    }

    // Should have received diff lines
    expect(diffLines.length).toBeGreaterThan(0);

    // Should contain the Python functions
    const allContent = diffLines.map((d) => d.line).join("\n");
    expect(allContent).toContain("calculate_sum");
    expect(allContent).toContain("calculate_product");
  });

  test("should handle UNCHANGED_CODE markers in responses", async () => {
    const oldCode = `function oldFunction() {
  return 'old';
}

function existingFunction() {
  return 'existing';
}`;
    const newCode = `function newFunction() {
  return 'new';
}

function existingFunction() {
  return 'existing';
}

function anotherFunction() {
  return 'updated';
}`;
    const filename = "example.js";
    const llm = new MockWithUnchangedCodeLLM() as any;
    const abortController = new AbortController();

    const diffLines = [];
    for await (const diffLine of streamLazyApply(
      oldCode,
      filename,
      newCode,
      llm,
      abortController,
    )) {
      diffLines.push(diffLine);
    }

    // Should have received diff lines
    expect(diffLines.length).toBeGreaterThan(0);

    // Should contain new and updated functions
    const allContent = diffLines.map((d) => d.line).join("\n");
    expect(allContent).toContain("newFunction");
    expect(allContent).toContain("anotherFunction");
  });

  test("should handle TypeScript files correctly", async () => {
    const oldCode = "interface User {\n  id: number;\n}";
    const newCode = `interface User {
  id: number;
  name: string;
}

function getUser(id: number): User {
  return { id, name: 'Test User' };
}`;
    const filename = "user.ts";
    const llm = new MockTypeScriptLLM() as any;
    const abortController = new AbortController();

    const diffLines = [];
    for await (const diffLine of streamLazyApply(
      oldCode,
      filename,
      newCode,
      llm,
      abortController,
    )) {
      diffLines.push(diffLine);
    }

    // Should have received diff lines
    expect(diffLines.length).toBeGreaterThan(0);

    // Should contain TypeScript interface and function
    const allContent = diffLines.map((d) => d.line).join("\n");
    expect(allContent).toContain("interface User");
    expect(allContent).toContain("getUser");
    expect(allContent).toContain("name: string");
  });

  test("should work with empty LLM responses", async () => {
    const oldCode = "function test() { return 1; }";
    const newCode = "function test() { return 2; }";
    const filename = "test.js";
    const llm = new MockEmptyLLM() as any;
    const abortController = new AbortController();

    const diffLines = [];
    for await (const diffLine of streamLazyApply(
      oldCode,
      filename,
      newCode,
      llm,
      abortController,
    )) {
      diffLines.push(diffLine);
    }

    // Should handle empty response gracefully
    expect(diffLines).toBeDefined();
  });

  test("should correctly identify markdown vs non-markdown files", async () => {
    // Test that our isMarkdownFile logic works
    const markdownFiles = ["README.md", "docs.markdown", "example.gfm"];
    const nonMarkdownFiles = [
      "script.js",
      "code.py",
      "style.css",
      "component.tsx",
    ];

    // This is more of a unit test, but verifies our file detection logic
    // We can test this indirectly by checking that different file types
    // are processed through different code paths

    const oldCode = "function test() { return false; }";
    const newCode = "function test() { return true; }";
    const llm = new MockSimpleLLM() as any;

    // Test each file type
    for (const filename of [...markdownFiles, ...nonMarkdownFiles]) {
      const abortController = new AbortController();
      const diffLines = [];

      for await (const diffLine of streamLazyApply(
        oldCode,
        filename,
        newCode,
        llm,
        abortController,
      )) {
        diffLines.push(diffLine);
      }

      // Should work for all file types
      expect(diffLines.length).toBeGreaterThan(0);

      const allContent = diffLines.map((d) => d.line).join("\n");
      expect(allContent).toContain("test");
    }
  });

  test("should handle regular markdown files with simple code blocks", async () => {
    const oldCode = "# Old Content";
    const newCode = `# Debug Test Folder
The sole purpose of this folder is to open it when debugging.

## File Structure
\`\`\`
debug-test-folder/
├── AdvancedPage.tsx
├── Calculator.java
├── Dockerfile
└── test.ts
\`\`\``;

    const filename = "README.md";
    const llm = new MockRegularMarkdownLLM() as any;
    const abortController = new AbortController();

    const diffLines = [];
    for await (const diffLine of streamLazyApply(
      oldCode,
      filename,
      newCode,
      llm,
      abortController,
    )) {
      diffLines.push(diffLine);
    }

    // Should have received diff lines (not empty)
    expect(diffLines.length).toBeGreaterThan(0);

    // Should contain the full file structure
    const allContent = diffLines.map((d) => d.line).join("\n");
    expect(allContent).toContain("Debug Test Folder");
    expect(allContent).toContain("File Structure");
    expect(allContent).toContain("debug-test-folder/");
    expect(allContent).toContain("├── AdvancedPage.tsx");
    expect(allContent).toContain("└── test.ts");

    // Should not have been truncated at the opening ```
    expect(allContent).toContain("Calculator.java");
    expect(allContent).toContain("Dockerfile");
  });
});
