import { ChatCompletion, ChatCompletionChunk } from "openai/resources/chat/completions";
import { fromChatCompletionChunk, fromChatResponse } from "./openaiTypeConverters";

describe("OpenAI Type Converters - Reasoning Support", () => {
  describe("fromChatResponse", () => {
    it("should handle response with reasoning field", () => {
      const mockResponse: ChatCompletion = {
        id: "test-id",
        object: "chat.completion",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "This is the response content",
              refusal: null,
              // @ts-ignore - reasoning field is not in OpenAI types yet
              reasoning: "This is the internal reasoning",
            },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      const result = fromChatResponse(mockResponse);

      expect(result).toEqual({
        role: "assistant",
        content: "This is the response content",
        reasoning: "This is the internal reasoning",
      });
    });

    it("should handle response without reasoning field", () => {
      const mockResponse: ChatCompletion = {
        id: "test-id",
        object: "chat.completion",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "This is the response content",
              refusal: null,
            },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      const result = fromChatResponse(mockResponse);

      expect(result).toEqual({
        role: "assistant",
        content: "This is the response content",
        reasoning: undefined,
      });
    });

    it("should handle response with tool calls and reasoning", () => {
      const mockResponse: ChatCompletion = {
        id: "test-id",
        object: "chat.completion",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "",
              refusal: null,
              tool_calls: [
                {
                  id: "tool-call-id",
                  type: "function",
                  function: {
                    name: "test_function",
                    arguments: '{"param": "value"}',
                  },
                },
              ],
              // @ts-ignore - reasoning field is not in OpenAI types yet
              reasoning: "I need to call this function to help the user",
            },
            finish_reason: "tool_calls",
            logprobs: null,
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      const result = fromChatResponse(mockResponse);

      expect(result).toEqual({
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool-call-id",
            type: "function",
            function: {
              name: "test_function",
              arguments: '{"param": "value"}',
            },
          },
        ],
        reasoning: "I need to call this function to help the user",
      });
    });
  });

  describe("fromChatCompletionChunk", () => {
    it("should handle chunk with content only", () => {
      const mockChunk: ChatCompletionChunk = {
        id: "test-id",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            delta: {
              content: "Hello world",
            },
            finish_reason: null,
          },
        ],
      };

      const result = fromChatCompletionChunk(mockChunk);

      expect(result).toEqual({
        role: "assistant",
        content: "Hello world",
        toolCalls: undefined,
        reasoning: undefined,
      });
    });

    it("should handle chunk with reasoning only", () => {
      const mockChunk: ChatCompletionChunk = {
        id: "test-id",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            delta: {
              // @ts-ignore - reasoning field is not in OpenAI types yet
              reasoning: "I'm thinking about this...",
            },
            finish_reason: null,
          },
        ],
      };

      const result = fromChatCompletionChunk(mockChunk);

      expect(result).toEqual({
        role: "assistant",
        content: "",
        toolCalls: undefined,
        reasoning: "I'm thinking about this...",
      });
    });

    it("should handle chunk with both content and reasoning", () => {
      const mockChunk: ChatCompletionChunk = {
        id: "test-id",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            delta: {
              content: "The answer is 42",
              // @ts-ignore - reasoning field is not in OpenAI types yet
              reasoning: "Let me calculate this step by step",
            },
            finish_reason: null,
          },
        ],
      };

      const result = fromChatCompletionChunk(mockChunk);

      expect(result).toEqual({
        role: "assistant",
        content: "The answer is 42",
        toolCalls: undefined,
        reasoning: "Let me calculate this step by step",
      });
    });

    it("should handle chunk with tool calls and reasoning", () => {
      const mockChunk: ChatCompletionChunk = {
        id: "test-id",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            delta: {
              content: "",
              tool_calls: [
                {
                  index: 0,
                  id: "tool-call-id",
                  type: "function",
                  function: {
                    name: "search_function",
                    arguments: '{"query": "test"}',
                  },
                },
              ],
              // @ts-ignore - reasoning field is not in OpenAI types yet
              reasoning: "I should search for this information",
            },
            finish_reason: null,
          },
        ],
      };

      const result = fromChatCompletionChunk(mockChunk);

      expect(result).toEqual({
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool-call-id",
            type: "function",
            function: {
              name: "search_function",
              arguments: '{"query": "test"}',
            },
          },
        ],
        reasoning: "I should search for this information",
      });
    });

    it("should return undefined for chunk with no content, tool_calls, or reasoning", () => {
      const mockChunk: ChatCompletionChunk = {
        id: "test-id",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            delta: {
              role: "assistant",
            },
            finish_reason: null,
          },
        ],
      };

      const result = fromChatCompletionChunk(mockChunk);

      expect(result).toBeUndefined();
    });

    it("should return undefined for chunk with no choices", () => {
      const mockChunk: ChatCompletionChunk = {
        id: "test-id",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4o",
        choices: [],
      };

      const result = fromChatCompletionChunk(mockChunk);

      expect(result).toBeUndefined();
    });

    it("should return undefined for chunk with no delta", () => {
      const mockChunk: ChatCompletionChunk = {
        id: "test-id",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: "gpt-4o",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: null,
          },
        ],
      };

      const result = fromChatCompletionChunk(mockChunk);

      expect(result).toBeUndefined();
    });
  });
});