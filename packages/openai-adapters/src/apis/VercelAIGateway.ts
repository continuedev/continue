import type {
  ChatCompletionCreateParams,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  EmbeddingCreateParams,
} from "openai/resources/index";
import type { z } from "zod";
import type { OpenAIConfigSchema } from "../types.js";
import { customFetch } from "../util.js";
import type {
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";
import { OpenAIApi } from "./OpenAI.js";

export const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1/";

export function assertGatewayBaseUrl(apiBase?: string) {
  if (
    apiBase &&
    apiBase.replace(/\/$/, "") !== AI_GATEWAY_BASE_URL.slice(0, -1)
  ) {
    throw new Error(
      "This extension uses Vercel AI Gateway exclusively. Remove apiBase or set it to https://ai-gateway.vercel.sh/v1/.",
    );
  }
}

export class VercelAIGatewayApi extends OpenAIApi {
  constructor(config: z.infer<typeof OpenAIConfigSchema>) {
    assertGatewayBaseUrl(config.apiBase);
    const apiKey =
      config.apiKey?.trim() || process.env.AI_GATEWAY_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "Add a Vercel AI Gateway API key in model setup or set AI_GATEWAY_API_KEY.",
      );
    }
    super({
      ...config,
      apiKey,
      apiBase: AI_GATEWAY_BASE_URL,
      useResponsesApi: false,
    });
  }

  // Gateway normalizes provider-specific parameters. Preserve namespaced model IDs.
  modifyChatBody<T extends ChatCompletionCreateParams>(body: T): T {
    return {
      ...body,
      ...(body.stream ? { stream_options: { include_usage: true } } : {}),
    };
  }

  modifyEmbedBody<T extends EmbeddingCreateParams>(body: T): T {
    // Request numeric vectors explicitly instead of the SDK's implicit base64 mode.
    return { ...body, encoding_format: "float" };
  }

  private completionBody(
    body: CompletionCreateParamsNonStreaming | CompletionCreateParamsStreaming,
  ) {
    if (typeof body.prompt !== "string") {
      throw new Error("Gateway completions require a text prompt.");
    }
    return {
      model: body.model,
      messages: [{ role: "user" as const, content: body.prompt }],
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      top_p: body.top_p,
      stop: body.stop,
    };
  }

  async completionNonStream(
    body: CompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<Completion> {
    const result = await this.chatCompletionNonStream(
      { ...this.completionBody(body), stream: false },
      signal,
    );
    return {
      id: result.id,
      created: result.created,
      model: result.model,
      object: "text_completion",
      usage: result.usage,
      choices: result.choices.map((choice) => ({
        index: choice.index,
        text: choice.message.content ?? "",
        logprobs: null,
        finish_reason: choice.finish_reason === "length" ? "length" : "stop",
      })),
    };
  }

  async *completionStream(
    body: CompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<Completion> {
    for await (const chunk of this.chatCompletionStream(
      { ...this.completionBody(body), stream: true },
      signal,
    )) {
      yield {
        id: chunk.id,
        created: chunk.created,
        model: chunk.model,
        object: "text_completion",
        usage: chunk.usage ?? undefined,
        choices: chunk.choices.map((choice) => ({
          index: choice.index,
          text: choice.delta.content ?? "",
          logprobs: null,
          finish_reason: choice.finish_reason === "length" ? "length" : "stop",
        })),
      };
    }
  }

  async *fimStream(body: FimCreateParamsStreaming, signal: AbortSignal) {
    yield* this.chatCompletionStream(
      {
        ...this.completionBody(body),
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "Complete the code at the cursor between PREFIX and SUFFIX. Return only the missing code, with no markdown fences, explanations, or repetition of the surrounding code.",
          },
          {
            role: "user",
            content: `PREFIX:\n${body.prompt}\nCURSOR\nSUFFIX:\n${body.suffix}`,
          },
        ],
      },
      signal,
    );
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    const response = await customFetch(this.config.requestOptions)(
      "https://ai-gateway.vercel.sh/v2/rerank",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: body.model,
          query: body.query,
          documents: body.documents,
          top_n: body.top_k,
        }),
      },
    );
    if (!response.ok)
      throw new Error(
        `Gateway reranking failed (${response.status}): ${await response.text()}`,
      );
    const result = (await response.json()) as {
      results?: CreateRerankResponse["data"];
    };
    if (!Array.isArray(result.results))
      throw new Error("Gateway returned an invalid reranking response.");
    return {
      object: "list",
      data: result.results,
      model: body.model,
      usage: { total_tokens: 0 },
    };
  }
}
