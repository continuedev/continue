// IMPORTANT: Import nativeFetch FIRST to preserve native fetch before any pollution
import { withNativeFetch } from "../util/nativeFetch.js";
import { withRequestOptionsFetch } from "../util/requestOptionsFetch.js";
import { GoogleGenAI, type HttpOptions } from "@google/genai";
import { OpenAI } from "openai/index";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionContentPartImage,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  CompletionUsage,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
  Model,
} from "openai/resources/index";

import { v4 as uuidv4 } from "uuid";
import { GeminiConfig } from "../types.js";
import {
  chatChunk,
  chatChunkFromDelta,
  embedding,
  usageChatChunk,
} from "../util.js";
import {
  convertOpenAIToolToGeminiFunction,
  GeminiChatContent,
  GeminiChatContentPart,
  GeminiToolFunctionDeclaration,
  mergeConsecutiveGeminiMessages,
} from "../util/gemini-types.js";
import { safeParseArgs } from "../util/parseArgs.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

type UsageInfo = Pick<
  CompletionUsage,
  "total_tokens" | "completion_tokens" | "prompt_tokens"
>;

interface GeminiToolCall
  extends OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall {
  extra_content?: {
    google?: {
      thought_signature?: string;
    };
  };
}

interface GeminiToolDelta
  extends OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta {
  extra_content?: {
    google?: {
      thought_signature?: string;
    };
  };
}

/**
 * Build the httpOptions handed to the GoogleGenAI SDK from Continue's config.
 *
 * The SDK constructs request URLs by joining `baseUrl` and `apiVersion` with
 * a slash, skipping `apiVersion` when it is an empty string. Continue's
 * `apiBase` already carries its version segment (e.g. `/v1beta/`), so
 * `apiVersion` is blanked to keep the SDK from appending a second one.
 *
 * Returns undefined when nothing is configured so default-config construction
 * is unchanged.
 */
function buildGoogleGenAIHttpOptions(
  config: GeminiConfig,
): HttpOptions | undefined {
  const httpOptions: HttpOptions = {};

  if (config.apiBase) {
    httpOptions.baseUrl = config.apiBase;
    httpOptions.apiVersion = "";
  }

  if (config.requestOptions?.headers) {
    httpOptions.headers = config.requestOptions.headers;
  }

  if (config.requestOptions?.timeout !== undefined) {
    httpOptions.timeout = config.requestOptions.timeout;
  }

  return Object.keys(httpOptions).length > 0 ? httpOptions : undefined;
}

type JsonObject = Record<string, unknown>;

function asJsonObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

/**
 * Extract the human-readable message nested inside a Gemini API error blob.
 *
 * The SDK's ApiError.message is a JSON envelope ({ error: { message, code,
 * status } }) whose error.message is often ITSELF a JSON string from Google
 * (see upstream issue #12945) — so users see "Unknown error" while the real
 * cause ("You exceeded your current quota...") sits two parse levels deep.
 * Walks the nesting until the innermost message; returns undefined for
 * non-JSON, malformed, or message-less input so callers can pass the
 * original error through unchanged.
 *
 * Mirrored by extractNestedJsonMessage in
 * extensions/cli/src/util/formatError.ts — kept as a small local mirror
 * with shared test vectors rather than a new cross-package export. Keep the
 * two in sync.
 */
export function extractNestedGeminiError(
  raw: string,
): { message: string; code?: number } | undefined {
  // Bound the unwrap depth so a gateway returning deeply nested error
  // envelopes cannot force unbounded sequential parses.
  const MAX_DEPTH = 8;
  let node: unknown;
  try {
    node = JSON.parse(raw);
  } catch {
    return undefined;
  }

  let message: string | undefined;
  let code: number | undefined;

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const obj = asJsonObject(node);
    if (!obj) {
      break;
    }
    const target = asJsonObject(obj.error) ?? obj;
    if (typeof target.code === "number") {
      code = target.code;
    }
    if (typeof target.message !== "string") {
      break;
    }
    message = target.message;
    try {
      node = JSON.parse(target.message.trim());
    } catch {
      break;
    }
  }

  return message === undefined ? undefined : { message: message.trim(), code };
}

