import { AzureKeyCredential, OpenAIClient } from "@azure/openai";

import dotenv from "dotenv";
import {
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
} from "openai/resources/completions.js";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "openai/resources/index.js";
import { LlmApiConfig } from "../index.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

dotenv.config();

const HTTPS_PROXY = process.env.HTTPS_PROXY;
const HTTP_PROXY = process.env.HTTP_PROXY;

const MS_TOKEN = 30;

export class AzureOpenAIApi implements BaseLlmApi {
  private client: OpenAIClient;

  constructor(private config: LlmApiConfig) {
    let proxyOptions;
    const PROXY = HTTPS_PROXY ?? HTTP_PROXY;
    if (PROXY) {
      const url = new URL(PROXY);
      proxyOptions = {
        host: url.hostname,
        port: Number(url.port),
      };
    }

    if (!config.apiBase || !config.apiKey) {
      throw new Error("Azure OpenAI API requires apiBase and apiKey");
    }

    this.client = new OpenAIClient(
      config.apiBase,
      new AzureKeyCredential(config.apiKey),
      {
        proxyOptions,
      },
    );
  }

  private _bodyToOptions(
    body:
      | ChatCompletionCreateParamsStreaming
      | ChatCompletionCreateParamsNonStreaming,
  ) {
    return {
      maxTokens: body.max_tokens ?? undefined,
      temperature: body.temperature ?? undefined,
      topP: body.top_p ?? undefined,
      frequencyPenalty: body.frequency_penalty ?? undefined,
      presencePenalty: body.presence_penalty ?? undefined,
      stop:
        typeof body.stop === "string" ? [body.stop] : (body.stop ?? undefined),
    };
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
  ): Promise<ChatCompletion> {
    const completion = await this.client.getChatCompletions(
      body.model,
      body.messages,
      this._bodyToOptions(body),
    );
    return {
      ...completion,
      object: "chat.completion",
      model: body.model,
      created: completion.created.getTime(),
      usage: completion.usage
        ? {
            total_tokens: completion.usage.totalTokens,
            completion_tokens: completion.usage.completionTokens,
            prompt_tokens: completion.usage.promptTokens,
          }
        : undefined,
      choices: completion.choices.map((choice) => ({
        ...choice,
        logprobs: null,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: choice.message?.content ?? null,
          refusal: null,
        },
      })),
    };
  }
  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    const events = await this.client.streamChatCompletions(
      body.model,
      body.messages,
      this._bodyToOptions(body),
    );

    const eventBuffer: ChatCompletionChunk[] = [];
    let done = false;
    let tokensOutput = 0;
    const ms = MS_TOKEN;
    (async () => {
      for await (const event of events) {
        eventBuffer.push({
          ...event,
          object: "chat.completion.chunk",
          model: body.model,
          created: event.created.getTime(),
          choices: event.choices.map((choice: any) => ({
            ...choice,
            logprobs: undefined,
            finish_reason: null,
            delta: {
              role: (choice.delta?.role as any) ?? "assistant",
              content: choice.delta?.content ?? "",
            },
          })),
          usage: undefined,
        });
      }
      done = true;
    })();

    while (!done) {
      if (eventBuffer.length > 0) {
        const event = eventBuffer.shift()!;
        yield event;
        tokensOutput += event.choices[0]?.delta.content?.length ?? 0;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5));
        continue;
      }

      if (tokensOutput < 100 && eventBuffer.length > 30) {
        await new Promise((resolve) => setTimeout(resolve, ms / 3));
      } else if (eventBuffer.length < 12) {
        await new Promise((resolve) =>
          setTimeout(resolve, ms + 20 * (12 - eventBuffer.length)),
        );
      } else if (eventBuffer.length > 40) {
        await new Promise((resolve) => setTimeout(resolve, ms / 2));
      } else {
        // await new Promise((resolve) => setTimeout(resolve, Math.max(25, 50 - 2 * eventBuffer.length)));
        await new Promise((resolve) => setTimeout(resolve, ms));
      }
    }

    for (const event of eventBuffer) yield event;
  }
  async completionNonStream(
    body: CompletionCreateParamsNonStreaming,
  ): Promise<Completion> {
    const { prompt, logprobs, ...restOfBody } = body;
    const messages = [
      {
        role: "user" as any,
        content: prompt as any,
      },
    ];
    const resp = await this.chatCompletionNonStream({
      messages,
      ...restOfBody,
    });
    return {
      ...resp,
      object: "text_completion",
      choices: resp.choices.map((choice) => ({
        ...choice,
        text: choice.message.content ?? "",
        finish_reason: "stop",
        logprobs: null,
      })),
    };
  }
  async *completionStream(
    body: CompletionCreateParamsStreaming,
  ): AsyncGenerator<Completion> {
    const { prompt, logprobs, ...restOfBody } = body;
    const messages = [
      {
        role: "user" as any,
        content: prompt as any,
      },
    ];
    for await (const event of this.chatCompletionStream({
      messages,
      ...restOfBody,
    })) {
      yield {
        ...event,
        object: "text_completion",
        choices: event.choices.map((choice) => ({
          ...choice,
          text: choice.delta.content ?? "",
          finish_reason: "stop",
          logprobs: null,
        })),
      };
    }
  }
  fimStream(
    body: FimCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    throw new Error(
      "Azure OpenAI does not support fill-in-the-middle (FIM) completions.",
    );
  }

  async embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    const input = typeof body.input === "string" ? [body.input] : body.input;
    const response = await this.client.getEmbeddings(body.model, input as any, {
      dimensions: body.dimensions,
      model: body.model,
    });

    const output = {
      data: response.data.map((item) => ({
        ...item,
        object: "embedding" as const,
      })),
      model: body.model,
      object: "list" as const,
      usage: {
        prompt_tokens: response.usage.promptTokens,
        total_tokens: response.usage.totalTokens,
      },
    };

    return output;
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    throw new Error("Azure OpenAI does not support reranking.");
  }
}
