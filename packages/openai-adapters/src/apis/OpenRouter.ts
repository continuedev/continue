import { ChatCompletionCreateParams } from "openai/resources/index";

import { OpenAIConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";
import { applyAnthropicCachingToOpenRouterBody } from "./OpenRouterCaching.js";

export interface OpenRouterConfig extends OpenAIConfig {
  cachingStrategy?: import("./AnthropicCachingStrategies.js").CachingStrategyName;
}

// TODO: Extract detailed error info from OpenRouter's error.metadata.raw to surface better messages

const OPENROUTER_HEADERS: Record<string, string> = {
  "HTTP-Referer": "https://www.continue.dev/",
  "X-Title": "Continue",
};

export class OpenRouterApi extends OpenAIApi {
  constructor(config: OpenRouterConfig) {
    super({
      ...config,
      apiBase: config.apiBase ?? "https://openrouter.ai/api/v1/",
      requestOptions: {
        ...config.requestOptions,
        headers: {
          ...OPENROUTER_HEADERS,
          ...config.requestOptions?.headers,
        },
      },
    });
  }

  private isAnthropicModel(model?: string): boolean {
    if (!model) {
      return false;
    }
    const modelLower = model.toLowerCase();
    return modelLower.includes("claude");
  }

  override modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    const modifiedBody = super.modifyChatBody(body);

    if (!this.isAnthropicModel(modifiedBody.model)) {
      return modifiedBody;
    }

    applyAnthropicCachingToOpenRouterBody(
      modifiedBody as unknown as ChatCompletionCreateParams,
      (this.config as OpenRouterConfig).cachingStrategy ?? "systemAndTools",
    );

    return modifiedBody;
  }
}

export default OpenRouterApi;
