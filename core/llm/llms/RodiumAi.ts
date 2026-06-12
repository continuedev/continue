import { ChatCompletionCreateParams } from "openai/resources/index";

import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

const CONTINUE_VERSION = process.env.npm_package_version || "unknown";

class RodiumAi extends OpenAI {
  static providerName = "rodiumai";
  protected supportsReasoningField = true;
  protected supportsReasoningDetailsField = true;
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.rodiumai.io/v1/",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };

  protected _getHeaders() {
    return {
      ...super._getHeaders(),
      "User-Agent": `Continue/${CONTINUE_VERSION}`,
      "X-Continue-Provider": "rodiumai",
    };
  }

  private isAnthropicModel(model?: string): boolean {
    if (!model) return false;
    const modelLower = model.toLowerCase();
    return modelLower.includes("claude") || modelLower.startsWith("anthropic/");
  }

  private isGeminiModel(model?: string): boolean {
    if (!model) return false;
    const modelLower = model.toLowerCase();
    return (
      modelLower.startsWith("google/") ||
      modelLower.startsWith("gemini/") ||
      modelLower.includes("gemini")
    );
  }

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

    if (this.isGeminiModel(body.model)) {
      body = this.addGeminiThoughtSignatures(body);
    }

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

export default RodiumAi;
