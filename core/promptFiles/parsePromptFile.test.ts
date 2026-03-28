import { parsePromptFile } from "./parsePromptFile";

describe("parsePromptFile", () => {
  const path = "prompts/test.prompt";

  it("should parse frontmatter with LF line endings", () => {
    const content = "name: greet\ndescription: Say hello\n---\nHello {{ name }}";
    const result = parsePromptFile(path, content);
    expect(result.name).toBe("greet");
    expect(result.description).toBe("Say hello");
    expect(result.prompt).toBe("Hello {{ name }}");
    expect(result.systemMessage).toBeUndefined();
  });

  it("should parse frontmatter with CRLF line endings", () => {
    const content =
      "name: greet\r\ndescription: Say hello\r\n---\r\nHello {{ name }}";
    const result = parsePromptFile(path, content);
    expect(result.name).toBe("greet");
    expect(result.description).toBe("Say hello");
    expect(result.prompt).toBe("Hello {{ name }}");
  });

  it("should handle mixed line endings", () => {
    const content =
      "name: mixed\r\ndescription: Mixed endings\n---\r\nSome prompt text";
    const result = parsePromptFile(path, content);
    expect(result.name).toBe("mixed");
    expect(result.description).toBe("Mixed endings");
    expect(result.prompt).toBe("Some prompt text");
  });

  it("should fall back to filename when no frontmatter", () => {
    const content = "Just a prompt with no frontmatter";
    const result = parsePromptFile(path, content);
    expect(result.name).toBe("test");
    expect(result.description).toBe("test");
    expect(result.prompt).toBe("Just a prompt with no frontmatter");
  });

  it("should parse <system> tag with CRLF", () => {
    const content =
      "name: sys\r\ndescription: With system\r\n---\r\n<system>\r\nYou are helpful.\r\n</system>\r\nUser prompt here";
    const result = parsePromptFile(path, content);
    expect(result.name).toBe("sys");
    expect(result.systemMessage).toBe("You are helpful.");
    expect(result.prompt).toBe("User prompt here");
  });

  it("should default version to 2", () => {
    const content = "name: ver\n---\nHello";
    const result = parsePromptFile(path, content);
    expect(result.version).toBe(2);
  });

  it("should respect version in frontmatter", () => {
    const content = "name: ver\nversion: 1\n---\nHello";
    const result = parsePromptFile(path, content);
    expect(result.version).toBe(1);
  });
});
