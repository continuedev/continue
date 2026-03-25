import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/index";

import { OpenAIConfig } from "../types.js";
import { OpenAIApi } from "./OpenAI.js";
import { applyAnthropicCachingToOpenRouterBody } from "./OpenRouterCaching.js";

export interface OpenRouterConfig extends OpenAIConfig {
  cachingStrategy?: import("./AnthropicCachingStrategies.js").CachingStrategyName;
}

/**
 * Extract detailed error info from OpenRouter API errors.
 * OpenRouter often nests useful details in error.metadata.raw
 * that the OpenAI SDK doesn't surface.
 */
function enrichOpenRouterError(e: any): Error {
  const metadata = e?.error?.metadata?.raw;
  const providerName = e?.error?.metadata?.provider_name;
  const baseMessage = e?.message ?? String(e);

  const parts = [baseMessage];
  if (providerName) {
    parts.push(`Provider: ${providerName}`);
  }
  if (metadata && typeof metadata === "string" && !baseMessage.includes(metadata)) {
    parts.push(`Details: ${metadata}`);
  }

  const enriched = new Error(parts.join(" | "));
  enriched.name = e?.name ?? "OpenRouterError";
  return enriched;
}

export class OpenRouterApi extends OpenAIApi {
  constructor(config: OpenRouterConfig) {
    super({
      ...config,
      apiBase: config.apiBase ?? "https://openrouter.ai/api/v1/",
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

  override async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    try {
      return await super.chatCompletionNonStream(body, signal);
    } catch (e: any) {
      throw enrichOpenRouterError(e);
    }
  }

  override async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    try {
      for await (const chunk of super.chatCompletionStream(body, signal)) {
        yield chunk;
      }
    } catch (e: any) {
      throw enrichOpenRouterError(e);
    }
  }
}

export default OpenRouterApi;
