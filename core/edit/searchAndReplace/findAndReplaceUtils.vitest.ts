import { describe, expect, it } from "vitest";
import { ContinueErrorReason } from "../../util/errors";
import { trimEmptyLines, validateSingleEdit } from "./findAndReplaceUtils";

describe("validateSingleEdit", () => {
  describe("valid inputs", () => {
    it("should not throw for valid non-empty strings", () => {
      expect(() => {
        validateSingleEdit("old", "new", undefined);
      }).not.toThrow();
    });

    it("should allow empty old_string for file creation", () => {
      expect(() => {
        validateSingleEdit("", "new content", undefined);
      }).not.toThrow();
    });

    it("should allow empty new_string for deletion", () => {
      expect(() => {
        validateSingleEdit("delete me", "", undefined);
      }).not.toThrow();
    });

    it("should allow multiline strings", () => {
      expect(() => {
        validateSingleEdit("line1\nline2", "newline1\nnewline2", undefined);
      }).not.toThrow();
    });

    it("should allow special characters", () => {
      expect(() => {
        validateSingleEdit("/[a-z]+/g", "/[A-Z]+/g", undefined);
      }).not.toThrow();
    });

    it("should allow replaceAll as true", () => {
      expect(() => {
        validateSingleEdit("old", "new", true);
      }).not.toThrow();
    });

    it("should allow replaceAll as false", () => {
      expect(() => {
        validateSingleEdit("old", "new", false);
      }).not.toThrow();
    });

    it("should return validated values including replaceAll", () => {
      const result = validateSingleEdit("old", "new", true);
      expect(result).toEqual({
        oldString: "old",
        newString: "new",
        replaceAll: true,
      });
    });

    it("should return validated values with replaceAll undefined", () => {
      const result = validateSingleEdit("old", "new", undefined);
      expect(result).toEqual({
        oldString: "old",
        newString: "new",
        replaceAll: undefined,
      });
    });
  });

  describe("invalid inputs", () => {
    it("should throw error when old_string is null", () => {
      expect(() => {
        validateSingleEdit(null as any, "new", undefined);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingOldString,
        }),
      );
    });

    it("should throw error when old_string is undefined", () => {
      expect(() => {
        validateSingleEdit(undefined as any, "new", undefined);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingOldString,
        }),
      );
    });

    it("should throw error when new_string is undefined", () => {
      expect(() => {
        validateSingleEdit("old", undefined as any, undefined);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingNewString,
        }),
      );
    });

    it("should throw error when old_string and new_string are identical", () => {
      expect(() => {
        validateSingleEdit("same", "same", undefined);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });

    it("should throw error when both are empty strings", () => {
      expect(() => {
        validateSingleEdit("", "", undefined);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });

    it("should throw error when replaceAll is not a boolean", () => {
      expect(() => {
        validateSingleEdit("old", "new", "invalid" as any);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceInvalidReplaceAll,
        }),
      );
    });

    it("should throw error when replaceAll is null", () => {
      expect(() => {
        validateSingleEdit("old", "new", null as any);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceInvalidReplaceAll,
        }),
      );
    });

    it("should throw error when replaceAll is a number", () => {
      expect(() => {
        validateSingleEdit("old", "new", 1 as any);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceInvalidReplaceAll,
        }),
      );
    });
  });

  describe("error messages with context", () => {
    it("should include edit number in error messages when index provided", () => {
      expect(() => {
        validateSingleEdit(null as any, "new", undefined, 2);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingOldString,
        }),
      );
    });

    it("should include edit number for new_string errors", () => {
      expect(() => {
        validateSingleEdit("old", undefined as any, undefined, 0);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingNewString,
        }),
      );
    });

    it("should include edit number for identical strings error", () => {
      expect(() => {
        validateSingleEdit("same", "same", undefined, 4);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });

    it("should include edit number for replaceAll validation error", () => {
      expect(() => {
        validateSingleEdit("old", "new", "invalid" as any, 3);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceInvalidReplaceAll,
        }),
      );
    });

    it("should not include context when index not provided", () => {
      expect(() => {
        validateSingleEdit("same", "same", undefined);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });
  });
});

describe("trimEmptyLines", () => {
  it("trims leading empty lines from start", () => {
    const input = ["", "", "a", "", "b"];
    const result = trimEmptyLines({ lines: input, fromEnd: false });
    expect(result).toEqual(["a", "", "b"]);
  });

  it("trims trailing empty lines from end", () => {
    const input = ["a", "", "b", "", ""];
    const result = trimEmptyLines({ lines: input, fromEnd: true });
    expect(result).toEqual(["a", "", "b"]);
  });

  it("returns empty array when all lines are empty", () => {
    const input = ["", "", ""];
    const result = trimEmptyLines({ lines: input, fromEnd: false });
    expect(result).toEqual([]);
  });
});
