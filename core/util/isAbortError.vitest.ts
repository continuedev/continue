import { describe, expect, it } from "vitest";
import { isAbortError } from "./isAbortError";

describe("isAbortError", () => {
  it('should return true for "cancel" string', () => {
    expect(isAbortError("cancel")).toBe(true);
  });

  it("should return true for DOMException with AbortError name", () => {
    if (typeof DOMException !== "undefined") {
      const error = new DOMException("Operation aborted", "AbortError");
      expect(isAbortError(error)).toBe(true);
    } else {
      // Skip in environments without DOMException
      expect(true).toBe(true);
    }
  });

  it("should return true for Error with AbortError name", () => {
    const error = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(isAbortError(error)).toBe(true);
  });

  it("should return true for Error with name containing AbortError (middle match)", () => {
    const error = Object.assign(new Error("aborted"), {
      name: "NetworkAbortError",
    });
    expect(isAbortError(error)).toBe(true);
  });

  it("should return true for Error with name starting with AbortError", () => {
    const error = Object.assign(new Error("aborted"), {
      name: "AbortErrorSomething",
    });
    expect(isAbortError(error)).toBe(true);
  });

  it("should return true for Error with ABORT_ERR code", () => {
    const error = Object.assign(new Error("aborted"), { code: "ABORT_ERR" });
    expect(isAbortError(error)).toBe(true);
  });

  it("should return true for plain object with AbortError name", () => {
    const error = { name: "AbortError" };
    expect(isAbortError(error)).toBe(true);
  });

  it("should return true for plain object with name containing AbortError (middle match)", () => {
    const error = { name: "NetworkAbortError" };
    expect(isAbortError(error)).toBe(true);
  });

  it("should return true for plain object with name starting with AbortError", () => {
    const error = { name: "AbortErrorNetwork" };
    expect(isAbortError(error)).toBe(true);
  });

  it("should return false for regular Error", () => {
    const error = new Error("network error");
    expect(isAbortError(error)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isAbortError(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isAbortError(undefined)).toBe(false);
  });

  it("should return false for number", () => {
    expect(isAbortError(42)).toBe(false);
  });

  it("should return false for plain object without name", () => {
    expect(isAbortError({ message: "error" })).toBe(false);
  });
});