/**
 * Rebuild an SDK error around its extracted nested message, preserving the
 * HTTP status. Returns the original error untouched when there is nothing
 * to extract — never masks or degrades an unrecognized error.
 */
function normalizeGeminiError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }
  const extracted = extractNestedGeminiError(error.message);
  if (extracted === undefined) {
    return error;
  }
  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : extracted.code;
  const normalized: Error & { status?: number; cause?: unknown } = new Error(
    extracted.message,
  );
  normalized.status = status;
  normalized.cause = error;
  return normalized;
}

export class GeminiApi implements BaseLlmApi {
  apiBase: string = "https://generativelanguage.googleapis.com/v1beta/";
  private genAI: GoogleGenAI;

  static maxStopSequences = 5;

  constructor(protected config: GeminiConfig) {
    this.apiBase = config.apiBase ?? this.apiBase;
    // Create GoogleGenAI with native fetch to avoid pollution
    // from Vercel AI SDK packages that can break stream handling
    this.genAI = withNativeFetch(
      () =>
        new GoogleGenAI({
          apiKey: this.config.apiKey,
          httpOptions: buildGoogleGenAIHttpOptions(this.config),
        }),
    );
  }

  private _oaiPartToGeminiPart(
    part:
      | OpenAI.Chat.Completions.ChatCompletionContentPart
      | OpenAI.Chat.Completions.ChatCompletionContentPartRefusal,
  ): GeminiChatContentPart {
    switch (part.type) {
      case "refusal":
        return {
          text: part.refusal,
        };
      case "text":
        return {
          text: part.text,
        };
      case "input_audio":
        throw new Error("Unsupported part type: input_audio");
      case "image_url":
      default:
        return {
          inlineData: {
            mimeType: "image/jpeg",
            data: (part as ChatCompletionContentPartImage).image_url?.url.split(
              ",",
            )[1],
          },
        };
    }
  }

