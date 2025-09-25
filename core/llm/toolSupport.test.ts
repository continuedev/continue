// core/llm/toolSupport.test.ts
import { PROVIDER_TOOL_SUPPORT } from "./toolSupport";

describe("PROVIDER_TOOL_SUPPORT", () => {
  describe("continue-proxy", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["continue-proxy"];

    it("should return true for Claude 3.5 models", () => {
      expect(
        supportsFn("ownerSlug/packageSlug/anthropic/claude-3-5-sonnet"),
      ).toBe(true);
      expect(
        supportsFn("ownerSlug/packageSlug/anthropic/claude-3.5-sonnet"),
      ).toBe(true);
    });

    it("should return true for Claude 3.7 models", () => {
      expect(
        supportsFn("ownerSlug/packageSlug/anthropic/claude-3-7-haiku"),
      ).toBe(true);
      expect(
        supportsFn("ownerSlug/packageSlug/anthropic/claude-3.7-sonnet"),
      ).toBe(true);
    });

    it("should return true for GPT-4 models", () => {
      expect(supportsFn("ownerSlug/packageSlug/openai/gpt-4-turbo")).toBe(true);
      expect(
        supportsFn("ownerSlug/packageSlug/openai/gpt-4-1106-preview"),
      ).toBe(true);
    });

    it("should return true for Gemma models", () => {
      expect(supportsFn("ownerSlug/packageSlug/openai/gemma")).toBe(true);
      expect(supportsFn("ownerSlug/packageSlug/openai/gemma3")).toBe(true);
    });

    it("should return true for O3 models", () => {
      expect(supportsFn("ownerSlug/packageSlug/openai/o3-preview")).toBe(true);
    });

    it("should return true for Gemini models", () => {
      expect(supportsFn("ownerSlug/packageSlug/gemini/gemini-pro")).toBe(true);
      expect(supportsFn("ownerSlug/packageSlug/gemini/gemini-1.5-pro")).toBe(
        true,
      );
    });

    it("should return false for unsupported models", () => {
      expect(supportsFn("ownerSlug/packageSlug/openai/gpt-3.5-turbo")).toBe(
        false,
      );
      expect(supportsFn("ownerSlug/packageSlug/anthropic/claude-2")).toBe(
        false,
      );
      expect(supportsFn("ownerSlug/packageSlug/together/llama-3")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(
        supportsFn("ownerSlug/packageSlug/anthropic/CLAUDE-3-5-sonnet"),
      ).toBe(true);
      expect(supportsFn("ownerSlug/packageSlug/openai/GPT-4-turbo")).toBe(true);
      expect(supportsFn("ownerSlug/packageSlug/openai/Gemma3")).toBe(true);
      expect(supportsFn("ownerSlug/packageSlug/gemini/GEMINI-pro")).toBe(true);
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
      expect(supportsFn("claude-2")).toBe(false);
      expect(supportsFn("claude-instant")).toBe(false);
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

    it("should return true for Gemma models", () => {
      expect(supportsFn("gemma")).toBe(true);
      expect(supportsFn("gemma3")).toBe(true);
    });

    it("should return undefined for unsupported models", () => {
      expect(supportsFn("gpt-3.5-turbo")).toBe(false);
      expect(supportsFn("davinci")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("GPT-4-turbo")).toBe(true);
      expect(supportsFn("O3-preview")).toBe(true);
      expect(supportsFn("Gemma3")).toBe(true);
    });
  });

  describe("cohere", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["cohere"];

    it("should return true for Command models", () => {
      expect(supportsFn("command-r")).toBe(true);
      expect(supportsFn("command-a")).toBe(true);
    });

    it("should return false for other models", () => {
      expect(supportsFn("c4ai-aya-expanse-32b")).toBe(false);
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

    it("should return true for Claude 3.5 Sonnet models", () => {
      expect(supportsFn("anthropic.claude-3-5-sonnet-20240620-v1:0")).toBe(
        true,
      );
      expect(supportsFn("anthropic.claude-3.5-sonnet-20240620-v1:0")).toBe(
        true,
      );
    });

    it("should return true for Claude 3.7 Sonnet models", () => {
      expect(supportsFn("anthropic.claude-3-7-sonnet-20240620-v1:0")).toBe(
        true,
      );
      expect(supportsFn("anthropic.claude-3.7-sonnet-20240620-v1:0")).toBe(
        true,
      );
    });

    it("should return undefined for Claude Haiku and Opus models", () => {
      expect(supportsFn("anthropic.claude-3-5-haiku-20240307-v1:0")).toBe(
        false,
      );
      expect(supportsFn("anthropic.claude-3.5-haiku-20240620-v1:0")).toBe(
        false,
      );
      expect(supportsFn("anthropic.claude-3-7-haiku-20240620-v1:0")).toBe(
        false,
      );
      expect(supportsFn("anthropic.claude-3-5-opus-20240620-v1:0")).toBe(false);
      expect(supportsFn("anthropic.claude-3.7-opus-20240620-v1:0")).toBe(false);
    });

    it("should return undefined for other unsupported models", () => {
      expect(supportsFn("anthropic.claude-instant-v1")).toBe(false);
      expect(supportsFn("anthropic.titan-text-express-v1")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("ANTHROPIC.CLAUDE-3-5-SONNET-20240620-v1:0")).toBe(
        true,
      );
      expect(supportsFn("ANTHROPIC.CLAUDE-3.7-SONNET-20240620-v1:0")).toBe(
        true,
      );
    });
  });

  describe("mistral", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["mistral"];

    it("should return true for supported models", () => {
      expect(supportsFn("mistral-large-latest")).toBe(true);
      expect(supportsFn("mistral-small-latest")).toBe(true);
      expect(supportsFn("codestral-latest")).toBe(true);
      expect(supportsFn("ministral-8b-latest")).toBe(true);
      expect(supportsFn("ministral-3b-latest")).toBe(true);
      expect(supportsFn("pixtral-12b-2409")).toBe(true);
      expect(supportsFn("pixtral-large-latest")).toBe(true);
      expect(supportsFn("open-mistral-nemo")).toBe(true);
      expect(supportsFn("devstral-latest")).toBe(true);
    });

    it("should return false for other unsupported models", () => {
      expect(supportsFn("mistral-saba-latest")).toBe(false);
      expect(supportsFn("mistral-embed")).toBe(false);
      expect(supportsFn("mistral-moderation-latest")).toBe(false);
      expect(supportsFn("mistral-ocr-latest")).toBe(false);
      expect(supportsFn("open-codestral-mamba")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("MISTRAL-LARGE-LATEST")).toBe(true);
      expect(supportsFn("CODESTRAL-LATEST")).toBe(true);
      expect(supportsFn("MINISTRAL-8B-LATEST")).toBe(true);
      expect(supportsFn("PIXTRAL-12B-2409")).toBe(true);
      expect(supportsFn("DEVSTRAL-LATEST")).toBe(true);
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
      expect(supportsFn("command-a")).toBe(true);
      expect(supportsFn("smollm2")).toBe(true);
      expect(supportsFn("hermes3")).toBe(true);
      expect(supportsFn("athene-v2")).toBe(true);
      expect(supportsFn("nemotron-4-340b")).toBe(true);
      expect(supportsFn("llama3-groq")).toBe(true);
      expect(supportsFn("granite3")).toBe(true);
      expect(supportsFn("aya-expanse")).toBe(true);
      expect(supportsFn("firefunction-v2")).toBe(true);
      expect(supportsFn("mistral-7b")).toBe(true);
      expect(supportsFn("devstral-24b")).toBe(true);
    });

    it("should return false for explicitly unsupported models", () => {
      expect(supportsFn("vision")).toBe(false);
      expect(supportsFn("math")).toBe(false);
      expect(supportsFn("guard")).toBe(false);
      expect(supportsFn("mistrallite")).toBe(false);
      expect(supportsFn("mistral-openorca")).toBe(false);
    });

    it("should return undefined for other models", () => {
      expect(supportsFn("llama2")).toBe(false);
      expect(supportsFn("phi-2")).toBe(false);
      expect(supportsFn("falcon")).toBe(false);
    });

    it("should handle case insensitivity", () => {
      expect(supportsFn("LLAMA3.1")).toBe(true);
      expect(supportsFn("MIXTRAL-8x7b")).toBe(true);
      expect(supportsFn("VISION")).toBe(false);
    });
  });

  describe("xAI", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["xAI"];

    it("should return true for Grok-3 models", () => {
      expect(supportsFn("grok-3")).toBe(true);
      expect(supportsFn("grok-3-mini")).toBe(true);
      expect(supportsFn("grok-3-fast")).toBe(true);
    });

    it("should return true for Grok-4 models", () => {
      expect(supportsFn("grok-4")).toBe(true);
      expect(supportsFn("grok-4-fast-non-reasoning")).toBe(true);
      expect(supportsFn("grok-4-fast-reasoning")).toBe(true);
      expect(supportsFn("Grok-4-Fast")).toBe(true);
    });
  });

  describe("novita", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["novita"];

    it("should return true for exact match models", () => {
      expect(supportsFn("deepseek/deepseek-r1-0528")).toBe(true);
      expect(supportsFn("deepseek/deepseek-r1-turbo")).toBe(true);
      expect(supportsFn("deepseek/deepseek-v3-0324")).toBe(true);
      expect(supportsFn("deepseek/deepseek-v3-turbo")).toBe(true);
      expect(supportsFn("meta-llama/llama-3.3-70b-instruct")).toBe(true);
      expect(supportsFn("qwen/qwen-2.5-72b-instruct")).toBe(true);
      expect(supportsFn("zai-org/glm-4.5")).toBe(true);
      expect(supportsFn("moonshotai/kimi-k2-instruct")).toBe(true);
    });

    it("should return true for prefix match models", () => {
      expect(supportsFn("qwen/qwen3-235b-a22b-instruct-2507")).toBe(true);
      expect(supportsFn("openai/gpt-oss-20b")).toBe(true);
      expect(supportsFn("openai/gpt-oss-120b")).toBe(true);
    });

    it("should return false for unsupported models", () => {
      expect(supportsFn("deepseek/deepseek-chat")).toBe(false);
      expect(supportsFn("meta-llama/llama-2-7b")).toBe(false);
      expect(supportsFn("qwen/qwen-2.0-7b")).toBe(false);
      expect(supportsFn("openai/gpt-4")).toBe(false);
    });
  });

  describe("openrouter", () => {
    const supportsFn = PROVIDER_TOOL_SUPPORT["openrouter"];

    it("should return false for moonshotai/kimi-k2:free model", () => {
      // This fixes issue #6619
      expect(supportsFn("moonshotai/kimi-k2:free")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty model names", () => {
      expect(PROVIDER_TOOL_SUPPORT["continue-proxy"]("")).toBe(false);
      expect(PROVIDER_TOOL_SUPPORT["anthropic"]("")).toBe(false);
      expect(PROVIDER_TOOL_SUPPORT["openai"]("")).toBe(false);
      expect(PROVIDER_TOOL_SUPPORT["gemini"]("")).toBe(false);
      expect(PROVIDER_TOOL_SUPPORT["bedrock"]("")).toBe(false);
      expect(PROVIDER_TOOL_SUPPORT["ollama"]("")).toBe(false);
      expect(PROVIDER_TOOL_SUPPORT["novita"]("")).toBe(false);
    });

    it("should handle non-existent provider", () => {
      // @ts-ignore - Testing runtime behavior with invalid provider
      expect(PROVIDER_TOOL_SUPPORT["non-existent"]).toBe(undefined);
    });
  });
});
