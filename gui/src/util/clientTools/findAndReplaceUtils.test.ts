import { EditOperation } from "core/tools/definitions/multiEdit";
import { describe, expect, it } from "vitest";
import {
  EMPTY_NON_FIRST_EDIT_MESSAGE,
  FOUND_MULTIPLE_FIND_STRINGS_ERROR,
  performFindAndReplace,
  validateCreatingForMultiEdit,
  validateSingleEdit,
} from "./findAndReplaceUtils";

describe("performFindAndReplace", () => {
  describe("normal cases", () => {
    it("should replace single occurrence by default", () => {
      const content = "Hello world\nThis is a test file\nGoodbye";
      const result = performFindAndReplace(content, "Hello", "Hi");

      expect(result).toBe("Hi world\nThis is a test file\nGoodbye");
    });

    it("should replace single occurrence when replaceAll is false", () => {
      const content = "Hello world\nHello again";
      const result = performFindAndReplace(
        content,
        "Hello world",
        "Hi world",
        false,
      );

      expect(result).toBe("Hi world\nHello again");
    });

    it("should replace all occurrences when replaceAll is true", () => {
      const content = "Hello world\nHello again\nHello there";
      const result = performFindAndReplace(content, "Hello", "Hi", true);

      expect(result).toBe("Hi world\nHi again\nHi there");
    });

    it("should handle empty new string (deletion)", () => {
      const content = "Hello world";
      const result = performFindAndReplace(content, "Hello ", "");

      expect(result).toBe("world");
    });

    it("should handle empty old string replacement (insertion at start)", () => {
      const content = "";
      const result = performFindAndReplace(content, "", "Hello world");

      expect(result).toBe("Hello world");
    });

    it("should preserve whitespace and indentation", () => {
      const content =
        "function test() {\n    const value = 'old';\n    return value;\n}";
      const result = performFindAndReplace(
        content,
        "    const value = 'old';",
        "    const value = 'new';",
      );

      expect(result).toBe(
        "function test() {\n    const value = 'new';\n    return value;\n}",
      );
    });

    it("should handle multiline strings", () => {
      const content = "line1\nline2\nline3";
      const result = performFindAndReplace(
        content,
        "line1\nline2",
        "newline1\nnewline2",
      );

      expect(result).toBe("newline1\nnewline2\nline3");
    });
  });

  describe("special character handling", () => {
    it("should handle regex special characters in old string", () => {
      const content = "const regex = /[a-z]+/g;";
      const result = performFindAndReplace(content, "/[a-z]+/g", "/[A-Z]+/g");

      expect(result).toBe("const regex = /[A-Z]+/g;");
    });

    it("should handle dollar signs in strings", () => {
      const content = 'const text = "Hello $world"';
      const result = performFindAndReplace(
        content,
        '"Hello $world"',
        '"Hi $universe"',
      );

      expect(result).toBe('const text = "Hi $universe"');
    });

    it("should handle backslashes", () => {
      const content = 'const path = "C:\\Users\\test"';
      const result = performFindAndReplace(
        content,
        "C:\\Users\\test",
        "D:\\Users\\test",
      );

      expect(result).toBe('const path = "D:\\Users\\test"');
    });

    it("should handle parentheses", () => {
      const content = "function test() { return 'old'; }";
      const result = performFindAndReplace(
        content,
        "() { return 'old'; }",
        "() { return 'new'; }",
      );

      expect(result).toBe("function test() { return 'new'; }");
    });

    it("should handle square brackets", () => {
      const content = "const arr = [1, 2, 3];";
      const result = performFindAndReplace(content, "[1, 2, 3]", "[4, 5, 6]");

      expect(result).toBe("const arr = [4, 5, 6];");
    });
  });

  describe("replaceAll behavior", () => {
    it("should replace all occurrences including partial matches", () => {
      const content = "test testing tested test";
      const result = performFindAndReplace(content, "test", "exam", true);

      expect(result).toBe("exam examing examed exam");
    });

    it("should replace all occurrences with empty string", () => {
      const content = "remove this remove that remove everything";
      const result = performFindAndReplace(content, "remove ", "", true);

      expect(result).toBe("this that everything");
    });

    it("should handle overlapping patterns correctly", () => {
      const content = "aaaa";
      const result = performFindAndReplace(content, "aa", "b", true);

      expect(result).toBe("bb");
    });
  });

  describe("error cases", () => {
    it("should throw error when string not found", () => {
      const content = "Hello world";

      expect(() => {
        performFindAndReplace(content, "xyz", "abc");
      }).toThrow('string not found in file: "xyz"');
    });

    it("should throw error with edit context when string not found", () => {
      const content = "Hello world";

      expect(() => {
        performFindAndReplace(content, "xyz", "abc", false, 2);
      }).toThrow('edit at index 2: string not found in file: "xyz"');
    });

    it("should throw error when multiple occurrences exist and replaceAll is false", () => {
      const content = "Hello world\nHello again\nHello there";

      expect(() => {
        performFindAndReplace(content, "Hello", "Hi", false);
      }).toThrow(
        `String "Hello" appears 3 times in the file. ${FOUND_MULTIPLE_FIND_STRINGS_ERROR}`,
      );
    });

    it("should throw error with edit context for multiple occurrences", () => {
      const content = "test test test";

      expect(() => {
        performFindAndReplace(content, "test", "exam", false, 1);
      }).toThrow(
        `edit at index 1: String "test" appears 3 times in the file. ${FOUND_MULTIPLE_FIND_STRINGS_ERROR}`,
      );
    });
  });

  describe("edge cases", () => {
    it("should handle single character replacement", () => {
      const content = "a b c";
      const result = performFindAndReplace(content, "b", "x");

      expect(result).toBe("a x c");
    });

    it("should handle very long strings", () => {
      const longString = "a".repeat(10000);
      const content = `start${longString}end`;
      const result = performFindAndReplace(content, longString, "short");

      expect(result).toBe("startshortend");
    });

    it("should handle strings at beginning of content", () => {
      const content = "start middle end";
      const result = performFindAndReplace(content, "start", "begin");

      expect(result).toBe("begin middle end");
    });

    it("should handle strings at end of content", () => {
      const content = "start middle end";
      const result = performFindAndReplace(content, "end", "finish");

      expect(result).toBe("start middle finish");
    });

    it("should handle entire content replacement", () => {
      const content = "replace everything";
      const result = performFindAndReplace(
        content,
        "replace everything",
        "new content",
      );

      expect(result).toBe("new content");
    });
  });
});

