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
import { CometAPIConfig } from "../types.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";
import { OpenAIApi } from "./OpenAI.js";

/**
 * CometAPI adapter - extends OpenAI adapter since CometAPI is OpenAI-compatible
 *
 * CometAPI provides access to multiple LLM providers (GPT, Claude, Gemini, etc.)
 * through a unified OpenAI-compatible API interface.
 */
export class CometAPIApi extends OpenAIApi implements BaseLlmApi {
  // Store the original CometAPI config separately
  private cometConfig: CometAPIConfig;

  constructor(config: CometAPIConfig) {
    // CometAPI uses OpenAI-compatible API, so we can reuse OpenAI adapter
    // Convert CometAPI config to OpenAI-compatible config for the base class
    const openAICompatibleConfig = {
      ...config,
      provider: "openai" as const,
      apiBase: config.apiBase ?? "https://api.cometapi.com/v1/",
    };
    super(openAICompatibleConfig);

    // Store original config after super() call
    this.cometConfig = config;
  }

  /**
   * Override list method to handle CometAPI-specific model filtering
   * The core filtering logic is handled in the CometAPI provider class
   */
  async list(): Promise<Model[]> {
    try {
      return await super.list();
    } catch (error) {
      // Fallback to empty list if model listing fails
      console.warn("CometAPI: Failed to fetch model list", error);
      return [];
    }
  }

  /**
   * Chat completion - uses OpenAI-compatible format
   */
  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    return super.chatCompletionNonStream(body, signal);
  }

  /**
   * Streaming chat completion - uses OpenAI-compatible format
   */
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    yield* super.chatCompletionStream(body, signal);
  }

  /**
   * Legacy completion endpoint support
   */
  completionNonStream(
    body: CompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Completion> {
    return super.completionNonStream(body, signal);
  }

  /**
   * Legacy streaming completion endpoint support
   */
  completionStream(
    body: CompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<Completion> {
    return super.completionStream(body, signal);
  }

  /**
   * Fill-in-the-middle completion support
   */
  fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    return super.fimStream(body, signal);
  }

  /**
   * Embeddings support (if available through CometAPI)
   */
  async embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    try {
      return await super.embed(body);
    } catch (error) {
      throw new Error(`CometAPI embeddings not supported: ${error}`);
    }
  }

  /**
   * Reranking support (if available through CometAPI)
   */
  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    try {
      return await super.rerank(body);
    } catch (error) {
      throw new Error(`CometAPI reranking not supported: ${error}`);
    }
  }
}
