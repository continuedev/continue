import { describe, expect, it } from "vitest";
import { isAbortError } from "./isAbortError";

describe("isAbortError", () => {
  // -- Positive cases --

  it('returns true for "cancel" string', () => {
    expect(isAbortError("cancel")).toBe(true);
  });

  it("returns true for Error with name AbortError", () => {
    const error = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(isAbortError(error)).toBe(true);
  });

  it("returns true for Error with ABORT_ERR code", () => {
    const error = Object.assign(new Error("aborted"), { code: "ABORT_ERR" });
    expect(isAbortError(error)).toBe(true);
  });

  it("returns true for Error with both AbortError name and ABORT_ERR code", () => {
    const error = Object.assign(new Error("aborted"), {
      name: "AbortError",
      code: "ABORT_ERR",
    });
    expect(isAbortError(error)).toBe(true);
  });

  it("returns true for custom Error subclass with AbortError name", () => {
    class CustomAbortError extends Error {
      constructor() {
        super("aborted");
        this.name = "AbortError";
      }
    }
    expect(isAbortError(new CustomAbortError())).toBe(true);
  });

  const hasDOMException = typeof DOMException !== "undefined";

  it.skipIf(!hasDOMException)(
    "returns true for DOMException with AbortError name",
    () => {
      const error = new DOMException("Operation aborted", "AbortError");
      expect(isAbortError(error)).toBe(true);
    },
  );

  it("returns true for plain object with name AbortError", () => {
    expect(isAbortError({ name: "AbortError" })).toBe(true);
  });

  it("returns true for frozen object with name AbortError", () => {
    expect(isAbortError(Object.freeze({ name: "AbortError" }))).toBe(true);
  });

  // -- Negative cases: exact match, not substring --

  it("returns false for Error with name containing AbortError as substring", () => {
    const error = Object.assign(new Error("x"), { name: "NetworkAbortError" });
    expect(isAbortError(error)).toBe(false);
  });

  it("returns false for Error with partial name Abort", () => {
    const error = Object.assign(new Error("x"), { name: "Abort" });
    expect(isAbortError(error)).toBe(false);
  });

  it("returns false for plain object with AbortError substring in name", () => {
    expect(isAbortError({ name: "AbortErrorWrapper" })).toBe(false);
  });

  // -- Negative cases: cancel is case-sensitive --

  it('returns false for "Cancel" (capital C)', () => {
    expect(isAbortError("Cancel")).toBe(false);
  });

  it('returns false for "CANCEL" (all caps)', () => {
    expect(isAbortError("CANCEL")).toBe(false);
  });

  // -- Negative cases: plain object edge cases --

  it("returns false for plain object with ABORT_ERR code but no AbortError name", () => {
    // code check only applies to instanceof Error, not plain objects
    expect(isAbortError({ code: "ABORT_ERR" })).toBe(false);
  });

  it("returns false for plain object with numeric name", () => {
    expect(isAbortError({ name: 123 })).toBe(false);
  });

  it("returns false for plain object with null name", () => {
    expect(isAbortError({ name: null })).toBe(false);
  });

  it.skipIf(!hasDOMException)(
    "returns false for DOMException with non-AbortError name",
    () => {
      const error = new DOMException("fail", "NetworkError");
      expect(isAbortError(error)).toBe(false);
    },
  );

  // -- Negative cases: primitives and nullish --

  it("returns false for null", () => {
    expect(isAbortError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAbortError(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAbortError("")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isAbortError(42)).toBe(false);
  });

  it("returns false for boolean", () => {
    expect(isAbortError(false)).toBe(false);
    expect(isAbortError(true)).toBe(false);
  });

  // -- Negative cases: regular errors --

  it("returns false for regular Error", () => {
    expect(isAbortError(new Error("network error"))).toBe(false);
  });

  it("returns false for TypeError", () => {
    expect(isAbortError(new TypeError("bad type"))).toBe(false);
  });

  it("returns false for plain object without name", () => {
    expect(isAbortError({ message: "error" })).toBe(false);
  });
});
