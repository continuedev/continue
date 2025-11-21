import {
  BedrockRuntimeClient,
  ContentBlock,
  ContentBlockStart,
  ConversationRole,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  ImageFormat,
  InvokeModelCommand,
  Message,
  ToolConfiguration,
} from "@aws-sdk/client-bedrock-runtime";
import { OpenAI } from "openai/index";
import { v4 as uuidv4 } from "uuid";

import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionContentPartImage,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageToolCall,
  Completion,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
  Model,
} from "openai/resources/index";

import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { fromStatic } from "@aws-sdk/token-providers";
import { BedrockConfig } from "../types.js";
import { chatChunk, chatChunkFromDelta, embedding, rerank } from "../util.js";
import { safeParseArgs } from "../util/parseArgs.js";
import { parseDataUrl } from "../util/url.js";
import {
  BaseLlmApi,
  CreateRerankResponse,
  FimCreateParamsStreaming,
  RerankCreateParams,
} from "./base.js";

// Utility function to get or generate UUID for prompt caching
function getSecureID(): string {
  // Adding a type declaration for the static property
  if (!(getSecureID as any).uuid) {
    (getSecureID as any).uuid = uuidv4();
  }
  return `<!-- SID: ${(getSecureID as any).uuid} -->`;
}

/**
 * Interface for tool use state tracking
 */
interface ToolUseState {
  toolUseId: string;
  name: string;
  input: string;
}

export class BedrockApi implements BaseLlmApi {
  constructor(protected config: BedrockConfig) {
    if (config.env?.accessKeyId || config?.env?.secretAccessKey) {
      if (!config.env?.accessKeyId) {
        throw new Error(
          "accessKeyId is required for Bedrock API. Only found secretAccessKey",
        );
      }
      if (!config.env?.secretAccessKey) {
        throw new Error(
          "secretAccessKey is required for Bedrock API. Only found accessKeyId",
        );
      }
    }
  }

  async getCreds() {
    if (this.config?.env?.accessKeyId && this.config?.env?.secretAccessKey) {
      return {
        accessKeyId: this.config.env.accessKeyId,
        secretAccessKey: this.config.env.secretAccessKey,
      };
    }
    const profile = this.config.env?.profile ?? "bedrock";
    try {
      return await fromNodeProviderChain({
        profile: profile,
        ignoreCache: true,
      })();
    } catch (e) {
      console.warn(
        `AWS profile with name ${profile} not found in ~/.aws/credentials, using default profile`,
      );
    }
    return await fromNodeProviderChain()();
  }
  async getClient(): Promise<BedrockRuntimeClient> {
    const region = this.config.env?.region;

    // If apiKey is provided, use bearer token authentication
    if (this.config.apiKey) {
      return new BedrockRuntimeClient({
        region,
        token: fromStatic({
          token: { token: this.config.apiKey },
        }),
      });
    }

    // Otherwise use IAM credentials (existing behavior)
    const creds = await this.getCreds();
    return new BedrockRuntimeClient({
      region,
      credentials: creds,
    });
  }

