import {
  Tool as AnthropicTool,
  ContentBlockParam,
  MessageCreateParams,
  MessageParam,
  RawContentBlockDeltaEvent,
  RawContentBlockStartEvent,
  RawMessageDeltaEvent,
  RawMessageStartEvent,
  RawMessageStreamEvent,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages.mjs";
import { streamSse } from "@continuedev/fetch";
import {
  addCacheControlToLastTwoUserMessages,
  getAnthropicErrorMessage,
  getAnthropicHeaders,
  getAnthropicMediaTypeFromDataUrl,
} from "@continuedev/openai-adapters";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessageContent,
  Tool,
  ToolCallDelta,
  Usage,
} from "../../index.js";
import { safeParseToolCallArgs } from "../../tools/parseArgs.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { extractBase64FromDataUrl } from "../../util/url.js";
import { DEFAULT_REASONING_TOKENS } from "../constants.js";
import { BaseLLM } from "../index.js";

class Anthropic extends BaseLLM {
  static providerName = "anthropic";
  static defaultOptions: Partial<LLMOptions> = {
    model: "claude-3-5-sonnet-latest",
    completionOptions: {
      model: "claude-3-5-sonnet-latest",
      maxTokens: 8192,
    },
    apiBase: "https://api.anthropic.com/v1/",
  };

  private convertToolToAnthropicTool(tool: Tool): AnthropicTool {
    return {
      name: tool.function.name,
      description: tool.function.description,
      input_schema: (tool.function.parameters as AnthropicTool.InputSchema) ?? {
        // TODO unsafe tool.function.parameters casting
        type: "object",
      },
    };
  }

  // Public for use within VertexAI
  public convertArgs(
    options: CompletionOptions,
  ): Omit<MessageCreateParams, "messages"> {
    const finalOptions = {
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 2048,
      model: options.model === "claude-2" ? "claude-2.1" : options.model,
      stop_sequences: options.stop?.filter((x) => x.trim() !== ""),
      stream: options.stream ?? true,
      tools: options.tools?.map(this.convertToolToAnthropicTool),
      thinking: options.reasoning
        ? {
            type: "enabled" as const,
            budget_tokens:
              options.reasoningBudgetTokens ?? DEFAULT_REASONING_TOKENS,
          }
        : undefined,
      tool_choice: options.toolChoice
        ? {
            type: "tool" as const,
            name: options.toolChoice.function.name,
          }
        : undefined,
    };

    return finalOptions;
  }

  private convertMessageContentToBlocks(
    content: MessageContent,
  ): ContentBlockParam[] {
    const parts: ContentBlockParam[] = [];
    if (typeof content === "string") {
      if (content) {
        parts.push({
          type: "text",
          text: content,
        });
      }
    } else {
      for (const part of content) {
        if (part.type === "text") {
          if (part.text) {
            parts.push({
              type: "text",
              text: part.text,
            });
          }
        } else {
          const base64Data = extractBase64FromDataUrl(part.imageUrl.url);
          if (base64Data) {
            parts.push({
              type: "image",
              source: {
                type: "base64",
                media_type: getAnthropicMediaTypeFromDataUrl(part.imageUrl.url),
                data: base64Data,
              },
            });
          } else {
            console.warn(
              "Anthropic: skipping image with invalid data URL format",
              part.imageUrl.url,
            );
          }
        }
      }
    }
    return parts;
  }

  private convertToolCallsToBlocks(
    toolCall: ToolCallDelta,
  ): ToolUseBlock | undefined {
    const toolCallId = toolCall.id;
    const toolName = toolCall.function?.name;
    if (toolCallId && toolName) {
      return {
        type: "tool_use",
        id: toolCallId,
        name: toolName,
        input: safeParseToolCallArgs(toolCall),
      };
    }
  }

  private getContentBlocksFromChatMessage(
    message: ChatMessage,
  ): ContentBlockParam[] {
    switch (message.role) {
      // One tool message = one tool_result block
      case "tool":
        return [
          {
            type: "tool_result",
            tool_use_id: message.toolCallId,
            content: renderChatMessage(message) || undefined,
          },
        ];
      case "user":
        return this.convertMessageContentToBlocks(message.content);
      case "thinking":
        if (message.redactedThinking) {
          return [
            {
              type: "redacted_thinking",
              data: message.redactedThinking,
            },
          ];
        }
        // Strip thinking that has no signature
        const signature = message.signature;
        if (!signature) {
          return [];
        }
        if (typeof message.content === "string") {
          if (!message.content) {
            return [];
          }
          return [
            {
              type: "thinking",
              thinking: message.content,
              signature,
            },
          ];
        }
        const textParts = message.content
          .filter((p) => p.type === "text")
          .filter((p) => !!p.text);
        return textParts.map((part) => ({
          type: "thinking",
          thinking: part.text,
          signature,
        }));
      case "assistant":
        const blocks: ContentBlockParam[] = this.convertMessageContentToBlocks(
          message.content,
        );
        // If any tool calls are present, always put them last
        // Loses order vs what was originally sent, but they typically come last
        for (const toolCall of message.toolCalls ?? []) {
          const block = this.convertToolCallsToBlocks(toolCall);
          if (block) {
            blocks.push(block);
          }
        }
        return blocks;
      // system, etc.
      default:
        return [];
    }
  }

