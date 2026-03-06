import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DeepSeekApi } from "../apis/DeepSeek.js";
import { OpenAIConfigSchema } from "../types.js";

describe("DeepSeekApi - Simple Unit Tests", () => {
  const mockConfig = {
    apiKey: "test-key",
    apiBase: "https://api.deepseek.com/",
  };

  describe("constructor", () => {
    it("should preserve API base URL exactly as provided", () => {
      const api = new DeepSeekApi({
        ...mockConfig,
        apiBase: "https://api.deepseek.com/",
      } as z.infer<typeof OpenAIConfigSchema>);

      // @ts-ignore - accessing private property for test
      expect(api.apiBase).toBe("https://api.deepseek.com/");
    });

    it("should use default API base if not provided", () => {
      const api = new DeepSeekApi({
        apiKey: "test-key",
      } as z.infer<typeof OpenAIConfigSchema>);

      // @ts-ignore
      expect(api.apiBase).toBe("https://api.deepseek.com/");
    });
  });

  describe("hasToolsInConversation", () => {
    it("should detect tools in body.tools", () => {
      const api = new DeepSeekApi(
        mockConfig as z.infer<typeof OpenAIConfigSchema>,
      );
      const body: any = {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Hi" }],
        tools: [{ type: "function", function: { name: "test" } }],
      };

      // @ts-ignore - accessing private method
      const result = api.hasToolsInConversation(body);
      expect(result).toBe(true);
    });

    it("should detect tool_choice", () => {
      const api = new DeepSeekApi(
        mockConfig as z.infer<typeof OpenAIConfigSchema>,
      );
      const body: any = {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Hi" }],
        tool_choice: "auto",
      };

      // @ts-ignore
      const result = api.hasToolsInConversation(body);
      expect(result).toBe(true);
    });

    it("should detect tool_calls in assistant messages", () => {
      const api = new DeepSeekApi(
        mockConfig as z.infer<typeof OpenAIConfigSchema>,
      );
      const body: any = {
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "Hi" },
          {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "1",
                type: "function",
                function: { name: "test", arguments: "{}" },
              },
            ],
          },
        ],
      };

      // @ts-ignore
      const result = api.hasToolsInConversation(body);
      expect(result).toBe(true);
    });

    it("should return false for no tools", () => {
      const api = new DeepSeekApi(
        mockConfig as z.infer<typeof OpenAIConfigSchema>,
      );
      const body: any = {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Hi" }],
      };

      // @ts-ignore
      const result = api.hasToolsInConversation(body);
      expect(result).toBe(false);
    });
  });

  describe("prepareChatCompletionRequest logic", () => {
    it("should use prefix completion for assistant last message without tools", () => {
      const api = new DeepSeekApi(
        mockConfig as z.infer<typeof OpenAIConfigSchema>,
      );
      const body: any = {
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "Complete this" },
          { role: "assistant", content: "I think" },
        ],
      };

      // @ts-ignore - accessing private method
      const result = api.prepareChatCompletionRequest(body);
      expect(result.endpoint.pathname).toContain("beta/chat/completions");
    });

    it("should use regular chat completion with tools", () => {
      const api = new DeepSeekApi(
        mockConfig as z.infer<typeof OpenAIConfigSchema>,
      );
      const body: any = {
        model: "deepseek-chat",
        messages: [
          { role: "user", content: "Use tool" },
          { role: "assistant", content: "I'll use tool" },
        ],
        tools: [{ type: "function", function: { name: "test" } }],
      };

      // @ts-ignore - accessing private method
      const result = api.prepareChatCompletionRequest(body);
      expect(result.endpoint.pathname).toContain("chat/completions");
      expect(result.endpoint.pathname).not.toContain("beta");
    });
  });

  describe("error handling", () => {
    it("_throwDeepSeekError should format error message", async () => {
      const api = new DeepSeekApi(
        mockConfig as z.infer<typeof OpenAIConfigSchema>,
      );
      const mockResponse = {
        status: 429,
        text: async () => "Rate limit exceeded",
      } as Response;

      // @ts-ignore - accessing private method
      await expect(api._throwDeepSeekError(mockResponse)).rejects.toThrow(
        "DeepSeek API error (429): Rate limit exceeded",
      );
    });
  });
});
