import {
  ChatMessage,
  Chunk,
  CompletionOptions,
  LLMOptions,
} from "../../index.js";
import { renderChatMessage } from "../../util/messageContent.js";
import { BaseLLM } from "../index.js";
import { streamJSON } from "../stream.js";

class Cohere extends BaseLLM {
  static providerName = "cohere";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.cohere.ai/v1",
    maxEmbeddingBatchSize: 96,
  };
  static maxStopSequences = 5;

  private _convertMessages(msgs: ChatMessage[]): any[] {
    const messages = [];
    for (const m of msgs) {
      if (m.role === "system" || !m.content) {
        continue;
      }
      messages.push({
        role: m.role === "assistant" ? "chatbot" : m.role,
        message: m.content,
      });
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
      raw_prompting: options.raw,
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
        message: messages.pop()?.content,
        chat_history: this._convertMessages(messages),
        preamble: this.systemMessage,
      }),
      signal,
    });

    if (options.stream === false) {
      const data = await resp.json();
      yield { role: "assistant", content: data.text };
      return;
    }

    for await (const value of streamJSON(resp)) {
      if (value.event_type === "text-generation") {
        yield { role: "assistant", content: value.text };
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
