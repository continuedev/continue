import { describe, expect, it } from "vitest";
import { ContinueError, ContinueErrorReason, getRootCause } from "./errors";

describe("getRootCause", () => {
  it("should return the same error when there is no cause", () => {
    const error = new Error("Test error");
    expect(getRootCause(error)).toBe(error);
  });

  it("should return the root cause when there is a single level of cause", () => {
    const rootCause = new Error("Root cause");
    const error = new Error("Test error", { cause: rootCause });
    expect(getRootCause(error)).toBe(rootCause);
  });

  it("should recursively traverse multiple levels of causes", () => {
    const rootCause = new Error("Root cause");
    const middleCause = new Error("Middle cause", { cause: rootCause });
    const error = new Error("Test error", { cause: middleCause });
    expect(getRootCause(error)).toBe(rootCause);
  });

  it("should handle deeply nested causes", () => {
    const rootCause = new Error("Root cause");
    let current = rootCause;
    for (let i = 0; i < 10; i++) {
      current = new Error(`Level ${i}`, { cause: current });
    }
    expect(getRootCause(current)).toBe(rootCause);
  });

  it("should handle non-Error objects with cause property", () => {
    const rootCause = { message: "Root object" };
    const error = { message: "Test object", cause: rootCause };
    expect(getRootCause(error)).toBe(rootCause);
  });

  it("should return the input when cause is undefined", () => {
    const error = { message: "Test", cause: undefined };
    expect(getRootCause(error)).toBe(error);
  });

  it("should return the input when cause is null", () => {
    const error = { message: "Test", cause: null };
    expect(getRootCause(error)).toBe(error);
  });

  it("should handle string primitive values", () => {
    // String primitives have properties that can be accessed
    expect(getRootCause("string error")).toBe("string error");
  });

  it("should handle number primitive values", () => {
    // Number primitives have properties that can be accessed
    expect(getRootCause(42)).toBe(42);
  });

  it("should handle objects without cause property", () => {
    const obj = { name: "test" };
    expect(getRootCause(obj)).toBe(obj);
  });
});

describe("ContinueError", () => {
  it("should create an error with reason and message", () => {
    const error = new ContinueError(
      ContinueErrorReason.FileNotFound,
      "File not found: test.txt",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ContinueError);
    expect(error.reason).toBe(ContinueErrorReason.FileNotFound);
    expect(error.message).toBe("File not found: test.txt");
    expect(error.name).toBe("ContinueError");
  });

  it("should create an error with reason and no message", () => {
    const error = new ContinueError(ContinueErrorReason.Unknown);

    expect(error.reason).toBe(ContinueErrorReason.Unknown);
    expect(error.message).toBe("");
    expect(error.name).toBe("ContinueError");
  });

  it("should work with all ContinueErrorReason values", () => {
    const reasons = Object.values(ContinueErrorReason);

    reasons.forEach((reason) => {
      const error = new ContinueError(reason, `Test: ${reason}`);
      expect(error.reason).toBe(reason);
      expect(error.message).toBe(`Test: ${reason}`);
    });
  });

  it("should be throwable and catchable", () => {
    expect(() => {
      throw new ContinueError(
        ContinueErrorReason.FileTooLarge,
        "File exceeds limit",
      );
    }).toThrow(ContinueError);

    try {
      throw new ContinueError(
        ContinueErrorReason.FileTooLarge,
        "File exceeds limit",
      );
    } catch (e) {
      expect(e).toBeInstanceOf(ContinueError);
      if (e instanceof ContinueError) {
        expect(e.reason).toBe(ContinueErrorReason.FileTooLarge);
      }
    }
  });

  it("should maintain proper prototype chain", () => {
    const error = new ContinueError(ContinueErrorReason.Unknown, "Test");

    expect(error instanceof Error).toBe(true);
    expect(error instanceof ContinueError).toBe(true);
    expect(Object.getPrototypeOf(error)).toBe(ContinueError.prototype);
  });

  it("should have a stack trace", () => {
    const error = new ContinueError(ContinueErrorReason.Unknown, "Test");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ContinueError");
  });
});

describe("ContinueErrorReason enum", () => {
  it("should have unique values for all keys", () => {
    const values = Object.values(ContinueErrorReason);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it("should contain expected Find and Replace errors", () => {
    expect(ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings).toBe(
      "find_and_replace_identical_old_and_new_strings",
    );
    expect(ContinueErrorReason.FindAndReplaceMissingOldString).toBe(
      "find_and_replace_missing_old_string",
    );
    expect(ContinueErrorReason.FindAndReplaceOldStringNotFound).toBe(
      "find_and_replace_old_string_not_found",
    );
  });

  it("should contain expected file-related errors", () => {
    expect(ContinueErrorReason.FileNotFound).toBe("file_not_found");
    expect(ContinueErrorReason.FileAlreadyExists).toBe("file_already_exists");
    expect(ContinueErrorReason.FileTooLarge).toBe("file_too_large");
    expect(ContinueErrorReason.DirectoryNotFound).toBe("directory_not_found");
  });

  it("should contain expected multi-edit errors", () => {
    expect(ContinueErrorReason.MultiEditEditsArrayRequired).toBe(
      "multi_edit_edits_array_required",
    );
    expect(ContinueErrorReason.MultiEditEditsArrayEmpty).toBe(
      "multi_edit_edits_array_empty",
    );
  });
});
