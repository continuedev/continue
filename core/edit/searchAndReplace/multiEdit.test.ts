import { describe, expect, it } from "vitest";
import { EditOperation } from "../../tools/definitions/multiEdit";
import { validateAllEdits, validateMultiEditArgs } from "./multiEditValidation";
import { executeMultiFindAndReplace } from "./performReplace";

describe("multiEdit shared validation", () => {
  describe("validateMultiEditArgs", () => {
    it("should throw error if edits is not an array", () => {
      expect(() => validateMultiEditArgs({ edits: "not an array" })).toThrow(
        "edits array is required",
      );
    });

    it("should throw error if edits is missing", () => {
      expect(() => validateMultiEditArgs({})).toThrow(
        "edits array is required",
      );
    });

    it("should throw error if edits array is empty", () => {
      expect(() => validateMultiEditArgs({ edits: [] })).toThrow(
        "edits array must contain at least one edit",
      );
    });

    it("should return valid edits", () => {
      const edits: EditOperation[] = [
        { old_string: "hello", new_string: "world" },
      ];
      const result = validateMultiEditArgs({ edits });
      expect(result.edits).toEqual(edits);
    });
  });

  describe("validateAllEdits", () => {
    it("should throw error if edit has missing old_string", () => {
      const edits = [
        {
          old_string: undefined as any,
          new_string: "Hi there",
        },
      ];

      expect(() => validateAllEdits(edits)).toThrow(
        "edit at index 0: old_string is required",
      );
    });

    it("should throw error if edit has missing new_string", () => {
      const edits = [
        {
          old_string: "Hello world",
          new_string: undefined as any,
        },
      ];

      expect(() => validateAllEdits(edits)).toThrow(
        "edit at index 0: new_string is required",
      );
    });

    it("should throw error if old_string and new_string are the same", () => {
      const edits = [
        {
          old_string: "Hello world",
          new_string: "Hello world",
        },
      ];

      expect(() => validateAllEdits(edits)).toThrow(
        "edit at index 0: old_string and new_string must be different",
      );
    });

    it("should throw error if non-first edit has empty old_string", () => {
      const edits = [
        {
          old_string: "Hello world",
          new_string: "Hi there",
        },
        {
          old_string: "",
          new_string: "Invalid insertion",
        },
      ];

      expect(() => validateAllEdits(edits)).toThrow(
        "Edit at index 1: old_string cannot be empty. Only the first edit can have an empty old_string for insertion at the beginning of the file.",
      );
    });

    it("should allow first edit to have empty old_string", () => {
      const edits = [
        {
          old_string: "",
          new_string: "New content",
        },
      ];

      expect(() => validateAllEdits(edits)).not.toThrow();
    });
  });

  describe("executeMultiFindAndReplace", () => {
    const originalContent = "Hello world\nThis is a test file\nGoodbye world";

    it("should handle single edit", () => {
      const edits = [
        {
          old_string: "Hello world",
          new_string: "Hi there",
        },
      ];

      const result = executeMultiFindAndReplace(originalContent, edits);
      expect(result).toBe("Hi there\nThis is a test file\nGoodbye world");
    });

    it("should handle multiple edits", () => {
      const edits = [
        {
          old_string: "Hello world",
          new_string: "Hi there",
        },
        {
          old_string: "Goodbye world",
          new_string: "See you later",
        },
      ];

      const result = executeMultiFindAndReplace(originalContent, edits);
      expect(result).toBe("Hi there\nThis is a test file\nSee you later");
    });

    it("should handle replace_all", () => {
      const edits = [
        {
          old_string: "world",
          new_string: "universe",
          replace_all: true,
        },
      ];

      const result = executeMultiFindAndReplace(originalContent, edits);
      expect(result).toBe(
        "Hello universe\nThis is a test file\nGoodbye universe",
      );
    });

    it("should handle empty old_string as insertion at beginning", () => {
      const edits = [
        {
          old_string: "",
          new_string: "New first line\n",
        },
      ];

      const result = executeMultiFindAndReplace(originalContent, edits);
      expect(result).toBe(
        "New first line\nHello world\nThis is a test file\nGoodbye world",
      );
    });

    it("should handle empty string in empty file", () => {
      const edits = [
        {
          old_string: "",
          new_string: "Content for empty file",
        },
      ];

      const result = executeMultiFindAndReplace("", edits);
      expect(result).toBe("Content for empty file");
    });

    it("should apply edits sequentially", () => {
      const edits = [
        {
          old_string: "Hello world",
          new_string: "Hi universe",
        },
        {
          old_string: "Hi universe",
          new_string: "Greetings cosmos",
        },
      ];

      const result = executeMultiFindAndReplace(originalContent, edits);
      expect(result).toBe(
        "Greetings cosmos\nThis is a test file\nGoodbye world",
      );
    });

    it("should throw error if old_string is not found", () => {
      const edits = [
        {
          old_string: "Not found",
          new_string: "Hi there",
        },
      ];

      expect(() => executeMultiFindAndReplace(originalContent, edits)).toThrow(
        'Edit at index 0: string not found in file: "Not found"',
      );
    });

    it("should throw error if old_string appears multiple times and replace_all is false", () => {
      const edits = [
        {
          old_string: "world",
          new_string: "universe",
          replace_all: false,
        },
      ];

      expect(() => executeMultiFindAndReplace(originalContent, edits)).toThrow(
        'Edit at index 0: String "world" appears 2 times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.',
      );
    });

    it("should throw if string not found in edit sequence", () => {
      const content = "Hello world";
      const edits = [
        { old_string: "Hello", new_string: "Hi" },
        { old_string: "not found", new_string: "test" },
      ];

      expect(() => executeMultiFindAndReplace(content, edits)).toThrow(
        'Edit at index 1: string not found in file: "not found"',
      );
    });

    it("should handle whitespace differences using findSearchMatch", () => {
      const content = "function test() {\n  return true;\n}";
      const edits = [
        {
          old_string: "function test(){return true;}",
          new_string: "function test() { return false; }",
        },
      ];

      const result = executeMultiFindAndReplace(content, edits);
      expect(result).toBe("function test() { return false; }");
    });

    it("should handle mixed replace_all settings", () => {
      const content = "x y x z x";
      const edits = [
        { old_string: "x", new_string: "a", replace_all: true },
        { old_string: "y", new_string: "b" },
      ];

      const result = executeMultiFindAndReplace(content, edits);
      expect(result).toBe("a b a z a");
    });
  });

  describe("preprocessing logic", () => {
    const originalContent = "Hello world\nThis is a test file\nGoodbye world";

    it("should handle single edit preprocessing", () => {
      const edits = [
        {
          old_string: "Hello world",
          new_string: "Hi there",
        },
      ];

      const newContent = executeMultiFindAndReplace(originalContent, edits);

      expect(newContent).toBe("Hi there\nThis is a test file\nGoodbye world");
    });

    it("should handle multiple edits preprocessing", () => {
      const edits = [
        {
          old_string: "Hello world",
          new_string: "Hi there",
        },
        {
          old_string: "Goodbye world",
          new_string: "See you later",
        },
      ];

      const newContent = executeMultiFindAndReplace(originalContent, edits);

      expect(newContent).toBe("Hi there\nThis is a test file\nSee you later");
    });

    it("should count edits correctly", () => {
      const edits = [
        { old_string: "Hello", new_string: "Hi" },
        { old_string: "world", new_string: "universe", replace_all: true },
      ];

      const newContent = executeMultiFindAndReplace(originalContent, edits);

      expect(newContent).toBe(
        "Hi universe\nThis is a test file\nGoodbye universe",
      );
      expect(edits.length).toBe(2);
    });
  });
});
