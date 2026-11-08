import {
  BedrockRuntimeClient,
  ContentBlock,
  ContentBlockDelta,
  ContentBlockStart,
  ContentBlockStartEvent,
  ConverseCommand,
  ConversationRole,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
  ImageFormat,
  InvokeModelCommand,
  Message,
  ReasoningContentBlockDelta,
  ToolConfiguration,
  ToolUseBlock,
  ToolUseBlockDelta,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockClient,
  GetUseCaseForModelAccessCommand,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from "@aws-sdk/client-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { getTlsErrorHint } from "@continuedev/fetch";
import type { NodeHttpHandler } from "@smithy/node-http-handler";

import type { CompletionOptions, RequestOptions } from "../../index.js";
import { ChatMessage, Chunk, LLMOptions, MessageContent } from "../../index.js";
import type { Usage } from "../../index.js";
import { safeParseToolCallArgs } from "../../tools/parseArgs.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { parseDataUrl } from "../../util/url.js";
import { BaseLLM } from "../index.js";
import { getAnthropicThinkingParams } from "./anthropicThinking.js";
import { PROVIDER_TOOL_SUPPORT } from "../toolSupport.js";
import { createBedrockRequestHandler } from "./bedrockHttp.js";
import { withResponseInfo } from "../utils/cacheStats.js";
import { getSecureID } from "../utils/getSecureID.js";
import { isTaskPlanBlockText } from "../../util/taskPlan.js";
import { resolveCacheParts, resolvePromptCacheTtl } from "./anthropicCache.js";
import {
  applyCrossRegionInference,
  BedrockModelOption,
  bedrockCacheTtl,
  bedrockUsageToUsage,
  buildModelCatalog,
  getBedrockErrorHint,
  isStopSequencesUnsupportedError,
  isUseCaseFormMissingError,
  markAnthropicUseCaseNeeded,
  normalizeToolUseIds,
} from "./bedrockHelpers.js";

/** The use-case lookup is advisory, so listing never waits on it for long. */
const USE_CASE_LOOKUP_TIMEOUT_MS = 2000;

/**
 * Models that refused `stopSequences` in this process. They get requests
 * without it from then on; callers that need stops (autocomplete) also cut the
 * output at the stop tokens themselves.
 */
const modelsWithoutStopSequences = new Set<string>();

interface ModelConfig {
  formatPayload: (text: string) => any;
  extractEmbeddings: (responseBody: any) => number[][];
}

/**
 * Interface for prompt caching metrics
 */
interface PromptCachingMetrics {
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
}

class Bedrock extends BaseLLM {
  static providerName = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
    model: "anthropic.claude-3-sonnet-20240229-v1:0",
    profile: "bedrock",
  };

  /**
   * Autocomplete's modelTimeout counts from the request. On Bedrock the first
   * token takes 0.5-1.1 s warm (Bedrock.tab.live.vitest.ts), and a multi-line
   * body ends by about 1.5 s, so the 150 ms default cut every suggestion to
   * one line and 1000 ms still cut multi-line bodies short.
   */
  providerAutocompleteDefaults = { modelTimeout: 2000 };

  private _promptCachingMetrics: PromptCachingMetrics = {
    cacheReadInputTokens: 0,
    cacheWriteInputTokens: 0,
  };

  public requestOptions: {
    region?: string;
    credentials?: any;
    headers?: Record<string, string>;
  };

  /** True when the user configured `profile` (vs. the built-in default). */
  private _profileExplicit: boolean;

  /**
   * The HTTP-level `requestOptions` from config (proxy, CA bundle, ...).
   * `this.requestOptions` is reused below for Bedrock-specific headers, so the
   * user's options are kept here.
   */
  private _httpRequestOptions: RequestOptions | undefined;
  private _requestHandlers = new Map<
    string,
    Promise<NodeHttpHandler | undefined>
  >();

  constructor(options: LLMOptions) {
    super(options);
    this._httpRequestOptions = options.requestOptions;
    this._profileExplicit = !!options.profile;
    if (!options.apiBase) {
      this.apiBase = `https://bedrock-runtime.${this.region ?? options.region}.amazonaws.com`;
    }

    this.requestOptions = {
      region: options.region,
      headers: {},
    };
  }

  /** Auth portion of an AWS SDK client config (shared by runtime and control-plane clients). */
  private async _clientAuth(): Promise<
    | {
        token: () => Promise<{ token: string }>;
        authSchemePreference: string[];
      }
    | {
        credentials: {
          accessKeyId: string;
          secretAccessKey: string;
          sessionToken?: string;
        };
      }
  > {
    const apiKey = this._resolveApiKey();
    if (apiKey) {
      // Bedrock API key authentication (bearer token)
      // Select bearer auth explicitly: otherwise the SDK may pick SigV4 and go looking for
      // AWS credentials (failing with "Could not load credentials") for key-only setups.
      return {
        token: async () => ({ token: apiKey }),
        authSchemePreference: ["httpBearerAuth"],
      };
    }
    // IAM credential authentication
    const credentials = await this._getCredentials();
    return {
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || undefined,
      },
    };
  }

  /** One handler (and connection pool) per endpoint, shared by all clients. */
  private _requestHandlerFor(
    endpoint: string,
  ): Promise<NodeHttpHandler | undefined> {
    let handler = this._requestHandlers.get(endpoint);
    if (!handler) {
      handler = createBedrockRequestHandler(endpoint, this._httpRequestOptions);
      this._requestHandlers.set(endpoint, handler);
    }
    return handler;
  }

  private async _getClient(): Promise<BedrockRuntimeClient> {
    const requestHandler = await this._requestHandlerFor(this.apiBase!);
    return new BedrockRuntimeClient({
      region: this.region,
      endpoint: this.apiBase,
      ...(requestHandler ? { requestHandler } : {}),
      ...(await this._clientAuth()),
      // A route with a fallback fails over rather than retrying (see
      // BaseLLM.failOverQuickly); otherwise the SDK's standard retries
      ...(this.failsOverQuickly ? { maxAttempts: 1 } : {}),
    });
  }

  /** Control-plane client (model/profile listing). Uses the regional default endpoint. */
  private async _getControlClient(): Promise<BedrockClient> {
    const requestHandler = await this._requestHandlerFor(
      `https://bedrock.${this.region}.amazonaws.com`,
    );
    return new BedrockClient({
      region: this.region,
      ...(requestHandler ? { requestHandler } : {}),
      ...(await this._clientAuth()),
    });
  }

  /**
   * List the models this account can use in `region`: on-demand models by ID,
   * and models that require it by inference profile ID. Anthropic models are
   * flagged when the account has not filled out Anthropic's use-case form.
   */
  async listAvailableModels(): Promise<BedrockModelOption[]> {
    try {
      const client = await this._getControlClient();
      const useCaseMissing = this._isAnthropicUseCaseMissing(client);

      const models = await client.send(
        new ListFoundationModelsCommand({ byOutputModality: "TEXT" }),
      );

      const profiles: any[] = [];
      let nextToken: string | undefined;
      do {
        const page: any = await client.send(
          new ListInferenceProfilesCommand({ maxResults: 1000, nextToken }),
        );
        profiles.push(...(page.inferenceProfileSummaries ?? []));
        nextToken = page.nextToken;
      } while (nextToken);

      const catalog = buildModelCatalog(models.modelSummaries ?? [], profiles);
      return (await useCaseMissing)
        ? markAnthropicUseCaseNeeded(catalog)
        : catalog;
    } catch (e) {
      throw this._withHint(e);
    }
  }

  /**
   * True only when Bedrock says the use-case form has not been filled out.
   * Bedrock lists Anthropic models as ACTIVE on such an account and then refuses
   * chat. Never rejects: an error, a timeout or a permission refusal is `false`,
   * so a failed lookup leaves the listing as it would otherwise be.
   */
  private async _isAnthropicUseCaseMissing(
    client: BedrockClient,
  ): Promise<boolean> {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        client
          .send(new GetUseCaseForModelAccessCommand({}), {
            abortSignal: abort.signal,
          })
          .then(() => false, isUseCaseFormMissingError),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => {
            abort.abort();
            resolve(false);
          }, USE_CASE_LOOKUP_TIMEOUT_MS);
        }),
      ]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Extra Converse fields driven by config: service tier, latency mode, guardrails. */
  private _extraConverseFields(): Record<string, unknown> {
    return {
      ...(this.serviceTier ? { serviceTier: { type: this.serviceTier } } : {}),
      ...(this.latency ? { performanceConfig: { latency: this.latency } } : {}),
      ...(this.guardrailIdentifier
        ? {
            guardrailConfig: {
              guardrailIdentifier: this.guardrailIdentifier,
              guardrailVersion: this.guardrailVersion ?? "DRAFT",
            },
          }
        : {}),
    };
  }

  /** Send a tiny request to verify credentials, region and access to `model`. */
  async testModel(): Promise<{
    modelId: string;
    latencyMs: number;
    reply: string;
  }> {
    const modelId = applyCrossRegionInference(
      this.model,
      this.crossRegionInference,
      this.region,
    );
    const started = Date.now();
    try {
      const client = await this._getClient();
      const response = await client.send(
        new ConverseCommand({
          modelId,
          messages: [
            {
              role: "user",
              content: [{ text: "Reply with the single word: ok" }],
            },
          ],
          inferenceConfig: { maxTokens: 16 },
          ...this._extraConverseFields(),
        } as any),
      );
      const reply =
        response.output?.message?.content
          ?.map((b) => ("text" in b ? b.text : ""))
          .join("")
          .trim() ?? "";
      return { modelId, latencyMs: Date.now() - started, reply };
    } catch (e) {
      throw this._withHint(e);
    }
  }

  /**
   * `apiKey` wins; otherwise fall back to the AWS_BEARER_TOKEN_BEDROCK env var
   * (the same variable the AWS SDK/CLI use) unless the user chose IAM keys or
   * a named profile explicitly.
   */
  private _resolveApiKey(): string | undefined {
    if (this.apiKey) return this.apiKey;
    if ((this.accessKeyId && this.secretAccessKey) || this._profileExplicit) {
      return undefined;
    }
    return process.env.AWS_BEARER_TOKEN_BEDROCK || undefined;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const messages = [{ role: "user" as const, content: prompt }];
    for await (const update of this._streamChat(messages, signal, options)) {
      // A completion is the answer only: reasoning (gpt-oss, thinking models)
      // would otherwise be pasted into the editor as code.
      if (update.role !== "assistant") continue;
      yield renderChatMessage(update);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    try {
      yield* this._streamChatInner(messages, signal, options);
    } catch (e) {
      throw this._withHint(e);
    }
  }

  /** Append an actionable hint (SSO login, model access, ...) to known AWS errors. */
  private _withHint(e: unknown): unknown {
    if (!(e instanceof Error)) return e;
    const hint =
      getTlsErrorHint(e) ??
      getBedrockErrorHint(e, {
        profile: this._profileExplicit ? this.profile : undefined,
        region: this.region,
      });
    if (hint && !e.message.includes(hint)) {
      e.message = `${e.message}\n\n${hint}`;
    }
    return e;
  }

  /**
   * Sends a ConverseStream request. A model that refuses `stopSequences` is
   * retried once without them and remembered, so later requests skip the
   * failing attempt.
   */
  private async _sendConverseStream(
    client: BedrockRuntimeClient,
    input: ConverseStreamCommandInput,
    signal: AbortSignal,
  ): Promise<ConverseStreamCommandOutput> {
    const send = async () =>
      (await client.send(new ConverseStreamCommand(input), {
        abortSignal: signal,
      })) as ConverseStreamCommandOutput;
    const withoutStops = () => {
      input.inferenceConfig = {
        ...input.inferenceConfig,
        stopSequences: undefined,
      };
    };

    const modelKey = input.modelId ?? "";
    if (modelsWithoutStopSequences.has(modelKey)) withoutStops();

    try {
      return await send();
    } catch (e) {
      if (
        !input.inferenceConfig?.stopSequences?.length ||
        !isStopSequencesUnsupportedError(e)
      ) {
        throw e;
      }
      modelsWithoutStopSequences.add(modelKey);
      withoutStops();
      return await send();
    }
  }

  private async *_streamChatInner(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const client = await this._getClient();

    let config_headers =
      this.requestOptions && this.requestOptions.headers
        ? this.requestOptions.headers
        : {};
    // AWS SigV4 requires strict canonicalization of headers.
    // DO NOT USE "_" in your header name. It will return an error like below.
    // "The request signature we calculated does not match the signature you provided."

    client.middlewareStack.add(
      (next) => async (args: any) => {
        args.request.headers = {
          ...args.request.headers,
          ...config_headers,
        };
        return next(args);
      },
      {
        step: "build",
      },
    );

    const input = this._generateConverseInput(messages, {
      ...options,
      stream: true,
    });
    const response = await this._sendConverseStream(client, input, signal);

    if (!response?.stream) {
      throw new Error("No stream received from Bedrock API");
    }

    // Reset cache metrics for new request
    this._promptCachingMetrics = {
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
    };

    try {
      let usage: Usage | undefined;
      let stopReason: string | undefined;
      let latencyMs: number | undefined;
      for await (const chunk of response.stream) {
        if (chunk.metadata?.usage) {
          usage = bedrockUsageToUsage(chunk.metadata.usage);
        }
        if (chunk.metadata?.metrics?.latencyMs !== undefined) {
          latencyMs = chunk.metadata.metrics.latencyMs;
        }
        if (chunk.messageStop?.stopReason) {
          stopReason = chunk.messageStop.stopReason;
        }

        const contentBlockDelta: ContentBlockDelta | undefined =
          chunk.contentBlockDelta?.delta;
        if (contentBlockDelta) {
          // Handle text content
          if (contentBlockDelta.text) {
            yield {
              role: "assistant",
              content: contentBlockDelta.text,
            };
            continue;
          }
          if (contentBlockDelta.reasoningContent?.text) {
            yield {
              role: "thinking",
              content: contentBlockDelta.reasoningContent.text,
            };
            continue;
          }
          if (contentBlockDelta.reasoningContent?.signature) {
            yield {
              role: "thinking",
              content: "",
              signature: contentBlockDelta.reasoningContent.signature,
            };
            continue;
          }
        }

        const reasoningDelta: ReasoningContentBlockDelta | undefined = chunk
          .contentBlockDelta?.delta as ReasoningContentBlockDelta;
        if (reasoningDelta) {
          if (reasoningDelta.redactedContent) {
            yield {
              role: "thinking",
              content: "",
              redactedThinking: reasoningDelta.text,
            };
            continue;
          }
        }

        const toolUseBlockDelta: ToolUseBlockDelta | undefined = chunk
          .contentBlockDelta?.delta?.toolUse as ToolUseBlockDelta;
        const toolUseBlock: ToolUseBlock | undefined = chunk.contentBlockDelta
          ?.delta?.toolUse as ToolUseBlock;
        if (toolUseBlockDelta && toolUseBlock) {
          yield {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: toolUseBlock.toolUseId,
                type: "function",
                function: {
                  name: toolUseBlock.name,
                  arguments: toolUseBlockDelta.input,
                },
              },
            ],
          };
          continue;
        }

        const contentBlockStart: ContentBlockStartEvent | undefined =
          chunk.contentBlockStart as ContentBlockStartEvent;
        if (contentBlockStart) {
          const start: ContentBlockStart | undefined = chunk.contentBlockStart
            ?.start as ContentBlockStart;
          if (start) {
            const toolUseBlock: ToolUseBlock | undefined =
              start.toolUse as ToolUseBlock;
            if (toolUseBlock?.toolUseId && toolUseBlock?.name) {
              yield {
                role: "assistant",
                content: "",
                toolCalls: [
                  {
                    id: toolUseBlock.toolUseId,
                    type: "function",
                    function: {
                      name: toolUseBlock.name,
                      arguments: "",
                    },
                  },
                ],
              };
              continue;
            }
          }
        }
      }
      if (usage) {
        // The metadata event arrives after the content; BaseLLM picks the
        // usage up from the last assistant chunk that carries it.
        yield {
          role: "assistant",
          content: "",
          usage: withResponseInfo(usage, {
            stopReason,
            latencyMs,
            requestId: response.$metadata?.requestId,
          }),
        };
      }
    } catch (error: unknown) {
      // Clean up state and let the original error bubble up for retry handling
      throw error;
    }
  }

  /**
   * Generates the input payload for the Bedrock Converse API
   * @param messages - Array of chat messages
   * @param options - Completion options
   * @returns Formatted input payload for the API
   */
  private _generateConverseInput(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): any {
    const systemMessage = stripImages(
      messages.find((m) => m.role === "system")?.content ?? "",
    );

    // Prompt and system message caching settings. `options` already includes the
    // model's configured default, so an explicit `promptCaching: false` (for
    // example from the toolbar) wins over `cacheBehavior`.
    //
    // Only Claude models take cache points. Other models on Bedrock either
    // cache by themselves (GPT, Grok) or not at all (Nova), and reject a
    // request that carries a cachePoint field (checked live), so a model
    // config with `promptCaching: true` must not reach them.
    const parts = /claude/i.test(options.model)
      ? resolveCacheParts(
          options.promptCaching,
          this.cacheBehavior,
          !!systemMessage,
        )
      : { tools: false, system: false, conversation: false };
    const cacheTtl = bedrockCacheTtl(
      options.model,
      resolvePromptCacheTtl(options.promptCacheTtl, this.cacheBehavior?.ttl),
    );
    const cachePoint = {
      cachePoint: {
        type: "default" as const,
        ...(cacheTtl ? { ttl: cacheTtl } : {}),
      },
    };
    const enablePromptCaching =
      parts.tools || parts.system || parts.conversation;

    if (enablePromptCaching) {
      this.requestOptions.headers = {
        ...this.requestOptions.headers,
        "x-amzn-bedrock-enablepromptcaching": "true",
      };
    }

    // First get tools
    const supportsTools =
      (this.capabilities?.tools ||
        PROVIDER_TOOL_SUPPORT.bedrock?.(options.model)) ??
      false;

    let toolConfig: undefined | ToolConfiguration = undefined;
    const availableTools = new Set<string>();
    if (supportsTools && options.tools && options.tools.length > 0) {
      toolConfig = {
        tools: options.tools.map((tool) => ({
          toolSpec: {
            name: tool.function.name,
            description: tool.function.description,
            inputSchema: {
              json: tool.function.parameters,
            },
          },
        })),
      } as ToolConfiguration;
      const shouldCacheToolsConfig = parts.tools;
      if (shouldCacheToolsConfig) {
        toolConfig.tools!.push(cachePoint);
      }
      options.tools.forEach((tool) => {
        availableTools.add(tool.function.name);
      });
    }

    const convertedMessages = normalizeToolUseIds(
      this._convertMessages(messages, availableTools, {
        conversation: parts.conversation,
        ttl: cacheTtl,
      }),
      options.model,
    );

    return {
      modelId: applyCrossRegionInference(
        options.model,
        this.crossRegionInference,
        this.region,
      ),
      system: systemMessage
        ? parts.system
          ? [{ text: systemMessage }, cachePoint]
          : [{ text: systemMessage }]
        : undefined,
      toolConfig: toolConfig,
      messages: convertedMessages,
      inferenceConfig: {
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        topP: options.topP,
        // TODO: The current approach selects the first 4 items from the list to comply with Bedrock's requirement
        // of having at most 4 stop sequences, as per the AWS documentation:
        // https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_InferenceConfiguration.html
        // However, it might be better to implement a strategy that dynamically selects the most appropriate stop sequences
        // based on the context.
        // TODO: Additionally, consider implementing a global exception handler for the providers to give users clearer feedback.
        // For example, differentiate between client-side errors (4XX status codes) and server-side issues (5XX status codes),
        // providing meaningful error messages to improve the user experience.
        stopSequences: options.stop
          ?.filter((stop) => stop.trim() !== "")
          .slice(0, 4),
      },
      ...this._extraConverseFields(),
      additionalModelRequestFields: {
        ...getAnthropicThinkingParams(options),
        anthropic_beta: options.model.includes("claude")
          ? ["fine-grained-tool-streaming-2025-05-14"]
          : undefined,
      },
    };
  }

  /*
    Converts the messages to the format expected by the Bedrock API.
    
    */
  private _convertMessages(
    messages: ChatMessage[],
    availableTools: Set<string>,
    cache?: { conversation: boolean; ttl?: "1h" },
  ): Message[] {
    let currentRole: "user" | "assistant" = "user";
    let currentBlocks: ContentBlock[] = [];

    const converted: Message[] = [];
    const pushCurrentMessage = () => {
      if (currentBlocks.length === 0 && converted.length > 1) {
        throw new Error(
          `Bedrock: no content in ${currentRole} message before conversational turn change`,
        );
      }
      if (currentBlocks.length > 0) {
        converted.push({
          role: currentRole,
          content: currentBlocks,
        });
      }
      currentBlocks = [];
    };

    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    const hasAddedToolCallIds = new Set<string>();

    for (let idx = 0; idx < nonSystemMessages.length; idx++) {
      const message = nonSystemMessages[idx];

      if (message.role === "user" || message.role === "tool") {
        // Detect conversational turn change
        if (currentRole !== ConversationRole.USER) {
          pushCurrentMessage();
          currentRole = ConversationRole.USER;
        }

        // USER messages:
        // Non-empty user message content is converted to "text" and "image" blocks
        // If ANY user message part is cached, we add a single cache point block when we push the message
        if (message.role === "user") {
          const trimmedContent =
            typeof message.content === "string"
              ? message.content.trim()
              : message.content;
          if (trimmedContent) {
            currentBlocks.push(
              ...this._convertMessageContentToBlocks(trimmedContent),
            );
          }
        }
        // TOOL messages:
        // Tool messages are represented by "toolResult" blocks
        // toolResult blocks must follow valid toolUse blocks (which also verifies that the tool name is present in toolConfig)
        // If it doesn't, we convert it to a text block
        else if (message.role === "tool") {
          const trimmedContent = message.content.trim() || "No tool output";
          if (hasAddedToolCallIds.has(message.toolCallId)) {
            currentBlocks.push({
              toolResult: {
                toolUseId: message.toolCallId,
                content: [
                  {
                    text: trimmedContent,
                  },
                ],
              },
            });
          } else {
            currentBlocks.push({
              text: `Tool call output for Tool Call ID ${message.toolCallId}:\n\n${trimmedContent}`,
            });
          }
        }
      } else if (message.role === "assistant" || message.role === "thinking") {
        // Detect conversational turn change
        if (currentRole !== ConversationRole.ASSISTANT) {
          pushCurrentMessage();
          currentRole = ConversationRole.ASSISTANT;
        }

        // ASSISTANT messages:
        // Non-empty assistant message content is converted to "text" and "image" blocks
        if (message.role === "assistant") {
          const trimmedContent =
            typeof message.content === "string"
              ? message.content.trim()
              : message.content;
          if (trimmedContent) {
            currentBlocks.push(
              ...this._convertMessageContentToBlocks(trimmedContent),
            );
          }
          // TOOL CALLS:
          // Tool calls are represented by "toolUse" blocks
          // Each tool call must have an id and a function name
          // The function name must match one of the available tools
          // Otherwise, we will convert it to a text block (e.g. Chat mode will pass no tools)
          if (message.toolCalls) {
            for (const toolCall of message.toolCalls) {
              if (toolCall.id && toolCall.function?.name) {
                if (availableTools.has(toolCall.function.name)) {
                  currentBlocks.push({
                    toolUse: {
                      toolUseId: toolCall.id,
                      name: toolCall.function.name,
                      input: safeParseToolCallArgs(toolCall),
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
                  `Bedrock: tool call missing id or name, skipping tool call: ${JSON.stringify(toolCall)}`,
                );
                continue;
              }
            }
          }
        } else if (message.role === "thinking") {
          // THINKING:
          // Thinking messages are represented by "reasoningContent" blocks which can have redacted content or reasoning content
          if (message.redactedThinking) {
            const block: ContentBlock.ReasoningContentMember = {
              reasoningContent: {
                redactedContent: new Uint8Array(
                  Buffer.from(message.redactedThinking),
                ),
              },
            };
            currentBlocks.push(block);
          } else {
            const block: ContentBlock.ReasoningContentMember = {
              reasoningContent: {
                reasoningText: {
                  text: (message.content as string) || "",
                  signature: message.signature,
                },
              },
            };
            currentBlocks.push(block);
          }
        }
      }
    }
    if (currentBlocks.length > 0) {
      pushCurrentMessage();
    }

    // If caching is enabled, we add cache_control parameter to the last two user messages
    // The second-to-last because it retrieves potentially already cached contents,
    // The last one because we want it cached for later retrieval.
    // See: https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
    // Callers that do not pass `cache` (tests) get the settings configured on the model.
    const cacheConversation =
      cache?.conversation ??
      !!(
        this.cacheBehavior?.cacheConversation ||
        this.completionOptions.promptCaching
      );
    if (cacheConversation) {
      this._addCachingToLastTwoUserMessages(converted, cache?.ttl);
    }

    return converted;
  }

  /**
   * Put cache points on the last two user messages, and make the cached prefix
   * unique to this process.
   *
   * Bedrock caches at the AWS account level, so identical prompts from
   * different users or processes would share entries (continuedev/continue
   * #5035). A random ID in the prompt prevents that. It has to be in the same
   * place on every request: this used to append it to the last two user
   * messages, so a message lost its ID when it fell out of that window, its
   * bytes changed, and the cached conversation stopped matching. Measured on
   * Bedrock, reads stopped growing from the third turn on. The ID now goes on
   * the first user message only; every later cached prefix includes it.
   *
   * The task list block (core/util/taskPlan.ts) is the last text of the last
   * user message and changes between requests, so the cache point goes before
   * it: the next request, which no longer has the block there, then starts
   * with exactly the bytes this one cached.
   */
  private _addCachingToLastTwoUserMessages(converted: Message[], ttl?: "1h") {
    const first = converted.find((m) => m.role === "user");
    first?.content?.forEach((block) => {
      if (block.text && !isTaskPlanBlockText(block.text)) {
        block.text += getSecureID();
      }
    });

    let numCached = 0;
    for (let i = converted.length - 1; i >= 0; i--) {
      const message = converted[i];
      if (message.role === "user") {
        const cachePoint = {
          cachePoint: { type: "default" as const, ...(ttl ? { ttl } : {}) },
        };
        const content = message.content ?? [];
        const last = content[content.length - 1];
        if (content.length > 1 && isTaskPlanBlockText(last?.text)) {
          content.splice(content.length - 1, 0, cachePoint);
        } else {
          content.push(cachePoint);
        }
        numCached++;
      }
      if (numCached === 2) {
        break;
      }
    }
  }

  // Converts Continue message content (string/parts) to Bedrock ContentBlock format.
  // Unsupported/problematic image formats are skipped with a warning.
  private _convertMessageContentToBlocks(
    content: MessageContent,
  ): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    if (typeof content === "string") {
      blocks.push({ text: content });
    } else {
      for (const part of content) {
        if (part.type === "text") {
          blocks.push({ text: part.text });
        } else if (part.type === "imageUrl" && part.imageUrl) {
          const parsed = parseDataUrl(part.imageUrl.url);
          if (parsed) {
            const { mimeType, base64Data } = parsed;
            const format = mimeType.split("/")[1]?.split(";")[0] || "jpeg";
            if (
              format === ImageFormat.JPEG ||
              format === ImageFormat.PNG ||
              format === ImageFormat.WEBP ||
              format === ImageFormat.GIF
            ) {
              blocks.push({
                image: {
                  format,
                  source: {
                    bytes: Uint8Array.from(Buffer.from(base64Data, "base64")),
                  },
                },
              });
            } else {
              console.warn(
                `Bedrock: skipping unsupported image part format: ${format}`,
                part,
              );
            }
          } else {
            console.warn("Bedrock: failed to process image part", part);
          }
        }
      }
    }
    return blocks;
  }

  /** Seam over the AWS SDK credential chain (overridden in tests). */
  protected async _credentialChain(profile: string | undefined) {
    return fromNodeProviderChain({ profile, ignoreCache: true })();
  }

  private async _getCredentials() {
    if (this.accessKeyId && this.secretAccessKey) {
      return {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        ...(this.sessionToken ? { sessionToken: this.sessionToken } : {}),
      };
    }

    try {
      if (this._profileExplicit) {
        // The user asked for this profile: don't silently use another one.
        return await this._credentialChain(this.profile);
      }

      // Nothing configured. Keep honouring the historical "bedrock" profile if
      // it exists, then fall back to the standard AWS chain (env vars,
      // [default] profile, SSO, container/instance roles, ...).
      try {
        return await this._credentialChain("bedrock");
      } catch {
        return await this._credentialChain(undefined);
      }
    } catch (e) {
      throw this._withHint(e);
    }
  }

  // EMBED //
  async _embed(chunks: string[]): Promise<number[][]> {
    const client = await this._getClient();

    return (
      await Promise.all(
        chunks.map(async (chunk) => {
          const input = this._generateInvokeModelCommandInput(chunk);
          const command = new InvokeModelCommand(input);
          const response = await client.send(command);
          if (response.body) {
            const decoder = new TextDecoder();
            const decoded = decoder.decode(response.body);
            try {
              const responseBody = JSON.parse(decoded);
              return this._extractEmbeddings(responseBody);
            } catch (e) {
              console.error(`Error parsing response body from:\n${decoded}`, e);
            }
          }
          return [];
        }),
      )
    ).flat();
  }

  private _generateInvokeModelCommandInput(text: string): any {
    const modelConfig = this._getModelConfig();
    const payload = modelConfig.formatPayload(text);

    return {
      body: JSON.stringify(payload),
      modelId: this.model,
      accept: "*/*",
      contentType: "application/json",
    };
  }

  private _extractEmbeddings(responseBody: any): number[][] {
    const modelConfig = this._getModelConfig();
    return modelConfig.extractEmbeddings(responseBody);
  }

  private _getModelConfig() {
    const modelConfigs: { [key: string]: ModelConfig } = {
      cohere: {
        formatPayload: (text: string) => ({
          texts: [text],
          input_type: "search_document",
          truncate: "END",
        }),
        extractEmbeddings: (responseBody: any) => responseBody.embeddings || [],
      },
      "amazon.titan-embed": {
        formatPayload: (text: string) => ({
          inputText: text,
        }),
        extractEmbeddings: (responseBody: any) =>
          responseBody.embedding ? [responseBody.embedding] : [],
      },
    };

    const modelPrefix = Object.keys(modelConfigs).find((prefix) =>
      this.model!.startsWith(prefix),
    );
    if (!modelPrefix) {
      throw new Error(`Unsupported model: ${this.model}`);
    }
    return modelConfigs[modelPrefix];
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (!query || !chunks.length) {
      throw new Error("Query and chunks must not be empty");
    }

    try {
      const client = await this._getClient();

      // Base payload for both models
      const payload: any = {
        query: query,
        documents: chunks.map((chunk) => chunk.content),
        top_n: chunks.length,
      };

      // Add api_version for Cohere model
      if (this.model.startsWith("cohere.rerank")) {
        payload.api_version = 2;
      }

      const input = {
        body: JSON.stringify(payload),
        modelId: this.model,
        accept: "*/*",
        contentType: "application/json",
      };

      const command = new InvokeModelCommand(input);
      const response = await client.send(command);

      if (!response.body) {
        throw new Error("Empty response received from Bedrock");
      }

      const decoder = new TextDecoder();
      const decoded = decoder.decode(response.body);
      try {
        const responseBody = JSON.parse(decoded);
        // Sort results by index to maintain original order
        return responseBody.results
          .sort((a: any, b: any) => a.index - b.index)
          .map((result: any) => result.relevance_score);
      } catch (e) {
        throw new Error(
          `Error parsing JSON from Bedrock response body:\n${decoded}, ${JSON.stringify(e)}`,
        );
      }
    } catch (error: unknown) {
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
}

export default Bedrock;
