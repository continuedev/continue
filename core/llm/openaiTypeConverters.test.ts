import {
  fromChatCompletionChunk,
  fromChatResponse,
  toResponsesInput,
} from "./openaiTypeConverters";
import { ChatMessage } from "..";
import type { ResponseInputItem } from "openai/resources/responses/responses.mjs";

// Types for test assertions (simplified from OpenAI types)
type FunctionCallItem = {
  type: "function_call";
  id: string;
  name: string;
  arguments: string;
  call_id: string;
};

type FunctionCallOutputItem = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

type MessageItem = {
  role: string;
  content: unknown;
};

// Helper functions for filtering results
function getFunctionCalls(items: ResponseInputItem[]): FunctionCallItem[] {
  return items.filter(
    (item) => (item as { type?: string }).type === "function_call",
  ) as unknown as FunctionCallItem[];
}

function getFunctionCallOutputs(
  items: ResponseInputItem[],
): FunctionCallOutputItem[] {
  return items.filter(
    (item) => (item as { type?: string }).type === "function_call_output",
  ) as unknown as FunctionCallOutputItem[];
}

function getMessagesByRole(
  items: ResponseInputItem[],
  role: string,
): MessageItem[] {
  return items.filter((item) => {
    const msg = item as { role?: string; type?: string };
    return msg.role === role && (!msg.type || msg.type === "message");
  }) as unknown as MessageItem[];
}

