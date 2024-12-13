import { streamSse } from "@continuedev/fetch";
import fetch from "node-fetch";
import { OpenAI } from "openai/index";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  Model,
} from "openai/resources/index";
import { z } from "zod";
import { OpenAIConfigSchema } from "../types.js";
import { maybeCustomFetch } from "../util.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class OpenAIApi implements BaseLlmApi {
  openai: OpenAI;
  apiBase: string = "https://api.openai.com/v1/";

  constructor(protected config: z.infer<typeof OpenAIConfigSchema>) {
    this.apiBase = config.apiBase ?? this.apiBase;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: this.apiBase,
      fetch: maybeCustomFetch(config.requestOptions),
    });
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    const response = await this.openai.chat.completions.create(body, {
      signal,
    });
    return response;
  }
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const response = await this.openai.chat.completions.create(body, {
      signal,
    });
    for await (const result of response) {
      yield result;
    }
  }
  async completionNonStream(
    body: CompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Completion> {
    const response = await this.openai.completions.create(body, { signal });
    return response;
  }
  async *completionStream(
    body: CompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<Completion, any, unknown> {
    const response = await this.openai.completions.create(body, { signal });
    for await (const result of response) {
      yield result;
    }
  }
  async *fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const endpoint = new URL("fim/completions", this.apiBase);
    const resp = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: body.model,
        prompt: body.prompt,
        suffix: body.suffix,
        max_tokens: body.max_tokens,
        max_completion_tokens: (body as any).max_completion_tokens,
        temperature: body.temperature,
        top_p: body.top_p,
        frequency_penalty: body.frequency_penalty,
        presence_penalty: body.presence_penalty,
        stop: body.stop,
        stream: true,
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": this.config.apiKey ?? "",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal,
    });
    for await (const chunk of streamSse(resp as any)) {
      if (chunk.choices && chunk.choices.length > 0) {
        yield chunk;
      }
    }
  }

  async embed(
    body: OpenAI.Embeddings.EmbeddingCreateParams,
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    const response = await this.openai.embeddings.create(body);
    return response;
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    const endpoint = new URL("rerank", this.apiBase);
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": this.config.apiKey ?? "",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
    const data = await response.json();
    return data as any;
  }

  async list(): Promise<Model[]> {
    return (await this.openai.models.list()).data;
  }
}
