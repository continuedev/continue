import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
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
import { AiSdkConfig } from "../types.js";
import { customFetch, embedding } from "../util.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

type AiSdkProviderCreator = (options: {
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof fetch;
}) => (modelId: string) => any;

const PROVIDER_MAP: Record<string, AiSdkProviderCreator> = {
  openai: createOpenAI,
  anthropic: createAnthropic,
  xai: createXai,
  deepseek: createDeepSeek,
  openrouter: (options) =>
    createOpenAI({
      ...options,
      baseURL: options.baseURL ?? "https://openrouter.ai/api/v1/",
    }),
};

export class AiSdkApi implements BaseLlmApi {
  private provider?: (modelId: string) => any;
  private config: AiSdkConfig;
  private providerId: string;
  private modelId: string;

  constructor(config: AiSdkConfig) {
    this.config = config;
    if (!config.model) {
      throw new Error(
        "AI SDK provider requires a model in the format '<provider>/<model>' (e.g., 'openai/gpt-4o')",
      );
    }
    const [providerId, ...modelParts] = config.model.split("/");
    this.providerId = providerId;
    this.modelId = modelParts.join("/");
  }

  private initializeProvider() {
    if (this.provider) {
      return;
    }

    const createFn = PROVIDER_MAP[this.providerId];
    if (!createFn) {
      const supportedProviders = Object.keys(PROVIDER_MAP).join(", ");
      throw new Error(
        `Unknown AI SDK provider: "${this.providerId}". ` +
          `Supported providers: ${supportedProviders}. ` +
          `To use a different provider, install the @ai-sdk/* package and add it to the provider map.`,
      );
    }

    const hasRequestOptions =
      this.config.requestOptions &&
      (this.config.requestOptions.headers ||
        this.config.requestOptions.proxy ||
        this.config.requestOptions.caBundlePath ||
        this.config.requestOptions.clientCertificate ||
        this.config.requestOptions.extraBodyProperties);

    this.provider = createFn({
      apiKey: this.config.apiKey ?? "",
      baseURL: this.config.apiBase,
      fetch: hasRequestOptions
        ? customFetch(this.config.requestOptions)
        : undefined,
    });
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    this.initializeProvider();

    const { generateText } = await import("ai");
    const { convertOpenAIMessagesToVercel } = await import(
      "../openaiToVercelMessages.js"
    );
    const { convertToolsToVercelFormat } = await import(
      "../convertToolsToVercel.js"
    );
    const { convertToolChoiceToVercel } = await import(
      "../convertToolChoiceToVercel.js"
    );

    const vercelMessages = convertOpenAIMessagesToVercel(body.messages);
    const systemMsg = vercelMessages.find((msg) => msg.role === "system");
    const systemText =
      systemMsg && typeof systemMsg.content === "string"
        ? systemMsg.content
        : undefined;
    const nonSystemMessages = vercelMessages.filter(
      (msg) => msg.role !== "system",
    );

    const modelId = this.modelId ?? body.model;
    const model = this.provider!(modelId);
    const vercelTools = await convertToolsToVercelFormat(body.tools);

    const result = await generateText({
      model,
      system: systemText,
      messages: nonSystemMessages as any,
      temperature: body.temperature ?? undefined,
      maxOutputTokens: body.max_tokens ?? undefined,
      topP: body.top_p ?? undefined,
      stopSequences: body.stop
        ? Array.isArray(body.stop)
          ? body.stop
          : [body.stop]
        : undefined,
      tools: vercelTools,
      toolChoice: convertToolChoiceToVercel(body.tool_choice),
      abortSignal: signal,
    });

    const toolCalls = result.toolCalls?.map((tc) => ({
      id: tc.toolCallId,
      type: "function" as const,
      function: {
        name: tc.toolName,
        arguments: JSON.stringify(tc.input),
      },
    }));

    return {
      id: result.response?.id ?? "",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: modelId,
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
        prompt_tokens: result.usage.inputTokens ?? 0,
        completion_tokens: result.usage.outputTokens ?? 0,
        total_tokens:
          (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      },
    };
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    this.initializeProvider();

    const { streamText } = await import("ai");
    const { convertOpenAIMessagesToVercel } = await import(
      "../openaiToVercelMessages.js"
    );
    const { convertToolsToVercelFormat } = await import(
      "../convertToolsToVercel.js"
    );
    const { convertVercelStream } = await import("../vercelStreamConverter.js");
    const { convertToolChoiceToVercel } = await import(
      "../convertToolChoiceToVercel.js"
    );

    const vercelMessages = convertOpenAIMessagesToVercel(body.messages);
    const systemMsg = vercelMessages.find((msg) => msg.role === "system");
    const systemText =
      systemMsg && typeof systemMsg.content === "string"
        ? systemMsg.content
        : undefined;
    const nonSystemMessages = vercelMessages.filter(
      (msg) => msg.role !== "system",
    );

    const modelId = this.modelId ?? body.model;
    const model = this.provider!(modelId);
    const vercelTools = await convertToolsToVercelFormat(body.tools);

    const result = streamText({
      model,
      system: systemText,
      messages: nonSystemMessages as any,
      temperature: body.temperature ?? undefined,
      maxOutputTokens: body.max_tokens ?? undefined,
      topP: body.top_p ?? undefined,
      stopSequences: body.stop
        ? Array.isArray(body.stop)
          ? body.stop
          : [body.stop]
        : undefined,
      tools: vercelTools,
      toolChoice: convertToolChoiceToVercel(body.tool_choice),
      abortSignal: signal,
    });

    yield* convertVercelStream(result.fullStream as any, { model: modelId });
  }

  async completionNonStream(
    _body: CompletionCreateParamsNonStreaming,
    _signal: AbortSignal,
  ): Promise<Completion> {
    throw new Error(
      "AI SDK provider does not support legacy completions API. Use chat completions instead.",
    );
  }

  async *completionStream(
    _body: CompletionCreateParamsStreaming,
    _signal: AbortSignal,
  ): AsyncGenerator<Completion> {
    throw new Error(
      "AI SDK provider does not support legacy completions API. Use chat completions instead.",
    );
  }

  async *fimStream(
    _body: FimCreateParamsStreaming,
    _signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    throw new Error(
      "AI SDK provider does not support fill-in-the-middle (FIM) completions.",
    );
  }

  async embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    this.initializeProvider();

    const { embed: aiEmbed, embedMany } = await import("ai");

    const modelId = typeof body.model === "string" ? body.model : body.model;
    const model = this.provider!(modelId);

    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    const stringInputs = inputs.map((input) =>
      typeof input === "string" ? input : String(input),
    );

    if (stringInputs.length === 1) {
      const result = await aiEmbed({
        model,
        value: stringInputs[0],
      });
      return embedding({
        data: [result.embedding],
        model: modelId,
        usage: {
          prompt_tokens: result.usage?.tokens ?? 0,
          total_tokens: result.usage?.tokens ?? 0,
        },
      });
    }

    const result = await embedMany({
      model,
      values: stringInputs,
    });

    return embedding({
      data: result.embeddings,
      model: modelId,
      usage: {
        prompt_tokens: result.usage?.tokens ?? 0,
        total_tokens: result.usage?.tokens ?? 0,
      },
    });
  }

  async rerank(_body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("AI SDK provider does not support reranking.");
  }

  async list(): Promise<Model[]> {
    return [];
  }
}
