import { describe, expect, it } from "vitest";
import { ToolCallDelta } from "..";
import {
  getBooleanArg,
  getNumberArg,
  getOptionalStringArg,
  getStringArg,
  safeParseToolCallArgs,
} from "./parseArgs";

describe("safeParseToolCallArgs", () => {
  it("should parse valid JSON arguments", () => {
    const toolCall: ToolCallDelta = {
      id: "1",
      function: {
        name: "testFunction",
        arguments: '{"name": "test", "value": 123}',
      },
    };

    const result = safeParseToolCallArgs(toolCall);
    expect(result).toEqual({ name: "test", value: 123 });
  });

  it("should parse valid JSON arguments with whitespace", () => {
    const toolCall: ToolCallDelta = {
      id: "1",
      function: {
        name: "testFunction",
        arguments: '  {"name": "test", "value": 123}  ',
      },
    };

    const result = safeParseToolCallArgs(toolCall);
    expect(result).toEqual({ name: "test", value: 123 });
  });

  it("should return empty object for invalid JSON", () => {
    const toolCall: ToolCallDelta = {
      id: "1",
      function: {
        name: "testFunction",
        arguments: '{"name": "test", value: 123', // Invalid JSON
      },
    };

    const result = safeParseToolCallArgs(toolCall);
    expect(result).toEqual({});
  });

  it("should return empty object when arguments is empty", () => {
    const toolCall: ToolCallDelta = {
      id: "1",
      function: {
        name: "testFunction",
        arguments: "",
      },
    };

    const result = safeParseToolCallArgs(toolCall);
    expect(result).toEqual({});
  });

  it("should return empty object when arguments is null or undefined", () => {
    const toolCall1: ToolCallDelta = {
      id: "1",
      function: {
        name: "testFunction",
        arguments: null as any,
      },
    };

    const toolCall2: ToolCallDelta = {
      id: "1",
      function: {
        name: "testFunction",
        arguments: undefined,
      },
    };

    expect(safeParseToolCallArgs(toolCall1)).toEqual({});
    expect(safeParseToolCallArgs(toolCall2)).toEqual({});
  });

  it("should handle case when function is undefined", () => {
    const toolCall: ToolCallDelta = {
      id: "1",
      function: undefined,
    };

    const result = safeParseToolCallArgs(toolCall);
    expect(result).toEqual({});
  });
});

describe("getStringArg", () => {
  it("should return string argument when valid", () => {
    const args = { name: "test" };
    const result = getStringArg(args, "name");
    expect(result).toBe("test");
  });

  it("should throw error when argument is missing", () => {
    const args = { otherArg: "test" };
    expect(() => getStringArg(args, "name")).toThrowError(
      "`name` argument is required and must not be empty or whitespace-only. (type string)",
    );
  });

  it("should throw error when argument is not a string", () => {
    const args = { name: 123 };
    expect(() => getStringArg(args, "name")).toThrowError(
      "`name` argument is required and must not be empty or whitespace-only. (type string)",
    );
  });

  it("should throw error when argument is empty and empty not allowed", () => {
    const args = { name: "" };
    expect(() => getStringArg(args, "name")).toThrowError(
      "Argument name must not be empty or whitespace-only",
    );

    const argsWithSpace = { name: "   " };
    expect(() => getStringArg(argsWithSpace, "name")).toThrowError(
      "Argument name must not be empty or whitespace-only",
    );
  });

  it("should accept empty string when allowEmpty is true", () => {
    const args = { name: "" };
    const result = getStringArg(args, "name", true);
    expect(result).toBe("");

    const argsWithSpace = { name: "   " };
    const resultWithSpace = getStringArg(argsWithSpace, "name", true);
    expect(resultWithSpace).toBe("   ");
  });

  it("should handle null or undefined args", () => {
    expect(() => getStringArg(null, "name")).toThrowError(
      "`name` argument is required and must not be empty or whitespace-only. (type string)",
    );
    expect(() => getStringArg(undefined, "name")).toThrowError(
      "`name` argument is required and must not be empty or whitespace-only. (type string)",
    );
  });

  it("should convert parsed JSON object to string for contents parameter", () => {
    // This simulates the case where JSON.parse() has converted a JSON string into an object
    const args = { contents: { key: "value", number: 123 } };
    const result = getStringArg(args, "contents");
    expect(result).toBe('{"key":"value","number":123}');
  });

  it("should convert nested JSON object to string for contents parameter", () => {
    const args = {
      contents: {
        user: {
          name: "John",
          details: {
            age: 30,
            preferences: ["coding", "reading"],
          },
        },
      },
    };
    const result = getStringArg(args, "contents");
    const expected =
      '{"user":{"name":"John","details":{"age":30,"preferences":["coding","reading"]}}}';
    expect(result).toBe(expected);
  });

  it("should convert JSON array to string for contents parameter", () => {
    const args = { contents: ["item1", "item2", { key: "value" }] };
    const result = getStringArg(args, "contents");
    expect(result).toBe('["item1","item2",{"key":"value"}]');
  });

  it("should handle contents parameter that is already a string", () => {
    const args = { contents: "already a string" };
    const result = getStringArg(args, "contents");
    expect(result).toBe("already a string");
  });

  it("should handle contents parameter that is null", () => {
    const args = { contents: null };
    expect(() => getStringArg(args, "contents")).toThrowError(
      "`contents` argument is required and must not be empty or whitespace-only. (type string)",
    );
  });
});

