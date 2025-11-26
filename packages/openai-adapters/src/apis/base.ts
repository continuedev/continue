import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
  Model,
} from "openai/resources/index";
import type { Response } from "openai/resources/responses/responses.js";

export interface FimCreateParamsStreaming
  extends CompletionCreateParamsStreaming {
  suffix: string;
}

export interface RerankCreateParams {
  query: string;
  documents: string[];
  model: string;
  top_k?: number;
}

export interface CreateRerankItem {
  relevance_score: number;
  index: number;
}

export interface CreateRerankResponse {
  object: "list";
  data: CreateRerankItem[];
  model: string;
  usage: {
    total_tokens: number;
  };
}

export interface BaseLlmApi {
  // Chat, no stream
  chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion>;

  // Chat, stream
  chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk>;

  responsesNonStream?(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Response>;

  responsesStream?(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk>;

  // Completion, no stream
  completionNonStream(
    body: CompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Completion>;

  // Completion, stream
  completionStream(
    body: CompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<Completion>;

  // FIM, stream
  fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk>;

  // Embeddings
  embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse>;

  // Reranking
  rerank(body: RerankCreateParams): Promise<CreateRerankResponse>;

  // List Models
  list(): Promise<Model[]>;
}
