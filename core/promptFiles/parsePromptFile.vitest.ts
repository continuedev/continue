import { describe, expect, it } from "vitest";
import { parsePromptFile } from "./parsePromptFile";

describe("parsePromptFile", () => {
  const path = "test.prompt";

  it("should parse LF content correctly", () => {
    const content = "name: test\ndescription: a test\n---\nHello world";
    const result = parsePromptFile(path, content);
    expect(result.name).toBe("test");
    expect(result.description).toBe("a test");
    expect(result.prompt).toBe("Hello world");
  });

  it("should parse CRLF content correctly", () => {
    const content = "name: test\r\ndescription: a test\r\n---\r\nHello world";
    const result = parsePromptFile(path, content);
    expect(result.name).toBe("test");
    expect(result.description).toBe("a test");
    expect(result.prompt).toBe("Hello world");
  });

  it("should handle no frontmatter", () => {
    const content = "Just a prompt";
    const result = parsePromptFile(path, content);
    expect(result.prompt).toBe("Just a prompt");
    expect(result.name).toBe("test");
  });

  it("should parse system tag with CRLF", () => {
    const content =
      "name: test\r\n---\r\n<system>You are helpful</system>\r\nHello";
    const result = parsePromptFile(path, content);
    expect(result.systemMessage).toBe("You are helpful");
    expect(result.prompt).toBe("Hello");
  });
});
