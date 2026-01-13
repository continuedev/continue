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
import type {
  Response,
  ResponseStreamEvent,
} from "openai/resources/responses/responses.js";
import { z } from "zod";
import { OpenAIConfigSchema } from "../types.js";
import {
  customFetch,
  chatChunk,
  usageChatChunk,
  chatChunkFromDelta,
} from "../util.js";
import {
  createResponsesStreamState,
  fromResponsesChunk,
  isResponsesModel,
  responseToChatCompletion,
  toResponsesParams,
} from "./openaiResponses.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class OpenAIApi implements BaseLlmApi {
  openai: OpenAI;
  apiBase: string = "https://api.openai.com/v1/";
  private openaiProvider?: any;
  private useVercelSDK: boolean;

  constructor(protected config: z.infer<typeof OpenAIConfigSchema>) {
    this.apiBase = config.apiBase ?? this.apiBase;
    this.useVercelSDK = process.env.USE_VERCEL_AI_SDK_OPENAI === "true";

    // Always create the original OpenAI client for fallback
    this.openai = new OpenAI({
      // Necessary because `new OpenAI()` will throw an error if there is no API Key
      apiKey: config.apiKey ?? "",
      baseURL: this.apiBase,
      fetch: customFetch(config.requestOptions),
    });
  }

  private async initializeVercelProvider() {
    if (!this.openaiProvider && this.useVercelSDK) {
      const { createOpenAI } = await import("@ai-sdk/openai");

      // Only use customFetch if we have request options that need it
      // Otherwise use native fetch (Vercel AI SDK requires Web Streams API)
      const hasRequestOptions =
        this.config.requestOptions &&
        (this.config.requestOptions.headers ||
          this.config.requestOptions.proxy ||
          this.config.requestOptions.caBundlePath ||
          this.config.requestOptions.clientCertificate ||
          this.config.requestOptions.extraBodyProperties);

      this.openaiProvider = createOpenAI({
        apiKey: this.config.apiKey ?? "",
        baseURL:
          this.apiBase !== "https://api.openai.com/v1/"
            ? this.apiBase
            : undefined,
        fetch: hasRequestOptions
          ? customFetch(this.config.requestOptions)
          : undefined,
      });
    }
  }
  modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    // Add stream_options to include usage in streaming responses
    if (body.stream) {
      (body as any).stream_options = { include_usage: true };
    }

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

  protected shouldUseResponsesEndpoint(model: string): boolean {
    const isOfficialOpenAIAPI = this.apiBase === "https://api.openai.com/v1/";
    return isOfficialOpenAIAPI && isResponsesModel(model);
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
    if (this.useVercelSDK && !this.shouldUseResponsesEndpoint(body.model)) {
      return this.chatCompletionNonStreamVercel(body, signal);
    }

    if (this.shouldUseResponsesEndpoint(body.model)) {
      const response = await this.responsesNonStream(body, signal);
      return responseToChatCompletion(response);
    }
    const response = await this.openai.chat.completions.create(
      this.modifyChatBody(body),
      {
        signal,
      },
    );
    return response;
  }

  private async chatCompletionNonStreamVercel(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    await this.initializeVercelProvider();

    if (!this.openaiProvider) {
      throw new Error("Vercel AI SDK provider not initialized");
    }

    const { generateText } = await import("ai");
    const { convertToolsToVercelFormat } = await import(
      "../convertToolsToVercel.js"
    );
    const { convertToolChoiceToVercel } = await import(
      "../convertToolChoiceToVercel.js"
    );

    const modifiedBody = this.modifyChatBody({ ...body });
    const model = this.openaiProvider(modifiedBody.model);

    // Convert OpenAI tools to Vercel AI SDK format
    const vercelTools = await convertToolsToVercelFormat(modifiedBody.tools);

    const result = await generateText({
      model,
      messages: modifiedBody.messages as any,
      temperature: modifiedBody.temperature ?? undefined,
      maxTokens:
        modifiedBody.max_completion_tokens ??
        modifiedBody.max_tokens ??
        undefined,
      topP: modifiedBody.top_p ?? undefined,
      frequencyPenalty: modifiedBody.frequency_penalty ?? undefined,
      presencePenalty: modifiedBody.presence_penalty ?? undefined,
      stopSequences: modifiedBody.stop
        ? Array.isArray(modifiedBody.stop)
          ? modifiedBody.stop
          : [modifiedBody.stop]
        : undefined,
      tools: vercelTools,
      toolChoice: convertToolChoiceToVercel(modifiedBody.tool_choice),
      abortSignal: signal,
    });

    // Convert Vercel AI SDK result to OpenAI ChatCompletion format
    const toolCalls = result.toolCalls?.map((tc, index) => ({
      id: tc.toolCallId,
      type: "function" as const,
      function: {
        name: tc.toolName,
        arguments: JSON.stringify(tc.args),
      },
    }));

    return {
      id: result.response?.id ?? "",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: modifiedBody.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: result.text,
            tool_calls: toolCalls,
            refusal: null,
          },
          finish_reason:
            result.finishReason === "tool-calls" ? "tool_calls" : "stop",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: result.usage.promptTokens,
        completion_tokens: result.usage.completionTokens,
        total_tokens: result.usage.totalTokens,
      },
    };
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    if (this.useVercelSDK && !this.shouldUseResponsesEndpoint(body.model)) {
      yield* this.chatCompletionStreamVercel(body, signal);
      return;
    }

    if (this.shouldUseResponsesEndpoint(body.model)) {
      for await (const chunk of this.responsesStream(body, signal)) {
        yield chunk;
      }
      return;
    }
    const response = await this.openai.chat.completions.create(
      this.modifyChatBody(body),
      {
        signal,
      },
    );
    let lastChunkWithUsage: ChatCompletionChunk | undefined;
    for await (const result of response) {
      // Check if this chunk contains usage information
      if (result.usage) {
        // Store it to emit after all content chunks
        lastChunkWithUsage = result;
      } else {
        yield result;
      }
    }
    // Emit the usage chunk at the end if we have one
    if (lastChunkWithUsage) {
      yield lastChunkWithUsage;
    }
  }

  private async *chatCompletionStreamVercel(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk, any, unknown> {
    await this.initializeVercelProvider();

    if (!this.openaiProvider) {
      throw new Error("Vercel AI SDK provider not initialized");
    }

    const { streamText } = await import("ai");
    const { convertToolsToVercelFormat } = await import(
      "../convertToolsToVercel.js"
    );
    const { convertVercelStream } = await import("../vercelStreamConverter.js");
    const { convertToolChoiceToVercel } = await import(
      "../convertToolChoiceToVercel.js"
    );

    const modifiedBody = this.modifyChatBody({ ...body });
    const model = this.openaiProvider(modifiedBody.model);

    // Convert OpenAI tools to Vercel AI SDK format
    const vercelTools = await convertToolsToVercelFormat(modifiedBody.tools);

    const stream = await streamText({
      model,
      messages: modifiedBody.messages as any,
      temperature: modifiedBody.temperature ?? undefined,
      maxTokens:
        modifiedBody.max_completion_tokens ??
        modifiedBody.max_tokens ??
        undefined,
      topP: modifiedBody.top_p ?? undefined,
      frequencyPenalty: modifiedBody.frequency_penalty ?? undefined,
      presencePenalty: modifiedBody.presence_penalty ?? undefined,
      stopSequences: modifiedBody.stop
        ? Array.isArray(modifiedBody.stop)
          ? modifiedBody.stop
          : [modifiedBody.stop]
        : undefined,
      tools: vercelTools,
      toolChoice: convertToolChoiceToVercel(modifiedBody.tool_choice),
      abortSignal: signal,
    });

    // Convert Vercel AI SDK stream to OpenAI format
    // The finish event in fullStream contains the usage data
    yield* convertVercelStream(stream.fullStream as any, {
      model: modifiedBody.model,
    });
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

  async responsesNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Response> {
    const params = toResponsesParams({
      ...(body as ChatCompletionCreateParams),
      stream: false,
    });
    return (await this.openai.responses.create(params, {
      signal,
    })) as Response;
  }

  async *responsesStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const params = toResponsesParams({
      ...(body as ChatCompletionCreateParams),
      stream: true,
    });

    const state = createResponsesStreamState({
      model: body.model,
    });

    const stream = this.openai.responses.stream(params as any, {
      signal,
    });

    for await (const event of stream as AsyncIterable<ResponseStreamEvent>) {
      const chunk = fromResponsesChunk(state, event);
      if (chunk) {
        yield chunk;
      }
    }
  }
}
