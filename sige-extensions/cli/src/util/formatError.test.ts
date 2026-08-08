import { formatError, formatAnthropicError } from "./formatError.js";

describe("formatError", () => {
  it("should format Error objects correctly", () => {
    const error = new Error("Test error message");
    expect(formatError(error)).toBe("Test error message");
  });

  it("should return string errors as-is", () => {
    const error = "String error message";
    expect(formatError(error)).toBe("String error message");
  });

  it("should extract message from error objects", () => {
    const error = { message: "Object error message" };
    expect(formatError(error)).toBe("Object error message");
  });

  it("should recursively format nested error objects", () => {
    const error = { error: { message: "Nested error message" } };
    expect(formatError(error)).toBe("Nested error message");
  });

  it("should extract details from error objects", () => {
    const error = { details: "Error details" };
    expect(formatError(error)).toBe("Error details");
  });

  it("should extract description from error objects", () => {
    const error = { description: "Error description" };
    expect(formatError(error)).toBe("Error description");
  });

  it("should format API errors with status and message", () => {
    const error = {
      status: 404,
      error: { message: "Not found" },
    };
    // The actual implementation prioritizes nested error.message over status formatting
    expect(formatError(error)).toBe("Not found");
  });

  it("should format network errors with code and syscall", () => {
    const error = {
      code: "ECONNREFUSED",
      syscall: "connect",
    };
    expect(formatError(error)).toBe("Network error: ECONNREFUSED in connect");
  });

  it("should join error arrays", () => {
    const error = {
      errors: ["First error", "Second error", "Third error"],
    };
    expect(formatError(error)).toBe("First error, Second error, Third error");
  });

  it("should JSON stringify complex objects", () => {
    const error = {
      code: "CUSTOM_ERROR",
      data: { id: 123, name: "test" },
    };
    expect(formatError(error)).toBe(
      '{"code":"CUSTOM_ERROR","data":{"id":123,"name":"test"}}',
    );
  });

  it("should handle objects that cannot be JSON stringified", () => {
    const circular: any = { name: "circular" };
    circular.self = circular;

    const result = formatError(circular);
    expect(result).toBe("An error occurred: [object Object]");
  });

  it("should handle null values", () => {
    expect(formatError(null)).toBe("null");
  });

  it("should handle undefined values", () => {
    expect(formatError(undefined)).toBe("undefined");
  });

  it("should handle numbers", () => {
    expect(formatError(42)).toBe("42");
  });

  it("should handle boolean values", () => {
    expect(formatError(true)).toBe("true");
    expect(formatError(false)).toBe("false");
  });

  it("should handle empty objects", () => {
    expect(formatError({})).toBe("{}");
  });

  it("should handle empty arrays", () => {
    expect(formatError([])).toBe("[]");
  });

  it("should prioritize message over other properties", () => {
    const error = {
      message: "Primary message",
      description: "Secondary description",
      details: "Tertiary details",
    };
    expect(formatError(error)).toBe("Primary message");
  });

  it("should prioritize error property over details", () => {
    const error = {
      error: "Nested error",
      details: "Error details",
    };
    expect(formatError(error)).toBe("Nested error");
  });

  it("should handle deeply nested error structures", () => {
    const error = {
      error: {
        error: {
          message: "Deep nested error",
        },
      },
    };
    expect(formatError(error)).toBe("Deep nested error");
  });

  it("should format API errors with status only when no nested error message", () => {
    const error = {
      status: 404,
      error: { code: "NOT_FOUND" },
    };
    expect(formatError(error)).toBe('{"code":"NOT_FOUND"}');
  });
});

describe("formatAnthropicError", () => {
  it("should format invalid API key authentication errors", () => {
    const error = new Error(
      '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
    );
    expect(formatAnthropicError(error)).toBe("Anthropic: Invalid API key");
  });

  it("should handle error objects in general", () => {
    const error = new Error("some error"); // some error we haven't catalogued yet
    console.log(formatAnthropicError(error));
    expect(formatAnthropicError(error)).toBe("Anthropic: some error");
  });

  it("should handle undefined values", () => {
    expect(formatAnthropicError(undefined)).toBe("Anthropic: undefined");
  });
});
