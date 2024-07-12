import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
} from "openai/resources/index.mjs";

export interface FimCreateParamsStreaming
  extends CompletionCreateParamsStreaming {
  suffix: string;
}

export interface BaseLlmApi {
  // Chat, no stream
  chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
  ): Promise<ChatCompletion>;

  // Chat, stream
  chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk>;

  // Completion, no stream
  completionNonStream(
    body: CompletionCreateParamsNonStreaming,
  ): Promise<Completion>;

  // Completion, stream
  completionStream(
    body: CompletionCreateParamsStreaming,
  ): AsyncGenerator<Completion>;

  // FIM, stream
  fimStream(
    body: FimCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk>;
}
