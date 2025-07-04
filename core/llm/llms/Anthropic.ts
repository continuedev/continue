import { streamSse } from "@continuedev/fetch";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { safeParseToolCallArgs } from "../../tools/parseArgs.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

class Anthropic extends BaseLLM {
  static providerName = "anthropic";
  static defaultOptions: Partial<LLMOptions> = {
    model: "claude-3-5-sonnet-latest",
    contextLength: 200000,
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
      tools: options.tools?.map((tool, index) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
        // Add cache_control to last tool if cacheToolMessages is enabled
        ...(this.cacheBehavior?.cacheToolMessages &&
        index === options.tools!.length - 1
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

    // Debug tools caching
    if (this.cacheBehavior?.cacheDebug && options.tools?.length) {
      const totalToolsSize = options.tools.reduce((total, tool) => {
        const toolSize = JSON.stringify({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        }).length;
        return total + toolSize;
      }, 0);

      const estimatedToolsTokens = Math.ceil(totalToolsSize / 4);
      const lastToolIndex = options.tools.length - 1;
      const willCacheTools = this.cacheBehavior?.cacheToolMessages;

      console.log(`[ANTHROPIC CACHE DEBUG] 🛠️ Tools Analysis:`, {
        totalTools: options.tools.length,
        totalSize: totalToolsSize,
        estimatedTokens: estimatedToolsTokens,
        willCacheTools: willCacheTools,
        lastToolCached: willCacheTools
          ? options.tools[lastToolIndex].function.name
          : "none",
        toolNames: options.tools.map((t) => t.function.name),
        preview: willCacheTools
          ? `${options.tools[lastToolIndex].function.name}: ${options.tools[lastToolIndex].function.description?.substring(0, 100)}...`
          : "caching disabled",
      });
    }

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

  // Extensible message selection strategy for cacheConversation
  private selectMessagesToCache(filteredMessages: ChatMessage[]): number[] {
    const strategy = "last_two" as
      | "last_two"
      | "last_two_users"
      | "last_two_assistants"
      | "two_before_last";

    switch (strategy) {
      case "last_two":
        // Last 2 messages regardless of role
        return filteredMessages.length >= 2
          ? [filteredMessages.length - 2, filteredMessages.length - 1]
          : filteredMessages.length === 1
            ? [0]
            : [];

      case "last_two_users":
        // Find last 2 user messages
        return this.getLastTwoByRole(filteredMessages, "user");

      case "last_two_assistants":
        // Find last 2 assistant messages
        return this.getLastTwoByRole(filteredMessages, "assistant");

      case "two_before_last":
        // Any 2 messages, but NOT the last one
        return filteredMessages.length >= 3
          ? [filteredMessages.length - 3, filteredMessages.length - 2]
          : filteredMessages.length === 2
            ? [0]
            : [];

      default:
        return [];
    }
  }
  private getLastTwoByRole(
    filteredMessages: ChatMessage[],
    role: string,
  ): number[] {
    const roleIndices = filteredMessages
      .map((msg, index) => (msg.role === role ? index : -1))
      .filter((index) => index !== -1);

    return roleIndices.length >= 2 ? roleIndices.slice(-2) : roleIndices;
  }

  private getMessageSize(message: ChatMessage): number {
    if (typeof message.content === "string") {
      return message.content.length;
    }
    if (Array.isArray(message.content)) {
      return message.content
        .filter((part) => part.type === "text")
        .reduce((sum, part) => sum + part.text.length, 0);
    }
    return 0;
  }

  public convertMessages(msgs: ChatMessage[]): any[] {
    // should be public for use within VertexAI
    const filteredmessages = msgs.filter(
      (m) =>
        m.role !== "system" &&
        (!!m.content || (m.role === "assistant" && m.toolCalls)),
    );

    // Debug configuration
    if (this.cacheBehavior?.cacheDebug && this.cacheBehavior) {
      console.log(`[ANTHROPIC CACHE DEBUG] 🔧 Cache Configuration:`, {
        cacheToolMessages: this.cacheBehavior.cacheToolMessages,
        cacheSystemMessage: this.cacheBehavior.cacheSystemMessage,
        cacheConversation: this.cacheBehavior.cacheConversation,
        conversationStrategy: "last_two",
        useExtendedTtl: this.cacheBehavior.useExtendedCacheTtlBeta,
        totalMessages: filteredmessages.length,
      });
    }

    // Select messages to cache based on strategy
    const messagesToCache = this.cacheBehavior?.cacheConversation
      ? this.selectMessagesToCache(filteredmessages)
      : [];

    // Debug message selection
    if (this.cacheBehavior?.cacheDebug && messagesToCache.length > 0) {
      console.log(`[ANTHROPIC CACHE DEBUG] 📝 Message Caching Selection:`, {
        strategy: "last_two",
        selectedIndices: messagesToCache,
        selectedMessages: messagesToCache.map((idx) => ({
          index: idx,
          role: filteredmessages[idx].role,
          size: this.getMessageSize(filteredmessages[idx]),
          estimatedTokens: Math.ceil(
            this.getMessageSize(filteredmessages[idx]) / 4,
          ),
          preview:
            typeof filteredmessages[idx].content === "string"
              ? filteredmessages[idx].content.substring(0, 100) + "..."
              : "[multipart]",
        })),
      });
    }

    const messages = filteredmessages.map((message, filteredMsgIdx) => {
      const addCaching = messagesToCache.includes(filteredMsgIdx);
      const chatMessage = this.convertMessage(message, addCaching);
      return chatMessage;
    });

    // Debug breakpoint allocation
    if (this.cacheBehavior?.cacheDebug) {
      let totalCachedBlocks = 0;
      messages.forEach((msg: any) => {
        if (msg.content && Array.isArray(msg.content)) {
          msg.content.forEach((content: any) => {
            if (content.cache_control) {
              totalCachedBlocks++;
            }
          });
        }
      });

      const toolsBreakpoint = this.cacheBehavior?.cacheToolMessages ? 1 : 0;
      const systemBreakpoint = this.cacheBehavior?.cacheSystemMessage ? 1 : 0;
      const messageBreakpoints = messagesToCache.length;
      const totalBreakpoints =
        toolsBreakpoint + systemBreakpoint + messageBreakpoints;

      console.log(`[ANTHROPIC CACHE DEBUG] 🎯 Breakpoint Allocation:`, {
        toolsBreakpoint,
        systemBreakpoint,
        messageBreakpoints,
        totalBreakpoints,
        breakpointBudget: "4 max",
        finalCacheBlocks: totalCachedBlocks,
      });
    }

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

    // Debug system message
    if (this.cacheBehavior?.cacheDebug && systemMessage) {
      const systemSize = systemMessage.length;
      const estimatedTokens = Math.ceil(systemSize / 4);
      console.log(`[ANTHROPIC CACHE DEBUG] 🎯 System Message:`, {
        size: systemSize,
        estimatedTokens: estimatedTokens,
        willCache: shouldCacheSystemMessage,
        preview: systemMessage.substring(0, 100) + "...",
      });
    }

    const msgs = this.convertMessages(messages);

    // Debug complete API payload
    if (this.cacheBehavior?.cacheDebug) {
      const apiPayload = {
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
      };

      console.log(`[ANTHROPIC CACHE DEBUG] 📦 Complete API Payload:`, {
        payloadSize: JSON.stringify(apiPayload).length,
        systemCached: shouldCacheSystemMessage,
        totalMessages: msgs.length,
        toolsCount: apiPayload.tools?.length || 0,
        headers: {
          "anthropic-beta": this.cacheBehavior?.useExtendedCacheTtlBeta
            ? "extended-cache-ttl-2025-04-11"
            : shouldCacheSystemMessage ||
                this.cacheBehavior?.cacheConversation ||
                this.cacheBehavior?.cacheToolMessages
              ? "prompt-caching-2024-07-31"
              : "none",
        },
      });

      // Debug each message with cache details (last 6 only)
      console.log(
        `[ANTHROPIC CACHE DEBUG] 📋 Message Details (last 6 of ${msgs.length}):`,
      );
      const messagesToShow = msgs.slice(-6); // Only last 6 messages
      const startIndex = Math.max(0, msgs.length - 6);
      messagesToShow.forEach((msg: any, relativeIndex: number) => {
        const actualIndex = startIndex + relativeIndex;
        let hasCacheControl = false;
        let cacheDetails: Array<{
          contentIndex: number;
          type: string;
          cacheType: string;
          ttl: string;
        }> = [];
        if (msg.content && Array.isArray(msg.content)) {
          msg.content.forEach((content: any, contentIndex: number) => {
            if (content.cache_control) {
              hasCacheControl = true;
              cacheDetails.push({
                contentIndex,
                type: content.type,
                cacheType: content.cache_control.type,
                ttl: content.cache_control.ttl || "5m",
              });
            }
          });
        }

        console.log(`  Message ${actualIndex}:`, {
          role: msg.role,
          contentParts: msg.content?.length || 0,
          hasCacheControl,
          cacheDetails: cacheDetails.length > 0 ? cacheDetails : "none",
          preview:
            msg.content?.[0]?.text?.substring(0, 50) + "..." ||
            msg.content?.[0]?.type ||
            "[no preview]",
        });
      });

      // Debug tools with cache details
      if (apiPayload.tools?.length) {
        console.log(`[ANTHROPIC CACHE DEBUG] 🛠️ Tools Details:`);
        apiPayload.tools.forEach((tool, index) => {
          console.log(`  Tool ${index}:`, {
            name: tool.name,
            hasCacheControl: !!tool.cache_control,
            cacheType: tool.cache_control?.type || "none",
            ttl: tool.cache_control?.ttl || "none",
          });
        });
      }

      // Debug system message details
      if (shouldCacheSystemMessage && Array.isArray(apiPayload.system)) {
        console.log(`[ANTHROPIC CACHE DEBUG] 🎯 System Details:`, {
          systemParts: apiPayload.system.length,
          hasCacheControl: !!apiPayload.system[0]?.cache_control,
          cacheType: apiPayload.system[0]?.cache_control?.type || "none",
          ttl: apiPayload.system[0]?.cache_control?.ttl || "none",
        });
      }
    }

    const response = await this.fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey as string,
        ...(this.cacheBehavior?.useExtendedCacheTtlBeta
          ? { "anthropic-beta": "extended-cache-ttl-2025-04-11" }
          : shouldCacheSystemMessage ||
              this.cacheBehavior?.cacheConversation ||
              this.cacheBehavior?.cacheToolMessages
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

      if (this.cacheBehavior?.cacheDebug && data.usage) {
        console.log(`[ANTHROPIC CACHE DEBUG] 📊 API Response (non-stream):`, {
          input_tokens: data.usage.input_tokens || 0,
          output_tokens: data.usage.output_tokens || 0,
          cache_creation_input_tokens:
            data.usage.cache_creation_input_tokens || 0,
          cache_read_input_tokens: data.usage.cache_read_input_tokens || 0,
          cache_hit_rate: data.usage.cache_read_input_tokens
            ? `${Math.round((data.usage.cache_read_input_tokens / (data.usage.input_tokens + data.usage.cache_read_input_tokens)) * 100)}%`
            : "0%",
        });
      }

      yield { role: "assistant", content: data.content[0].text };
      return;
    }
    let lastToolUseId: string | undefined;
    let lastToolUseName: string | undefined;
    let streamingUsage: any = null;

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
        case "message_start":
          if (value.message && value.message.usage) {
            streamingUsage = value.message.usage;
          }
          break;
        case "message_delta":
          if (value.usage) {
            streamingUsage = { ...streamingUsage, ...value.usage };
          }
          break;
        default:
          break;
      }
    }

    if (this.cacheBehavior?.cacheDebug && streamingUsage) {
      console.log(`[ANTHROPIC CACHE DEBUG] 📊 API Response (streaming):`, {
        input_tokens: streamingUsage.input_tokens || 0,
        output_tokens: streamingUsage.output_tokens || 0,
        cache_creation_input_tokens:
          streamingUsage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: streamingUsage.cache_read_input_tokens || 0,
        cache_hit_rate: streamingUsage.cache_read_input_tokens
          ? `${Math.round((streamingUsage.cache_read_input_tokens / (streamingUsage.input_tokens + streamingUsage.cache_read_input_tokens)) * 100)}%`
          : "0%",
      });
    }
  }
}

export default Anthropic;
