import { describe, expect, it } from "vitest";
import { ToolCallDelta } from "..";
import {
  coerceArgsToSchema,
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

describe("coerceArgsToSchema", () => {
  it("should stringify object values when schema expects string", () => {
    const args = { content: { key: "value", number: 123 } };
    const schema = {
      type: "object",
      properties: {
        content: { type: "string" },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.content).toBe('{"key":"value","number":123}');
  });

  it("should stringify array values when schema expects string", () => {
    const args = { content: ["item1", "item2"] };
    const schema = {
      type: "object",
      properties: {
        content: { type: "string" },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.content).toBe('["item1","item2"]');
  });

  it("should leave string values as-is", () => {
    const args = { content: "hello world" };
    const schema = {
      type: "object",
      properties: {
        content: { type: "string" },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.content).toBe("hello world");
  });

  it("should leave non-string schema types as-is", () => {
    const args = { count: 42, data: { nested: true } };
    const schema = {
      type: "object",
      properties: {
        count: { type: "number" },
        data: { type: "object" },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.count).toBe(42);
    expect(result.data).toEqual({ nested: true });
  });

  it("should return args unchanged when no schema provided", () => {
    const args = { content: { key: "value" } };
    const result = coerceArgsToSchema(args, undefined);
    expect(result).toBe(args);
  });

  it("should return args unchanged when schema has no properties", () => {
    const args = { content: { key: "value" } };
    const result = coerceArgsToSchema(args, { type: "object" });
    expect(result).toBe(args);
  });

  it("should handle mixed args with some needing coercion", () => {
    const args = {
      filePath: "/path/to/file.json",
      content: { key: "value" },
      overwrite: true,
    };
    const schema = {
      type: "object",
      properties: {
        filePath: { type: "string" },
        content: { type: "string" },
        overwrite: { type: "boolean" },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.filePath).toBe("/path/to/file.json");
    expect(result.content).toBe('{"key":"value"}');
    expect(result.overwrite).toBe(true);
  });

  it("should skip args not in schema", () => {
    const args = { unknown: { key: "value" }, known: "hello" };
    const schema = {
      type: "object",
      properties: {
        known: { type: "string" },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.unknown).toEqual({ key: "value" });
    expect(result.known).toBe("hello");
  });

  it("should not coerce numbers or booleans to strings", () => {
    const args = { content: 42, flag: true };
    const schema = {
      type: "object",
      properties: {
        content: { type: "string" },
        flag: { type: "string" },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.content).toBe(42);
    expect(result.flag).toBe(true);
  });

  it("should not mutate the original args object", () => {
    const args = { content: { key: "value" } };
    const schema = {
      type: "object",
      properties: {
        content: { type: "string" },
      },
    };
    coerceArgsToSchema(args, schema);
    expect(args.content).toEqual({ key: "value" });
  });
});

describe("coerceArgsToSchema with JSON-serialized values", () => {
  // Some providers return non-string arguments as JSON text, e.g.
  // {"paths": "[\"a.jsx\"]"}; strict MCP servers reject those (#13350)
  it("should decode a serialized array when the schema expects an array", () => {
    const args = {
      paths:
        '["frontend/src/pages/Accounts.jsx","frontend/src/components/Translate.jsx"]',
    };
    const schema = {
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" } },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.paths).toEqual([
      "frontend/src/pages/Accounts.jsx",
      "frontend/src/components/Translate.jsx",
    ]);
  });

  it("should decode nested arrays", () => {
    const args = { matrix: " [[1, 2], [3, [4, 5]], []] " };
    const schema = {
      type: "object",
      properties: {
        matrix: { type: "array", items: { type: "array" } },
      },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.matrix).toEqual([[1, 2], [3, [4, 5]], []]);
  });

  it("should decode a serialized object, keeping nested values native", () => {
    const args = {
      settings:
        '{"enabled": true, "mode": "fast", "size": {"width": 800, "scale": 1.5}, "tags": ["a", "b"], "parent": null}',
    };
    const schema = {
      type: "object",
      properties: { settings: { type: "object" } },
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result.settings).toEqual({
      enabled: true,
      mode: "fast",
      size: { width: 800, scale: 1.5 },
      tags: ["a", "b"],
      parent: null,
    });
  });

  it("should decode serialized integers, numbers, booleans and null", () => {
    const args = {
      count: "42",
      negative: "-7",
      ratio: "3.14",
      exponent: "1e3",
      dryRun: "false",
      verbose: "TRUE",
      limit: "null",
      flag: "null",
    };
    const schema = {
      type: "object",
      properties: {
        count: { type: "integer" },
        negative: { type: "integer" },
        ratio: { type: "number" },
        exponent: { type: "number" },
        dryRun: { type: "boolean" },
        verbose: { type: "boolean" },
        limit: { anyOf: [{ type: "integer" }, { type: "null" }] },
        flag: { type: ["boolean", "null"] },
      },
    };
    expect(coerceArgsToSchema(args, schema)).toEqual({
      count: 42,
      negative: -7,
      ratio: 3.14,
      exponent: 1000,
      dryRun: false,
      verbose: true,
      limit: null,
      flag: null,
    });
  });

  it("should leave strings unchanged when the schema accepts a string", () => {
    const args = {
      content: '{"key": [1, 2]}',
      list: "[1, 2]",
      either: '["a"]',
      nullableText: "null",
      choice: "true",
      anything: "42",
      described: "[3]",
    };
    const schema = {
      type: "object",
      properties: {
        content: { type: "string" },
        list: { type: ["string", "array"] },
        either: { anyOf: [{ type: "array" }, { type: "string" }] },
        nullableText: { anyOf: [{ type: "string" }, { type: "null" }] },
        choice: { enum: ["true", "false", "auto"] },
        anything: {},
        described: { description: "no type constraint" },
      },
    };
    expect(coerceArgsToSchema(args, schema)).toEqual(args);
  });

  it("should not truncate, round or reinterpret numeric strings", () => {
    const args = {
      fraction: "3.7",
      unsafe: "9007199254740993",
      overflow: "1e400",
      hex: "0x1A",
      nan: "NaN",
      infinity: "Infinity",
      empty: "",
      leadingZero: "042",
      suffix: "12px",
    };
    const integer = { type: "integer" };
    const number = { type: "number" };
    const schema = {
      type: "object",
      properties: {
        fraction: integer,
        unsafe: integer,
        overflow: number,
        hex: integer,
        nan: number,
        infinity: number,
        empty: number,
        leadingZero: integer,
        suffix: integer,
      },
    };
    expect(coerceArgsToSchema(args, schema)).toEqual(args);
  });

  it("should not decode a value into a type the schema does not accept", () => {
    const args = {
      paths: '{"a": 1}',
      config: "[1, 2]",
      enabled: "yes",
      toggle: "1",
      count: "true",
      broken: '["unterminated"',
    };
    const schema = {
      type: "object",
      properties: {
        paths: { type: "array" },
        config: { anyOf: [{ type: "object" }, { type: "null" }] },
        enabled: { type: "boolean" },
        toggle: { type: "boolean" },
        count: { type: "integer" },
        broken: { type: "array" },
      },
    };
    expect(coerceArgsToSchema(args, schema)).toEqual(args);
  });

  it("should resolve $ref, anyOf, oneOf and allOf", () => {
    const args = {
      config: '{"depth": 2, "targets": ["a"]}',
      retries: "3",
      mode: "[1]",
      edits: '[{"oldText": "a", "newText": "b"}]',
    };
    // Pydantic/FastMCP style: Optional[Model] -> anyOf [$ref, null]
    const schema = {
      type: "object",
      $defs: {
        ProbeConfig: {
          type: "object",
          properties: { depth: { type: "integer" } },
        },
        Edit: { type: "object" },
      },
      properties: {
        config: { anyOf: [{ $ref: "#/$defs/ProbeConfig" }, { type: "null" }] },
        retries: { oneOf: [{ type: "integer" }, { type: "null" }] },
        mode: { allOf: [{ type: ["string", "array"] }, { type: "array" }] },
        edits: { type: "array", items: { $ref: "#/$defs/Edit" } },
      },
    };
    expect(coerceArgsToSchema(args, schema)).toEqual({
      config: { depth: 2, targets: ["a"] },
      retries: 3,
      mode: [1],
      edits: [{ oldText: "a", newText: "b" }],
    });
  });

  it("should leave values unchanged when a $ref cannot be resolved", () => {
    const args = { missing: "[1]", remote: "[2]", cycle: "[3]", text: "[4]" };
    const schema = {
      type: "object",
      definitions: {
        Loop: { $ref: "#/definitions/Loop" },
        Text: { type: "string" },
      },
      properties: {
        missing: { $ref: "#/definitions/Missing" },
        remote: { $ref: "https://example.com/schema.json" },
        cycle: { $ref: "#/definitions/Loop" },
        text: { $ref: "#/definitions/Text" },
      },
    };
    expect(coerceArgsToSchema(args, schema)).toEqual(args);
  });

  it("should preserve sibling, optional and unknown arguments", () => {
    const args = {
      path: "frontend/src/App.jsx",
      edits: '[{"oldText": "a", "newText": "b"}]',
      dryRun: "false",
      unknownJson: "[1, 2]",
      nativeList: ["x"],
    };
    const schema = {
      type: "object",
      properties: {
        path: { type: "string" },
        edits: { type: "array" },
        dryRun: { type: "boolean" },
        nativeList: { type: "array" },
        optionalLimit: { type: "integer" },
      },
      required: ["path", "edits"],
    };
    const result = coerceArgsToSchema(args, schema);
    expect(result).toEqual({
      path: "frontend/src/App.jsx",
      edits: [{ oldText: "a", newText: "b" }],
      dryRun: false,
      unknownJson: "[1, 2]",
      nativeList: ["x"],
    });
    expect(Object.keys(result)).toEqual(Object.keys(args));
    expect(result.nativeList).toBe(args.nativeList);
  });

  it("should coerce a streamed provider payload against a strict object schema", () => {
    // Raw arguments string as streamed by an OpenAI-compatible provider
    const toolCall: ToolCallDelta = {
      id: "1",
      function: {
        name: "example_run_job",
        arguments:
          '{"settings": "{\\"enabled\\": true, \\"mode\\": \\"fast\\"}", "target": "{\\"id\\": \\"t1\\"}", "steps": "[{\\"name\\": \\"first\\", \\"retries\\": 2}]"}',
      },
    };
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        settings: { type: "object" },
        target: { type: "object" },
        steps: {
          type: "array",
          items: { type: ["null", "boolean", "object", "array"], items: {} },
        },
      },
      required: ["settings", "target", "steps"],
      additionalProperties: false,
    };
    const result = coerceArgsToSchema(safeParseToolCallArgs(toolCall), schema);
    expect(result).toEqual({
      settings: { enabled: true, mode: "fast" },
      target: { id: "t1" },
      steps: [{ name: "first", retries: 2 }],
    });
  });

  it("should give the same result for repeated calls without mutating inputs", () => {
    const schema = {
      type: "object",
      $defs: { Limit: { anyOf: [{ type: "integer" }, { type: "null" }] } },
      properties: {
        fields: { type: "array", items: { type: "string" } },
        limit: { $ref: "#/$defs/Limit" },
        path: { type: "string" },
      },
    };
    const schemaBefore = structuredClone(schema);
    const calls = [
      { path: "a.txt", fields: '["id"]', limit: "5" },
      { path: "b.txt", fields: ["name"], limit: 7 },
      { path: "c.txt", fields: '["created", "updated"]', limit: "null" },
    ];
    const callsBefore = structuredClone(calls);
    for (let round = 0; round < 2; round++) {
      expect(calls.map((args) => coerceArgsToSchema(args, schema))).toEqual([
        { path: "a.txt", fields: ["id"], limit: 5 },
        { path: "b.txt", fields: ["name"], limit: 7 },
        { path: "c.txt", fields: ["created", "updated"], limit: null },
      ]);
    }
    expect(schema).toEqual(schemaBefore);
    expect(calls).toEqual(callsBefore);
  });
});

describe("coerceArgsToSchema with adversarial schemas", () => {
  it("should expand a shared $ref only once", () => {
    // Each level references the next twice: 2^40 paths, 41 distinct schemas
    const $defs: Record<string, unknown> = { D40: { type: "array" } };
    for (let i = 0; i < 40; i++) {
      $defs[`D${i}`] = {
        anyOf: [{ $ref: `#/$defs/D${i + 1}` }, { $ref: `#/$defs/D${i + 1}` }],
      };
    }
    const schema = {
      type: "object",
      $defs,
      properties: { list: { $ref: "#/$defs/D0" } },
    };
    expect(coerceArgsToSchema({ list: "[1]" }, schema)).toEqual({ list: [1] });
  });

  it("should keep an argument whose schema exceeds the traversal budget", () => {
    let nested: Record<string, unknown> = { type: "array" };
    for (let i = 0; i < 20000; i++) {
      nested = { allOf: [nested] };
    }
    const $defs: Record<string, unknown> = { C2000: { type: "array" } };
    for (let i = 0; i < 2000; i++) {
      $defs[`C${i}`] = { $ref: `#/$defs/C${i + 1}` };
    }
    const schema = {
      type: "object",
      $defs,
      properties: {
        nested,
        chained: { $ref: "#/$defs/C0" },
        wide: {
          anyOf: Array.from({ length: 5000 }, () => ({ type: "array" })),
        },
        list: { type: "array" },
      },
    };
    const args = { nested: "[1]", chained: "[2]", wide: "[3]", list: "[4]" };
    // The budget is per argument, so list is still decoded
    expect(coerceArgsToSchema(args, schema)).toEqual({ ...args, list: [4] });
  });

  it("should keep arguments with recursive references", () => {
    const schema = {
      type: "object",
      $defs: {
        A: { anyOf: [{ $ref: "#/$defs/B" }, { type: "array" }] },
        B: { anyOf: [{ $ref: "#/$defs/A" }, { type: "null" }] },
        Self: { allOf: [{ $ref: "#/$defs/Self" }, { type: "array" }] },
      },
      properties: {
        mutual: { $ref: "#/$defs/A" },
        self: { $ref: "#/$defs/Self" },
      },
    };
    const args = { mutual: "[1]", self: "[2]" };
    expect(coerceArgsToSchema(args, schema)).toEqual(args);
  });

  it("should not resolve references across nested schema resources", () => {
    // Inside a schema with its own $id, "#/$defs/T" refers to that schema's
    // T, which accepts strings, so these strings are already valid
    const subResource = (id: string) => ({
      $id: id,
      $defs: { T: { type: ["string", "array"] } },
      allOf: [{ $ref: "#/$defs/T" }],
    });
    const schema = {
      $id: "urn:example:root",
      type: "object",
      $defs: {
        T: { type: "array" },
        Sub: subResource("urn:example:sub"),
        Legacy: { id: "urn:example:legacy", type: "array" },
      },
      properties: {
        embedded: subResource("urn:example:embedded"),
        viaRef: { $ref: "#/$defs/Sub" },
        intoResource: { $ref: "#/$defs/Sub/$defs/T" },
        draft4: { $ref: "#/$defs/Legacy" },
        dynamic: { $dynamicRef: "#/$defs/T" },
        malformed: { $ref: 42 },
        rootRelative: { $ref: "#/$defs/T" },
      },
    };
    const args = {
      embedded: "[1]",
      viaRef: "[2]",
      intoResource: "[3]",
      draft4: "[4]",
      dynamic: "[5]",
      malformed: "[6]",
      rootRelative: "[7]",
    };
    // Only the reference resolved within the root resource is decoded
    expect(coerceArgsToSchema(args, schema)).toEqual({
      ...args,
      rootRelative: [7],
    });
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
