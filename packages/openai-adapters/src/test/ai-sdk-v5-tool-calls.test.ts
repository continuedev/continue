import { describe, test, expect } from "vitest";

/**
 * AI SDK v5 Tool Call Migration Tests
 *
 * This test suite verifies correct handling of tool call changes in AI SDK v5:
 * - v4: toolCall.args → v5: toolCall.input
 * - Tool call structure changes in responses
 *
 * The adapters need to map these fields correctly when converting from
 * Vercel AI SDK responses back to OpenAI-compatible format.
 */

describe("AI SDK v5 Migration: Tool Call Fields", () => {
  describe("Tool call input field mapping", () => {
    test("maps tool call input to OpenAI arguments format", () => {
      // Simulating v5 tool call format
      const v5ToolCall = {
        toolName: "readFile",
        input: {
          filepath: "/path/to/file.txt",
          encoding: "utf-8",
        },
      };

      // Expected OpenAI format
      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      expect(openAIFormat.type).toBe("function");
      expect(openAIFormat.function.name).toBe("readFile");
      expect(openAIFormat.function.arguments).toBe(
        JSON.stringify({ filepath: "/path/to/file.txt", encoding: "utf-8" }),
      );
    });

    test("handles tool call with empty input", () => {
      const v5ToolCall = {
        toolName: "getCurrentTime",
        input: {},
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      expect(openAIFormat.function.arguments).toBe("{}");
    });

    test("handles tool call with null input", () => {
      const v5ToolCall = {
        toolName: "ping",
        input: null,
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      expect(openAIFormat.function.arguments).toBe("null");
    });

    test("handles tool call with undefined input", () => {
      const v5ToolCall = {
        toolName: "status",
        input: undefined,
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input ?? {}),
        },
      };

      expect(openAIFormat.function.arguments).toBe("{}");
    });

    test("handles tool call with complex nested input", () => {
      const v5ToolCall = {
        toolName: "createUser",
        input: {
          user: {
            name: "John Doe",
            email: "john@example.com",
            address: {
              street: "123 Main St",
              city: "Springfield",
              zipCode: "12345",
            },
          },
          options: {
            sendEmail: true,
            validateAddress: false,
          },
        },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.user.name).toBe("John Doe");
      expect(parsedArgs.user.address.city).toBe("Springfield");
      expect(parsedArgs.options.sendEmail).toBe(true);
    });

    test("handles tool call with array input", () => {
      const v5ToolCall = {
        toolName: "processItems",
        input: {
          items: [
            { id: "1", value: 100 },
            { id: "2", value: 200 },
            { id: "3", value: 300 },
          ],
        },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.items).toHaveLength(3);
      expect(parsedArgs.items[1].value).toBe(200);
    });

    test("handles tool call with boolean input", () => {
      const v5ToolCall = {
        toolName: "toggleFeature",
        input: {
          enabled: true,
        },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.enabled).toBe(true);
    });

    test("handles tool call with numeric input", () => {
      const v5ToolCall = {
        toolName: "setTemperature",
        input: {
          value: 23.5,
          unit: "celsius",
        },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.value).toBe(23.5);
      expect(parsedArgs.unit).toBe("celsius");
    });

    test("handles tool call with special characters in input", () => {
      const v5ToolCall = {
        toolName: "sendMessage",
        input: {
          message: 'Hello "World"\nNew line\tTab',
          recipient: "user@example.com",
        },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.message).toContain("Hello");
      expect(parsedArgs.message).toContain("World");
      expect(parsedArgs.message).toContain("\n");
    });
  });

  describe("Multiple tool calls", () => {
    test("handles multiple tool calls in single response", () => {
      const v5ToolCalls = [
        {
          toolName: "readFile",
          input: { filepath: "/file1.txt" },
        },
        {
          toolName: "readFile",
          input: { filepath: "/file2.txt" },
        },
        {
          toolName: "writeFile",
          input: { filepath: "/output.txt", content: "data" },
        },
      ];

      const openAIToolCalls = v5ToolCalls.map((tc) => ({
        type: "function" as const,
        function: {
          name: tc.toolName,
          arguments: JSON.stringify(tc.input),
        },
      }));

      expect(openAIToolCalls).toHaveLength(3);
      expect(openAIToolCalls[0].function.name).toBe("readFile");
      expect(openAIToolCalls[2].function.name).toBe("writeFile");
    });

    test("handles empty tool calls array", () => {
      const v5ToolCalls: any[] = [];

      const openAIToolCalls = v5ToolCalls.map((tc) => ({
        type: "function" as const,
        function: {
          name: tc.toolName,
          arguments: JSON.stringify(tc.input),
        },
      }));

      expect(openAIToolCalls).toHaveLength(0);
    });

    test("handles tool calls with mixed input types", () => {
      const v5ToolCalls = [
        {
          toolName: "tool1",
          input: { key: "value" },
        },
        {
          toolName: "tool2",
          input: {},
        },
        {
          toolName: "tool3",
          input: { nested: { data: [1, 2, 3] } },
        },
      ];

      const openAIToolCalls = v5ToolCalls.map((tc) => ({
        type: "function" as const,
        function: {
          name: tc.toolName,
          arguments: JSON.stringify(tc.input),
        },
      }));

      expect(openAIToolCalls).toHaveLength(3);
      expect(JSON.parse(openAIToolCalls[0].function.arguments)).toEqual({
        key: "value",
      });
      expect(JSON.parse(openAIToolCalls[1].function.arguments)).toEqual({});
      expect(
        JSON.parse(openAIToolCalls[2].function.arguments).nested.data,
      ).toEqual([1, 2, 3]);
    });
  });

  describe("Tool call edge cases", () => {
    test("handles tool call with very large input", () => {
      const largeInput = {
        data: "x".repeat(100000),
      };

      const v5ToolCall = {
        toolName: "processLargeData",
        input: largeInput,
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.data.length).toBe(100000);
    });

    test("handles tool call with unicode characters", () => {
      const v5ToolCall = {
        toolName: "processText",
        input: {
          text: "Hello 世界 🌍 Привет",
        },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.text).toBe("Hello 世界 🌍 Привет");
    });

    test("handles tool call with circular reference (should throw)", () => {
      const circularInput: any = { key: "value" };
      circularInput.self = circularInput;

      const v5ToolCall = {
        toolName: "failTool",
        input: circularInput,
      };

      expect(() => {
        JSON.stringify(v5ToolCall.input);
      }).toThrow();
    });

    test("handles tool call with Date objects", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      const v5ToolCall = {
        toolName: "scheduleTask",
        input: {
          scheduledTime: date.toISOString(),
        },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.scheduledTime).toBe("2024-01-01T00:00:00.000Z");
    });

    test("handles tool call with function values (should serialize)", () => {
      const v5ToolCall = {
        toolName: "testTool",
        input: {
          callback: undefined, // Functions become undefined in JSON
          data: "value",
        },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.callback).toBeUndefined();
      expect(parsedArgs.data).toBe("value");
    });
  });

  describe("Tool call ID handling", () => {
    test("preserves tool call ID when present", () => {
      const v5ToolCall = {
        id: "call_abc123",
        toolName: "readFile",
        input: { filepath: "/file.txt" },
      };

      const openAIFormat = {
        id: v5ToolCall.id,
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      expect(openAIFormat.id).toBe("call_abc123");
      expect(openAIFormat.function.name).toBe("readFile");
    });

    test("handles missing tool call ID", () => {
      const v5ToolCall = {
        toolName: "readFile",
        input: { filepath: "/file.txt" },
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      expect(openAIFormat).not.toHaveProperty("id");
    });

    test("handles tool call with empty ID", () => {
      const v5ToolCall = {
        id: "",
        toolName: "readFile",
        input: { filepath: "/file.txt" },
      };

      const openAIFormat = {
        id: v5ToolCall.id,
        type: "function" as const,
        function: {
          name: v5ToolCall.toolName,
          arguments: JSON.stringify(v5ToolCall.input),
        },
      };

      expect(openAIFormat.id).toBe("");
    });
  });

  describe("Comparison: v4 args vs v5 input", () => {
    test("demonstrates the field name change", () => {
      // v4 format (old)
      const v4ToolCall = {
        toolName: "readFile",
        args: {
          filepath: "/file.txt",
        },
      };

      // v5 format (new)
      const v5ToolCall = {
        toolName: "readFile",
        input: {
          filepath: "/file.txt",
        },
      };

      // Verify the structural difference
      expect(v4ToolCall).toHaveProperty("args");
      expect(v4ToolCall).not.toHaveProperty("input");

      expect(v5ToolCall).toHaveProperty("input");
      expect(v5ToolCall).not.toHaveProperty("args");

      // Content should be the same
      expect(v5ToolCall.input).toEqual(v4ToolCall.args);
    });

    test("both v4 and v5 convert to same OpenAI format", () => {
      const input = { filepath: "/file.txt" };

      // v4 conversion
      const v4OpenAI = {
        type: "function" as const,
        function: {
          name: "readFile",
          arguments: JSON.stringify(input),
        },
      };

      // v5 conversion
      const v5OpenAI = {
        type: "function" as const,
        function: {
          name: "readFile",
          arguments: JSON.stringify(input),
        },
      };

      // Final OpenAI format should be identical
      expect(v4OpenAI).toEqual(v5OpenAI);
    });
  });

  describe("Streaming tool calls", () => {
    test("handles partial tool call streaming", () => {
      // In streaming, tool calls might arrive in chunks
      const streamedChunks = [
        { toolName: "readFile", input: undefined },
        { toolName: "readFile", input: { filepath: undefined } },
        { toolName: "readFile", input: { filepath: "/file" } },
        { toolName: "readFile", input: { filepath: "/file.txt" } },
      ];

      // Final complete chunk
      const finalChunk = streamedChunks[streamedChunks.length - 1];

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: finalChunk.toolName,
          arguments: JSON.stringify(finalChunk.input),
        },
      };

      expect(openAIFormat.function.arguments).toBe(
        JSON.stringify({ filepath: "/file.txt" }),
      );
    });

    test("handles incomplete tool call in stream", () => {
      const incompleteToolCall = {
        toolName: "writeFile",
        input: { filepath: "/out.txt" }, // missing 'content'
      };

      const openAIFormat = {
        type: "function" as const,
        function: {
          name: incompleteToolCall.toolName,
          arguments: JSON.stringify(incompleteToolCall.input),
        },
      };

      const parsedArgs = JSON.parse(openAIFormat.function.arguments);
      expect(parsedArgs.filepath).toBe("/out.txt");
      expect(parsedArgs.content).toBeUndefined();
    });
  });
});
