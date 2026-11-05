import { ChatCompletionCreateParams } from "openai/resources/index";

import { OPENROUTER_HEADERS } from "@continuedev/openai-adapters";

import { CompletionOptions, LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";
import { resolvePromptCacheTtl } from "./anthropicCache.js";
import { anthropicStyleCacheTtl } from "./bedrockHelpers.js";
import { applyCacheControlToOpenAIBody } from "./openaiCacheControl.js";

class OpenRouter extends OpenAI {
  static providerName = "openrouter";
  protected supportsReasoningField = true;
  protected supportsReasoningDetailsField = true;
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://openrouter.ai/api/v1/",
    model: "gpt-4o-mini",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };

  constructor(options: LLMOptions) {
    super({
      ...options,
      requestOptions: {
        ...options.requestOptions,
        headers: {
          ...OPENROUTER_HEADERS,
          ...options.requestOptions?.headers,
        },
      },
    });
  }

  private isAnthropicModel(model?: string): boolean {
    if (!model) return false;
    const modelLower = model.toLowerCase();
    return modelLower.includes("claude");
  }

  private isGeminiModel(model?: string): boolean {
    if (!model) return false;
    return model.toLowerCase().startsWith("google/");
  }

  /**
   * Add thought_signature fallback to Gemini tool calls that don't already
   * have one, preventing 400 errors from missing thought_signature.
   * See: https://ai.google.dev/gemini-api/docs/thought-signatures
   */
  private addGeminiThoughtSignatures(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    body.messages = body.messages.map((message: any) => {
      if (message.role === "assistant" && message.tool_calls?.length) {
        return {
          ...message,
          tool_calls: message.tool_calls.map((toolCall: any, index: number) => {
            if (index !== 0) return toolCall;
            if (toolCall.extra_content?.google?.thought_signature) {
              return toolCall;
            }
            return {
              ...toolCall,
              extra_content: {
                ...toolCall.extra_content,
                google: {
                  ...toolCall.extra_content?.google,
                  thought_signature: "skip_thought_signature_validator",
                },
              },
            };
          }),
        };
      }
      return message;
    });
    return body;
  }

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
    options?: CompletionOptions,
  ): ChatCompletionCreateParams {
    body = super.modifyChatBody(body);

    if (this.isGeminiModel(body.model)) {
      body = this.addGeminiThoughtSignatures(body);
    }

    // The request's own setting (for example from the toolbar) wins over the
    // model's configured default; an explicit false turns caching off.
    const promptCaching =
      options?.promptCaching ?? this.completionOptions.promptCaching;

    if (
      !this.isAnthropicModel(body.model) ||
      promptCaching === false ||
      (!this.cacheBehavior && !promptCaching)
    ) {
      return body;
    }

    const shouldCacheConversation =
      this.cacheBehavior?.cacheConversation || promptCaching;
    const shouldCacheSystemMessage =
      this.cacheBehavior?.cacheSystemMessage || promptCaching;

    // Anthropic-style cache_control, including ttl, is passed through to Claude
    // models. The 1-hour lifetime is sent only for models known to take it
    // (Claude 3.x models are 5 minutes only); otherwise the field is omitted.
    const ttl = anthropicStyleCacheTtl(
      body.model,
      resolvePromptCacheTtl(options?.promptCacheTtl, this.cacheBehavior?.ttl),
    );

    if (!shouldCacheConversation && !shouldCacheSystemMessage) {
      return body;
    }

    return applyCacheControlToOpenAIBody(body, {
      system: !!shouldCacheSystemMessage,
      conversation: !!shouldCacheConversation,
      ttl,
    });
  }
}

export default OpenRouter;
