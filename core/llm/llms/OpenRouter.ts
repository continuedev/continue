import { ChatCompletionCreateParams } from "openai/resources/index";

import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

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

  /**
   * Detect if the model is an Anthropic/Claude model
   */
  private isAnthropicModel(model?: string): boolean {
    if (!model) return false;
    const modelLower = model.toLowerCase();
    return modelLower.includes("claude");
  }

  /**
   * Add cache_control to message content for Anthropic models
   */
  private addCacheControlToContent(content: any, addCaching: boolean): any {
    if (!addCaching) return content;

    if (typeof content === "string") {
      return [
        {
          type: "text",
          text: content,
          cache_control: { type: "ephemeral" },
        },
      ];
    }

    if (Array.isArray(content)) {
      // For array content, add cache_control to the last text item
      return content.map((part, idx) => {
        if (part.type === "text" && idx === content.length - 1) {
          return {
            ...part,
            cache_control: { type: "ephemeral" },
          };
        }
        return part;
      });
    }

    return content;
  }

  /**
   * Override modifyChatBody to add Anthropic caching when appropriate
   */
  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    // First apply parent modifications
    body = super.modifyChatBody(body);

    // Check if we should apply Anthropic caching
    if (
      !this.isAnthropicModel(body.model) ||
      (!this.cacheBehavior && !this.completionOptions.promptCaching)
    ) {
      return body;
    }

    const shouldCacheConversation =
      this.cacheBehavior?.cacheConversation ||
      this.completionOptions.promptCaching;
    const shouldCacheSystemMessage =
      this.cacheBehavior?.cacheSystemMessage ||
      this.completionOptions.promptCaching;

    if (!shouldCacheConversation && !shouldCacheSystemMessage) {
      return body;
    }

    // Follow the same logic as Anthropic.ts: filter out system messages first
    const filteredMessages = body.messages.filter(
      (m: any) => m.role !== "system" && !!m.content,
    );

    // Find the last two user message indices from the filtered array
    const lastTwoUserMsgIndices = filteredMessages
      .map((msg: any, index: number) => (msg.role === "user" ? index : -1))
      .filter((index: number) => index !== -1)
      .slice(-2);

    // Create a mapping from filtered indices to original indices
    let filteredIndex = 0;
    const filteredToOriginalIndexMap: number[] = [];
    body.messages.forEach((msg: any, originalIndex: number) => {
      if (msg.role !== "system" && !!msg.content) {
        filteredToOriginalIndexMap[filteredIndex] = originalIndex;
        filteredIndex++;
      }
    });

    // Modify messages to add cache_control
    body.messages = body.messages.map((message: any, idx) => {
      // Handle system message caching
      if (message.role === "system" && shouldCacheSystemMessage) {
        return {
          ...message,
          content: this.addCacheControlToContent(message.content, true),
        };
      }

      // Handle conversation caching for last two user messages
      // Check if this message's index (in filtered array) is one of the last two user messages
      const filteredIdx = filteredToOriginalIndexMap.indexOf(idx);
      if (
        message.role === "user" &&
        shouldCacheConversation &&
        filteredIdx !== -1 &&
        lastTwoUserMsgIndices.includes(filteredIdx)
      ) {
        return {
          ...message,
          content: this.addCacheControlToContent(message.content, true),
        };
      }

      return message;
    });

    return body;
  }
}

export default OpenRouter;