  public convertMessages(
    msgs: ChatMessage[],
    cachePrompt: boolean,
  ): MessageParam[] {
    const nonSystemMessages = msgs.filter((m) => m.role !== "system");

    const convertedMessages: MessageParam[] = [];
    let currentRole: "user" | "assistant" | undefined = undefined;
    let currentParts: ContentBlockParam[] = [];

    const flushCurrentMessage = () => {
      if (currentRole && currentParts.length > 0) {
        convertedMessages.push({
          role: currentRole,
          content: currentParts,
        });
        currentParts = [];
      }
    };

    for (const message of nonSystemMessages) {
      const newRole =
        message.role === "user" || message.role === "tool"
          ? "user"
          : "assistant";
      if (currentRole !== newRole) {
        flushCurrentMessage();
        currentRole = newRole;
      }
      currentParts.push(...this.getContentBlocksFromChatMessage(message));
    }
    flushCurrentMessage();

    if (cachePrompt) {
      addCacheControlToLastTwoUserMessages(convertedMessages);
    }

    return convertedMessages;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, signal, options)) {
      yield renderChatMessage(update);
    }
  }

  async *handleResponse(
    response: any,
    stream: boolean | undefined,
  ): AsyncGenerator<ChatMessage> {
    if (response.status === 499) {
      return; // Aborted by user
    }

    if (!response.ok) {
      const json = await response.json();
      if (json.type === "error") {
        throw new Error(getAnthropicErrorMessage(json));
      }
      throw new Error(
        `Anthropic API sent back ${response.status}: ${JSON.stringify(json)}`,
      );
    }

    if (stream === false) {
      const json = await response.json();
      const cost = json.usage
        ? {
            inputTokens: json.usage.input_tokens,
            outputTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
          }
        : {};
      yield {
        role: "assistant",
        content: json.content[0].text,
        ...(Object.keys(cost).length > 0 ? { cost } : {}),
      };
      return;
    }

    let lastToolUseId: string | undefined;
    let lastToolUseName: string | undefined;
    let usage: Usage = {
      promptTokens: 0,
      completionTokens: 0,
      promptTokensDetails: {
        cachedTokens: 0,
        cacheWriteTokens: 0,
      },
    };

    for await (const event of streamSse(response)) {
      // https://docs.anthropic.com/en/api/messages-streaming#event-types
      const rawEvent = event as RawMessageStreamEvent;
      switch (event.type) {
        case "message_start":
          // Capture initial usage information
          const startEvent = rawEvent as RawMessageStartEvent;
          usage.promptTokens = startEvent.message.usage.input_tokens;
          usage.promptTokensDetails!.cachedTokens =
            startEvent.message.usage.cache_read_input_tokens ?? undefined;
          usage.promptTokensDetails!.cacheWriteTokens =
            startEvent.message.usage.cache_creation_input_tokens ?? undefined;
          break;
        case "message_delta":
          // Update usage information during streaming
          const deltaEvent = rawEvent as RawMessageDeltaEvent;
          if (deltaEvent.usage) {
            usage.completionTokens = deltaEvent.usage.output_tokens;
          }
          break;
        case "content_block_start":
          const blockStartEvent = rawEvent as RawContentBlockStartEvent;
          if (blockStartEvent.content_block.type === "tool_use") {
            lastToolUseId = blockStartEvent.content_block.id;
            lastToolUseName = blockStartEvent.content_block.name;
          }
          // handle redacted thinking
          if (blockStartEvent.content_block.type === "redacted_thinking") {
            yield {
              role: "thinking",
              content: "",
              redactedThinking: blockStartEvent.content_block.data,
            };
          }
          break;
        case "content_block_delta":
          // https://docs.anthropic.com/en/api/messages-streaming#delta-types
          const blockDeltaEvent = rawEvent as RawContentBlockDeltaEvent;
          switch (blockDeltaEvent.delta.type) {
            case "text_delta":
              yield { role: "assistant", content: blockDeltaEvent.delta.text };
              break;
            case "thinking_delta":
              yield {
                role: "thinking",
                content: blockDeltaEvent.delta.thinking,
              };
              break;
            case "signature_delta":
              yield {
                role: "thinking",
                content: "",
                signature: blockDeltaEvent.delta.signature,
              };
              break;
            case "input_json_delta":
              if (!lastToolUseId || !lastToolUseName) {
                throw new Error("No tool use found");
              }
              yield {
                role: "assistant",
                content: "",
                toolCalls: [
                  {
                    id: lastToolUseId,
                    type: "function",
                    function: {
                      name: lastToolUseName,
                      arguments: blockDeltaEvent.delta.partial_json,
                    },
                  },
                ],
              };
              break;
          }
          break;
        case "content_block_stop":
          lastToolUseId = undefined;
          lastToolUseName = undefined;
          break;
        default:
          break;
      }
    }

    yield {
      role: "assistant",
      content: "",
      usage,
    };
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    if (!this.apiKey || this.apiKey === "") {
      throw new Error(
        "Request not sent. You have an Anthropic model configured in your config.json, but the API key is not set.",
      );
    }

    const systemMessage = stripImages(
      messages.filter((m) => m.role === "system")[0]?.content ?? "",
    );
    const shouldCacheSystemMessage = !!(
      this.cacheBehavior?.cacheSystemMessage && systemMessage
    );
    const shouldCachePrompt = !!(
      this.cacheBehavior?.cacheConversation ||
      this.completionOptions.promptCaching
    );

    const msgs = this.convertMessages(messages, shouldCachePrompt);
    const headers = getAnthropicHeaders(
      this.apiKey,
      shouldCacheSystemMessage || shouldCachePrompt,
      this.apiBase,
    );

    const body: MessageCreateParams = {
      ...this.convertArgs(options),
      messages: msgs,
      system: shouldCacheSystemMessage
        ? [
            {
              type: "text",
              text: systemMessage,
              cache_control: { type: "ephemeral" },
            },
          ]
        : systemMessage,
    };

    const response = await this.fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    yield* this.handleResponse(response, options.stream);
  }
}

export default Anthropic;
