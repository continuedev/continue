import { extractPathsFromCodeBlocks } from "./extractPathsFromCodeBlocks";

describe("extractPathsFromCodeBlocks", () => {
  it("should extract paths from code blocks with language and filepath", () => {
    const content = "```typescript src/main.ts\nconst x = 1;\n```";
    expect(extractPathsFromCodeBlocks(content)).toEqual(["src/main.ts"]);
  });

  it("should extract paths from code blocks with filepath only (no language)", () => {
    const content = "```test.js\nclass Calculator { }\n```";
    expect(extractPathsFromCodeBlocks(content)).toEqual(["test.js"]);
  });

  it("should extract paths from code blocks with line ranges", () => {
    const content = "```js test.js (19-25)\nfunction test() {}\n```";
    expect(extractPathsFromCodeBlocks(content)).toEqual(["test.js"]);
  });

  it("should handle multiple code blocks with different formats", () => {
    const content =
      "```typescript src/main.ts\nconst x = 1;\n```\n" +
      "```test.js\nclass Calculator { }\n```\n" +
      "```js utils.js (19-25)\nfunction test() {}\n```";
    const result = extractPathsFromCodeBlocks(content);
    expect(result).toContain("src/main.ts");
    expect(result).toContain("test.js");
    expect(result).toContain("utils.js");
    expect(result.length).toBe(3);
  });

  it("should not extract paths from code blocks without file paths", () => {
    const content = "```typescript\nconst x = 1;\n```";
    expect(extractPathsFromCodeBlocks(content)).toEqual([]);
  });
});
