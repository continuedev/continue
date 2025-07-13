import {
  parseAllSearchReplaceBlocks,
  parseSearchReplaceBlock,
} from "./parseSearchReplaceBlock";

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

    it("should handle empty replace content (deletion)", () => {
      const content = `------- SEARCH
old content to delete
=======
+++++++ REPLACE`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(true);
      expect(result.searchContent).toBe("old content to delete");
      expect(result.replaceContent).toBe("");
    });

    it("should handle both empty search and replace content", () => {
      const content = `------- SEARCH
=======
+++++++ REPLACE`;

      const result = parseSearchReplaceBlock(content);

      expect(result.isComplete).toBe(true);
      expect(result.searchContent).toBe("");
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

describe("parseAllSearchReplaceBlocks", () => {
  it("should parse multiple complete blocks", () => {
    const content = `------- SEARCH
old code 1
=======
new code 1
+++++++ REPLACE

------- SEARCH
old code 2
=======
new code 2
+++++++ REPLACE`;

    const blocks = parseAllSearchReplaceBlocks(content);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].searchContent).toBe("old code 1");
    expect(blocks[0].replaceContent).toBe("new code 1");
    expect(blocks[1].searchContent).toBe("old code 2");
    expect(blocks[1].replaceContent).toBe("new code 2");
  });

  it("should handle blocks with different content", () => {
    const content = `------- SEARCH
function old() {
  return 1;
}
=======
function new() {
  return 2;
}
+++++++ REPLACE

------- SEARCH
const x = 'old';
=======
const x = 'new';
+++++++ REPLACE`;

    const blocks = parseAllSearchReplaceBlocks(content);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].searchContent).toBe(`function old() {
  return 1;
}`);
    expect(blocks[0].replaceContent).toBe(`function new() {
  return 2;
}`);
    expect(blocks[1].searchContent).toBe(`const x = 'old';`);
    expect(blocks[1].replaceContent).toBe(`const x = 'new';`);
  });

  it("should handle deletion blocks (empty replace content)", () => {
    const content = `------- SEARCH
code to keep
=======
modified code
+++++++ REPLACE

------- SEARCH
code to delete
=======
+++++++ REPLACE`;

    const blocks = parseAllSearchReplaceBlocks(content);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].searchContent).toBe("code to keep");
    expect(blocks[0].replaceContent).toBe("modified code");
    expect(blocks[1].searchContent).toBe("code to delete");
    expect(blocks[1].replaceContent).toBe(""); // Deletion
  });

  it("should handle insertion blocks (empty search content)", () => {
    const content = `------- SEARCH
existing code
=======
modified existing code
+++++++ REPLACE

------- SEARCH
=======
new code to insert
+++++++ REPLACE`;

    const blocks = parseAllSearchReplaceBlocks(content);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].searchContent).toBe("existing code");
    expect(blocks[0].replaceContent).toBe("modified existing code");
    expect(blocks[1].searchContent).toBe(""); // Insertion
    expect(blocks[1].replaceContent).toBe("new code to insert");
  });

  it("should skip incomplete blocks", () => {
    const content = `------- SEARCH
incomplete block

------- SEARCH
complete block
=======
replacement
+++++++ REPLACE`;

    const blocks = parseAllSearchReplaceBlocks(content);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].searchContent).toBe("complete block");
    expect(blocks[0].replaceContent).toBe("replacement");
  });

  it("should handle single block", () => {
    const content = `------- SEARCH
single block
=======
replacement
+++++++ REPLACE`;

    const blocks = parseAllSearchReplaceBlocks(content);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].searchContent).toBe("single block");
    expect(blocks[0].replaceContent).toBe("replacement");
  });

  it("should return empty array when no complete blocks found", () => {
    const content = `------- SEARCH
incomplete
=======
missing replace marker`;

    const blocks = parseAllSearchReplaceBlocks(content);

    expect(blocks).toHaveLength(0);
  });

  it("should handle blocks with extra content between them", () => {
    const content = `Some other content here

------- SEARCH
block 1
=======
replacement 1
+++++++ REPLACE

More content in between

------- SEARCH
block 2
=======
replacement 2
+++++++ REPLACE

Trailing content`;

    const blocks = parseAllSearchReplaceBlocks(content);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].searchContent).toBe("block 1");
    expect(blocks[0].replaceContent).toBe("replacement 1");
    expect(blocks[1].searchContent).toBe("block 2");
    expect(blocks[1].replaceContent).toBe("replacement 2");
  });

  it("should throw error for malformed blocks", () => {
    const content = `------- SEARCH
content
+++++++ REPLACE`; // Missing =======

    expect(() => parseAllSearchReplaceBlocks(content)).toThrow(
      "Found replace block end marker without matching replace start marker",
    );
  });
});
