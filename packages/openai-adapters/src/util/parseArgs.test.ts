import { describe, expect, it, vi } from "vitest";
import { safeParseArgs } from "./parseArgs.js";

describe("safeParseArgs", () => {
  it("should parse valid JSON string", () => {
    const result = safeParseArgs('{"key": "value", "number": 42}');

    expect(result).toEqual({ key: "value", number: 42 });
  });

  it("should return empty object for undefined args", () => {
    const result = safeParseArgs(undefined);

    expect(result).toEqual({});
  });

  it("should return empty object for empty string", () => {
    const result = safeParseArgs("");

    expect(result).toEqual({});
  });

  it("should return empty object for whitespace-only string", () => {
    const result = safeParseArgs("   ");

    expect(result).toEqual({});
  });

  it("should trim whitespace before parsing", () => {
    const result = safeParseArgs('  {"key": "value"}  ');

    expect(result).toEqual({ key: "value" });
  });

  it("should parse complex nested JSON", () => {
    const complexJson = JSON.stringify({
      user: {
        name: "John",
        settings: {
          theme: "dark",
          notifications: true,
        },
      },
      items: [1, 2, 3],
    });

    const result = safeParseArgs(complexJson);

    expect(result).toEqual({
      user: {
        name: "John",
        settings: {
          theme: "dark",
          notifications: true,
        },
      },
      items: [1, 2, 3],
    });
  });

  it("should return empty object and log error for invalid JSON", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = safeParseArgs("not valid json");

    expect(result).toEqual({});
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse tool call arguments"),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("should include errorId in error message when provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = safeParseArgs("invalid", "test-call-123");

    expect(result).toEqual({});
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Call: test-call-123"),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("should include args in error message when errorId is provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const invalidArgs = "{broken";
    safeParseArgs(invalidArgs, "my-error-id");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Args:${invalidArgs}`),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("should handle JSON with special characters", () => {
    const result = safeParseArgs('{"message": "Hello\\nWorld\\t!"}');

    expect(result).toEqual({ message: "Hello\nWorld\t!" });
  });

  it("should handle JSON arrays", () => {
    const result = safeParseArgs("[1, 2, 3]");

    expect(result).toEqual([1, 2, 3]);
  });
});
