import { parsePromptFile } from "./parsePromptFile.js";

describe("parsePromptFile", () => {
  describe("LF baseline", () => {
    it("should parse content with LF separators and extract name and description from YAML", () => {
      const content = `name: test-prompt\ndescription: Test description\n---\nHello world`;
      const result = parsePromptFile("/path/to/test.prompt", content);
      expect(result.name).toBe("test-prompt");
      expect(result.description).toBe("Test description");
      expect(result.prompt).toBe("Hello world");
    });
  });

  describe("CRLF regression", () => {
    it("should parse content with CRLF endings and extract name from YAML (not filename)", () => {
      const content = `name: my-prompt\r\ndescription: My Description\r\n---\r\nPrompt body`;
      const result = parsePromptFile("/path/to/ignore.prompt", content);
      expect(result.name).toBe("my-prompt");
      expect(result.description).toBe("My Description");
      expect(result.prompt).toBe("Prompt body");
    });
  });

  describe("CRLF with system tag", () => {
    it("should extract systemMessage from content with CRLF and <system> tag", () => {
      const content = `name: system-test\r\n---\r\n<system>System message here</system>\r\nMain prompt body`;
      const result = parsePromptFile("/path/to/file.prompt", content);
      expect(result.name).toBe("system-test");
      expect(result.systemMessage).toBe("System message here");
      expect(result.prompt).toBe("Main prompt body");
    });
  });

  describe("No frontmatter fallback", () => {
    it("should fall back to path segment when no frontmatter is present", () => {
      const content = `Just some prompt content without any YAML`;
      const result = parsePromptFile("/path/to/myfile.prompt", content);
      expect(result.name).toBe("myfile");
      expect(result.prompt).toBe("Just some prompt content without any YAML");
    });
  });

  describe("Mixed line endings", () => {
    it("should normalize mixed line endings in body with CRLF frontmatter and LF body", () => {
      const content = `name: mixed-test\r\ndescription: Mixed test\r\n---\nBody with\nLF endings`;
      const result = parsePromptFile("/path/to/file.prompt", content);
      expect(result.name).toBe("mixed-test");
      expect(result.description).toBe("Mixed test");
      expect(result.prompt).toBe("Body with\nLF endings");
    });
  });

  describe("Default version", () => {
    it("should use version 2 when no version is specified in frontmatter", () => {
      const content = `name: no-version\r\n---\r\nPrompt`;
      const result = parsePromptFile("/path/to/file.prompt", content);
      expect(result.version).toBe(2);
    });
  });

  describe("Explicit version", () => {
    it("should use explicit version when specified in frontmatter", () => {
      const content = `name: with-version\r\nversion: 1\r\n---\r\nPrompt`;
      const result = parsePromptFile("/path/to/file.prompt", content);
      expect(result.version).toBe(1);
    });
  });
});
