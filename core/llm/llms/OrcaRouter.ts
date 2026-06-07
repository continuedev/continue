import { ChatCompletionCreateParams } from "openai/resources/index";

import { ORCAROUTER_HEADERS } from "@continuedev/openai-adapters";

import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class OrcaRouter extends OpenAI {
  static providerName = "orcarouter";
  protected supportsReasoningField = true;
  protected supportsReasoningDetailsField = true;
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.orcarouter.ai/v1/",
    model: "orcarouter/auto",
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
          ...ORCAROUTER_HEADERS,
          ...options.requestOptions?.headers,
        },
      },
    });
  }

  private isAnthropicModel(model?: string): boolean {
    if (!model) return false;
    return model.toLowerCase().includes("claude");
  }

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

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    body = super.modifyChatBody(body);

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

    const filteredMessages = body.messages.filter(
      (m: any) => m.role !== "system" && !!m.content,
    );

    const lastTwoUserMsgIndices = filteredMessages
      .map((msg: any, index: number) => (msg.role === "user" ? index : -1))
      .filter((index: number) => index !== -1)
      .slice(-2);

    let filteredIndex = 0;
    const filteredToOriginalIndexMap: number[] = [];
    body.messages.forEach((msg: any, originalIndex: number) => {
      if (msg.role !== "system" && !!msg.content) {
        filteredToOriginalIndexMap[filteredIndex] = originalIndex;
        filteredIndex++;
      }
    });

    body.messages = body.messages.map((message: any, idx) => {
      if (message.role === "system" && shouldCacheSystemMessage) {
        return {
          ...message,
          content: this.addCacheControlToContent(message.content, true),
        };
      }

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

export default OrcaRouter;