describe("getOptionalStringArg", () => {
  it("should return undefined when argument is not provided", () => {
    const args = { otherArg: "test" };
    const result = getOptionalStringArg(args, "name");
    expect(result).toBeUndefined();
  });

  it("should return string argument when valid", () => {
    const args = { name: "test" };
    const result = getOptionalStringArg(args, "name");
    expect(result).toBe("test");
  });

  it("should throw error when argument is not a string", () => {
    const args = { name: 123 };
    expect(() => getOptionalStringArg(args, "name")).toThrowError(
      "`name` argument is required and must not be empty or whitespace-only. (type string)",
    );
  });

  it("should throw error when argument is empty and empty not allowed", () => {
    const args = { name: "" };
    expect(() => getOptionalStringArg(args, "name")).toThrowError(
      "Argument name must not be empty or whitespace-only",
    );
  });

  it("should accept empty string when allowEmpty is true", () => {
    const args = { name: "" };
    const result = getOptionalStringArg(args, "name", true);
    expect(result).toBe("");
  });

  it("should handle null or undefined args", () => {
    expect(getOptionalStringArg(null, "name")).toBeUndefined();
    expect(getOptionalStringArg(undefined, "name")).toBeUndefined();
  });
});

describe("getBooleanArg", () => {
  it("should return boolean argument when valid", () => {
    const argsTrue = { flag: true };
    const argsFalse = { flag: false };

    expect(getBooleanArg(argsTrue, "flag")).toBe(true);
    expect(getBooleanArg(argsFalse, "flag")).toBe(false);
  });

  it("should return undefined when argument is not provided and not required", () => {
    const args = { otherArg: true };
    const result = getBooleanArg(args, "flag");
    expect(result).toBeUndefined();
  });

  it("should throw error when argument is not provided and required", () => {
    const args = { otherArg: true };
    expect(() => getBooleanArg(args, "flag", true)).toThrowError(
      "Argument `flag` is required (type boolean)",
    );
  });

  it('should handle string "true" and "false" values', () => {
    const argsStringTrue = { flag: "true" };
    const argsStringFalse = { flag: "false" };
    const argsStringTrueUppercase = { flag: "TRUE" };
    const argsStringFalseUppercase = { flag: "FALSE" };

    expect(getBooleanArg(argsStringTrue, "flag")).toBe(true);
    expect(getBooleanArg(argsStringFalse, "flag")).toBe(false);
    expect(getBooleanArg(argsStringTrueUppercase, "flag")).toBe(true);
    expect(getBooleanArg(argsStringFalseUppercase, "flag")).toBe(false);
  });

  it("should throw error when argument is not a boolean or valid boolean string", () => {
    const argsNumber = { flag: 1 };
    const argsInvalidString = { flag: "yes" };
    const argsObject = { flag: {} };

    expect(() => getBooleanArg(argsNumber, "flag")).toThrowError(
      "Argument `flag` must be a boolean true or false",
    );
    expect(() => getBooleanArg(argsInvalidString, "flag")).toThrowError(
      "Argument `flag` must be a boolean true or false",
    );
    expect(() => getBooleanArg(argsObject, "flag")).toThrowError(
      "Argument `flag` must be a boolean true or false",
    );
  });

  it("should handle null or undefined args", () => {
    expect(getBooleanArg(null, "flag")).toBeUndefined();
    expect(getBooleanArg(undefined, "flag")).toBeUndefined();

    expect(() => getBooleanArg(null, "flag", true)).toThrowError(
      "Argument `flag` is required (type boolean)",
    );
    expect(() => getBooleanArg(undefined, "flag", true)).toThrowError(
      "Argument `flag` is required (type boolean)",
    );
  });
});

describe("getNumberArg", () => {
  it("should return number argument when valid", () => {
    const args = { count: 42 };
    const result = getNumberArg(args, "count");
    expect(result).toBe(42);
  });

  it("should parse string numbers", () => {
    const args = { count: "42" };
    const result = getNumberArg(args, "count");
    expect(result).toBe(42);
  });

  it("should floor decimal numbers", () => {
    const args = { count: 42.7 };
    const result = getNumberArg(args, "count");
    expect(result).toBe(42);
  });

  it("should parse and floor string decimal numbers", () => {
    const args = { count: "42.7" };
    const result = getNumberArg(args, "count");
    expect(result).toBe(42);
  });

  it("should throw error when argument is missing", () => {
    const args = { otherArg: 42 };
    expect(() => getNumberArg(args, "count")).toThrowError(
      "Argument `count` is required (type number)",
    );
  });

  it("should throw error when argument is not a number", () => {
    const argsString = { count: "not-a-number" };
    const argsBoolean = { count: true };
    const argsObject = { count: {} };

    expect(() => getNumberArg(argsString, "count")).toThrowError(
      "Argument `count` must be a valid number",
    );
    expect(() => getNumberArg(argsBoolean, "count")).toThrowError(
      "Argument `count` must be a valid number",
    );
    expect(() => getNumberArg(argsObject, "count")).toThrowError(
      "Argument `count` must be a valid number",
    );
  });

  it("should throw error when argument is NaN", () => {
    const args = { count: NaN };
    expect(() => getNumberArg(args, "count")).toThrowError(
      "Argument `count` must be a valid number",
    );
  });

  it("should handle negative numbers", () => {
    const args = { count: -5 };
    const result = getNumberArg(args, "count");
    expect(result).toBe(-5);
  });

  it("should handle negative string numbers", () => {
    const args = { count: "-10" };
    const result = getNumberArg(args, "count");
    expect(result).toBe(-10);
  });

  it("should handle zero", () => {
    const args = { count: 0 };
    const result = getNumberArg(args, "count");
    expect(result).toBe(0);
  });

  it("should handle null or undefined args", () => {
    expect(() => getNumberArg(null, "count")).toThrowError(
      "Argument `count` is required (type number)",
    );
    expect(() => getNumberArg(undefined, "count")).toThrowError(
      "Argument `count` is required (type number)",
    );
  });
});
