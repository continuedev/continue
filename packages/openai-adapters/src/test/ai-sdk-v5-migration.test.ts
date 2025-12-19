import { describe, test, expect } from "vitest";
import { convertToolsToVercelFormat } from "../convertToolsToVercel.js";
import type { ChatCompletionCreateParams } from "openai/resources/index.js";

/**
 * AI SDK v5 Migration Tests
 *
 * This test suite verifies that the migration from AI SDK v4 to v5 is correct.
 * Key changes in v5:
 * - Tool parameters renamed to inputSchema
 * - Usage fields: promptTokens → inputTokens, completionTokens → outputTokens
 * - Tool call structure: args → input
 * - Model initialization: anthropic(model) → anthropic.chat(model)
 * - maxTokens → maxOutputTokens
 */

describe("AI SDK v5 Migration: Tool Conversion", () => {
  test("uses inputSchema instead of parameters for tool definitions", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "searchWeb",
          description: "Search the web for information",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query",
              },
              limit: {
                type: "number",
                description: "Maximum results",
                default: 10,
              },
            },
            required: ["query"],
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.searchWeb).toHaveProperty("inputSchema");
    expect(result?.searchWeb).not.toHaveProperty("parameters");
    expect(result?.searchWeb.description).toBe(
      "Search the web for information",
    );
  });

  test("handles empty parameters object correctly", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "getCurrentTime",
          description: "Get current time",
          parameters: undefined,
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.getCurrentTime).toHaveProperty("inputSchema");
    // Should default to empty object schema
    expect(result?.getCurrentTime.inputSchema).toBeDefined();
  });

  test("converts multiple tools with various parameter types", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "calculateSum",
          description: "Calculate sum of numbers",
          parameters: {
            type: "object",
            properties: {
              numbers: {
                type: "array",
                items: { type: "number" },
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "getUserInfo",
          description: "Get user information",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string" },
              includeDetails: { type: "boolean" },
            },
            required: ["userId"],
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(Object.keys(result!)).toHaveLength(2);

    // Both should use inputSchema
    expect(result?.calculateSum).toHaveProperty("inputSchema");
    expect(result?.calculateSum).not.toHaveProperty("parameters");

    expect(result?.getUserInfo).toHaveProperty("inputSchema");
    expect(result?.getUserInfo).not.toHaveProperty("parameters");
  });

  test("handles nested object schemas in inputSchema", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "createUser",
          description: "Create a new user",
          parameters: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  address: {
                    type: "object",
                    properties: {
                      street: { type: "string" },
                      city: { type: "string" },
                      zipCode: { type: "string" },
                    },
                  },
                },
                required: ["name", "email"],
              },
            },
            required: ["user"],
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.createUser).toHaveProperty("inputSchema");
    expect(result?.createUser.inputSchema).toBeDefined();
  });

  test("handles array parameters in inputSchema", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "processItems",
          description: "Process multiple items",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    value: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.processItems).toHaveProperty("inputSchema");
  });

  test("maintains backward compatibility with existing tool formats", async () => {
    // This test ensures that the conversion still works with older tool definitions
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "legacyTool",
          description: "A legacy tool",
          parameters: {
            type: "object",
            properties: {
              input: { type: "string" },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.legacyTool).toHaveProperty("description");
    expect(result?.legacyTool).toHaveProperty("inputSchema");
  });

  test("handles tools with enum parameters", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "setStatus",
          description: "Set status",
          parameters: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["active", "inactive", "pending"],
              },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.setStatus).toHaveProperty("inputSchema");
  });

  test("handles tools with pattern constraints", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "validateEmail",
          description: "Validate email format",
          parameters: {
            type: "object",
            properties: {
              email: {
                type: "string",
                pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
              },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.validateEmail).toHaveProperty("inputSchema");
  });

  test("handles tools with numeric constraints", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "setTemperature",
          description: "Set temperature value",
          parameters: {
            type: "object",
            properties: {
              value: {
                type: "number",
                minimum: -273.15,
                maximum: 1000,
                multipleOf: 0.1,
              },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.setTemperature).toHaveProperty("inputSchema");
  });

  test("handles tools with string length constraints", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "setUsername",
          description: "Set username",
          parameters: {
            type: "object",
            properties: {
              username: {
                type: "string",
                minLength: 3,
                maxLength: 20,
              },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.setUsername).toHaveProperty("inputSchema");
  });

  test("handles tools with array constraints", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "setTags",
          description: "Set tags",
          parameters: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 10,
                uniqueItems: true,
              },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.setTags).toHaveProperty("inputSchema");
  });

  test("handles tools with oneOf/anyOf/allOf schemas", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "processData",
          description: "Process data with flexible schema",
          parameters: {
            type: "object",
            properties: {
              data: {
                oneOf: [
                  { type: "string" },
                  { type: "number" },
                  { type: "object", properties: { value: { type: "string" } } },
                ],
              },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.processData).toHaveProperty("inputSchema");
  });

  test("handles tools with additionalProperties", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "createConfig",
          description: "Create configuration",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            additionalProperties: true,
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.createConfig).toHaveProperty("inputSchema");
  });
});

