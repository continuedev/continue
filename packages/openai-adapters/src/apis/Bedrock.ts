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

import {
  applyCrossRegionInference,
  bedrockCachePoint,
  bedrockCacheTtl,
  bedrockUsageToCompletionUsage,
  getBedrockErrorHint,
  resolveBedrockCacheParts,
} from "./bedrockHelpers.js";
import {
  AutoCacheTtl,
  optsOutOfPromptCache,
  requestedCacheTtl,
} from "./cacheTtl.js";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import {
  createAgentForUrl,
  defaultUseSystemCa,
  getTlsErrorHint,
  needsCustomAgent,
} from "@continuedev/fetch";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { fromStatic } from "@aws-sdk/token-providers";
import { BedrockConfig } from "../types.js";
import {
  chatChunk,
  chatChunkFromDelta,
  embedding,
  rerank,
  usageChatChunk,
} from "../util.js";
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
  /** Counts this instance's cached requests for `cacheBehavior.ttl: auto`. */
  private autoTtl = new AutoCacheTtl();

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

  /** Seam over the AWS SDK credential chain (overridden in tests). */
  protected async credentialChain(profile: string | undefined) {
    return fromNodeProviderChain({ profile, ignoreCache: true })();
  }

  private withHint(e: unknown): unknown {
    if (!(e instanceof Error)) return e;
    const hint = getBedrockErrorHint(e, {
      profile: this.config.env?.profile,
      region: this.config.env?.region,
    });
    if (hint && !e.message.includes(hint)) {
      e.message = `${e.message}\n\n${hint}`;
    }
    return e;
  }

  async getCreds() {
    const env = this.config.env;
    if (env?.accessKeyId && env?.secretAccessKey) {
      return {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
        ...(env.sessionToken ? { sessionToken: env.sessionToken } : {}),
      };
    }
    try {
      if (env?.profile) {
        // Explicitly requested profile: never silently use another one.
        return await this.credentialChain(env.profile);
      }
      // Nothing configured: legacy "bedrock" profile, then the standard chain.
      try {
        return await this.credentialChain("bedrock");
      } catch {
        return await this.credentialChain(undefined);
      }
    } catch (e) {
      throw this.withHint(e);
    }
  }

  /** Service tier, latency mode and guardrail settings from config. */
  private extraConverseFields(): Record<string, unknown> {
    const env = this.config.env;
    return {
      ...(env?.serviceTier ? { serviceTier: { type: env.serviceTier } } : {}),
      ...(env?.latency ? { performanceConfig: { latency: env.latency } } : {}),
      ...(env?.guardrailIdentifier
        ? {
            guardrailConfig: {
              guardrailIdentifier: env.guardrailIdentifier,
              guardrailVersion: env.guardrailVersion ?? "DRAFT",
            },
          }
        : {}),
    };
  }

  private resolveApiKey(): string | undefined {
    if (this.config.apiKey) return this.config.apiKey;
    const env = this.config.env;
    if ((env?.accessKeyId && env?.secretAccessKey) || env?.profile) {
      return undefined;
    }
    return process.env.AWS_BEARER_TOKEN_BEDROCK || undefined;
  }

  private requestHandler?: Promise<NodeHttpHandler | undefined>;

  /**
   * Applies `requestOptions` (proxy, CA bundle, system CA store, client
   * certificate, verifySsl) to the AWS SDK, which otherwise ignores them.
   * Undefined when nothing needs customising.
   */
  private getRequestHandler(): Promise<NodeHttpHandler | undefined> {
    this.requestHandler ??= (async () => {
      const region = this.config.env?.region ?? "us-east-1";
      const url = new URL(`https://bedrock-runtime.${region}.amazonaws.com`);
      const options = this.config.requestOptions;
      if (!needsCustomAgent(url, options, defaultUseSystemCa())) {
        return undefined;
      }
      const { agent } = await createAgentForUrl(url, options);
      return new NodeHttpHandler({ httpsAgent: agent });
    })();
    return this.requestHandler;
  }

  async getClient(): Promise<BedrockRuntimeClient> {
    const region = this.config.env?.region;
    const requestHandler = await this.getRequestHandler();
    const networking = requestHandler ? { requestHandler } : {};

    // If apiKey is provided, use bearer token authentication
    const apiKey = this.resolveApiKey();
    if (apiKey) {
      return new BedrockRuntimeClient({
        region,
        ...networking,
        token: fromStatic({
          token: { token: apiKey },
        }),
        // Select bearer auth explicitly: otherwise the SDK may pick SigV4 and look for AWS
        // credentials (failing with "Could not load credentials") for key-only setups.
        authSchemePreference: ["httpBearerAuth"],
      });
    }

    // Otherwise use IAM credentials (existing behavior)
    const creds = await this.getCreds();
    return new BedrockRuntimeClient({
      region,
      ...networking,
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
    cache?: { conversation: boolean; ttl?: "1h" },
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
    if (cache?.conversation) {
      this._addCachingToLastTwoUserMessages(converted, cache.ttl);
    }

    return converted;
  }

  /**
   * Put cache points on the last two user messages, and make the cached prefix
   * unique to this process.
   *
   * Bedrock caches at the AWS account level, so identical prompts from
   * different users or processes would share entries. A random ID in the
   * prompt prevents that. It has to be in the same place on every request: if
   * it were appended to the last two user messages, a message would lose its
   * ID when it fell out of that window, its bytes would change, and the cached
   * conversation would stop matching. So the ID goes on the first user message
   * only, and every later cached prefix includes it.
   */
  private _addCachingToLastTwoUserMessages(converted: Message[], ttl?: "1h") {
    const first = converted.find((m) => m.role === "user");
    first?.content?.forEach((block) => {
      if (block.text) {
        block.text += getSecureID();
      }
    });

    let numCached = 0;
    for (let i = converted.length - 1; i >= 0; i--) {
      const message = converted[i];
      if (message.role === "user") {
        message.content?.push(bedrockCachePoint(ttl));
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

    // Only Claude models take cache points. The others (GPT, Nova, Grok, ...)
    // either cache by themselves or not at all, and reject a request that
    // carries a cachePoint field, so `promptCaching: true` must not reach them.
    const parts =
      /claude/i.test(oaiBody.model) && !optsOutOfPromptCache(oaiBody)
        ? resolveBedrockCacheParts(
            this.config.promptCaching,
            this.config.cacheBehavior,
            !!systemMessageText,
          )
        : { tools: false, system: false, conversation: false };

    // The lifetime to ask for on every cache point of this request, only for a
    // model that accepts one (an unsupported `ttl` can fail the request).
    // `cacheBehavior.ttl: auto` is the chat window's policy; with no toolbar,
    // this instance counts its own requests (one per model call, as the chat
    // window does) and applies the same two rules.
    const cachingOn = parts.tools || parts.system || parts.conversation;
    const cacheTtl = bedrockCacheTtl(
      oaiBody.model,
      requestedCacheTtl(
        this.config.cacheBehavior?.ttl,
        this.autoTtl,
        cachingOn,
      ),
    );

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

      // Add cache point after the tool list
      if (parts.tools) {
        toolConfig.tools!.push(bedrockCachePoint(cacheTtl));
      }

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
      { conversation: parts.conversation, ttl: cacheTtl },
    );

    // Build final request body
    const body: any = {
      modelId: applyCrossRegionInference(
        oaiBody.model,
        this.config.env?.crossRegionInference,
        this.config.env?.region,
      ),
      messages: convertedMessages,
      ...this.extraConverseFields(),
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
      body.system = parts.system
        ? [{ text: systemMessageText }, bedrockCachePoint(cacheTtl)]
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
    let usage: ChatCompletion["usage"];
    let requestId: string | undefined;
    const toolCalls: ChatCompletionMessageToolCall[] = [];

    for await (const chunk of this.chatCompletionStream(
      {
        ...body,
        stream: true,
      },
      signal,
    )) {
      if (chunk.usage) {
        usage = chunk.usage;
      }
      if (chunk.id) {
        requestId = chunk.id;
      }
      if (chunk.choices[0]?.delta?.content) {
        completion += chunk.choices[0].delta.content;
      }
      // TODO tool calls not supported
    }

    return {
      // Bedrock's own request ID when it sent one: it is the ID in the
      // invocation log and the bill.
      id: requestId ?? uuidv4(),
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
      usage,
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

      // The ID that identifies this call in Bedrock's invocation log and in
      // billing. It is known before the first event, so every chunk carries it.
      const id = response.$metadata?.requestId;

      for await (const chunk of response.stream) {
        if (chunk.contentBlockDelta?.delta) {
          const delta: any = chunk.contentBlockDelta.delta;

          // Handle text content
          if (delta.text) {
            yield chatChunk({
              content: delta.text,
              model: body.model,
              id,
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
              id,
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
              id,
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

        // The metadata event arrives last and carries the token counts,
        // including the cache read and write counts when caching is on.
        if (chunk.metadata?.usage) {
          yield usageChatChunk({
            model: body.model,
            id,
            usage: bedrockUsageToCompletionUsage(chunk.metadata.usage),
          });
        }
      }
    } catch (error) {
      // TLS / proxy trouble (untrusted corporate CA, proxy auth) is common
      // here; say how to fix it.
      const hint = getTlsErrorHint(error);
      const withHint = (message: string) =>
        hint && !message.includes(hint) ? `${message}\n\n${hint}` : message;
      if (error instanceof Error) {
        if ("code" in error) {
          throw new Error(
            withHint(
              `AWS Bedrock stream error (${(error as any).code}): ${error.message}`,
            ),
          );
        }
        throw new Error(
          withHint(`Error processing Bedrock stream: ${error.message}`),
        );
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
