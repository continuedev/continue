import { describe, expect, it } from "vitest";
import { Position } from "../..";
import {
  MERCURY_CODE_TO_EDIT_CLOSE,
  MERCURY_CODE_TO_EDIT_OPEN,
  MERCURY_CURSOR,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_CLOSE,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_OPEN,
} from "../constants";
import {
  currentFileContentBlock,
  editHistoryBlock,
  recentlyViewedCodeSnippetsBlock,
} from "./mercuryCoderNextEdit";

describe("mercuryCoderNextEdit", () => {
  describe("recentlyViewedCodeSnippetsBlock", () => {
    it("should format a list of code snippets correctly", () => {
      const snippets = [
        { filepath: "/path/to/file1.ts", content: "const a = 1;" },
        {
          filepath: "/path/to/file2.ts",
          content: "function test() { return true; }",
        },
      ];

      const result = recentlyViewedCodeSnippetsBlock(snippets);

      const expected =
        `${MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_OPEN}\n` +
        "code_snippet_file_path: /path/to/file1.ts\n" +
        "const a = 1;\n" +
        `${MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_CLOSE}\n` +
        `${MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_OPEN}\n` +
        "code_snippet_file_path: /path/to/file2.ts\n" +
        "function test() { return true; }\n" +
        MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_CLOSE;

      expect(result).toBe(expected);
    });

    it("should handle empty snippets array", () => {
      const result = recentlyViewedCodeSnippetsBlock([]);
      expect(result).toBe("");
    });
  });

  describe("currentFileContentBlock", () => {
    it("should correctly format current file content with editable region and cursor", () => {
      const fileContent = "line 1\nline 2\nline 3\nline 4\nline 5";
      const editableRegionStartLine = 1;
      const editableRegionEndLine = 3;
      const cursorPosition: Position = { line: 2, character: 3 };

      const result = currentFileContentBlock(
        fileContent,
        editableRegionStartLine,
        editableRegionEndLine,
        cursorPosition,
      );

      const expected =
        "line 1\n" +
        MERCURY_CODE_TO_EDIT_OPEN +
        "\n" +
        "line 2\n" +
        "lin" +
        MERCURY_CURSOR +
        "e 3\n" +
        "line 4\n" +
        MERCURY_CODE_TO_EDIT_CLOSE +
        "\n" +
        "line 5";

      expect(result).toBe(expected);
    });

    it("should handle cursor at the beginning of a line", () => {
      const fileContent = "line 1\nline 2\nline 3";
      const editableRegionStartLine = 0;
      const editableRegionEndLine = 2;
      const cursorPosition: Position = { line: 1, character: 0 };

      const result = currentFileContentBlock(
        fileContent,
        editableRegionStartLine,
        editableRegionEndLine,
        cursorPosition,
      );

      expect(result).toContain(MERCURY_CODE_TO_EDIT_OPEN);
      expect(result).toContain(MERCURY_CURSOR + "line 2");
      expect(result).toContain(MERCURY_CODE_TO_EDIT_CLOSE);
    });

    it("should handle cursor at the end of a line", () => {
      const fileContent = "line 1\nline 2\nline 3";
      const editableRegionStartLine = 0;
      const editableRegionEndLine = 2;
      const cursorPosition: Position = { line: 1, character: 6 };

      const result = currentFileContentBlock(
        fileContent,
        editableRegionStartLine,
        editableRegionEndLine,
        cursorPosition,
      );

      expect(result).toContain("line 2" + MERCURY_CURSOR);
    });
  });

  describe("editHistoryBlock", () => {
    it("should return the edit diff history unchanged", () => {
      const diffHistory =
        "diff --git a/file.ts b/file.ts\n==============================\n@@ -1,3 +1,4 @@";
      const result = editHistoryBlock([diffHistory]);
      expect(result).toBe("@@ -1,3 +1,4 @@");
    });

    it("should handle empty diff history", () => {
      const result = editHistoryBlock([]);
      expect(result).toBe("");
    });
  });
});
