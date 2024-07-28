import fetch from "node-fetch";
import {
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "openai/resources/embeddings.mjs";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
} from "openai/resources/index.mjs";
import { LlmApiConfig } from "../index.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

// Cohere is OpenAI-compatible
export class CohereApi implements BaseLlmApi {
  apiBase: string = "https://api.cohere.com/v1";

  constructor(protected config: LlmApiConfig) {
    this.apiBase = config.apiBase ?? this.apiBase;
    if (!this.apiBase.endsWith("/")) {
      this.apiBase += "/";
    }
  }

  chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
  ): Promise<ChatCompletion> {
    throw new Error("Method not implemented.");
  }
  chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    throw new Error("Method not implemented.");
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
    const response = await fetch(url, {
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

    return {
      object: "list",
      model: body.model,
      usage: {
        total_tokens: 0,
        prompt_tokens: 0,
      },
      data: data.embeddings.map((embedding: any, index: number) => ({
        object: "embedding",
        index,
        embedding,
      })),
    };
  }
}
