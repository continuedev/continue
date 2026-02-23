import { streamJSON } from "@continuedev/fetch";
import { OpenAI } from "openai/index";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
  Model,
} from "openai/resources/index";
import { CohereConfig } from "../types.js";
import { chatCompletion, customFetch, embedding } from "../util.js";
import { EMPTY_CHAT_COMPLETION } from "../util/emptyChatCompletion.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class CohereApi implements BaseLlmApi {
  apiBase: string = "https://api.cohere.com/v1";

  static maxStopSequences = 5;

  constructor(protected config: CohereConfig) {
    this.apiBase = config.apiBase ?? this.apiBase;
  }

  private _convertMessages(
    msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): any[] {
    return msgs.map((m) => ({
      role: m.role === "assistant" ? "CHATBOT" : "USER",
      message: m.content,
    }));
  }

  private _convertBody(oaiBody: ChatCompletionCreateParams) {
    return {
      message: oaiBody.messages.pop()?.content,
      chat_history: this._convertMessages(
        oaiBody.messages.filter((msg) => msg.role !== "system"),
      ),
      preamble: oaiBody.messages.find((msg) => msg.role === "system")?.content,
      model: oaiBody.model,
      stream: oaiBody.stream,
      temperature: oaiBody.temperature,
      max_tokens: oaiBody.max_tokens,
      p: oaiBody.top_p,
      stop_sequences: oaiBody.stop?.slice(0, CohereApi.maxStopSequences),
      frequency_penalty: oaiBody.frequency_penalty,
      presence_penalty: oaiBody.presence_penalty,
    };
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    const resp = await customFetch(this.config.requestOptions)(
      new URL("chat", this.apiBase),
      {
        method: "POST",
        headers,
        body: JSON.stringify(this._convertBody(body)),
        signal,
      },
    );

    if (resp.status === 499) {
      return EMPTY_CHAT_COMPLETION;
    }

    const data = (await resp.json()) as any;
    const { input_tokens, output_tokens } = data.meta.tokens;
    return chatCompletion({
      model: body.model,
      id: data.id,
      content: data.text,
      usage: {
        total_tokens: input_tokens + output_tokens,
        completion_tokens: output_tokens,
        prompt_tokens: input_tokens,
      },
    });
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    const resp = await customFetch(this.config.requestOptions)(
      new URL("chat", this.apiBase),
      {
        method: "POST",
        headers,
        body: JSON.stringify(this._convertBody(body)),
        signal,
      },
    );

    for await (const value of streamJSON(resp as any)) {
      if (value.event_type === "text-generation") {
        yield {
          id: value.id,
          object: "chat.completion.chunk",
          model: body.model,
          created: Date.now(),
          choices: [
            {
              index: 0,
              logprobs: undefined,
              finish_reason: null,
              delta: {
                role: "assistant",
                content: value.text,
              },
            },
          ],
          usage: undefined,
        };
      }
    }
  }
  completionNonStream(
    body: CompletionCreateParamsNonStreaming,
  ): Promise<Completion> {
    throw new Error("Method not implemented.");
  }
  completionStream(
    body: CompletionCreateParamsStreaming,
  ): AsyncGenerator<Completion> {
    throw new Error("Method not implemented.");
  }
  fimStream(
    body: FimCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    throw new Error("Method not implemented.");
  }
  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    const endpoint = new URL("rerank", this.apiBase);
    const response = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": this.config.apiKey ?? "",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
    const data = (await response.json()) as any;
    return {
      object: "list",
      data: data.results.map((result: any) => ({
        index: result.index,
        relevance_score: result.relevance_score,
      })),
      model: body.model,
      usage: {
        total_tokens: 0,
      },
    };
  }

  async embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    const url = new URL("/embed", this.apiBase);
    const texts = typeof body.input === "string" ? [body.input] : body.input;
    const response = await customFetch(this.config.requestOptions)(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        texts,
        model: body.model,
        input_type: "search_document",
      }),
    });
    const data = (await response.json()) as any;

    return embedding({
      model: body.model,
      usage: {
        total_tokens: 0,
        prompt_tokens: 0,
      },
      data: data.embeddings.map((embedding: any) => embedding),
    });
  }

  list(): Promise<Model[]> {
    throw new Error("Method not implemented.");
  }
}
