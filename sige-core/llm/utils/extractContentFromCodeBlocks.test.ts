import { extractContentFromCodeBlock } from "./extractContentFromCodeBlocks";

describe("extractContentFromCodeBlock", () => {
  it("should extract content from code block with language and filepath", () => {
    const content = "```typescript src/main.ts\nconst x = 1;\n```";
    expect(extractContentFromCodeBlock(content, "src/main.ts")).toBe(
      "const x = 1;",
    );
  });

  it("should extract content from code block with filepath only (no language)", () => {
    const content = "```test.js\nclass Calculator { }\n```";
    expect(extractContentFromCodeBlock(content, "test.js")).toBe(
      "class Calculator { }",
    );
  });

  it("should extract content from code block with line ranges", () => {
    const content = "```js test.js (19-25)\nfunction test() {}\n```";
    expect(extractContentFromCodeBlock(content, "test.js")).toBe(
      "function test() {}",
    );
  });

  it("should handle multiple code blocks and find the right one", () => {
    const content =
      "```typescript src/main.ts\nconst x = 1;\n```\n" +
      "```test.js\nclass Calculator { }\n```\n" +
      "```js utils.js (19-25)\nfunction test() {}\n```";

    expect(extractContentFromCodeBlock(content, "src/main.ts")).toBe(
      "const x = 1;",
    );
    expect(extractContentFromCodeBlock(content, "test.js")).toBe(
      "class Calculator { }",
    );
    expect(extractContentFromCodeBlock(content, "utils.js")).toBe(
      "function test() {}",
    );
  });

  it("should handle paths with special regex characters", () => {
    const content =
      "```typescript src/special+chars.ts[123]\nconst special = true;\n```";
    expect(
      extractContentFromCodeBlock(content, "src/special+chars.ts[123]"),
    ).toBe("const special = true;");
  });

  it("should handle multiline content", () => {
    const content =
      "```typescript src/multi-line.ts\n" +
      "function example() {\n" +
      "  const x = 1;\n" +
      "  return x + 2;\n" +
      "}\n" +
      "```";

    const expected =
      "function example() {\n" + "  const x = 1;\n" + "  return x + 2;\n" + "}";

    expect(extractContentFromCodeBlock(content, "src/multi-line.ts")).toBe(
      expected,
    );
  });

  it("should return undefined when path doesn't exist in any code block", () => {
    const content = "```typescript src/main.ts\nconst x = 1;\n```";
    expect(
      extractContentFromCodeBlock(content, "nonexistent.ts"),
    ).toBeUndefined();
  });

  it("should extract content when the path has directory structure", () => {
    const content =
      "```js src/components/Button.jsx\nconst Button = () => <button>Click me</button>;\n```";
    expect(
      extractContentFromCodeBlock(content, "src/components/Button.jsx"),
    ).toBe("const Button = () => <button>Click me</button>;");
  });

  it("should match exact paths only", () => {
    const content =
      "```typescript src/utils.ts\nconst util = {};\n```\n" +
      "```typescript src/utils/index.ts\nconst index = {};\n```";

    expect(extractContentFromCodeBlock(content, "src/utils.ts")).toBe(
      "const util = {};",
    );
    expect(extractContentFromCodeBlock(content, "src/utils/index.ts")).toBe(
      "const index = {};",
    );
  });
});
