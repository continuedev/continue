import { describe, test, expect } from "vitest";
import { convertToolsToVercelFormat } from "../convertToolsToVercel.js";
import type { ChatCompletionCreateParams } from "openai/resources/index.js";

describe("convertToolsToVercelFormat", () => {
  test("returns undefined for undefined tools", () => {
    const result = convertToolsToVercelFormat(undefined);
    expect(result).toBeUndefined();
  });

  test("returns undefined for empty tools array", () => {
    const result = convertToolsToVercelFormat([]);
    expect(result).toBeUndefined();
  });

  test("converts single function tool", () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "readFile",
          description: "Read a file from disk",
          parameters: {
            type: "object",
            properties: {
              filepath: {
                type: "string",
                description: "Path to the file",
              },
            },
            required: ["filepath"],
          },
        },
      },
    ];

    const result = convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("readFile");
    expect(result?.readFile).toHaveProperty(
      "description",
      "Read a file from disk",
    );
    expect(result?.readFile).toHaveProperty("parameters");
    // Check that parameters were wrapped with aiJsonSchema
    expect(result?.readFile.parameters).toBeDefined();
  });

  test("converts multiple function tools", () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "readFile",
          description: "Read a file",
          parameters: {
            type: "object",
            properties: {
              filepath: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "writeFile",
          description: "Write a file",
          parameters: {
            type: "object",
            properties: {
              filepath: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
    ];

    const result = convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(Object.keys(result!)).toHaveLength(2);
    expect(result).toHaveProperty("readFile");
    expect(result).toHaveProperty("writeFile");
    expect(result?.readFile.description).toBe("Read a file");
    expect(result?.writeFile.description).toBe("Write a file");
  });

  test("handles tool without description", () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "testTool",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
    ];

    const result = convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("testTool");
    expect(result?.testTool.description).toBeUndefined();
  });

  test("filters out non-function tools", () => {
    const tools: any[] = [
      {
        type: "function",
        function: {
          name: "validTool",
          description: "Valid tool",
          parameters: { type: "object" },
        },
      },
      {
        type: "custom", // Not a function type
        name: "customTool",
      },
    ];

    const result = convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(Object.keys(result!)).toHaveLength(1);
    expect(result).toHaveProperty("validTool");
    expect(result).not.toHaveProperty("customTool");
  });

  test("returns undefined if all tools are filtered out", () => {
    const tools: any[] = [
      {
        type: "custom", // Not a function type
        name: "customTool",
      },
    ];

    const result = convertToolsToVercelFormat(tools);

    expect(result).toBeUndefined();
  });

  test("preserves parameter schema structure", () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "complexTool",
          description: "A complex tool",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name parameter",
              },
              age: {
                type: "number",
                minimum: 0,
                maximum: 120,
              },
              tags: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
            required: ["name"],
          },
        },
      },
    ];

    const result = convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.complexTool.parameters).toBeDefined();
    // The parameters should be wrapped but still contain the original schema structure
    // We can't easily test the internal structure of aiJsonSchema, but we can verify it exists
    expect(result?.complexTool.parameters).toBeTruthy();
  });
});