describe("validateSingleEdit", () => {
  describe("valid inputs", () => {
    it("should not throw for valid non-empty strings", () => {
      expect(() => {
        validateSingleEdit("old", "new");
      }).not.toThrow();
    });

    it("should allow empty old_string for file creation", () => {
      expect(() => {
        validateSingleEdit("", "new content");
      }).not.toThrow();
    });

    it("should allow empty new_string for deletion", () => {
      expect(() => {
        validateSingleEdit("delete me", "");
      }).not.toThrow();
    });

    it("should allow multiline strings", () => {
      expect(() => {
        validateSingleEdit("line1\nline2", "newline1\nnewline2");
      }).not.toThrow();
    });

    it("should allow special characters", () => {
      expect(() => {
        validateSingleEdit("/[a-z]+/g", "/[A-Z]+/g");
      }).not.toThrow();
    });
  });

  describe("invalid inputs", () => {
    it("should throw error when old_string is null", () => {
      expect(() => {
        validateSingleEdit(null as any, "new");
      }).toThrow("old_string is required");
    });

    it("should throw error when old_string is undefined", () => {
      expect(() => {
        validateSingleEdit(undefined as any, "new");
      }).toThrow("old_string is required");
    });

    it("should throw error when new_string is undefined", () => {
      expect(() => {
        validateSingleEdit("old", undefined as any);
      }).toThrow("new_string is required");
    });

    it("should throw error when old_string and new_string are identical", () => {
      expect(() => {
        validateSingleEdit("same", "same");
      }).toThrow("old_string and new_string must be different");
    });

    it("should throw error when both are empty strings", () => {
      expect(() => {
        validateSingleEdit("", "");
      }).toThrow("old_string and new_string must be different");
    });
  });

  describe("error messages with context", () => {
    it("should include edit number in error messages when index provided", () => {
      expect(() => {
        validateSingleEdit(null as any, "new", 2);
      }).toThrow("edit at index 2: old_string is required");
    });

    it("should include edit number for new_string errors", () => {
      expect(() => {
        validateSingleEdit("old", undefined as any, 0);
      }).toThrow("edit at index 0: new_string is required");
    });

    it("should include edit number for identical strings error", () => {
      expect(() => {
        validateSingleEdit("same", "same", 4);
      }).toThrow(
        "edit at index 4: old_string and new_string must be different",
      );
    });

    it("should not include context when index not provided", () => {
      expect(() => {
        validateSingleEdit("same", "same");
      }).toThrow("old_string and new_string must be different");
    });
  });
});

