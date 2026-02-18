// IMPORTANT: Import nativeFetch FIRST to preserve native fetch before any pollution
import { withNativeFetch } from "../util/nativeFetch.js";
import { GoogleGenAI } from "@google/genai";
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
  customFetch,
  embedding,
  usageChatChunk,
} from "../util.js";
import {
  convertOpenAIToolToGeminiFunction,
  GeminiChatContent,
  GeminiChatContentPart,
  GeminiToolFunctionDeclaration,
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

    const contents: (GeminiChatContent | null)[] = oaiBody.messages
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
      .filter((c) => c !== null);

    const sysMsg = oaiBody.messages.find((msg) => msg.role === "system");
    const finalBody: any = {
      generationConfig,
      contents,
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
          completion_tokens: chunk.usageMetadata.candidatesTokenCount || 0,
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
    // Use native fetch temporarily for stream operation to get proper ReadableStream
    // The withNativeFetch wrapper restores native fetch, makes the call, then reverts
    return withNativeFetch(() =>
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
  }

  async *streamWithGenAI(
    genAI: GoogleGenAI,
    body: ChatCompletionCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    const convertedBody = this._convertBody(body, false, true);
    const response = await this.generateStream(
      genAI,
      body.model,
      convertedBody,
    );
    yield* this.processStreamResponse(response, body.model);
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
    const response = await customFetch(this.config.requestOptions)(
      new URL(`${body.model}:batchEmbedContents`, this.apiBase),
      {
        method: "POST",
        body: JSON.stringify({
          requests: inputs.map((input) => ({
            model: body.model,
            content: {
              role: "user",
              parts: [{ text: input }],
            },
          })),
        }),
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "x-goog-api-key": this.config.apiKey,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "Content-Type": "application/json",
        },
      },
    );

    const data = (await response.json()) as any;
    return embedding({
      model: body.model,
      usage: {
        total_tokens: data.total_tokens,
        prompt_tokens: data.prompt_tokens,
      },
      data: data.batchEmbedContents.map((embedding: any) => embedding.values),
    });
  }

  list(): Promise<Model[]> {
    throw new Error("Method not implemented.");
  }
}
