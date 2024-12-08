import {
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
} from "openai/resources/completions";
import {
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "openai/resources/embeddings";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/index";
import { Model } from "openai/resources/models";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class AskSage implements BaseLlmApi {
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
  embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    throw new Error("Method not implemented.");
  }
  rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("Method not implemented.");
  }
  list(): Promise<Model[]> {
    throw new Error("Method not implemented.");
  }
}