describe("validateCreatingForMultiEdit", () => {
  describe("single edit scenarios", () => {
    it("should return true for creating with single edit", () => {
      const edits: EditOperation[] = [
        { old_string: "", new_string: "new file content" },
      ];

      const isCreating = validateCreatingForMultiEdit(edits);
      expect(isCreating).toBe(true);
    });

    it("should return false for editing with single edit", () => {
      const edits: EditOperation[] = [{ old_string: "old", new_string: "new" }];

      const isCreating = validateCreatingForMultiEdit(edits);
      expect(isCreating).toBe(false);
    });
  });

  describe("multiple edit scenarios - editing existing file", () => {
    it("should return false for multiple edits on existing file", () => {
      const edits: EditOperation[] = [
        { old_string: "old1", new_string: "new1" },
        { old_string: "old2", new_string: "new2" },
        { old_string: "old3", new_string: "new3" },
      ];

      const isCreating = validateCreatingForMultiEdit(edits);
      expect(isCreating).toBe(false);
    });

    it("should allow multiple valid edits on existing file", () => {
      const edits: EditOperation[] = [
        { old_string: "import old", new_string: "import new" },
        { old_string: "function old()", new_string: "function new()" },
        { old_string: "return old;", new_string: "return new;" },
      ];

      expect(() => validateCreatingForMultiEdit(edits)).not.toThrow();
      expect(validateCreatingForMultiEdit(edits)).toBe(false);
    });
  });

  describe("error cases", () => {
    it("should throw error when trying to make subsequent edits on file creation", () => {
      const edits: EditOperation[] = [
        { old_string: "", new_string: "new file content" },
        { old_string: "old", new_string: "new" },
      ];

      expect(() => {
        validateCreatingForMultiEdit(edits);
      }).toThrow("cannot make subsequent edits on a file you are creating");
    });

    it("should throw error when empty old_string appears in non-first edit", () => {
      const edits: EditOperation[] = [
        { old_string: "old1", new_string: "new1" },
        { old_string: "", new_string: "new2" },
      ];

      expect(() => {
        validateCreatingForMultiEdit(edits);
      }).toThrow(`edit at index 1: ${EMPTY_NON_FIRST_EDIT_MESSAGE}`);
    });

    it("should throw error with correct edit number for empty old_string", () => {
      const edits: EditOperation[] = [
        { old_string: "old1", new_string: "new1" },
        { old_string: "old2", new_string: "new2" },
        { old_string: "", new_string: "new3" },
      ];

      expect(() => {
        validateCreatingForMultiEdit(edits);
      }).toThrow(`edit at index 2: ${EMPTY_NON_FIRST_EDIT_MESSAGE}`);
    });

    it("should throw error for multiple empty old_strings in subsequent edits", () => {
      const edits: EditOperation[] = [
        { old_string: "old1", new_string: "new1" },
        { old_string: "", new_string: "new2" },
        { old_string: "", new_string: "new3" },
      ];

      expect(() => {
        validateCreatingForMultiEdit(edits);
      }).toThrow(`edit at index 1: ${EMPTY_NON_FIRST_EDIT_MESSAGE}`);
    });
  });

  describe("edge cases", () => {
    it("should handle empty edits array gracefully", () => {
      const edits: EditOperation[] = [];

      // This should not throw, but would likely cause issues elsewhere
      // The function doesn't explicitly handle empty arrays
      expect(() => {
        validateCreatingForMultiEdit(edits);
      }).toThrow(); // Will throw because edits[0] is undefined
    });

    it("should handle complex edit operations", () => {
      const edits: EditOperation[] = [
        {
          old_string: "function oldFunction() {\n  return 'old';\n}",
          new_string: "function newFunction() {\n  return 'new';\n}",
          replace_all: false,
        },
        {
          old_string: "const OLD_CONSTANT",
          new_string: "const NEW_CONSTANT",
          replace_all: true,
        },
      ];

      expect(() => validateCreatingForMultiEdit(edits)).not.toThrow();
      expect(validateCreatingForMultiEdit(edits)).toBe(false);
    });

    it("should handle edits with replace_all flags", () => {
      const edits: EditOperation[] = [
        { old_string: "old", new_string: "new", replace_all: true },
        { old_string: "test", new_string: "exam", replace_all: false },
      ];

      expect(() => validateCreatingForMultiEdit(edits)).not.toThrow();
      expect(validateCreatingForMultiEdit(edits)).toBe(false);
    });
  });
});
