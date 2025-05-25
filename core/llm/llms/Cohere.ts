import { streamSse } from "@continuedev/fetch";
import {
  ChatMessage,
  Chunk,
  CompletionOptions,
  LLMOptions,
} from "../../index.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";

class Cohere extends BaseLLM {
  static providerName = "cohere";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.cohere.ai/v2",
    maxEmbeddingBatchSize: 96,
  };
  static maxStopSequences = 5;

  private _convertMessages(msgs: ChatMessage[]): any[] {
    const messages = [];
    for (const m of msgs) {
      if (!m.content) {
        continue;
      }
      switch (m.role) {
        case "user":
          messages.push({
            role: m.role,
            content: m.content,
          });
          break;
        case "assistant":
          messages.push({
            role: m.role,
            content: m.content,
          });
          break;
        case "system":
          messages.push({
            role: m.role,
            content: stripImages(m.content),
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
      yield { role: "assistant", content: data.message.content[0].text };
      return;
    }

    for await (const value of streamSse(resp)) {
      // https://docs.cohere.com/v2/docs/streaming#stream-events
      switch (value.type) {
        // https://docs.cohere.com/v2/docs/streaming#content-delta
        case "content-delta":
          yield {
            role: "assistant",
            content: value.delta.message.content.text,
          };
          break;
        default:
          break;
      }
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
