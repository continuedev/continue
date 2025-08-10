import { streamSse } from "@continuedev/fetch";
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
  Model,
} from "openai/resources/index";
import { z } from "zod";
import { OpenAIConfigSchema } from "../types.js";
import { customFetch } from "../util.js";
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
      // Necessary because `new OpenAI()` will throw an error if there is no API Key
      apiKey: config.apiKey ?? "",
      baseURL: this.apiBase,
      fetch: customFetch(config.requestOptions),
    });
  }
  modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    // o-series models - only apply for official OpenAI API
    const isOfficialOpenAIAPI = this.apiBase === "https://api.openai.com/v1/";
    if (isOfficialOpenAIAPI) {
      if (body.model.startsWith("o") || body.model.includes("gpt-5")) {
        // a) use max_completion_tokens instead of max_tokens
        body.max_completion_tokens = body.max_tokens;
        body.max_tokens = undefined;

        // b) use "developer" message role rather than "system"
        body.messages = body.messages.map((message) => {
          if (message.role === "system") {
            return { ...message, role: "developer" } as any;
          }
          return message;
        });
      }
      if (body.tools?.length && !body.model.startsWith("o3")) {
        body.parallel_tool_calls = false;
      }
    }
    return body;
  }

  modifyCompletionBody<
    T extends
      | CompletionCreateParamsNonStreaming
      | CompletionCreateParamsStreaming,
  >(body: T): T {
    return body;
  }

  modifyEmbedBody<T extends OpenAI.Embeddings.EmbeddingCreateParams>(
    body: T,
  ): T {
    return body;
  }

  modifyFimBody<T extends FimCreateParamsStreaming>(body: T): T {
    return body;
  }

  modifyRerankBody<T extends RerankCreateParams>(body: T): T {
    return body;
  }

  protected getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": this.config.apiKey ?? "",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    const response = await this.openai.chat.completions.create(
      this.modifyChatBody(body),
      {
        signal,
      },
    );
    return response;
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const response = await this.openai.chat.completions.create(
      this.modifyChatBody(body),
      {
        signal,
      },
    );
    for await (const result of response) {
      yield result;
    }
  }
  async completionNonStream(
    body: CompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Completion> {
    const response = await this.openai.completions.create(
      this.modifyCompletionBody(body),
      { signal },
    );
    return response;
  }
  async *completionStream(
    body: CompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<Completion, any, unknown> {
    const response = await this.openai.completions.create(
      this.modifyCompletionBody(body),
      { signal },
    );
    for await (const result of response) {
      yield result;
    }
  }
  async *fimStream(
    body: FimCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    const endpoint = new URL("fim/completions", this.apiBase);
    const modifiedBody = this.modifyFimBody(body);
    const resp = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: modifiedBody.model,
        prompt: modifiedBody.prompt,
        suffix: modifiedBody.suffix,
        max_tokens: modifiedBody.max_tokens,
        max_completion_tokens: (modifiedBody as any).max_completion_tokens,
        temperature: modifiedBody.temperature,
        top_p: modifiedBody.top_p,
        frequency_penalty: modifiedBody.frequency_penalty,
        presence_penalty: modifiedBody.presence_penalty,
        stop: modifiedBody.stop,
        stream: true,
      }),
      headers: this.getHeaders(),
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
    const response = await this.openai.embeddings.create(
      this.modifyEmbedBody(body),
    );
    return response;
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    const endpoint = new URL("rerank", this.apiBase);
    const modifiedBody = this.modifyRerankBody(body);
    const response = await customFetch(this.config.requestOptions)(endpoint, {
      method: "POST",
      body: JSON.stringify(modifiedBody),
      headers: this.getHeaders(),
    });
    const data = await response.json();
    return data as any;
  }

  async list(): Promise<Model[]> {
    return (await this.openai.models.list()).data;
  }
}