describe("AI SDK v5 Migration: Edge Cases", () => {
  test("handles tool with empty string name gracefully", async () => {
    const tools: any[] = [
      {
        type: "function",
        function: {
          name: "",
          description: "Tool with empty name",
          parameters: { type: "object" },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.[""]).toBeDefined();
  });

  test("handles tool with special characters in name", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "tool_with_underscores",
          description: "Tool name with underscores",
          parameters: { type: "object" },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.tool_with_underscores).toHaveProperty("inputSchema");
  });

  test("handles duplicate tool names (last one wins)", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "duplicateTool",
          description: "First tool",
          parameters: { type: "object" },
        },
      },
      {
        type: "function",
        function: {
          name: "duplicateTool",
          description: "Second tool",
          parameters: { type: "object" },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(Object.keys(result!)).toHaveLength(1);
    expect(result?.duplicateTool.description).toBe("Second tool");
  });

  test("handles tool with null description", async () => {
    const tools: any[] = [
      {
        type: "function",
        function: {
          name: "nullDescTool",
          description: null,
          parameters: { type: "object" },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.nullDescTool.description).toBeNull();
  });

  test("handles tool with very long description", async () => {
    const longDescription = "A".repeat(10000);
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "longDescTool",
          description: longDescription,
          parameters: { type: "object" },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.longDescTool.description).toBe(longDescription);
    expect(result?.longDescTool).toHaveProperty("inputSchema");
  });

  test("handles tool with complex nested schemas", async () => {
    const tools: ChatCompletionCreateParams["tools"] = [
      {
        type: "function",
        function: {
          name: "complexNested",
          description: "Complex nested structure",
          parameters: {
            type: "object",
            properties: {
              level1: {
                type: "object",
                properties: {
                  level2: {
                    type: "object",
                    properties: {
                      level3: {
                        type: "object",
                        properties: {
                          level4: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                value: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(result?.complexNested).toHaveProperty("inputSchema");
  });

  test("handles mixed valid and invalid tools", async () => {
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
        type: "invalid_type",
        function: {
          name: "invalidTool",
          description: "Invalid tool type",
          parameters: { type: "object" },
        },
      },
      {
        type: "function",
        function: {
          name: "anotherValidTool",
          description: "Another valid tool",
          parameters: { type: "object" },
        },
      },
    ];

    const result = await convertToolsToVercelFormat(tools);

    expect(result).toBeDefined();
    expect(Object.keys(result!)).toHaveLength(2);
    expect(result?.validTool).toBeDefined();
    expect(result?.anotherValidTool).toBeDefined();
    expect(result?.invalidTool).toBeUndefined();
  });
});
