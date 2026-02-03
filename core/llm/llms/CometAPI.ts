import { allModelProviders } from "@continuedev/llm-info";
import { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

/**
 * CometAPI-specific error types for better error handling
 */
export class CometAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "CometAPIError";
  }
}

export class CometAPIAuthenticationError extends CometAPIError {
  constructor(message: string = "Invalid CometAPI API key") {
    super(message, "AUTHENTICATION_ERROR", 401);
    this.name = "CometAPIAuthenticationError";
  }
}

export class CometAPIQuotaExceededError extends CometAPIError {
  constructor(message: string = "CometAPI quota exceeded") {
    super(message, "QUOTA_EXCEEDED", 429);
    this.name = "CometAPIQuotaExceededError";
  }
}

/**
 * CometAPI LLM provider - aggregates multiple mainstream models
 * from various providers (GPT, Claude, Gemini, Grok, DeepSeek, Qwen, etc.)
 *
 * Uses OpenAI-compatible API format with bearer token authentication
 */
class CometAPI extends OpenAI {
  static providerName = "cometapi";

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.cometapi.com/v1/",
    model: "gpt-4o-mini", // Default to a commonly available model
  };

  constructor(options: LLMOptions) {
    // Validate required configuration before calling super
    CometAPI.validateConfig(options);
    super(options);

    // Align contextLength with llm-info for cometapi specifically (non-breaking for others)
    try {
      const cometProvider = allModelProviders.find((p) => p.id === "cometapi");
      const info = cometProvider?.models.find((m) =>
        m.regex ? m.regex.test(this.model) : m.model === this.model,
      );
      if (info?.contextLength) {
        // Always prefer cometapi-specific llm-info over generic provider matches
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - accessing protected for targeted fix
        this._contextLength = info.contextLength;
      }
    } catch {
      // no-op: do not fail construction on metadata issues
    }
  }

  /**
   * Validate CometAPI configuration
   */
  private static validateConfig(options: LLMOptions): void {
    // Allow constructing without API key (tests that only instantiate should pass).
    // Enforce credentials at request time instead.
    if (!options.apiKey) {
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
        console.warn(
          "CometAPI: No API key provided. Requests will fail until an API key is configured. Get one at https://api.cometapi.com/console/token",
        );
      }
      return;
    }

    if (options.apiBase && !CometAPI.isValidApiBase(options.apiBase)) {
      throw new CometAPIError(
        `Invalid CometAPI base URL: ${options.apiBase}. Expected https://api.cometapi.com/v1/ or compatible endpoint`,
      );
    }

    if (
      options.model &&
      !CometAPI.isValidModelFormat(options.model) &&
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "test"
    ) {
      console.warn(
        `CometAPI: Model "${options.model}" may not be supported. Check CometAPI documentation for available models.`,
      );
    }
  }

  /**
   * Validate API base URL format
   */
  private static isValidApiBase(apiBase: string): boolean {
    try {
      const url = new URL(apiBase);
      return (
        url.protocol === "https:" &&
        (url.hostname === "api.cometapi.com" ||
          url.hostname.endsWith(".cometapi.com") ||
          apiBase.includes("v1")) // Allow custom compatible endpoints
      );
    } catch {
      return false;
    }
  }

  /**
   * Basic model format validation
   */
  private static isValidModelFormat(model: string): boolean {
    // Allow common model patterns
    const validPatterns = [
      /^gpt-/i,
      /^claude-/i,
      /^gemini-/i,
      /^grok/i,
      /^deepseek/i,
      /^qwen/i,
      /^text-/i,
      /^chat/i,
    ];

    return validPatterns.some((pattern) => pattern.test(model));
  }

  /**
   * Patterns to filter out non-chat models from the model list
   * Based on CometAPI documentation requirements
   */
  private static IGNORE_PATTERNS = [
    // Image generation models
    "dall-e",
    "dalle",
    "midjourney",
    "mj_",
    "stable-diffusion",
    "sd-",
    "flux-",
    "playground-v",
    "ideogram",
    "recraft-",
    "black-forest-labs",
    "/recraft-v3",
    "recraftv3",
    "stability-ai/",
    "sdxl",

    // Audio generation models
    "suno_",
    "tts",
    "whisper",

    // Video generation models
    "runway",
    "luma_",
    "luma-",
    "veo",
    "kling_",
    "minimax_video",
    "hunyuan-t1",

    // Utility models
    "embedding",
    "search-gpts",
    "files_retrieve",
    "moderation",
  ];

  /**
   * Recommended chat models from CometAPI documentation
   */
  private static RECOMMENDED_MODELS = [
    // GPT series
    "gpt-5.1",
    "gpt-5-chat-latest",
    "chatgpt-4o-latest",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4.1",
    "gpt-4o-mini",
    "o4-mini-2025-04-16",
    "o3-pro-2025-06-10",

    // Claude series
    "claude-opus-4-1-20250805",
    "claude-opus-4-1-20250805-thinking",
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-20250514-thinking",
    "claude-3-7-sonnet-latest",
    "claude-3-5-haiku-latest",

    // Gemini series
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",

    // Grok series
    "grok-4-0709",
    "grok-3",
    "grok-3-mini",
    "grok-2-image-1212",

    // DeepSeek series
    "deepseek-v3.1",
    "deepseek-v3",
    "deepseek-r1-0528",
    "deepseek-chat",
    "deepseek-reasoner",

    // Qwen series
    "qwen3-30b-a3b",
    "qwen3-coder-plus-2025-07-22",
  ];

  /**
   * Filter model list to exclude non-chat models
   * Uses pattern matching against model names
   */
  protected filterChatModels(models: any[]): any[] {
    if (!models || !Array.isArray(models)) {
      return [];
    }

    return models.filter((model) => {
      const modelId = model.id || model.model || "";
      const modelName = modelId.toLowerCase();

      // Check if model matches any ignore pattern
      const shouldIgnore = CometAPI.IGNORE_PATTERNS.some((pattern) =>
        modelName.includes(pattern.toLowerCase()),
      );

      return !shouldIgnore;
    });
  }

  /**
   * Get recommended models for CometAPI
   * Returns predefined list since CometAPI model info is limited
   */
  protected getRecommendedModels(): string[] {
    return [...CometAPI.RECOMMENDED_MODELS];
  }

  /**
   * Override listModels method to apply model filtering with enhanced error handling
   */
  async listModels(): Promise<string[]> {
    try {
      const allModels = await super.listModels();
      const filteredModels = this.filterChatModels(
        allModels.map((id) => ({ id })),
      );

      // If filtered list is empty or very limited, return recommended models
      if (filteredModels.length < 5) {
        console.info(
          "CometAPI: Limited models available, using recommended set",
        );
        return this.getRecommendedModels();
      }

      return filteredModels.map((model) => model.id);
    } catch (error: any) {
      // Enhanced error handling with specific error types
      const errorMessage = error?.message || "Unknown error";
      const statusCode = error?.status || error?.statusCode;

      if (statusCode === 401) {
        throw new CometAPIAuthenticationError(
          "CometAPI authentication failed. Please check your API key.",
        );
      } else if (statusCode === 429) {
        throw new CometAPIQuotaExceededError(
          "CometAPI rate limit exceeded. Please try again later.",
        );
      } else if (statusCode >= 400 && statusCode < 500) {
        throw new CometAPIError(
          `CometAPI client error: ${errorMessage}`,
          "CLIENT_ERROR",
          statusCode,
        );
      } else if (statusCode >= 500) {
        console.warn(
          "CometAPI server error, falling back to recommended models:",
          errorMessage,
        );
        return this.getRecommendedModels();
      } else {
        // Network or other errors - fallback gracefully
        console.warn(
          "CometAPI: Failed to fetch model list, using recommended models",
          errorMessage,
        );
        return this.getRecommendedModels();
      }
    }
  }

  /**
   * Override chat completion with enhanced error handling
   */
  protected async *_streamChat(
    messages: any[],
    signal: AbortSignal,
    options: any = {},
  ): AsyncGenerator<any> {
    try {
      yield* super._streamChat(messages, signal, options);
    } catch (error: any) {
      const statusCode = error?.status || error?.statusCode;
      const errorMessage = error?.message || "Unknown error";

      if (statusCode === 401) {
        throw new CometAPIAuthenticationError(
          "CometAPI authentication failed during chat completion",
        );
      } else if (statusCode === 429) {
        throw new CometAPIQuotaExceededError(
          "CometAPI rate limit exceeded during chat completion",
        );
      } else if (
        errorMessage.includes("model") &&
        errorMessage.includes("not found")
      ) {
        throw new CometAPIError(
          `Model "${this.model}" is not available on CometAPI. Please check available models.`,
          "MODEL_NOT_FOUND",
          404,
        );
      } else {
        // Re-throw with more context
        throw new CometAPIError(
          `CometAPI chat completion failed: ${errorMessage}`,
          "COMPLETION_ERROR",
          statusCode,
        );
      }
    }
  }
}

export default CometAPI;