  private _oaiPartToBedrockPart(
    part:
      | OpenAI.Chat.Completions.ChatCompletionContentPart
      | OpenAI.Chat.Completions.ChatCompletionContentPartRefusal,
  ): ContentBlock {
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
        const parsed = parseDataUrl(
          (part as ChatCompletionContentPartImage).image_url.url,
        );
        if (!parsed) {
          console.warn("Bedrock: failed to process image part - invalid URL");
          return { text: "[Failed to process image]" };
        }
        const { mimeType, base64Data } = parsed;
        const format = mimeType.split("/")[1]?.split(";")[0] || "jpeg";
        if (
          format === ImageFormat.JPEG ||
          format === ImageFormat.PNG ||
          format === ImageFormat.WEBP ||
          format === ImageFormat.GIF
        ) {
          return {
            image: {
              format,
              source: {
                bytes: Uint8Array.from(Buffer.from(base64Data, "base64")),
              },
            },
          };
        } else {
          console.warn(
            `Bedrock: skipping unsupported image part format: ${format}`,
          );
          return { text: "[Unsupported image format]" };
        }
    }
  }

  private _convertMessages(
    oaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    availableTools: Set<string>,
  ): Message[] {
    let currentRole: "user" | "assistant" = "user";
    let currentBlocks: ContentBlock[] = [];
    const converted: Message[] = [];
    const hasAddedToolCallIds = new Set<string>();

    const pushCurrentMessage = () => {
      if (currentBlocks.length > 0) {
        converted.push({
          role: currentRole,
          content: currentBlocks,
        });
        currentBlocks = [];
      }
    };

    const nonSystemMessages = oaiMessages.filter((m) => m.role !== "system");

    for (let idx = 0; idx < nonSystemMessages.length; idx++) {
      const message = nonSystemMessages[idx];

      if (message.role === "user" || message.role === "tool") {
        // Detect conversational turn change
        if (currentRole !== ConversationRole.USER) {
          pushCurrentMessage();
          currentRole = ConversationRole.USER;
        }

        // USER messages
        if (message.role === "user") {
          const content = message.content;
          if (content) {
            if (typeof content === "string") {
              currentBlocks.push({ text: content });
            } else {
              content.forEach((part) => {
                currentBlocks.push(this._oaiPartToBedrockPart(part));
              });
            }
          }
        }
        // TOOL messages
        else if (message.role === "tool") {
          const trimmedContent =
            typeof message.content === "string"
              ? message.content.trim()
              : message.content
                  .map((c) => c.text)
                  .join("\n")
                  .trim();

          if (hasAddedToolCallIds.has(message.tool_call_id)) {
            currentBlocks.push({
              toolResult: {
                toolUseId: message.tool_call_id,
                content: [
                  {
                    text: trimmedContent || "No tool output",
                  },
                ],
              },
            });
          } else {
            currentBlocks.push({
              text: `Tool call output for Tool Call ID ${message.tool_call_id}:\n\n${trimmedContent || "No tool output"}`,
            });
          }
        }
      } else if (message.role === "assistant") {
        // Detect conversational turn change
        if (currentRole !== ConversationRole.ASSISTANT) {
          pushCurrentMessage();
          currentRole = ConversationRole.ASSISTANT;
        }

        // ASSISTANT messages
        if (typeof message.content === "string") {
          const trimmedText = message.content.trim();
          if (trimmedText) {
            currentBlocks.push({ text: trimmedText });
          }
        } else {
          message.content?.forEach((part) => {
            const text = part.type === "text" ? part.text : part.refusal;
            const trimmedText = text.trim();
            if (trimmedText) {
              currentBlocks.push({ text: trimmedText });
            }
          });
        }

        // TOOL CALLS
        if (message.tool_calls) {
          for (const toolCall of message.tool_calls) {
            // Type guard for function tool calls
            if (
              toolCall.type === "function" &&
              "function" in toolCall &&
              toolCall.id &&
              toolCall.function?.name
            ) {
              if (availableTools.has(toolCall.function.name)) {
                currentBlocks.push({
                  toolUse: {
                    toolUseId: toolCall.id,
                    name: toolCall.function.name,
                    input: safeParseArgs(
                      toolCall.function.arguments,
                      `Call: ${toolCall.function.name} ${toolCall.id}`,
                    ),
                  },
                });
                hasAddedToolCallIds.add(toolCall.id);
              } else {
                const toolCallText = `Assistant tool call:\nTool name: ${toolCall.function.name}\nTool Call ID: ${toolCall.id}\nArguments: ${toolCall.function?.arguments ?? "{}"}`;
                currentBlocks.push({
                  text: toolCallText,
                });
              }
            } else {
              console.warn(
                `Unsupported tool call type in Bedrock: ${toolCall.type}`,
              );
            }
          }
        }
      }
    }

    if (currentBlocks.length > 0) {
      pushCurrentMessage();
    }

    // If caching is enabled, add cache points
    // if (this.config.cacheBehavior?.cacheConversation) {
    //   this._addCachingToLastTwoUserMessages(converted);
    // }

    return converted;
  }

  private _addCachingToLastTwoUserMessages(converted: Message[]) {
    let numCached = 0;
    for (let i = converted.length - 1; i >= 0; i--) {
      const message = converted[i];
      if (message.role === "user") {
        message.content?.forEach((block) => {
          if (block.text) {
            block.text += getSecureID();
          }
        });
        message.content?.push({ cachePoint: { type: "default" } });
        numCached++;
      }
      if (numCached === 2) {
        break;
      }
    }
  }

  private _convertBody(
    oaiBody: ChatCompletionCreateParams,
  ): ConverseStreamCommandInput {
    // Extract system message
    const systemMessage =
      oaiBody.messages.find((msg) => msg.role === "system")?.content || "";

    const systemMessageText =
      typeof systemMessage === "string"
        ? systemMessage
        : systemMessage
            .map((part) =>
              part.type === "text" ? part.text : "[Non-text content]",
            )
            .join(" ");

    // Check for tools
    const availableTools = new Set<string>();
    let toolConfig: ToolConfiguration | undefined = undefined;

    if (oaiBody.tools && oaiBody.tools.length > 0) {
      toolConfig = {
        tools: oaiBody.tools.map((tool) => {
          // Type guard for function tools
          if (tool.type === "function" && "function" in tool) {
            return {
              toolSpec: {
                name: tool.function.name,
                description: tool.function.description,
                inputSchema: {
                  json: tool.function.parameters,
                },
              },
            };
          } else {
            throw new Error(`Unsupported tool type in Bedrock: ${tool.type}`);
          }
        }),
      } as ToolConfiguration;

      // Add cache point if needed
      // if (this.config.cacheBehavior?.cacheSystemMessage) {
      //   toolConfig!.tools!.push({ cachePoint: { type: "default" } });
      // }

      oaiBody.tools.forEach((tool) => {
        if (tool.type === "function" && "function" in tool) {
          availableTools.add(tool.function.name);
        }
      });
    }

    // Convert messages
    const convertedMessages = this._convertMessages(
      oaiBody.messages,
      availableTools,
    );

    // Build final request body
    const body: any = {
      modelId: oaiBody.model,
      messages: convertedMessages,
      inferenceConfig: {
        temperature: oaiBody.temperature,
        topP: oaiBody.top_p,
        maxTokens: oaiBody.max_tokens,
        stopSequences: Array.isArray(oaiBody.stop)
          ? oaiBody.stop.filter((s) => s.trim() !== "").slice(0, 4)
          : oaiBody.stop
            ? [oaiBody.stop].filter((s) => s.trim() !== "")
            : undefined,
      },
    };

    // Add system message if present
    if (systemMessageText) {
      body.system = false // this.config.cacheBehavior?.cacheSystemMessage // TODO
        ? [{ text: systemMessageText }, { cachePoint: { type: "default" } }]
        : [{ text: systemMessageText }];
    }

    // Add tool config if present
    if (toolConfig) {
      body.toolConfig = toolConfig;
    }

    // Add reasoning if needed
    // TODO REASONING
    // if (this.c) {
    //   body.additionalModelRequestFields = {
    //     thinking: {
    //       type: "enabled",
    //       budget_tokens:
    //         oaiBody.additionalModelRequestFields.reasoningBudgetTokens,
    //     },
    //   };
    // }

    return body;
  }

  async chatCompletionNonStream(
    body: ChatCompletionCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<ChatCompletion> {
    let completion = "";
    const toolCalls: ChatCompletionMessageToolCall[] = [];

    for await (const chunk of this.chatCompletionStream(
      {
        ...body,
        stream: true,
      },
      signal,
    )) {
      if (chunk.choices[0].delta.content) {
        completion += chunk.choices[0].delta.content;
      }
      // TODO tool calls not supported
    }

    return {
      id: uuidv4(),
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
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
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
    const requestBody = this._convertBody(body);

    try {
      const command = new ConverseStreamCommand({
        ...requestBody,
      });

      const client = await this.getClient();
      const response = await client.send(command, { abortSignal: signal });

      if (!response?.stream) {
        throw new Error("No stream received from Bedrock API");
      }

      for await (const chunk of response.stream) {
        if (chunk.contentBlockDelta?.delta) {
          const delta: any = chunk.contentBlockDelta.delta;

          // Handle text content
          if (delta.text) {
            yield chatChunk({
              content: delta.text,
              model: body.model,
            });
            continue;
          }

          // Handle thinking content (if reasoning enabled)
          if (delta.reasoningContent?.text) {
            // TODO reasoning
            // Reasoning is not directly supported in OpenAI format,
            // but we could add it as a special message
            continue;
          }

          // Handle tool use
          if (delta.toolUse) {
            yield chatChunkFromDelta({
              model: body.model,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: delta.toolUse.toolUseId,
                    type: "function",
                    function: {
                      name: delta.toolUse.name,
                      arguments: delta.toolUse.input,
                    },
                  },
                ],
              },
            });
          }
        }

        if (chunk.contentBlockStart?.start) {
          const start: ContentBlockStart = chunk.contentBlockStart.start;

          if (start.toolUse) {
            yield chatChunkFromDelta({
              model: body.model,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: start.toolUse.toolUseId,
                    type: "function",
                    function: {
                      name: start.toolUse.name,
                      arguments: undefined,
                    },
                  },
                ],
              },
            });
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if ("code" in error) {
          throw new Error(
            `AWS Bedrock stream error (${(error as any).code}): ${error.message}`,
          );
        }
        throw new Error(`Error processing Bedrock stream: ${error.message}`);
      }
      throw new Error(
        "Error processing Bedrock stream: Unknown error occurred",
      );
    }
  }

  completionNonStream(
    body: CompletionCreateParamsNonStreaming,
  ): Promise<Completion> {
    throw new Error("Bedrock does not support completions API");
  }

  completionStream(
    body: CompletionCreateParamsStreaming,
  ): AsyncGenerator<Completion> {
    throw new Error("Bedrock does not support completions API");
  }

  fimStream(
    body: FimCreateParamsStreaming,
  ): AsyncGenerator<ChatCompletionChunk> {
    throw new Error("Bedrock does not support FIM directly");
  }

  private async getInvokeModelResponseBody(model: string, jsonBody: object) {
    const payload = {
      body: JSON.stringify(jsonBody),
      modelId: model,
      accept: "*/*",
      contentType: "application/json",
    };
    const command = new InvokeModelCommand(payload);
    const client = await this.getClient();
    const response = await client.send(command);
    if (!response.body) {
      throw new Error("No response body");
    }
    const decoder = new TextDecoder();
    const decoded = decoder.decode(response.body);
    return JSON.parse(decoded);
  }

  private getEmbedTexts(body: EmbeddingCreateParams): string[] {
    const texts: string[] = [];
    if (typeof body.input === "string") {
      texts.push(body.input);
    } else if (body.input.length > 0) {
      const firstVal = body.input[0];
      if (Array.isArray(firstVal)) {
        throw new Error("Unsupported embeddings type received: number[][]");
      }
      if (typeof firstVal === "string") {
        texts.push(...(body.input as string[]));
      } else {
        throw new Error("Unsupported embeddings type received: number[]");
      }
    }
    return texts;
  }

  async embed(body: EmbeddingCreateParams): Promise<CreateEmbeddingResponse> {
    const texts = this.getEmbedTexts(body);

    let embeddings: number[][];
    if (body.model.startsWith("cohere")) {
      const payload = {
        texts,
        input_type: "search_document",
        truncate: "END",
      };
      const output = await this.getInvokeModelResponseBody(body.model, payload);
      embeddings = [output.embedding];
    } else if (body.model.startsWith("amazon.titan-embed")) {
      embeddings = await Promise.all(
        texts.map(async (text) => {
          const payload = {
            inputText: text,
          };
          const output = await this.getInvokeModelResponseBody(
            body.model,
            payload,
          );
          return output.embeddings || [];
        }),
      );
    } else {
      throw new Error(`Unsupported model: ${body.model}`);
    }

    return embedding({
      data: embeddings,
      model: body.model,
      usage: {
        prompt_tokens: 0,
        total_tokens: 0,
      },
    });
  }

  async rerank(body: RerankCreateParams): Promise<CreateRerankResponse> {
    if (!body.query || !body.documents.length) {
      throw new Error("Query and chunks must not be empty");
    }

    // Base payload for both models
    const payload: any = {
      query: body.query,
      documents: body.documents,
      top_n: body.top_k ?? body.documents.length,
    };

    // Add api_version for Cohere model
    if (body.model.startsWith("cohere.rerank")) {
      payload.api_version = 2;
    }

    try {
      const responseBody = await this.getInvokeModelResponseBody(
        body.model,
        payload,
      );
      const scores = responseBody.results
        .sort((a: any, b: any) => a.index - b.index)
        .map((result: any) => result.relevance_score);

      return rerank({
        model: body.model,
        usage: {
          total_tokens: 0,
        },
        data: scores,
      });
    } catch (error) {
      if (error instanceof Error) {
        if ("code" in error) {
          // AWS SDK specific errors
          throw new Error(
            `AWS Bedrock rerank error (${(error as any).code}): ${error.message}`,
          );
        }
        throw new Error(`Error in BedrockReranker.rerank: ${error.message}`);
      }
      throw new Error(
        "Error in BedrockReranker.rerank: Unknown error occurred",
      );
    }
  }

  list(): Promise<Model[]> {
    throw new Error("Method not implemented.");
  }
}
