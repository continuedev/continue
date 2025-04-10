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

import { GeminiConfig } from "../types.js";
import {
  chatChunk,
  chatChunkFromDelta,
  customFetch,
  embedding,
} from "../util.js";
import { GeminiToolFunctionDeclaration } from "../util/gemini-types.js";
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
    part: OpenAI.Chat.Completions.ChatCompletionContentPart,
  ) {
    switch (part.type) {
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
    const contents = oaiBody.messages
      .map((msg) => {
        if (msg.role === "system" && !isV1API) {
          return null; // Don't include system message in contents
        }

        if (msg.role == "assistant" && msg.tool_calls?.length) {
          for (const toolCall of msg.tool_calls) {
            toolCallIdToNameMap.set(toolCall.id, toolCall.function.name);
          }

          return {
            role: "model",
            parts: msg.tool_calls.map((toolCall) => ({
              functionCall: {
                name: toolCall.function.name,
                args: JSON.parse(toolCall.function.arguments || "{}"),
              },
            })),
          };
        }

        if (msg.role === "tool") {
          return {
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: msg.tool_call_id,
                  response: {
                    name: toolCallIdToNameMap.get(msg.tool_call_id),
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
          role: msg.role === "assistant" ? "model" : "user",
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
          if (tool.function.description && tool.function.name) {
            const fn: GeminiToolFunctionDeclaration = {
              description: tool.function.description,
              name: tool.function.name,
            };

            if (
              tool.function.parameters &&
              "type" in tool.function.parameters
              // && typeof tool.function.parameters.type === "string"
            ) {
              if (tool.function.parameters.type === "object") {
                // Gemini can't take an empty object
                // So if empty object param is present just don't add parameters
                if (
                  JSON.stringify(tool.function.parameters.properties) === "{}"
                ) {
                  functions.push(fn);
                  return;
                }
              }
              // Helper function to recursively clean JSON Schema objects
              const cleanJsonSchema = (schema: any): any => {
                if (!schema || typeof schema !== "object") return schema;

                if (Array.isArray(schema)) {
                  return schema.map(cleanJsonSchema);
                }

                const {
                  $schema,
                  additionalProperties,
                  default: defaultValue,
                  ...rest
                } = schema;

                // Recursively clean nested properties
                if (rest.properties) {
                  rest.properties = Object.entries(rest.properties).reduce(
                    (acc, [key, value]) => ({
                      ...acc,
                      [key]: cleanJsonSchema(value),
                    }),
                    {},
                  );
                }

                // Clean items in arrays
                if (rest.items) {
                  rest.items = cleanJsonSchema(rest.items);
                }

                return rest;
              };

              // Clean the parameters and convert type to uppercase
              const cleanedParams = cleanJsonSchema(tool.function.parameters);
              fn.parameters = {
                ...cleanedParams,
                type: (tool.function.parameters as any)?.type?.toUpperCase(),
              };
            }
            functions.push(fn);
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
                      id: "", // Not supported by Gemini
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
