// core/llm/toolSupport.test.ts
import { PROVIDER_TOOL_SUPPORT } from "./toolSupport";

describe("PROVIDER_TOOL_SUPPORT", () => {
  describe("continue-proxy", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["continue-proxy"];

    it("should return true for Claude 3.5 models", () => {
      expect(supportsFn("claude-3-5-sonnet")).toBe(true);
      expect(supportsFn("claude-3.5-sonnet")).toBe(true);
    });

    it("should return true for Claude 3.7 models", () => {
      expect(supportsFn("claude-3-7-haiku")).toBe(true);
      expect(supportsFn("claude-3.7-sonnet")).toBe(true);
    });

    it("should return true for GPT-4 models", () => {
      expect(supportsFn("gpt-4-turbo")).toBe(true);
      expect(supportsFn("gpt-4-1106-preview")).toBe(true);
    });

    it("should return true for O3 models", () => {
      expect(supportsFn("o3-preview")).toBe(true);
    });

    it("should return true for Gemini models", () => {
      expect(supportsFn("gemini-pro")).toBe(true);
      expect(supportsFn("gemini-1.5-pro")).toBe(true);
    });

    it("should return false for unsupported models", () => {
      expect(supportsFn("gpt-3.5-turbo")).toBe(false);
      expect(supportsFn("claude-2")).toBe(false);
      expect(supportsFn("llama-3")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("CLAUDE-3-5-sonnet")).toBe(true);
      expect(supportsFn("GPT-4-turbo")).toBe(true);
      expect(supportsFn("GEMINI-pro")).toBe(true);
    });
  });

  describe("anthropic", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["anthropic"];

    it("should return true for Claude 3.5 models", () => {
      expect(supportsFn("claude-3-5-sonnet")).toBe(true);
      expect(supportsFn("claude-3.5-haiku")).toBe(true);
    });

    it("should return true for Claude 3.7 models", () => {
      expect(supportsFn("claude-3-7-haiku")).toBe(true);
      expect(supportsFn("claude-3.7-sonnet")).toBe(true);
    });

    it("should return undefined for unsupported models", () => {
      expect(supportsFn("claude-2")).toBeUndefined();
      expect(supportsFn("claude-instant")).toBeUndefined();
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("CLAUDE-3-5-sonnet")).toBe(true);
      expect(supportsFn("CLAUDE-3.7-haiku")).toBe(true);
    });
  });

  describe("openai", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["openai"];

    it("should return true for GPT-4 models", () => {
      expect(supportsFn("gpt-4")).toBe(true);
      expect(supportsFn("gpt-4-turbo")).toBe(true);
      expect(supportsFn("gpt-4-1106-preview")).toBe(true);
    });

    it("should return true for O3 models", () => {
      expect(supportsFn("o3")).toBe(true);
      expect(supportsFn("o3-preview")).toBe(true);
    });

    it("should return undefined for unsupported models", () => {
      expect(supportsFn("gpt-3.5-turbo")).toBeUndefined();
      expect(supportsFn("davinci")).toBeUndefined();
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("GPT-4-turbo")).toBe(true);
      expect(supportsFn("O3-preview")).toBe(true);
    });
  });

  describe("gemini", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["gemini"];

    it("should return true for all Gemini models", () => {
      expect(supportsFn("gemini-pro")).toBe(true);
      expect(supportsFn("gemini-1.5-pro")).toBe(true);
      expect(supportsFn("gemini-ultra")).toBe(true);
    });

    it("should return false for non-Gemini models", () => {
      expect(supportsFn("gpt-4")).toBe(false);
      expect(supportsFn("claude-3")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("GEMINI-pro")).toBe(true);
      expect(supportsFn("Gemini-1.5-Pro")).toBe(true);
    });
  });

  describe("bedrock", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["bedrock"];

    it("should return true for Claude 3.5 models", () => {
      expect(supportsFn("anthropic.claude-3-5-sonnet-20240620-v1:0")).toBe(true);
      expect(supportsFn("amazon.claude-3.5-sonnet-20240620-v1:0")).toBe(true);
    });

    it("should return true for Claude 3.7 models", () => {
      expect(supportsFn("anthropic.claude-3-7-haiku-20240620-v1:0")).toBe(true);
      expect(supportsFn("amazon.claude-3.7-sonnet-20240620-v1:0")).toBe(true);
    });

    it("should return undefined for unsupported models", () => {
      expect(supportsFn("anthropic.claude-instant-v1")).toBeUndefined();
      expect(supportsFn("amazon.titan-text-express-v1")).toBeUndefined();
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("ANTHROPIC.CLAUDE-3-5-sonnet-20240620-v1:0")).toBe(true);
      expect(supportsFn("AMAZON.CLAUDE-3.7-haiku-20240620-v1:0")).toBe(true);
    });
  });

  describe("ollama", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["ollama"];

    it("should return true for supported models", () => {
      expect(supportsFn("llama3.1")).toBe(true);
      expect(supportsFn("llama3.2-8b")).toBe(true);
      expect(supportsFn("llama3.3-70b")).toBe(true);
      expect(supportsFn("qwen2")).toBe(true);
      expect(supportsFn("mixtral-8x7b")).toBe(true);
      expect(supportsFn("command-r")).toBe(true);
      expect(supportsFn("smollm2")).toBe(true);
      expect(supportsFn("hermes3")).toBe(true);
      expect(supportsFn("athene-v2")).toBe(true);
      expect(supportsFn("nemotron-4-340b")).toBe(true);
      expect(supportsFn("llama3-groq")).toBe(true);
      expect(supportsFn("granite3")).toBe(true);
      expect(supportsFn("aya-expanse")).toBe(true);
      expect(supportsFn("firefunction-v2")).toBe(true);
      expect(supportsFn("mistral-7b")).toBe(true);
    });

    it("should return false for explicitly unsupported models", () => {
      expect(supportsFn("vision")).toBe(false);
      expect(supportsFn("math")).toBe(false);
      expect(supportsFn("guard")).toBe(false);
      expect(supportsFn("mistrallite")).toBe(false);
      expect(supportsFn("mistral-openorca")).toBe(false);
    });

    it("should return undefined for other models", () => {
      expect(supportsFn("llama2")).toBeUndefined();
      expect(supportsFn("phi-2")).toBeUndefined();
      expect(supportsFn("falcon")).toBeUndefined();
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("LLAMA3.1")).toBe(true);
      expect(supportsFn("MIXTRAL-8x7b")).toBe(true);
      expect(supportsFn("VISION")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty model names", () => {
      expect(PROVIDER_TOOL_SUPPORT["continue-proxy"]("")).toBe(false);
      expect(PROVIDER_TOOL_SUPPORT["anthropic"]("")).toBeUndefined();
      expect(PROVIDER_TOOL_SUPPORT["openai"]("")).toBeUndefined();
      expect(PROVIDER_TOOL_SUPPORT["gemini"]("")).toBe(false);
      expect(PROVIDER_TOOL_SUPPORT["bedrock"]("")).toBeUndefined();
      expect(PROVIDER_TOOL_SUPPORT["ollama"]("")).toBeUndefined();
    });

    it("should handle non-existent provider", () => {
      // @ts-ignore - Testing runtime behavior with invalid provider
      expect(PROVIDER_TOOL_SUPPORT["non-existent"]).toBeUndefined();
    });
  });
});
