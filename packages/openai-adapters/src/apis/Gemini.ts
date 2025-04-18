import { streamResponse } from "@continuedev/fetch";
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
} from "../util.js";
import {
  convertOpenAIToolToGeminiFunction,
  GeminiChatContent,
  GeminiChatContentPart,
  GeminiToolFunctionDeclaration,
} from "../util/gemini-types.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

export class GeminiApi implements BaseLlmApi {
  apiBase: string = "https://generativelanguage.googleapis.com/v1beta/";

  static maxStopSequences = 5;

  constructor(protected config: GeminiConfig) {
    this.apiBase = config.apiBase ?? this.apiBase;
  }

  private _convertMessages(
    msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): any[] {
    return msgs.map((m) => ({
      role: m.role === "assistant" ? "CHATBOT" : "USER",
      message: m.content,
    }));
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
            data: part.image_url?.url.split(",")[1],
          },
        };
    }
  }

  private _convertBody(oaiBody: ChatCompletionCreateParams, url: string) {
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

    const isV1API = url.includes("/v1/");

    const toolCallIdToNameMap = new Map<string, string>();
    oaiBody.messages.forEach((msg) => {
      if (msg.role === "assistant" && msg.tool_calls) {
        msg.tool_calls.forEach((call) => {
          toolCallIdToNameMap.set(call.id, call.function.name);
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
            toolCallIdToNameMap.set(toolCall.id, toolCall.function.name);
          }

          return {
            role: "model" as const,
            parts: msg.tool_calls.map((toolCall) => ({
              functionCall: {
                id: toolCall.id,
                name: toolCall.function.name,
                args: JSON.parse(toolCall.function.arguments || "{}"),
              },
            })),
          };
        }

        if (msg.role === "tool") {
          const functionName = toolCallIdToNameMap.get(msg.tool_call_id);
          return {
            role: "user" as const,
            parts: [
              {
                functionResponse: {
                  id: msg.tool_call_id,
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
    for await (const chunk of this.chatCompletionStream(
      {
        ...body,
        stream: true,
      },
      signal,
    )) {
      completion += chunk.choices[0].delta.content;
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
      usage: undefined,
    };
  }

  async *chatCompletionStream(
    body: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<ChatCompletionChunk> {
    const apiURL = new URL(
      `models/${body.model}:streamGenerateContent?key=${this.config.apiKey}`,
      this.apiBase,
    ).toString();
    const convertedBody = this._convertBody(body, apiURL);
    const resp = await customFetch(this.config.requestOptions)(apiURL, {
      method: "POST",
      body: JSON.stringify(convertedBody),
      signal,
    });

    let buffer = "";
    for await (const chunk of streamResponse(resp as any)) {
      buffer += chunk;
      if (buffer.startsWith("[")) {
        buffer = buffer.slice(1);
      }
      if (buffer.endsWith("]")) {
        buffer = buffer.slice(0, -1);
      }
      if (buffer.startsWith(",")) {
        buffer = buffer.slice(1);
      }

      const parts = buffer.split("\n,");

      let foundIncomplete = false;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        let data;
        try {
          data = JSON.parse(part);
        } catch (e) {
          foundIncomplete = true;
          continue; // yo!
        }
        if (data.error) {
          throw new Error(data.error.message);
        }

        const content = data?.candidates?.[0]?.content;
        if (content) {
          for (const part of content.parts) {
            if ("text" in part) {
              yield chatChunk({
                content: part.text,
                model: body.model,
              });
            } else if ("functionCall" in part) {
              yield chatChunkFromDelta({
                model: body.model,
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: part.functionCall.id ?? uuidv4(),
                      type: "function",
                      function: {
                        name: part.functionCall.name,
                        arguments: JSON.stringify(part.functionCall.args),
                      },
                    },
                  ],
                },
              });
            }
          }
        } else {
          console.warn("Unexpected response format:", data);
        }
      }
      if (foundIncomplete) {
        buffer = parts[parts.length - 1];
      } else {
        buffer = "";
      }
    }
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
