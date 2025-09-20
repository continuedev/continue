import { describe, expect, it } from "vitest";
import { ContinueErrorReason } from "../../util/errors";
import { trimEmptyLines, validateSingleEdit } from "./findAndReplaceUtils";

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
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingOldString,
        }),
      );
    });

    it("should throw error when old_string is undefined", () => {
      expect(() => {
        validateSingleEdit(undefined as any, "new");
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingOldString,
        }),
      );
    });

    it("should throw error when new_string is undefined", () => {
      expect(() => {
        validateSingleEdit("old", undefined as any);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingNewString,
        }),
      );
    });

    it("should throw error when old_string and new_string are identical", () => {
      expect(() => {
        validateSingleEdit("same", "same");
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });

    it("should throw error when both are empty strings", () => {
      expect(() => {
        validateSingleEdit("", "");
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });
  });

  describe("error messages with context", () => {
    it("should include edit number in error messages when index provided", () => {
      expect(() => {
        validateSingleEdit(null as any, "new", 2);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingOldString,
        }),
      );
    });

    it("should include edit number for new_string errors", () => {
      expect(() => {
        validateSingleEdit("old", undefined as any, 0);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingNewString,
        }),
      );
    });

    it("should include edit number for identical strings error", () => {
      expect(() => {
        validateSingleEdit("same", "same", 4);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });

    it("should not include context when index not provided", () => {
      expect(() => {
        validateSingleEdit("same", "same");
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
