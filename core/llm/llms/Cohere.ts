import { streamSse } from "@continuedev/fetch";
import {
  ChatMessage,
  Chunk,
  CompletionOptions,
  LLMOptions,
  Usage,
} from "../../index.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { DEFAULT_REASONING_TOKENS } from "../constants.js";

class Cohere extends BaseLLM {
  static providerName = "cohere";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.cohere.ai/v2",
    maxEmbeddingBatchSize: 96,
  };
  static maxStopSequences = 5;

  private parseCohereUsage(rawUsage: any): Usage | undefined {
    if (!rawUsage) {
      return undefined;
    }

    const usage = rawUsage.tokens ?? rawUsage;
    const promptTokens = usage.input_tokens ?? usage.inputTokens;
    const completionTokens = usage.output_tokens ?? usage.outputTokens;
    const totalTokens = usage.total_tokens ?? usage.totalTokens;
    const cachedTokens =
      rawUsage.cached_tokens ??
      usage.cached_tokens ??
      rawUsage.cache_read_input_tokens ??
      usage.cache_read_input_tokens;

    if (
      typeof promptTokens !== "number" &&
      typeof completionTokens !== "number" &&
      typeof totalTokens !== "number"
    ) {
      return undefined;
    }

    const resolvedPromptTokens = promptTokens ?? 0;
    const resolvedCompletionTokens = completionTokens ?? 0;
    const resolvedTotalTokens =
      totalTokens ?? resolvedPromptTokens + resolvedCompletionTokens;

    return {
      promptTokens: resolvedPromptTokens,
      completionTokens: resolvedCompletionTokens,
      totalTokens: resolvedTotalTokens,
      promptTokensDetails:
        typeof cachedTokens === "number"
          ? {
              cachedTokens,
            }
          : undefined,
    };
  }

  private _convertMessages(msgs: ChatMessage[]): any[] {
    const messages = [];
    for (const m of msgs) {
      if (!m.content) {
        continue;
      }
      switch (m.role) {
        case "user":
          if (typeof m.content === "string") {
            messages.push({
              role: m.role,
              content: m.content,
            });
            break;
          }

          messages.push({
            role: m.role,
            content: m.content.map((part) => {
              if (part.type === "imageUrl") {
                return {
                  type: "image_url",
                  image_url: { url: part.imageUrl.url },
                };
              }
              return part;
            }),
          });
          break;
        case "thinking":
          messages.push({
            role: "assistant",
            content: [
              {
                type: "thinking",
                thinking: m.content,
              },
            ],
          });
          break;
        case "assistant":
          let msg: any;
          if (messages.at(-1)?.content[0]?.thinking) {
            msg = messages.pop();
          } else {
            msg = {
              role: m.role,
              content: [],
            };
          }

          if (m.toolCalls) {
            msg.tool_calls = m.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.function?.name,
                arguments: toolCall.function?.arguments,
              },
            }));
          } else {
            if (typeof m.content === "string") {
              msg.content.push({
                type: "text",
                text: m.content,
              });
            } else {
              msg.content.push(...m.content);
            }
          }

          messages.push(msg);
          break;
        case "system":
          messages.push({
            role: m.role,
            content: stripImages(m.content),
          });
          break;
        case "tool":
          messages.push({
            role: m.role,
            content: m.content,
            tool_call_id: m.toolCallId,
          });
          break;
        default:
          break;
      }
    }
    return messages;
  }

  private _convertArgs(options: CompletionOptions) {
    return {
      model: options.model,
      stream: options.stream ?? true,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      k: options.topK,
      p: options.topP,
      stop_sequences: options.stop?.slice(0, Cohere.maxStopSequences),
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      thinking: options.reasoning
        ? {
            type: "enabled" as const,
            token_budget:
              options.reasoningBudgetTokens ?? DEFAULT_REASONING_TOKENS,
          }
        : // Reasoning is enabled by default for models that support it.
          // https://docs.cohere.com/reference/chat-stream#request.body.thinking
          { type: "disabled" as const },
      tools: options.tools?.map((tool) => ({
        type: "function",
        function: {
          name: tool.function.name,
          parameters: tool.function.parameters,
          description: tool.function.description,
        },
      })),
    };
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
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.requestOptions?.headers,
    };

    const resp = await this.fetch(new URL("chat", this.apiBase), {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...this._convertArgs(options),
        messages: this._convertMessages(messages),
      }),
      signal,
    });

    if (resp.status === 499) {
      return; // Aborted by user
    }

    if (options.stream === false) {
      const data = await resp.json();
      const usage = this.parseCohereUsage(data?.usage);
      for (const content of data.message.content) {
        if (content.thinking) {
          yield { role: "thinking", content: content.thinking };
          continue;
        }
        yield { role: "assistant", content: content.text };
      }
      if (data.message.tool_calls) {
        if (data.message.tool_plan) {
          yield { role: "thinking", content: data.message.tool_plan };
        }
        yield {
          role: "assistant",
          content: "",
          toolCalls: data.message.tool_calls.map((toolCall: any) => ({
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.function?.name,
              arguments: toolCall.function?.arguments,
            },
          })),
        };
        if (usage) {
          yield {
            role: "assistant",
            content: "",
            usage,
          };
        }
        return;
      }
      if (usage) {
        yield {
          role: "assistant",
          content: "",
          usage,
        };
      }
      return;
    }

    let lastToolUseId: string | undefined;
    let lastToolUseName: string | undefined;
    let usage: Usage | undefined;
    for await (const value of streamSse(resp)) {
      // https://docs.cohere.com/v2/docs/streaming#stream-events
      switch (value.type) {
        // https://docs.cohere.com/v2/docs/streaming#content-delta
        case "content-delta":
          if (value.delta.message.content.thinking) {
            yield {
              role: "thinking",
              content: value.delta.message.content.thinking,
            };
            break;
          }
          yield {
            role: "assistant",
            content: value.delta.message.content.text,
          };
          break;
        // https://docs.cohere.com/reference/chat-stream#request.body.messages.assistant.tool_plan
        case "tool-plan-delta":
          yield {
            role: "thinking",
            content: value.delta.message.tool_plan,
          };
          break;
        case "tool-call-start":
          lastToolUseId = value.delta.message.tool_calls.id;
          lastToolUseName = value.delta.message.tool_calls.function.name;
          yield {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: lastToolUseId,
                type: "function",
                function: {
                  name: lastToolUseName,
                  arguments: value.delta.message.tool_calls.function.arguments,
                },
              },
            ],
          };
          break;
        case "tool-call-delta":
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
                  arguments: value.delta.message.tool_calls.function.arguments,
                },
              },
            ],
          };
          break;
        case "tool-call-end":
          lastToolUseId = undefined;
          lastToolUseName = undefined;
          break;
        case "message-end":
          usage = this.parseCohereUsage(value?.delta?.usage ?? value?.usage);
          break;
        default:
          break;
      }
    }

    if (usage) {
      yield {
        role: "assistant",
        content: "",
        usage,
      };
    }
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    const resp = await this.fetch(new URL("embed", this.apiBase), {
      method: "POST",
      body: JSON.stringify({
        texts: chunks,
        model: this.model,
        input_type: "search_document",
        embedding_types: ["float"],
        truncate: "END",
      }),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    return data.embeddings.float;
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    const resp = await this.fetch(new URL("rerank", this.apiBase), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        query,
        documents: chunks.map((chunk) => chunk.content),
      }),
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = (await resp.json()) as any;
    const results = data.results.sort((a: any, b: any) => a.index - b.index);
    return results.map((result: any) => result.relevance_score);
  }
}

export default Cohere;
