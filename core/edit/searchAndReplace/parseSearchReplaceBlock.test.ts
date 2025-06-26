import { parseSearchReplaceBlock } from "./parseSearchReplaceBlock";
describe("parseSearchReplaceBlock", () => {
  describe("Complete blocks", () => {
    it("should parse a complete basic search/replace block", () => {
      const content = `------- SEARCH
reset() {
this.result = 0;
return this;
}
=======
// Resets the calculator result to 0 and returns the instance for method chaining
reset() {
this.result = 0;
return this;
}
+++++++ REPLACE`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(true);
      expect(result.searchContent).toBe(`reset() {
this.result = 0;
return this;
}`);
      expect(result.replaceContent)
        .toBe(`// Resets the calculator result to 0 and returns the instance for method chaining
reset() {
this.result = 0;
return this;
}`);
      expect(result.error).toBeUndefined();
    });

    it("should handle different marker lengths", () => {
      const content = `------- SEARCH
old content
=========
new content
+++++++++++ REPLACE`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(true);
      expect(result.searchContent).toBe("old content");
      expect(result.replaceContent).toBe("new content");
    });

    it("should handle empty search content", () => {
      const content = `------- SEARCH
=======
new content
+++++++ REPLACE`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(true);
      expect(result.searchContent).toBe("");
      expect(result.replaceContent).toBe("new content");
    });

    it("should handle empty replace content", () => {
      const content = `------- SEARCH
old content
=======
+++++++ REPLACE`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(true);
      expect(result.searchContent).toBe("old content");
      expect(result.replaceContent).toBe("");
    });
  });

  describe("Incomplete blocks", () => {
    it("should handle incomplete search block", () => {
      const content = `------- SEARCH
some content`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(false);
      expect(result.searchContent).toBe("some content");
      expect(result.replaceContent).toBe("");
      expect(result.error).toBeUndefined();
    });

    it("should handle incomplete replace block", () => {
      const content = `------- SEARCH
old content
=======
new content`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(false);
      expect(result.searchContent).toBe("old content");
      expect(result.replaceContent).toBe("new content");
      expect(result.error).toBeUndefined();
    });
  });

  describe("Error cases", () => {
    it("should error on search end without start", () => {
      const content = `=======
some content
+++++++ REPLACE`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(false);
      expect(result.error).toBe(
        "Found search block end marker without matching start marker",
      );
    });

    it("should error on replace end without replace start", () => {
      const content = `+++++++ REPLACE`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(false);
      expect(result.error).toBe(
        "Found replace block end marker without matching replace start marker",
      );
    });
  });

  describe("Regex pattern validation", () => {
    it("should match various search start patterns", () => {
      const patterns = ["--- SEARCH", "------- SEARCH", "------------- SEARCH"];

      patterns.forEach((pattern) => {
        const content = `${pattern}
content
=======
replacement
+++++++ REPLACE`;
        const result = parseSearchReplaceBlock(content);
        expect(result.isComplete).toBe(true);
      });
    });

    it("should match various search end patterns", () => {
      const patterns = ["===", "=======", "=============="];

      patterns.forEach((pattern) => {
        const content = `------- SEARCH
content
${pattern}
replacement
+++++++ REPLACE`;

        const result = parseSearchReplaceBlock(content);
        expect(result.isComplete).toBe(true);
      });
    });

    it("should match various replace end patterns", () => {
      const patterns = [
        "+++ REPLACE",
        "+++++++ REPLACE",
        "+++++++++++ REPLACE",
      ];

      patterns.forEach((pattern) => {
        const content = `------- SEARCH
content
=======
replacement
${pattern}`;

        const result = parseSearchReplaceBlock(content);
        expect(result.isComplete).toBe(true);
      });
    });

    it("should not match invalid patterns", () => {
      const invalidPatterns = [
        "-- SEARCH", // Too few dashes
        "SEARCH", // No markers
        "== SEARCH", // Wrong markers
        "=== REPLACE", // Wrong end marker
        "++++ SEARCH", // Wrong markers for search
      ];

      invalidPatterns.forEach((pattern) => {
        const content = `${pattern}
content`;

        const result = parseSearchReplaceBlock(content);
        expect(result.isComplete).toBe(false);
        expect(result.searchContent).toBe(""); // Should not enter search mode
      });
    });
  });
});