describe("openaiTypeConverters", () => {
  describe("usage extraction", () => {
    it("extracts usage from non-stream responses", () => {
      const messages = fromChatResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: "hello",
            },
          },
        ],
        usage: {
          prompt_tokens: 123,
          completion_tokens: 45,
          total_tokens: 168,
        },
      } as any);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      if (messages[0].role === "assistant") {
        expect(messages[0].usage).toMatchObject({
          promptTokens: 123,
          completionTokens: 45,
          totalTokens: 168,
          source: "provider",
        });
      }
    });

    it("extracts usage-only stream chunks", () => {
      const message = fromChatCompletionChunk({
        choices: [],
        usage: {
          prompt_tokens: 30,
          completion_tokens: 10,
          total_tokens: 40,
        },
      } as any);

      expect(message).toBeDefined();
      expect(message?.role).toBe("assistant");
      if (message?.role === "assistant") {
        expect(message.content).toBe("");
        expect(message.usage).toMatchObject({
          promptTokens: 30,
          completionTokens: 10,
          totalTokens: 40,
        });
      }
    });
  });

  describe("toResponsesInput", () => {
    describe("tool calls handling - OpenAI Responses API", () => {
      it("should emit function_call items when fc_ ID is in metadata", () => {
        const messages: ChatMessage[] = [
          {
            role: "user",
            content: "List files in current directory",
          },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_abc123",
                type: "function",
                function: {
                  name: "filesystem_list_directory",
                  arguments: '{"path": "."}',
                },
              },
            ],
            metadata: { responsesOutputItemId: "fc_abc123" },
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        const functionCalls = getFunctionCalls(result);
        expect(functionCalls.length).toBe(1);
        expect(functionCalls[0].id).toBe("fc_abc123");
        expect(functionCalls[0].call_id).toBe("call_abc123");
        expect(functionCalls[0].name).toBe("filesystem_list_directory");
      });

      it("should NOT emit function_call when no fc_ ID in metadata", () => {
        const messages: ChatMessage[] = [
          {
            role: "assistant",
            content: "I'll help.",
            toolCalls: [
              {
                id: "call_xyz",
                type: "function",
                function: {
                  name: "some_tool",
                  arguments: "{}",
                },
              },
            ],
            // No metadata with fc_ ID
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        const functionCalls = getFunctionCalls(result);
        expect(functionCalls.length).toBe(0);

        // Text should still be emitted
        const assistantMessages = getMessagesByRole(result, "assistant");
        expect(assistantMessages.length).toBe(1);
      });

      it("should emit text content alongside tool calls", () => {
        const messages: ChatMessage[] = [
          {
            role: "assistant",
            content: "Let me help you with that.",
            toolCalls: [
              {
                id: "call_xyz",
                type: "function",
                function: {
                  name: "some_tool",
                  arguments: "{}",
                },
              },
            ],
            metadata: { responsesOutputItemId: "fc_xyz" },
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        const functionCalls = getFunctionCalls(result);
        const assistantMessages = getMessagesByRole(result, "assistant");

        expect(functionCalls.length).toBe(1);
        expect(assistantMessages.length).toBe(1);
        expect(assistantMessages[0].content).toBe("Let me help you with that.");
      });
    });

    describe("function_call_output handling", () => {
      it("should emit function_call_output for tool role messages", () => {
        const messages: ChatMessage[] = [
          {
            role: "tool",
            content: '{"files": ["a.txt", "b.txt"]}',
            toolCallId: "call_abc123",
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        const outputs = getFunctionCallOutputs(result);
        expect(outputs.length).toBe(1);
        expect(outputs[0].call_id).toBe("call_abc123");
      });
    });

    // Complete conversation flow tests (moved out of describe block to reduce nesting)
    it("should handle full tool call cycle with fc_ IDs", () => {
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: "List files",
        },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_list",
              type: "function",
              function: {
                name: "list_files",
                arguments: "{}",
              },
            },
          ],
          metadata: { responsesOutputItemId: "fc_list" },
        } as ChatMessage,
        {
          role: "tool",
          content: '["file1.txt", "file2.txt"]',
          toolCallId: "call_list",
        } as ChatMessage,
      ];

      const result = toResponsesInput(messages);

      const userMsgs = getMessagesByRole(result, "user");
      const functionCalls = getFunctionCalls(result);
      const functionOutputs = getFunctionCallOutputs(result);

      expect(userMsgs.length).toBe(1);
      expect(functionCalls.length).toBe(1);
      expect(functionOutputs.length).toBe(1);

      expect(functionCalls[0].id).toBe("fc_list");
      expect(functionCalls[0].call_id).toBe("call_list");
      expect(functionOutputs[0].call_id).toBe("call_list");
    });

    it("should handle parallel tool calls merged into ONE message with responsesOutputItemIds array", () => {
      // This is the REAL scenario: streaming parallel tool calls get merged into
      // ONE ChatMessage with multiple toolCalls and an array of fc_ IDs
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: "Read these 3 files",
        },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_001",
              type: "function",
              function: {
                name: "read_file",
                arguments: '{"path":"test.py"}',
              },
            },
            {
              id: "call_002",
              type: "function",
              function: {
                name: "read_file",
                arguments: '{"path":"test.js"}',
              },
            },
            {
              id: "call_003",
              type: "function",
              function: {
                name: "read_file",
                arguments: '{"path":"test.ts"}',
              },
            },
          ],
          metadata: {
            // Array of fc_ IDs, one per tool call
            responsesOutputItemIds: ["fc_001", "fc_002", "fc_003"],
            responsesOutputItemId: "fc_003", // Also keep last one for backwards compat
          },
        } as ChatMessage,
        // Tool results
        {
          role: "tool",
          content: "# Python code",
          toolCallId: "call_001",
        } as ChatMessage,
        {
          role: "tool",
          content: "// JS code",
          toolCallId: "call_002",
        } as ChatMessage,
        {
          role: "tool",
          content: "// TS code",
          toolCallId: "call_003",
        } as ChatMessage,
      ];

      const result = toResponsesInput(messages);

      const functionCalls = getFunctionCalls(result);
      expect(functionCalls.length).toBe(3);

      // Verify each function_call has correct fc_ ID and call_id
      expect(functionCalls[0].id).toBe("fc_001");
      expect(functionCalls[0].call_id).toBe("call_001");
      expect(functionCalls[1].id).toBe("fc_002");
      expect(functionCalls[1].call_id).toBe("call_002");
      expect(functionCalls[2].id).toBe("fc_003");
      expect(functionCalls[2].call_id).toBe("call_003");

      const functionOutputs = getFunctionCallOutputs(result);
      expect(functionOutputs.length).toBe(3);
    });

    it("should handle 3 parallel tool calls when each has its own fc_ ID (separate messages)", () => {
      // Legacy scenario: Each function_call from OpenAI creates a separate ChatMessage
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: "Read these 3 files",
        },
        // First tool call
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_001",
              type: "function",
              function: {
                name: "read_file",
                arguments: '{"path":"test.py"}',
              },
            },
          ],
          metadata: { responsesOutputItemId: "fc_001" },
        } as ChatMessage,
        // Second tool call
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_002",
              type: "function",
              function: {
                name: "read_file",
                arguments: '{"path":"test.js"}',
              },
            },
          ],
          metadata: { responsesOutputItemId: "fc_002" },
        } as ChatMessage,
        // Third tool call
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "call_003",
              type: "function",
              function: {
                name: "read_file",
                arguments: '{"path":"test.ts"}',
              },
            },
          ],
          metadata: { responsesOutputItemId: "fc_003" },
        } as ChatMessage,
        // Tool results
        {
          role: "tool",
          content: "# Python code",
          toolCallId: "call_001",
        } as ChatMessage,
        {
          role: "tool",
          content: "// JS code",
          toolCallId: "call_002",
        } as ChatMessage,
        {
          role: "tool",
          content: "// TS code",
          toolCallId: "call_003",
        } as ChatMessage,
      ];

      const result = toResponsesInput(messages);

      const functionCalls = getFunctionCalls(result);
      expect(functionCalls.length).toBe(3);

      const fcIds = functionCalls.map((fc) => fc.id);
      expect(fcIds).toContain("fc_001");
      expect(fcIds).toContain("fc_002");
      expect(fcIds).toContain("fc_003");

      const functionOutputs = getFunctionCallOutputs(result);
      expect(functionOutputs.length).toBe(3);
    });

    describe("edge cases", () => {
      it("should handle empty messages array", () => {
        const result = toResponsesInput([]);
        expect(result).toEqual([]);
      });

      it("should handle assistant message with empty toolCalls array", () => {
        const messages: ChatMessage[] = [
          {
            role: "assistant",
            content: "No tools needed",
            toolCalls: [],
            metadata: { responsesOutputItemId: "fc_empty" },
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        const functionCalls = getFunctionCalls(result);
        expect(functionCalls.length).toBe(0);

        // Should emit as regular message instead
        const assistantMessages = getMessagesByRole(result, "assistant");
        expect(assistantMessages.length).toBe(1);
      });

      it("should handle assistant message with undefined metadata", () => {
        const messages: ChatMessage[] = [
          {
            role: "assistant",
            content: "Hello",
            toolCalls: [
              {
                id: "call_test",
                type: "function",
                function: {
                  name: "test_tool",
                  arguments: "{}",
                },
              },
            ],
            // metadata is undefined
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        // Should not emit function_call without fc_ ID
        const functionCalls = getFunctionCalls(result);
        expect(functionCalls.length).toBe(0);
      });

      it("should handle more toolCalls than responsesOutputItemIds", () => {
        const messages: ChatMessage[] = [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_001",
                type: "function",
                function: { name: "tool1", arguments: "{}" },
              },
              {
                id: "call_002",
                type: "function",
                function: { name: "tool2", arguments: "{}" },
              },
              {
                id: "call_003",
                type: "function",
                function: { name: "tool3", arguments: "{}" },
              },
            ],
            metadata: {
              // Only 2 IDs for 3 tool calls
              responsesOutputItemIds: ["fc_001", "fc_002"],
            },
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        // Should only emit 2 function_calls (matching the available IDs)
        const functionCalls = getFunctionCalls(result);
        expect(functionCalls.length).toBe(2);
        expect(functionCalls[0].id).toBe("fc_001");
        expect(functionCalls[1].id).toBe("fc_002");
      });

      it("should handle toolCall with missing function name", () => {
        const messages: ChatMessage[] = [
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_001",
                type: "function",
                function: { name: "", arguments: "{}" }, // Empty name
              },
            ],
            metadata: { responsesOutputItemIds: ["fc_001"] },
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        // Should skip tool calls with empty name
        const functionCalls = getFunctionCalls(result);
        expect(functionCalls.length).toBe(0);
      });

      it("should handle user message with various content types", () => {
        const messages: ChatMessage[] = [
          { role: "user", content: "Simple string" },
          {
            role: "user",
            content: [{ type: "text", text: "Array content" }],
          } as ChatMessage,
        ];

        const result = toResponsesInput(messages);

        const userMessages = getMessagesByRole(result, "user");
        expect(userMessages.length).toBe(2);
      });

      it("should handle system message (converted to developer role)", () => {
        const messages: ChatMessage[] = [
          { role: "system", content: "You are a helpful assistant" },
        ];

        const result = toResponsesInput(messages);

        const devMessages = getMessagesByRole(result, "developer");
        expect(devMessages.length).toBe(1);
      });
    });
  });
});
