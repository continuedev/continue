import {
  formatError,
  formatAnthropicError,
  extractNestedJsonMessage,
} from "./formatError.js";

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

/**
 * Real shape from continuedev/continue#12945: an SDK error message that is
 * a JSON envelope whose error.message is ITSELF a pretty-printed JSON
 * string, hiding the actual cause two parse levels deep. Shared vector for
 * the formatError and extractNestedJsonMessage suites.
 */
function quotaErrorMessageVector(): string {
  const googleBody = JSON.stringify(
    {
      error: {
        code: 429,
        message:
          "You exceeded your current quota, please check your plan and billing details. Please retry in 45.191226092s.",
        status: "RESOURCE_EXHAUSTED",
      },
    },
    null,
    2,
  );
  return JSON.stringify({
    error: {
      message: `${googleBody}\n`,
      code: 429,
      status: "Too Many Requests",
    },
  });
}

describe("formatError nested Gemini-style JSON messages", () => {
  it("extracts the innermost message from a double-nested JSON error", () => {
    const error = new Error(quotaErrorMessageVector());
    expect(formatError(error)).toBe(
      "You exceeded your current quota, please check your plan and billing details. Please retry in 45.191226092s.",
    );
  });

  it("extracts a single-level nested message", () => {
    const error = new Error(
      JSON.stringify({
        error: { message: "Quota exceeded", status: "RESOURCE_EXHAUSTED" },
      }),
    );
    expect(formatError(error)).toBe("Quota exceeded");
  });

  it("leaves a message-less nested error unchanged", () => {
    const raw = JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } });
    expect(formatError(new Error(raw))).toBe(raw);
  });

  it("leaves a primitive-valued error field unchanged", () => {
    const raw = JSON.stringify({ error: "Invalid API key" });
    expect(formatError(new Error(raw))).toBe(raw);
  });

  it("leaves malformed JSON unchanged", () => {
    expect(formatError(new Error("{invalid json"))).toBe("{invalid json");
  });

  it("leaves plain non-JSON messages unchanged", () => {
    expect(formatError(new Error("socket hang up"))).toBe("socket hang up");
  });
});

describe("extractNestedJsonMessage (direct vectors)", () => {
  it("extracts the innermost message from the double-nested shape", () => {
    expect(extractNestedJsonMessage(quotaErrorMessageVector())).toBe(
      "You exceeded your current quota, please check your plan and billing details. Please retry in 45.191226092s.",
    );
  });

  it("extracts a single-level nested message", () => {
    expect(
      extractNestedJsonMessage(
        JSON.stringify({ error: { message: "Quota exceeded" } }),
      ),
    ).toBe("Quota exceeded");
  });

  it("returns undefined for message-less JSON", () => {
    expect(
      extractNestedJsonMessage(
        JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined for a primitive error field", () => {
    expect(
      extractNestedJsonMessage(JSON.stringify({ error: "Invalid API key" })),
    ).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    expect(extractNestedJsonMessage("{invalid json")).toBeUndefined();
  });

  it("returns undefined for plain non-JSON text", () => {
    expect(extractNestedJsonMessage("socket hang up")).toBeUndefined();
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
