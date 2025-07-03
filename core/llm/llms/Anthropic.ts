import { streamSse } from "@continuedev/fetch";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { safeParseToolCallArgs } from "../../tools/parseArgs.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

class Anthropic extends BaseLLM {
  static providerName = "anthropic";
  static defaultOptions: Partial<LLMOptions> = {
    model: "claude-3-5-sonnet-latest",
    contextLength: 200_000,
    completionOptions: {
      model: "claude-3-5-sonnet-latest",
      maxTokens: 8192,
    },
    apiBase: "https://api.anthropic.com/v1/",
  };

  public convertArgs(options: CompletionOptions) {
    // should be public for use within VertexAI
    const finalOptions = {
      top_k: options.topK,
      top_p: options.topP,
      temperature: options.temperature,
      max_tokens: options.maxTokens ?? 2048,
      model: options.model === "claude-2" ? "claude-2.1" : options.model,
      stop_sequences: options.stop?.filter((x) => x.trim() !== ""),
      stream: options.stream ?? true,
      tools: options.tools?.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      })),
      thinking: options.reasoning
        ? {
            type: "enabled",
            budget_tokens: options.reasoningBudgetTokens,
          }
        : undefined,
      tool_choice: options.toolChoice
        ? {
            type: "tool",
            name: options.toolChoice.function.name,
          }
        : undefined,
    };

    return finalOptions;
  }

  protected convertMessage(message: ChatMessage, addCaching: boolean): any {
    if (message.role === "tool") {
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.toolCallId,
            content: renderChatMessage(message) || undefined,
            // Add caching support for tool results
            ...(addCaching
              ? {
                  cache_control: this.cacheBehavior?.useExtendedCacheTtlBeta
                    ? {
                        type: "ephemeral",
                        ttl: this.cacheBehavior?.cacheTtl ?? "5m",
                      }
                    : { type: "ephemeral" },
                }
              : {}),
          },
        ],
      };
    } else if (message.role === "assistant" && message.toolCalls) {
      return {
        role: "assistant",
        content: message.toolCalls.map((toolCall, index) => ({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function?.name,
          input: safeParseToolCallArgs(toolCall),
          // Add caching support for assistant tool calls (last tool call only)
          ...(addCaching && index === message.toolCalls!.length - 1
            ? {
                cache_control: this.cacheBehavior?.useExtendedCacheTtlBeta
                  ? {
                      type: "ephemeral",
                      ttl: this.cacheBehavior?.cacheTtl ?? "5m",
                    }
                  : { type: "ephemeral" },
              }
            : {}),
        })),
      };
    } else if (message.role === "thinking" && !message.redactedThinking) {
      return {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: message.content,
            signature: message.signature,
          },
        ],
      };
    } else if (message.role === "thinking" && message.redactedThinking) {
      return {
        role: "assistant",
        content: [
          {
            type: "redacted_thinking",
            data: message.redactedThinking,
          },
        ],
      };
    }

    if (typeof message.content === "string") {
      var chatMessage = {
        role: message.role,
        content: [
          {
            type: "text",
            text: message.content,
            ...(addCaching
              ? {
                  cache_control: this.cacheBehavior?.useExtendedCacheTtlBeta
                    ? {
                        type: "ephemeral",
                        ttl: this.cacheBehavior?.cacheTtl ?? "5m",
                      }
                    : { type: "ephemeral" },
                }
              : {}),
          },
        ],
      };
      return chatMessage;
    }

    return {
      role: message.role,
      content: message.content.map((part, contentIdx) => {
        if (part.type === "text") {
          const newpart = {
            ...part,
            // If multiple text parts, only add cache_control to the last one
            ...(addCaching && contentIdx === message.content.length - 1
              ? {
                  cache_control: this.cacheBehavior?.useExtendedCacheTtlBeta
                    ? {
                        type: "ephemeral",
                        ttl: this.cacheBehavior?.cacheTtl ?? "5m",
                      }
                    : { type: "ephemeral" },
                }
              : {}),
          };
          return newpart;
        }
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: part.imageUrl?.url.split(",")[1],
          },
        };
      }),
    };
  }

  protected shouldCacheMessage(
    message: ChatMessage,
    index: number,
    filteredMessages: ChatMessage[],
  ): boolean {
    if (!this.cacheBehavior) return false;

    // Get the cache plan for all messages
    const cachePlan = this.calculateCachePlan(filteredMessages);

    // Check if this specific message is in the cache plan
    return cachePlan.has(message);
  }

  private getMessageSize(message: ChatMessage): number {
    if (typeof message.content === "string") {
      return message.content.length;
    }
    if (Array.isArray(message.content)) {
      return message.content
        .filter(part => part.type === "text")
        .reduce((sum, part) => sum + part.text.length, 0);
    }
    return 0;
  }

  private meetsMinimumCacheSize(message: ChatMessage, model?: string): boolean {
    const messageSize = this.getMessageSize(message);
    const isHaiku = model?.includes("haiku") || false;

    // Minimum cacheable sizes from Anthropic docs:
    // - Haiku: 2048 tokens (~8192 chars)
    // - Other models: 1024 tokens (~4096 chars)
    const minChars = isHaiku ? 8192 : 4096;

    return messageSize >= minChars;
  }

  private calculatePriority(message: ChatMessage, index: number, type: string): number {
    const messageSize = this.getMessageSize(message);

    // Base priorities aligned with Anthropic's patterns
    // User input gets highest priority (like cookbook examples)
    const basePriorities: { [key: string]: number } = {
      user: 100,           // User input priority (as in cookbook)
      tool_result: 90,     // Tool results important but not higher than user
      assistant_tool_call: 80,
      assistant: 70
    };

    // Size factor - larger content gets priority (like Pride & Prejudice example)
    const sizeFactor = Math.min(Math.floor(messageSize / 1000), 50);

    // Recency factor - more recent gets higher priority
    const recencyFactor = index * 5;

    return (basePriorities[type] || 50) + sizeFactor + recencyFactor;
  }

  private calculateCachePlan(filteredMessages: ChatMessage[]): Set<ChatMessage> {
    const cachePlan = new Set<ChatMessage>();

    // Start with max 4 cache blocks (Anthropic's limit)
    let availableBlocks = 4;

    // Reserve 1 block for system message if enabled (like cookbook)
    if (this.cacheBehavior?.cacheSystemMessage) {
      availableBlocks--;
    }

    if (availableBlocks <= 0) return cachePlan;

    // Collect candidates that meet minimum size requirements
    const candidates: Array<{ message: ChatMessage; priority: number; type: string }> = [];

    if (this.cacheBehavior?.cacheConversation) {
      // User messages - prioritize like cookbook example
      const userMessages = filteredMessages.filter((m) => m.role === "user");
      userMessages.slice(-2).forEach((msg, idx) => {
        if (this.meetsMinimumCacheSize(msg, this.model)) {
          candidates.push({
            message: msg,
            priority: this.calculatePriority(msg, idx, "user"),
            type: "user"
          });
        }
      });

      // Assistant messages (non-tool)
      const assistantMessages = filteredMessages.filter(
        (m) => m.role === "assistant" && !m.toolCalls,
      );
      assistantMessages.slice(-2).forEach((msg, idx) => {
        if (this.meetsMinimumCacheSize(msg, this.model)) {
          candidates.push({
            message: msg,
            priority: this.calculatePriority(msg, idx, "assistant"),
            type: "assistant"
          });
        }
      });
    }

    if (this.cacheBehavior?.cacheToolMessages) {
      // Tool results
      const toolMessages = filteredMessages.filter((m) => m.role === "tool");
      toolMessages.slice(-2).forEach((msg, idx) => {
        if (this.meetsMinimumCacheSize(msg, this.model)) {
          candidates.push({
            message: msg,
            priority: this.calculatePriority(msg, idx, "tool_result"),
            type: "tool_result"
          });
        }
      });

      // Assistant tool calls
      const assistantToolMessages = filteredMessages.filter(
        (m) => m.role === "assistant" && m.toolCalls,
      );
      assistantToolMessages.slice(-2).forEach((msg, idx) => {
        candidates.push({
          message: msg,
          priority: this.calculatePriority(msg, idx, "assistant_tool_call"),
          type: "assistant_tool_call"
        });
      });
    }

    // Sort by priority (highest first) and take only what fits in available blocks
    candidates
      .sort((a, b) => b.priority - a.priority)
      .slice(0, availableBlocks)
      .forEach(candidate => cachePlan.add(candidate.message));

    return cachePlan;
  }

  public convertMessages(msgs: ChatMessage[]): any[] {
    // should be public for use within VertexAI
    const filteredmessages = msgs.filter(
      (m) =>
        m.role !== "system" &&
        (!!m.content || (m.role === "assistant" && m.toolCalls)),
    );

    const messages = filteredmessages.map((message, filteredMsgIdx) => {
      // Use simplified caching logic
      const addCaching = this.shouldCacheMessage(
        message,
        filteredMsgIdx,
        filteredmessages,
      );

      const chatMessage = this.convertMessage(message, !!addCaching);
      return chatMessage;
    });
    return messages;
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

    const msgs = this.convertMessages(messages);
    const response = await this.fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey as string,
        ...(this.cacheBehavior?.useExtendedCacheTtlBeta
          ? { "anthropic-beta": "extended-cache-ttl-2025-04-11" }
          : shouldCacheSystemMessage || this.cacheBehavior?.cacheConversation
            ? { "anthropic-beta": "prompt-caching-2024-07-31" }
            : {}),
      },
      body: JSON.stringify({
        ...this.convertArgs(options),
        messages: msgs,
        system: shouldCacheSystemMessage
          ? [
              {
                type: "text",
                text: systemMessage,
                cache_control: this.cacheBehavior?.useExtendedCacheTtlBeta
                  ? {
                      type: "ephemeral",
                      ttl: this.cacheBehavior?.cacheTtl ?? "5m",
                    }
                  : { type: "ephemeral" },
              },
            ]
          : systemMessage,
      }),
      signal,
    });

    if (response.status === 499) {
      return; // Aborted by user
    }

    if (!response.ok) {
      const json = await response.json();
      if (json.type === "error") {
        if (json.error?.type === "overloaded_error") {
          throw new Error(
            "The Anthropic API is currently overloaded. Please check their status page: https://status.anthropic.com/#past-incidents",
          );
        }
        throw new Error(json.message);
      }
      throw new Error(
        `Anthropic API sent back ${response.status}: ${JSON.stringify(json)}`,
      );
    }

    if (options.stream === false) {
      const data = await response.json();
      yield { role: "assistant", content: data.content[0].text };
      return;
    }
    let lastToolUseId: string | undefined;
    let lastToolUseName: string | undefined;
    for await (const value of streamSse(response)) {
      // https://docs.anthropic.com/en/api/messages-streaming#event-types
      switch (value.type) {
        case "content_block_start":
          if (value.content_block.type === "tool_use") {
            lastToolUseId = value.content_block.id;
            lastToolUseName = value.content_block.name;
          }
          // handle redacted thinking
          if (value.content_block.type === "redacted_thinking") {
            console.log("redacted thinking", value.content_block.data);
            yield {
              role: "thinking",
              content: "",
              redactedThinking: value.content_block.data,
            };
          }
          break;
        case "content_block_delta":
          // https://docs.anthropic.com/en/api/messages-streaming#delta-types
          switch (value.delta.type) {
            case "text_delta":
              yield { role: "assistant", content: value.delta.text };
              break;
            case "thinking_delta":
              yield { role: "thinking", content: value.delta.thinking };
              break;
            case "signature_delta":
              yield {
                role: "thinking",
                content: "",
                signature: value.delta.signature,
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
                      arguments: value.delta.partial_json,
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
  }
}

export default Anthropic;
