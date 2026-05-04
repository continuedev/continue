import { describe, expect, it, vi } from "vitest";

import { safeParseArgs } from "./parseArgs.js";

describe("safeParseArgs", () => {
  it("should parse valid JSON string", () => {
    const result = safeParseArgs('{"key": "value"}');

    expect(result).toEqual({ key: "value" });
  });

  it("should parse JSON with multiple keys", () => {
    const result = safeParseArgs(
      '{"name": "test", "count": 42, "active": true}',
    );

    expect(result).toEqual({ name: "test", count: 42, active: true });
  });

  it("should parse nested JSON objects", () => {
    const result = safeParseArgs('{"outer": {"inner": "value"}}');

    expect(result).toEqual({ outer: { inner: "value" } });
  });

  it("should parse JSON arrays", () => {
    const result = safeParseArgs('{"items": [1, 2, 3]}');

    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it("should return empty object for undefined input", () => {
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

  it("should return empty object for invalid JSON", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = safeParseArgs("not valid json");

    expect(result).toEqual({});
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should return empty object for malformed JSON", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = safeParseArgs('{"key": }');

    expect(result).toEqual({});
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should include errorId in error message when provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    safeParseArgs("invalid", "test-call-id");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Call: test-call-id"),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });

  it("should include args in error message when errorId is provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    safeParseArgs("broken json", "call-123");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Args:broken json"),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });

  it("should not include identifier in error message when errorId is not provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    safeParseArgs("invalid");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.not.stringContaining("Call:"),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });

  it("should parse JSON with special characters in strings", () => {
    const result = safeParseArgs('{"message": "Hello\\nWorld"}');

    expect(result).toEqual({ message: "Hello\nWorld" });
  });

  it("should parse JSON with unicode characters", () => {
    const result = safeParseArgs('{"emoji": "\\u2764"}');

    expect(result).toEqual({ emoji: "\u2764" });
  });

  it("should parse JSON with null values", () => {
    const result = safeParseArgs('{"value": null}');

    expect(result).toEqual({ value: null });
  });

  it("should handle JSON with numeric keys", () => {
    const result = safeParseArgs('{"123": "numeric key"}');

    expect(result).toEqual({ "123": "numeric key" });
  });
});
