import { isModelCapable } from "./modelCapability.js";

describe("isModelCapable", () => {
  describe("OpenAI models", () => {
    test("should consider GPT-4 models as capable", () => {
      expect(isModelCapable("openai", "gpt-4")).toBe(true);
      expect(isModelCapable("openai", "gpt-4-turbo")).toBe(true);
      expect(isModelCapable("openai", "gpt-4-0613")).toBe(true);
    });

    test("should consider GPT-3.5-turbo as capable", () => {
      expect(isModelCapable("openai", "gpt-3.5-turbo")).toBe(true);
      expect(isModelCapable("openai", "gpt-3.5-turbo-16k")).toBe(true);
    });

    test("should consider O-series models as capable", () => {
      expect(isModelCapable("openai", "o1-preview")).toBe(true);
      expect(isModelCapable("openai", "o1-mini")).toBe(true);
      expect(isModelCapable("openai", "o3")).toBe(true);
    });

    test("should consider older GPT-3 models as capable", () => {
      expect(isModelCapable("openai", "gpt-3-davinci")).toBe(true);
      expect(isModelCapable("openai", "gpt-3-curie")).toBe(true);
    });
  });

  describe("Anthropic models", () => {
    test("should consider Claude-3 models as capable", () => {
      expect(isModelCapable("anthropic", "claude-3-opus")).toBe(true);
      expect(isModelCapable("anthropic", "claude-3-sonnet")).toBe(true);
    });

    test("should consider Claude-2 as capable", () => {
      expect(isModelCapable("anthropic", "claude-2")).toBe(true);
      expect(isModelCapable("anthropic", "claude-2.1")).toBe(true);
    });

    test("should consider Claude-1 as capable", () => {
      expect(isModelCapable("anthropic", "claude-1")).toBe(true);
    });
  });

  describe("Google models", () => {
    test("should consider Gemini Pro models as capable", () => {
      expect(isModelCapable("google", "gemini-pro")).toBe(true);
      expect(isModelCapable("gemini", "gemini-ultra")).toBe(true);
    });

    test("should consider PaLM-2 models as not capable", () => {
      expect(isModelCapable("google", "palm-2-chat")).toBe(false);
    });
  });

  describe("Local/Ollama models", () => {
    test("should consider larger models as not capable", () => {
      expect(isModelCapable("ollama", "llama2-70b")).toBe(false);
      expect(isModelCapable("local", "codellama-34b")).toBe(false);
    });

    test("should consider smaller models as less capable", () => {
      expect(isModelCapable("ollama", "llama2-7b")).toBe(false);
      expect(isModelCapable("local", "mistral-7b")).toBe(false);
    });
  });

  describe("Meta/Llama models", () => {
    test("should consider large Llama models as not capable", () => {
      expect(isModelCapable("llama", "llama-2-70b")).toBe(false);
      expect(isModelCapable("meta", "llama-65b")).toBe(false);
    });

    test("should consider small Llama models as less capable", () => {
      expect(isModelCapable("llama", "llama-2-7b")).toBe(false);
      expect(isModelCapable("meta", "llama-13b")).toBe(false);
    });
  });

  describe("Continue Proxy models", () => {
    test("should consider continue-proxy models as not capable", () => {
      expect(isModelCapable("continue-proxy", "any-model")).toBe(false);
    });
  });

  describe("Hugging Face models", () => {
    test("should consider code-specific models as not capable", () => {
      expect(isModelCapable("huggingface", "codellama-instruct")).toBe(false);
      expect(isModelCapable("huggingface", "starcoder-base")).toBe(false);
    });

    test("should consider general chat models as less capable", () => {
      expect(isModelCapable("huggingface", "falcon-7b")).toBe(false);
    });
  });

  describe("Unknown providers", () => {
    test("should default to not capable for unknown providers", () => {
      expect(isModelCapable("unknown-provider", "some-model")).toBe(false);
    });
  });

  describe("Other capable models", () => {
    test("should consider Qwen models as capable", () => {
      expect(isModelCapable("alibaba", "qwen-turbo")).toBe(true);
      expect(isModelCapable("dashscope", "qwen-max")).toBe(true);
    });

    test("should consider Kimi models as capable", () => {
      expect(isModelCapable("moonshot", "kimi-8k")).toBe(true);
      expect(isModelCapable("moonshot", "kimi-32k")).toBe(true);
    });
  });

  describe("Case insensitivity", () => {
    test("should handle different cases correctly", () => {
      expect(isModelCapable("OPENAI", "GPT-4")).toBe(true);
      expect(isModelCapable("OpenAI", "Gpt-4-Turbo")).toBe(true);
      expect(isModelCapable("anthropic", "CLAUDE-3-OPUS")).toBe(true);
    });
  });

  describe("Model property matching", () => {
    test("should consider models capable when model property matches even if name does not", () => {
      // Case where name doesn't match but model property does
      expect(isModelCapable("custom", "some-custom-name", "gpt-4")).toBe(true);
      expect(isModelCapable("custom", "random-name", "claude-3-opus")).toBe(
        true,
      );
      expect(isModelCapable("custom", "xyz", "gemini-pro")).toBe(true);
    });

    test("should consider models capable when name matches even if model property does not", () => {
      // Case where name matches but model property doesn't
      expect(isModelCapable("custom", "gpt-4", "some-internal-id")).toBe(true);
      expect(isModelCapable("custom", "claude-3-opus", "xyz")).toBe(true);
      expect(isModelCapable("custom", "gemini-pro", "random")).toBe(true);
    });

    test("should consider models capable when both name and model match", () => {
      // Case where both match
      expect(isModelCapable("openai", "gpt-4", "gpt-4-turbo")).toBe(true);
      expect(isModelCapable("anthropic", "claude-3", "claude-3-opus")).toBe(
        true,
      );
    });

    test("should consider models not capable when neither name nor model match", () => {
      // Case where neither matches
      expect(isModelCapable("custom", "llama-7b", "local-model")).toBe(false);
      expect(isModelCapable("custom", "falcon-7b", "random-model")).toBe(false);
    });
  });
});