  public _convertBody(
    oaiBody: ChatCompletionCreateParams,
    isV1API: boolean,
    includeToolCallIds: boolean,
  ) {
    const generationConfig: any = {};

    if (oaiBody.top_p) {
      generationConfig.topP = oaiBody.top_p;
    }
    if (oaiBody.temperature !== undefined && oaiBody.temperature !== null) {
      generationConfig.temperature = oaiBody.temperature;
    }
    if (oaiBody.max_tokens) {
      generationConfig.maxOutputTokens = oaiBody.max_tokens;
    }
    if (oaiBody.stop) {
      const stop = Array.isArray(oaiBody.stop) ? oaiBody.stop : [oaiBody.stop];
      generationConfig.stopSequences = stop.filter((x) => x.trim() !== "");
    }

    const toolCallIdToNameMap = new Map<string, string>();
    oaiBody.messages.forEach((msg) => {
      if (msg.role === "assistant" && msg.tool_calls) {
        msg.tool_calls.forEach((call) => {
          // Type guard for function tool calls
          if (call.type === "function" && "function" in call) {
            toolCallIdToNameMap.set(call.id, call.function.name);
          }
        });
      }
    });

    const contents = oaiBody.messages
      .map((msg) => {
        if (msg.role === "system" && !isV1API) {
          return null; // Don't include system message in contents
        }

        if (msg.role === "assistant" && msg.tool_calls?.length) {
          for (const toolCall of msg.tool_calls) {
            // Type guard for function tool calls
            if (toolCall.type === "function" && "function" in toolCall) {
              toolCallIdToNameMap.set(toolCall.id, toolCall.function.name);
            }
          }

          return {
            role: "model" as const,
            parts: (msg.tool_calls as GeminiToolCall[]).map(
              (toolCall, index) => {
                if (toolCall.type === "function" && "function" in toolCall) {
                  let thoughtSignature: string | undefined;
                  if (index === 0) {
                    const rawSignature =
                      toolCall?.extra_content?.google?.thought_signature;

                    if (
                      typeof rawSignature === "string" &&
                      rawSignature.length > 0
                    ) {
                      thoughtSignature = rawSignature;
                    } else {
                      // Fallback per https://ai.google.dev/gemini-api/docs/thought-signatures
                      // for histories that were not generated by Gemini or are missing signatures.
                      thoughtSignature = "skip_thought_signature_validator";
                    }
                  }

                  return {
                    functionCall: {
                      id: includeToolCallIds ? toolCall.id : undefined,
                      name: toolCall.function.name,
                      args: safeParseArgs(
                        toolCall.function.arguments,
                        `Call: ${toolCall.function.name} ${toolCall.id}`,
                      ),
                    },
                    ...(thoughtSignature && { thoughtSignature }),
                  };
                }
                throw new Error(
                  `Unsupported tool call type in Gemini: ${toolCall.type}`,
                );
              },
            ),
          };
        }

        if (msg.role === "tool") {
          const functionName = toolCallIdToNameMap.get(msg.tool_call_id);
          return {
            role: "user" as const,
            parts: [
              {
                functionResponse: {
                  id: includeToolCallIds ? msg.tool_call_id : undefined,
                  name: functionName ?? "unknown",
                  response: {
                    content:
                      typeof msg.content === "string"
                        ? msg.content
                        : msg.content.map((part) => part.text).join(""),
                  },
                },
              },
            ],
          };
        }

        if (!msg.content) {
          return null;
        }

        return {
          role:
            msg.role === "assistant" ? ("model" as const) : ("user" as const),
          parts:
            typeof msg.content === "string"
              ? [{ text: msg.content }]
              : msg.content.map(this._oaiPartToGeminiPart),
        };
      })
      .filter((c) => c !== null) as GeminiChatContent[];

    const mergedContents = mergeConsecutiveGeminiMessages(contents);

    const sysMsg = oaiBody.messages.find((msg) => msg.role === "system");
    const finalBody: any = {
      generationConfig,
      contents: mergedContents,
      // if there is a system message, reformat it for Gemini API
      ...(sysMsg &&
        !isV1API && {
          systemInstruction: { parts: [{ text: sysMsg.content }] },
        }),
    };

    if (!isV1API) {
      // Convert and add tools if present
      if (oaiBody.tools?.length) {
        // Choosing to map all tools to the functionDeclarations of one tool
        // Rather than map each tool to its own tool + functionDeclaration
        // Same difference
        const functions: GeminiToolFunctionDeclaration[] = [];
        oaiBody.tools.forEach((tool) => {
          try {
            functions.push(convertOpenAIToolToGeminiFunction(tool));
          } catch (e) {
            console.warn(
              `Failed to convert tool to gemini function definition. Skipping: ${JSON.stringify(tool, null, 2)}`,
            );
          }
        });

        if (functions.length) {
          finalBody.tools = [
            {
              functionDeclarations: functions,
            },
          ];
        }
      }
    }

    return finalBody;
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    let completion = "";
    let usage: UsageInfo | undefined = undefined;
    for await (const chunk of this.chatCompletionStream(
      {
        ...body,
        stream: true,
      },
      signal,
    )) {
      if (chunk.choices.length > 0) {
        completion += chunk.choices[0].delta.content || "";
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }
    return {
      id: "",
      object: "chat.completion",
      model: body.model,
      created: Date.now(),
      choices: [
        {
          index: 0,
          logprobs: null,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: completion,
            refusal: null,
          },
        },
      ],
      usage,
    };
  }

