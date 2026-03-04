import {
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from "openai/resources";
import { describe, expect, it } from "vitest";
import type {
  ChatCompletionCreateParamsExt,
  OpenAICompatibleMessage,
} from "../util/deepseek-converters.js";
import {
  convertToChatDeepSeekRequestBody,
  prepareMessage,
  validateAndFilterContent,
  validateAndFilterTools,
  validateAndPrepareMessages,
  validateResponseFormat,
  validateToolChoice,
} from "../util/deepseek-converters.js";
import type { DeepSeekMessage, DeepSeekTool } from "../util/deepseek-types.js";

describe("DeepSeek Converters", () => {
  describe("validateAndPrepareMessages", () => {
    it("should ensure reasoning_content is defined for assistant messages after last user message in reasoning mode", () => {
      const warnings: string[] = [];
      const messages: OpenAICompatibleMessage[] = [
        { role: "user", content: "Hello" },
        {
          role: "assistant",
          content: "Hi",
          reasoning_content: "I should greet back",
        },
        { role: "user", content: "What's the weather?" },
        // Assistant with tool calls but no reasoning_content - should get empty string
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "get_weather", arguments: '{"city":"Berlin"}' },
            },
          ],
        },
        { role: "tool", content: '{"temp":20}', tool_call_id: "call_1" },
        // Another assistant with reasoning_content already defined
        {
          role: "assistant",
          content: "It's 20 degrees",
          reasoning_content: "I need to summarize the weather",
        },
      ];

      const result = validateAndPrepareMessages(messages, warnings, true);

      // Find assistant messages after last user message (index 2)
      // The assistant with tool calls should have reasoning_content = ""
      const assistantWithToolCalls = result.find(
        (msg: DeepSeekMessage) =>
          msg.role === "assistant" && msg.tool_calls?.length,
      );
      expect(assistantWithToolCalls?.reasoning_content).toBe("");

      // Assistant with existing reasoning_content should keep it
      const assistantWithReasoning = result.find(
        (msg: DeepSeekMessage) =>
          msg.role === "assistant" && msg.content === "It's 20 degrees",
      );
      expect(assistantWithReasoning?.reasoning_content).toBe(
        "I need to summarize the weather",
      );

      // Assistant before last user message (first assistant) should NOT have reasoning_content
      // because it's before the last user message boundary
      const firstAssistant = result.find(
        (msg: DeepSeekMessage) =>
          msg.role === "assistant" && msg.content === "Hi",
      );
      expect(firstAssistant?.reasoning_content).toBeUndefined();

      expect(warnings).toEqual([]);
    });

    it("should handle tool call chain without reasoning_content", () => {
      const warnings: string[] = [];
      const messages: OpenAICompatibleMessage[] = [
        { role: "user", content: "Get data" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "api_call", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "data", tool_call_id: "call_1" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call_2",
              type: "function",
              function: { name: "process", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "processed", tool_call_id: "call_2" },
        { role: "assistant", content: "Here is the result" },
      ];

      const result = validateAndPrepareMessages(messages, warnings, true);

      // All assistant messages after last user message should have reasoning_content (empty string)
      const allAssistants = result.filter(
        (msg: DeepSeekMessage) => msg.role === "assistant",
      );
      expect(allAssistants).toHaveLength(3);
      allAssistants.forEach((assistant: DeepSeekMessage) => {
        expect(assistant.reasoning_content).toBe("");
      });

      expect(warnings).toEqual([]);
    });

    it("should not add reasoning_content to assistant messages before last user message", () => {
      const warnings: string[] = [];
      const messages: OpenAICompatibleMessage[] = [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" }, // No reasoning_content
        { role: "user", content: "Second question" },
        {
          role: "assistant",
          content: "Second answer",
          reasoning_content: "Thinking",
        },
      ];

      const result = validateAndPrepareMessages(messages, warnings, true);

      const firstAssistant = result.find(
        (msg: DeepSeekMessage) =>
          msg.role === "assistant" && msg.content === "First answer",
      );
      // This assistant is before last user message (second user), so should NOT get reasoning_content
      expect(firstAssistant?.reasoning_content).toBeUndefined();

      const secondAssistant = result.find(
        (msg: DeepSeekMessage) =>
          msg.role === "assistant" && msg.content === "Second answer",
      );
      // This assistant is after last user message, but already has reasoning_content
      expect(secondAssistant?.reasoning_content).toBe("Thinking");

      expect(warnings).toEqual([]);
    });

    it("should handle system messages as user boundary", () => {
      const warnings: string[] = [];
      const messages: OpenAICompatibleMessage[] = [
        { role: "system", content: "You are a helper" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" }, // No reasoning_content
        { role: "system", content: "Now be concise" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "tool", arguments: "{}" },
            },
          ],
        },
      ];

      const result = validateAndPrepareMessages(messages, warnings, true);

      // Assistant after last system message (which resets boundary) should get reasoning_content for tool calls
      const assistantWithToolCalls = result.find(
        (msg: DeepSeekMessage) =>
          msg.role === "assistant" && msg.tool_calls?.length,
      );
      expect(assistantWithToolCalls?.reasoning_content).toBe("");

      // Assistant before last system message should NOT get reasoning_content
      const firstAssistant = result.find(
        (msg: DeepSeekMessage) =>
          msg.role === "assistant" && msg.content === "Hi",
      );
      expect(firstAssistant?.reasoning_content).toBeUndefined();

      expect(warnings).toEqual([]);
    });

    it("should handle reasoning field (legacy) as reasoning_content", () => {
      const warnings: string[] = [];
      const messages: OpenAICompatibleMessage[] = [
        { role: "user", content: "Test" },
        { role: "assistant", content: "Answer", reasoning: "Legacy reasoning" },
      ];

      const result = validateAndPrepareMessages(messages, warnings, true);

      const assistant = result.find(
        (msg: DeepSeekMessage) => msg.role === "assistant",
      );
      expect(assistant?.reasoning_content).toBe("Legacy reasoning");
      expect(warnings).toEqual([]);
    });

    it("should throw error for empty messages array", () => {
      expect(() => validateAndPrepareMessages([], [], true)).toThrow(
        "Messages array must contain at least one message",
      );
    });

    it("should filter out invalid roles with warning", () => {
      const warnings: string[] = [];
      const messages: any[] = [
        { role: "user", content: "Hi" },
        { role: "invalid", content: "Bad" },
        { role: "assistant", content: "Ok" },
      ];

      const result = validateAndPrepareMessages(messages, warnings, false);
      expect(result).toHaveLength(2);
      expect(result.map((msg: DeepSeekMessage) => msg.role)).toEqual([
        "user",
        "assistant",
      ]);
      expect(warnings).toContain("Invalid message role: invalid at index 1. (removed from request)");
    });
  });

  describe("prepareMessage", () => {
    it("should convert developer role to system", () => {
      const warnings: string[] = [];
      const message: OpenAICompatibleMessage = {
        role: "developer",
        content: "Instructions",
      };

      const result = prepareMessage(message, 0, warnings);
      expect(result?.role).toBe("system");
      expect(result?.content).toBe("Instructions");
      expect(warnings).toEqual([]);
    });

    it("should handle tool messages with tool_call_id", () => {
      const warnings: string[] = [];
      const message: OpenAICompatibleMessage = {
        role: "tool",
        content: "result",
        tool_call_id: "call_123",
      };

      const result = prepareMessage(message, 0, warnings);
      expect(result?.role).toBe("tool");
      expect(result?.content).toBe("result");
      expect(result?.tool_call_id).toBe("call_123");
      expect(warnings).toEqual([]);
    });

    it("should filter non-text content with warning", () => {
      const warnings: string[] = [];
      const message: OpenAICompatibleMessage = {
        role: "user",
        content: [
          { type: "text", text: "Hello" },
          { type: "image_url", image_url: { url: "data:image/png" } },
        ],
      };

      const result = prepareMessage(message, 0, warnings);
      expect(result?.content).toEqual([{ type: "text", text: "Hello" }]);
      expect(warnings).toContain("Non-text content parts were filtered out");
    });
  });

  describe("validateAndFilterContent", () => {
    it("should return null for undefined content", () => {
      expect(validateAndFilterContent(undefined)).toBe(null);
    });

    it("should return string content as is", () => {
      expect(validateAndFilterContent("Hello")).toBe("Hello");
    });

    it("should filter array content to text only", () => {
      const warnings: string[] = [];
      const content = [
        { type: "text", text: "Hello" },
        { type: "image_url", image_url: {} },
        { type: "text", text: "World" },
      ];
      const result = validateAndFilterContent(content, warnings);
      expect(result).toEqual([
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ]);
      expect(warnings).toContain("Non-text content parts were filtered out");
    });

    it("should return empty string for array with no text parts", () => {
      const warnings: string[] = [];
      const content = [{ type: "image_url", image_url: {} }];
      const result = validateAndFilterContent(content, warnings);
      expect(result).toBe("");
      expect(warnings).toContain("Non-text content parts were filtered out");
    });
  });

  describe("validateResponseFormat", () => {
    it("should return undefined for invalid type", () => {
      const warnings: string[] = [];
      const result = validateResponseFormat({ type: "invalid" }, warnings);
      expect(result).toBeUndefined();
      expect(warnings).toContain(
        "Invalid response_format.type: invalid. Must be 'text' or 'json_object'.",
      );
    });

    it("should accept text and json_object", () => {
      const warnings: string[] = [];
      expect(validateResponseFormat({ type: "text" }, warnings)).toEqual({
        type: "text",
      });
      expect(validateResponseFormat({ type: "json_object" }, warnings)).toEqual(
        {
          type: "json_object",
        },
      );
      expect(warnings).toEqual([]);
    });
  });

  describe("validateAndFilterTools", () => {
    it("should filter out non-function tools", () => {
      const warnings: string[] = [];
      const tools: any[] = [
        { type: "function", function: { name: "func1" } },
        { type: "retrieval", function: { name: "ret" } },
        { type: "function", function: { name: "func2" } },
      ];
      const result = validateAndFilterTools(
        tools as ChatCompletionTool[],
        warnings,
      );
      expect(result).toHaveLength(2);
      expect(result?.map((t: DeepSeekTool) => t.function.name)).toEqual([
        "func1",
        "func2",
      ]);
      expect(warnings).toContain(
        "DeepSeek API supports only function tools. Ignoring 1 tools.",
      );
    });

    it("should limit to 128 tools", () => {
      const warnings: string[] = [];
      const tools = Array.from({ length: 130 }, (_, i) => ({
        type: "function",
        function: { name: `func${i}` },
      })) as ChatCompletionTool[];
      const result = validateAndFilterTools(tools, warnings);
      expect(result).toHaveLength(128);
      expect(warnings).toContain(
        "DeepSeek API supports maximum 128 tools. Using first 128 and ignoring 2 tools.",
      );
    });
  });

  describe("validateToolChoice", () => {
    it("should accept string values none, auto, required", () => {
      const warnings: string[] = [];
      expect(validateToolChoice("none", warnings)).toBe("none");
      expect(validateToolChoice("auto", warnings)).toBe("auto");
      expect(validateToolChoice("required", warnings)).toBe("required");
      expect(warnings).toEqual([]);
    });

    it("should accept function object", () => {
      const warnings: string[] = [];
      const toolChoice = {
        type: "function" as const,
        function: { name: "specific" },
      };
      const result = validateToolChoice(toolChoice, warnings);
      expect(result).toEqual(toolChoice);
      expect(warnings).toEqual([]);
    });

    it("should warn for invalid string", () => {
      const warnings: string[] = [];
      const result = validateToolChoice(
        "invalid" as ChatCompletionToolChoiceOption,
        warnings,
      );
      expect(result).toBeUndefined();
      expect(warnings).toContain(
        "Unsupported tool_choice value: invalid. Must be one of: 'none', 'auto', 'required'",
      );
    });
  });

  describe("convertToChatDeepSeekRequestBody", () => {
    it("should add thinking field for deepseek-reasoner model", () => {
      const warnings: string[] = [];
      const body = {
        model: "deepseek-reasoner",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      };
      const result = convertToChatDeepSeekRequestBody(
        body as ChatCompletionCreateParamsExt,
        warnings,
      );
      expect(result.thinking).toEqual({ type: "enabled" });
    });

    it("should add thinking field when thinking.enabled is set", () => {
      const warnings: string[] = [];
      const body = {
        model: "deepseek-chat",
        thinking: { type: "enabled" },
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      };
      const result = convertToChatDeepSeekRequestBody(
        body as ChatCompletionCreateParamsExt,
        warnings,
      );
      expect(result.thinking).toEqual({ type: "enabled" });
    });
  });
});
