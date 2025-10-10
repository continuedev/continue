import { describe, expect, it } from "vitest";
import { EditOperation } from "../../tools/definitions/multiEdit";
import { ContinueErrorReason } from "../../util/errors";
import { validateMultiEdit } from "./multiEditValidation";
import { executeMultiFindAndReplace } from "./performReplace";

describe("multiEdit shared validation", () => {
  describe("validateMultiEdit", () => {
    it("should throw error if edits is not an array", () => {
      expect(() => validateMultiEdit({ edits: "not an array" })).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.MultiEditEditsArrayRequired,
        }),
      );
    });

    it("should throw error if edits is missing", () => {
      expect(() => validateMultiEdit({})).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.MultiEditEditsArrayRequired,
        }),
      );
    });

    it("should throw error if edits array is empty", () => {
      expect(() => validateMultiEdit({ edits: [] })).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.MultiEditEditsArrayEmpty,
        }),
      );
    });

    it("should return valid edits", () => {
      const edits: EditOperation[] = [
        { old_string: "hello", new_string: "world" },
      ];
      const result = validateMultiEdit({ edits });
      expect(result.edits).toEqual(edits);
    });
  });

  describe("validateMultiEdit - individual edit validation", () => {
    it("should throw error if edit has missing old_string", () => {
      const args = {
        edits: [
          {
            old_string: undefined as any,
            new_string: "Hi there",
          },
        ],
      };

      expect(() => validateMultiEdit(args)).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingOldString,
        }),
      );
    });

    it("should throw error if edit has missing new_string", () => {
      const args = {
        edits: [
          {
            old_string: "Hello world",
            new_string: undefined as any,
          },
        ],
      };

      expect(() => validateMultiEdit(args)).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingNewString,
        }),
      );
    });

    it("should throw error if old_string and new_string are the same", () => {
      const args = {
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hello world",
          },
        ],
      };

      expect(() => validateMultiEdit(args)).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });

    it("should throw error if non-first edit has empty old_string", () => {
      const args = {
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
          {
            old_string: "",
            new_string: "Invalid insertion",
          },
        ],
      };

      expect(() => validateMultiEdit(args)).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceNonFirstEmptyOldString,
        }),
      );
    });

    it("should allow first edit to have empty old_string", () => {
      const args = {
        edits: [
          {
            old_string: "",
            new_string: "New content",
          },
        ],
      };

      expect(() => validateMultiEdit(args)).not.toThrow();
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

      // Empty old_string matches at position 0 (beginning of file)
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

      expect(() =>
        executeMultiFindAndReplace(originalContent, edits),
      ).toThrowError(
        expect.objectContaining({
          // Now caught by edit chain validation
          reason: ContinueErrorReason.FindAndReplaceEditChainInvalid,
          message: expect.stringContaining("not found in original file"),
        }),
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

      expect(() =>
        executeMultiFindAndReplace(originalContent, edits),
      ).toThrowError(
        expect.objectContaining({
          // Now caught by edit chain validation
          reason: ContinueErrorReason.FindAndReplaceEditChainInvalid,
          message: expect.stringContaining("appears 2 times"),
        }),
      );
    });

    it("should throw if string not found in edit sequence", () => {
      const content = "Hello world";
      const edits = [
        { old_string: "Hello", new_string: "Hi" },
        { old_string: "not found", new_string: "test" },
      ];

      expect(() => executeMultiFindAndReplace(content, edits)).toThrowError(
        expect.objectContaining({
          // Now caught by edit chain validation
          reason: ContinueErrorReason.FindAndReplaceEditChainInvalid,
          message: expect.stringContaining("not found in original file"),
        }),
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

  describe("executeMultiFindAndReplace - sequential edit validation (Issue #4)", () => {
    it("should detect when edit N+1 targets string modified by edit N", () => {
      const fileContent = "data = get_data()\nprocess(data)\nreturn data";
      const edits = [
        { old_string: "data", new_string: "user_data", replace_all: true },
        {
          old_string: "process(data)",
          new_string: "process_user_data(user_data)",
        },
      ];

      // Edit 1 changes all "data" to "user_data"
      // Edit 2 tries to find "process(data)" but it's now "process(user_data)"
      expect(() => executeMultiFindAndReplace(fileContent, edits)).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceEditChainInvalid,
          message: expect.stringContaining(
            'Edit 1 will fail: string "process(data)" not found after applying previous edits',
          ),
        }),
      );
    });

    it("should detect when edit invalidates subsequent edits", () => {
      const fileContent =
        "def calculate_tax():\n    rate = 0.1\n    return rate";
      const edits = [
        { old_string: "rate = 0.1", new_string: "tax_rate = 0.15" },
        { old_string: "return rate", new_string: "return tax_rate" },
      ];

      // Edit 1 changes "rate" to "tax_rate"
      // Edit 2 tries to find "return rate" but it still exists (different line)
      // This should succeed
      const result = executeMultiFindAndReplace(fileContent, edits);
      expect(result).toBe(
        "def calculate_tax():\n    tax_rate = 0.15\n    return tax_rate",
      );
    });

    it("should provide helpful error message for sequential edit conflicts", () => {
      const fileContent = "value = 10\nresult = value * 2";
      const edits = [
        { old_string: "value", new_string: "number", replace_all: true },
        { old_string: "value * 2", new_string: "number * 2" },
      ];

      expect(() => executeMultiFindAndReplace(fileContent, edits)).toThrowError(
        expect.objectContaining({
          message: expect.stringMatching(
            /Edit 1 will fail.*not found after applying previous edits.*Consider reordering edits/,
          ),
        }),
      );
    });

    it("should allow valid sequential edits", () => {
      const fileContent = "def func1():\n    pass\ndef func2():\n    pass";
      const edits = [
        {
          old_string: "def func1():\n    pass",
          new_string: "def func1():\n    return 1",
        },
        {
          old_string: "def func2():\n    pass",
          new_string: "def func2():\n    return 2",
        },
      ];

      // These edits don't interfere with each other
      const result = executeMultiFindAndReplace(fileContent, edits);
      expect(result).toBe(
        "def func1():\n    return 1\ndef func2():\n    return 2",
      );
    });

    it("should validate all edits before applying any (all-or-nothing)", () => {
      const fileContent = "a = 1\nb = 2\nc = 3";
      const edits = [
        { old_string: "a = 1", new_string: "x = 1" }, // This will succeed
        { old_string: "invalid_string", new_string: "something" }, // This will fail
      ];

      // The function should throw before modifying the file
      expect(() => executeMultiFindAndReplace(fileContent, edits)).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceEditChainInvalid,
        }),
      );

      // If we could check, the original content should be unchanged
      // (though the function throws, so we can't verify this directly)
    });
  });
});