  private async *processStreamResponse(
    response: AsyncIterable<any>,
    model: string,
  ): AsyncGenerator<ChatCompletionChunk> {
    let usage: UsageInfo | undefined = undefined;

    for await (const chunk of response) {
      if (chunk.usageMetadata) {
        usage = {
          prompt_tokens: chunk.usageMetadata.promptTokenCount || 0,
          // OpenAI-compatible usage counts reasoning inside completion_tokens;
          // thinking models report those separately as thoughtsTokenCount.
          completion_tokens:
            (chunk.usageMetadata.candidatesTokenCount || 0) +
            (chunk.usageMetadata.thoughtsTokenCount || 0),
          total_tokens: chunk.usageMetadata.totalTokenCount || 0,
        };
      }

      const contentParts = chunk?.candidates?.[0]?.content?.parts;
      if (contentParts) {
        for (const part of contentParts) {
          if (part.text !== undefined) {
            const thoughtSignature = (part as any)?.thoughtSignature;
            if (thoughtSignature) {
              yield chatChunkFromDelta({
                model,
                delta: {
                  role: "assistant",
                  extra_content: {
                    google: {
                      thought_signature: thoughtSignature,
                    },
                  },
                } as GeminiToolDelta,
              });
            }

            yield chatChunk({
              content: part.text,
              model,
            });
          } else if (part.functionCall) {
            const thoughtSignature = (part as any)?.thoughtSignature;
            yield chatChunkFromDelta({
              model,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: (part.functionCall as any).id ?? uuidv4(),
                    type: "function",
                    function: {
                      name: part.functionCall.name ?? "",
                      arguments: JSON.stringify(part.functionCall.args ?? {}),
                    },
                    ...(thoughtSignature && {
                      extra_content: {
                        google: {
                          thought_signature: thoughtSignature,
                        },
                      },
                    }),
                  },
                ],
              },
            });
          }
        }
      }
    }

    if (usage) {
      yield usageChatChunk({
        model,
        usage,
      });
    }
  }

  /**generates stream from @google/genai sdk */
  private async generateStream(
    genAI: GoogleGenAI,
    model: string,
    convertedBody: ReturnType<typeof this._convertBody>,
  ) {
    // Run the SDK call under a fetch matching this config: native fetch for
    // default configs (proper ReadableStream, restored after the call), or a
    // customFetch-backed fetch honoring proxy/TLS requestOptions with its
    // node-fetch Response adapted back to a native one for SDK streaming.
    return withRequestOptionsFetch(this.config.requestOptions, () =>
      genAI.models.generateContentStream({
        model,
        contents: convertedBody.contents,
        config: {
          systemInstruction: convertedBody.systemInstruction,
          tools: convertedBody.tools,
          ...convertedBody.generationConfig,
        },
      }),
    );
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    _signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    try {
      const convertedBody = this._convertBody(
        body,
        this.apiBase.includes("/v1/"),
        true,
      );
      const response = await this.generateStream(
        this.genAI,
        body.model,
        convertedBody,
      );
      yield* this.processStreamResponse(response, body.model);
    } catch (error) {
      // Surface the nested Gemini message (issue #12945 class of failures);
      // unrecognized errors are rethrown untouched.
      throw normalizeGeminiError(error);
    }
  }

  async *streamWithGenAI(
    genAI: GoogleGenAI,
    body: ChatCompletionCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    try {
      const convertedBody = this._convertBody(body, false, true);
      const response = await this.generateStream(
        genAI,
        body.model,
        convertedBody,
      );
      yield* this.processStreamResponse(response, body.model);
    } catch (error) {
      // Same normalization as chatCompletionStream — this entry point serves
      // Vertex AI's Gemini models, which hit the identical error surface.
      throw normalizeGeminiError(error);
    }
  }

  completionNonStream(
    _body: CompletionCreateParamsNonStreaming,
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
    throw new Error("Method not implemented.");
  }

  async embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    const inputs = Array.isArray(body.input) ? body.input : [body.input];
    try {
      // The SDK owns the REST contract — URL construction, model-name
      // normalization, and the response shape ({ embeddings: [{ values }] }).
      // Same proxy/TLS wrapper and error normalization as the chat paths.
      const response = await withRequestOptionsFetch(
        this.config.requestOptions,
        () =>
          this.genAI.models.embedContent({
            model: body.model,
            contents: inputs.map((input) => String(input)),
          }),
      );

      const embeddings = response.embeddings;
      if (!embeddings || embeddings.length === 0) {
        throw new Error(
          `Gemini returned no embeddings for model ${body.model}`,
        );
      }

      return embedding({
        model: body.model,
        // Google's embeddings API reports no token counts — the shared
        // helper applies its documented zero-usage default.
        data: embeddings.map((entry, index) => {
          if (!entry.values) {
            throw new Error(
              `Gemini returned no values for embedding at index ${index}`,
            );
          }
          return entry.values;
        }),
      });
    } catch (error) {
      throw normalizeGeminiError(error);
    }
  }

  list(): Promise<Model[]> {
    throw new Error("Method not implemented.");
  }
}
