import { describe, test, expect } from "vitest";

/**
 * Tests for the content accumulation logic used in streamChat.ts.
 *
 * The core change in streamChat.ts adds an `accumulatedCompletion` variable
 * that tracks partial output from streaming chunks. This logic must handle
 * both string content and MessagePart[] content correctly.
 *
 * These are unit tests for the extraction/accumulation behavior.
 * Integration tests for the full llmStreamChat flow are covered by
 * existing e2e tests.
 */
describe("streamChat content accumulation logic", () => {
  // Mirror the extraction logic from streamChat.ts lines 140-147
  function extractContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part: any) => (part.type === "text" ? part.text : ""))
        .join("");
    }
    return "";
  }

  test("should extract string content from chunks", () => {
    expect(extractContent("Hello world")).toBe("Hello world");
  });

  test("should extract text from MessagePart[] content", () => {
    const parts = [
      { type: "text", text: "Part 1 " },
      { type: "text", text: "Part 2" },
    ];
    expect(extractContent(parts)).toBe("Part 1 Part 2");
  });

  test("should skip non-text MessageParts (e.g. imageUrl)", () => {
    const parts = [
      { type: "text", text: "Hello " },
      { type: "imageUrl", imageUrl: { url: "http://example.com/img.png" } },
      { type: "text", text: "world" },
    ];
    expect(extractContent(parts)).toBe("Hello world");
  });

  test("should return empty string for undefined/null content", () => {
    expect(extractContent(undefined)).toBe("");
    expect(extractContent(null)).toBe("");
  });

  test("should accumulate content across multiple streaming chunks", () => {
    const chunks = [
      { content: "Hello " },
      { content: "world" },
      { content: "!" },
    ];
    let accumulated = "";
    for (const chunk of chunks) {
      accumulated += extractContent(chunk.content);
    }
    expect(accumulated).toBe("Hello world!");
  });

  test("should accumulate mixed string and MessagePart[] chunks", () => {
    const chunks = [
      { content: "Start " },
      {
        content: [
          { type: "text", text: "middle " },
          { type: "text", text: "part" },
        ],
      },
      { content: " end" },
    ];
    let accumulated = "";
    for (const chunk of chunks) {
      accumulated += extractContent(chunk.content);
    }
    expect(accumulated).toBe("Start middle part end");
  });

  test("should handle empty chunks without error", () => {
    const chunks = [
      { content: "Hello" },
      { content: "" },
      { content: " world" },
    ];
    let accumulated = "";
    for (const chunk of chunks) {
      accumulated += extractContent(chunk.content);
    }
    expect(accumulated).toBe("Hello world");
  });
});
