import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  RedactedThinkingMessagePart,
  TextMessagePart,
  ThinkingMessagePart,
} from "../../index.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { streamSse } from "../stream.js";

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
      tool_choice: options.toolChoice
        ? {
            type: "tool",
            name: options.toolChoice.function.name,
          }
        : undefined,
      thinking: options.thinking,
    };

    if (
      finalOptions.thinking?.type === "disabled" &&
      "budget_tokens" in finalOptions.thinking
    ) {
      delete finalOptions.thinking.budget_tokens;
    }

    return finalOptions;
  }

  private convertMessage(message: ChatMessage, addCaching: boolean): any {
    if (message.role === "tool") {
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.toolCallId,
            content: renderChatMessage(message) || undefined,
          },
        ],
      };
    } else if (message.role === "assistant") {
      // Start with an empty content array
      const content: any[] = [];

      // 1. Add thinking blocks first (if present in array content)
      if (Array.isArray(message.content)) {
        const thinkingBlocks = message.content.filter(
          (part) =>
            part.type === "thinking" || part.type === "redacted_thinking",
        );

        if (thinkingBlocks.length > 0) {
          content.push(...thinkingBlocks);
        }
      }

      // 2. Add tool calls (if present)
      if (message.toolCalls?.length) {
        const toolUseBlocks = message.toolCalls.map((toolCall) => ({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function?.name,
          input: JSON.parse(toolCall.function?.arguments || "{}"),
        }));

        content.push(...toolUseBlocks);
      }

      // 3. Add text parts (if present)
      if (Array.isArray(message.content)) {
        const textBlocks = message.content.filter(
          (part) => part.type === "text",
        );
        if (textBlocks.length > 0) {
          content.push(...textBlocks);
        }
      } else if (typeof message.content === "string" && message.content) {
        content.push({
          type: "text",
          text: message.content,
          ...(addCaching ? { cache_control: { type: "ephemeral" } } : {}),
        });
      }

      // Return full assistant message with combined content
      return {
        role: "assistant",
        content: content.length > 0 ? content : "", // Handle empty content case
      };
    }

    if (typeof message.content === "string") {
      var chatMessage = {
        role: message.role,
        content: [
          {
            type: "text",
            text: message.content,
            ...(addCaching ? { cache_control: { type: "ephemeral" } } : {}),
          },
        ],
      };
      return chatMessage;
    }

    // Filter out empty thinking blocks before mapping
    const filteredContent = Array.isArray(message.content)
      ? message.content.filter(
          (part) =>
            !(
              part.type === "thinking" &&
              (!part.thinking || part.thinking.trim() === "") &&
              (!part.signature || part.signature.trim() === "")
            ),
        )
      : message.content;

    const convertedContent = (
      Array.isArray(filteredContent) ? filteredContent : [filteredContent]
    ).map((part, contentIdx) => {
      if (part.type === "text") {
        const newpart = {
          ...part,
          // If multiple text parts, only add cache_control to the last one
          ...(addCaching &&
          contentIdx ==
            (Array.isArray(filteredContent) ? filteredContent.length : 1) - 1
            ? { cache_control: { type: "ephemeral" } }
            : {}),
        };
        return newpart;
      }
      if (part.type === "imageUrl") {
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: part.imageUrl?.url.split(",")[1],
          },
        };
      }
      if (part.type === "thinking") {
        // Make sure to preserve the thinking and signature fields
        return {
          type: "thinking",
          thinking: part.thinking,
          signature: part.signature,
        };
      }
      if (part.type === "redacted_thinking") {
        // Make sure to preserve the data field
        return {
          type: "redacted_thinking",
          data: part.data,
        };
      }
      // Pass through other blocks as-is
      return part;
    });

    const result = {
      role: message.role,
      content: convertedContent,
    };

    return result;
  }

  public convertMessages(msgs: ChatMessage[]): any[] {
    // should be public for use within VertexAI
    const filteredmessages = msgs.filter(
      (m) => m.role !== "system" && !!m.content,
    );
    const lastTwoUserMsgIndices = filteredmessages
      .map((msg, index) => (msg.role === "user" ? index : -1))
      .filter((index) => index !== -1)
      .slice(-2);

    const messages = filteredmessages.map((message, filteredMsgIdx) => {
      // Add cache_control parameter to the last two user messages
      // The second-to-last because it retrieves potentially already cached contents,
      // The last one because we want it cached for later retrieval.
      // See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
      const addCaching =
        this.cacheBehavior?.cacheConversation &&
        lastTwoUserMsgIndices.includes(filteredMsgIdx);

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

    const shouldCacheSystemMessage =
      !!this.systemMessage && this.cacheBehavior?.cacheSystemMessage;
    const systemMessage: string = stripImages(
      messages.filter((m) => m.role === "system")[0]?.content ?? "",
    );

    const msgs = this.convertMessages(messages);

    // Merge default headers with custom headers
    const headers: any = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": this.apiKey as string,
      ...this.requestOptions?.headers,
    };

    // Handle the special case for anthropic-beta
    this.setBetaHeaders(headers, shouldCacheSystemMessage);

    // Create the request body
    const requestBody = {
      ...this.convertArgs(options),
      messages: msgs,
      system: shouldCacheSystemMessage
        ? [
            {
              type: "text",
              text: this.systemMessage,
              cache_control: { type: "ephemeral" },
            },
          ]
        : systemMessage,
    };

    const response = await this.fetch(new URL("messages", this.apiBase), {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });

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

      // Check if there are thinking blocks in the response
      const thinkingBlocks = data.content.filter(
        (block: any) =>
          block.type === "thinking" || block.type === "redacted_thinking",
      );

      const textBlocks = data.content.filter(
        (block: any) => block.type === "text",
      );

      // First yield thinking blocks if they exist
      for (const block of thinkingBlocks) {
        if (block.type === "thinking") {
          const thinkingPart: ThinkingMessagePart = {
            type: "thinking",
            thinking: block.thinking,
            signature: block.signature,
          };

          // Yield thinking content
          yield {
            role: "assistant",
            content: [thinkingPart],
          };
        } else if (block.type === "redacted_thinking") {
          const redactedPart: RedactedThinkingMessagePart = {
            type: "redacted_thinking",
            data: block.data,
          };

          // Yield redacted thinking content
          yield {
            role: "assistant",
            content: [redactedPart],
          };
        }
      }

      // Then yield text blocks as a separate message
      if (textBlocks.length > 0) {
        for (const block of textBlocks) {
          if (block.type === "text") {
            const textPart: TextMessagePart = {
              type: "text",
              text: block.text,
            };

            // Yield text content
            yield {
              role: "assistant",
              content: [textPart],
            };
          }
        }
      }
      return;
    }

    // State for tracking different content blocks
    let lastToolUseId: string | undefined;
    let lastToolUseName: string | undefined;
    let thinkingBlockIndex: number | undefined;
    let thinkingBlocksById: Map<number, string> = new Map();
    let thinkingSignaturesById: Map<number, string> = new Map();
    let textContent = "";

    for await (const value of streamSse(response)) {
      switch (value.type) {
        case "content_block_start":
          if (value.content_block.type === "tool_use") {
            lastToolUseId = value.content_block.id;
            lastToolUseName = value.content_block.name;
          } else if (value.content_block.type === "thinking") {
            thinkingBlockIndex = value.index;
            thinkingBlocksById.set(value.index, "");
          } else if (value.content_block.type === "redacted_thinking") {
            // Emit redacted thinking blocks immediately
            yield {
              role: "assistant",
              content: [
                {
                  type: "redacted_thinking",
                  data: value.content_block.data,
                },
              ],
            };
          }
          break;

        case "content_block_delta":
          switch (value.delta.type) {
            case "text_delta":
              textContent += value.delta.text;

              // Emit text content as it comes in
              yield {
                role: "assistant",
                content: [
                  {
                    type: "text",
                    text: value.delta.text,
                  },
                ],
              };
              break;

            case "thinking_delta":
              if (thinkingBlockIndex !== undefined) {
                // Accumulate thinking content
                const currentContent =
                  thinkingBlocksById.get(thinkingBlockIndex) || "";
                const newContent = currentContent + value.delta.thinking;
                thinkingBlocksById.set(thinkingBlockIndex, newContent);

                // Emit thinking content as it comes in
                yield {
                  role: "assistant",
                  content: [
                    {
                      type: "thinking",
                      thinking: value.delta.thinking,
                      signature: "", // Empty signature for deltas
                    },
                  ],
                };
              }
              break;

            case "signature_delta":
              if (thinkingBlockIndex !== undefined) {
                // Store the signature
                thinkingSignaturesById.set(
                  thinkingBlockIndex,
                  value.delta.signature,
                );

                // Get the accumulated content
                const thinkingContent =
                  thinkingBlocksById.get(thinkingBlockIndex) || "";

                // Emit complete thinking block with signature
                yield {
                  role: "assistant",
                  content: [
                    {
                      type: "thinking",
                      thinking: thinkingContent,
                      signature: value.delta.signature,
                    },
                  ],
                };
              }
              break;

            case "input_json_delta":
              if (!lastToolUseId || !lastToolUseName) {
                throw new Error("No tool use found");
              }
              // Emit tool call
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
          if (value.index === thinkingBlockIndex) {
            thinkingBlockIndex = undefined;
          }

          if (value.content_block?.type === "tool_use") {
            lastToolUseId = undefined;
            lastToolUseName = undefined;
          }
          break;
      }
    }
  }

  private setBetaHeaders(
    headers: any,
    shouldCacheSystemMessage: boolean | undefined,
  ) {
    const betaValues = new Set<string>();

    // Add from existing header if present
    const existingBeta = headers["anthropic-beta"];
    if (existingBeta && typeof existingBeta === "string") {
      existingBeta
        .split(",")
        .map((v) => v.trim())
        .forEach((v) => betaValues.add(v));
    }

    // Add caching header if we should
    if (shouldCacheSystemMessage || this.cacheBehavior?.cacheConversation) {
      betaValues.add("prompt-caching-2024-07-31");
    }

    // Update the header if we have values
    if (betaValues.size > 0) {
      headers["anthropic-beta"] = Array.from(betaValues).join(",");
    }
  }
}

export default Anthropic;
