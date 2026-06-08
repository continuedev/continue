import { processRule as processPromptOrRule } from "./hubLoader.js";

describe("processPromptOrRule (rule processing)", () => {
  describe("direct content", () => {
    it("should treat simple strings as direct content", async () => {
      const directContent = "This is direct rule content";
      const result = await processPromptOrRule(directContent);
      expect(result).toBe(directContent);
    });

    it("should treat hub-slug-like strings as direct content (hub loading removed)", async () => {
      // Hub loading has been removed, so "owner/package" is treated as direct content
      const result = await processPromptOrRule("continuedev/sentry-nextjs");
      expect(result).toBe("continuedev/sentry-nextjs");
    });

    it("should treat multiline strings as direct content", async () => {
      const multiline = "# Rule\n\nThis is a multiline rule.";
      const result = await processPromptOrRule(multiline);
      expect(result).toBe(multiline);
    });
  });

  describe("file paths", () => {
    it("should throw for non-existent file paths starting with ./", async () => {
      await expect(processPromptOrRule("./owner/package")).rejects.toThrow(
        'Failed to read rule file "./owner/package": Rule file not found',
      );
    });

    it("should throw for non-existent file paths starting with /", async () => {
      await expect(processPromptOrRule("/nonexistent/rule.md")).rejects.toThrow(
        'Failed to read rule file "/nonexistent/rule.md"',
      );
    });
  });
});
