import {
  BedrockRuntimeClient,
  ContentBlock,
  ContentBlockDelta,
  ContentBlockStart,
  ContentBlockStartEvent,
  ConverseCommand,
  ConverseCommandOutput,
  ConversationRole,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
  ImageFormat,
  InvokeModelCommand,
  Message,
  ToolConfiguration,
  ToolUseBlock,
  ToolUseBlockDelta,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockClient,
  GetFoundationModelAvailabilityCommand,
  GetUseCaseForModelAccessCommand,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from "@aws-sdk/client-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { getTlsErrorHint } from "@continuedev/fetch";
import {
  bedrockModelAccessMessage,
  fillMissingToolResults,
} from "@continuedev/openai-adapters";
import type { NodeHttpHandler } from "@smithy/node-http-handler";

import type { CompletionOptions, RequestOptions } from "../../index.js";
import { ChatMessage, Chunk, LLMOptions, MessageContent } from "../../index.js";
import type { Usage } from "../../index.js";
import { CANCELLED_TOOL_CALL_MESSAGE } from "../../tools/constants.js";
import { safeParseToolCallArgs } from "../../tools/parseArgs.js";
import { renderChatMessage, stripImages } from "../../util/messageContent.js";
import { parseDataUrl } from "../../util/url.js";
import { BaseLLM } from "../index.js";
import { DEFAULT_REASONING_TOKENS } from "../constants.js";
import { PROVIDER_TOOL_SUPPORT } from "../toolSupport.js";
import { createBedrockRequestHandler } from "./bedrockHttp.js";
import { withResponseInfo } from "../utils/cacheStats.js";
import { isTaskPlanBlockText } from "../../util/taskPlan.js";
import { resolvePromptCacheTtl } from "./anthropicCache.js";
import {
  bedrockCatalogCacheKey,
  readBedrockCatalogCache,
  writeBedrockCatalogCache,
} from "./bedrockCatalogCache.js";
import {
  applyCrossRegionInference,
  applyModelAccess,
  BedrockModelAccess,
  BedrockModelOption,
  bedrockCachePartsForModel,
  bedrockCachePointAfterTextOnly,
  bedrockCacheTtl,
  bedrockReasoningFields,
  bedrockSamplingParams,
  bedrockToolsNeedNonStreaming,
  bedrockUsageToUsage,
  buildModelCatalog,
  crossRegionFallbackModelId,
  flushDsmlHold,
  getBedrockErrorHint,
  holdBackDsmlMarker,
  inferenceProfileSuggestion,
  inferenceProfileWarning,
  isInvalidModelIdentifierError,
  isStopSequencesUnsupportedError,
  isStreamingToolUseUnsupportedError,
  isUseCaseFormMissingError,
  leaksDsmlMarker,
  markAnthropicUseCaseNeeded,
  modelAccessFromAvailability,
  modelsNeedingAccessCheck,
  normalizeToolUseIds,
  ThinkingSplit,
  ThinkingTagSplitter,
  writesThinkingTags,
} from "./bedrockHelpers.js";

/** The use-case lookup is advisory, so listing never waits on it for long. */
const USE_CASE_LOOKUP_TIMEOUT_MS = 2000;
/**
 * GetFoundationModelAvailability is one call per third-party model (about
 * 0.3 to 0.8 s each). A few run at once, and the whole pass stops at the
 * deadline; models not answered by then carry no access state.
 */
const ACCESS_LOOKUP_CONCURRENCY = 5;
const ACCESS_LOOKUP_DEADLINE_MS = 10000;

/**
 * Models that refused `stopSequences` in this process. They get requests
 * without it from then on; callers that need stops (autocomplete) also cut the
 * output at the stop tokens themselves.
 */
const modelsWithoutStopSequences = new Set<string>();

/**
 * Prefixed model IDs (`us.qwen...`) that Bedrock refused as invalid in this
 * process because the model is only offered on demand. Requests for them go
 * out with the bare ID from then on.
 */
const modelsWithoutInferencePrefix = new Set<string>();

/**
 * Models that answered a ConverseStream request with tools with "This model
 * doesn't support tool use in streaming mode." in this process. Their
 * requests with tools go through Converse from then on, like the models in
 * bedrockToolsNeedNonStreaming.
 */
const modelsWithoutStreamingTools = new Set<string>();

/** Nova 2 returns this in place of its reasoning text; the tokens are billed. */
const NOVA_REDACTED_REASONING = "[REDACTED].";

/**
 * What the stream handler carries between chunks of one reply. DeepSeek V3.2
 * leaks a fragment of its tool-call markup at the end of the text before a
 * toolUse block, so text that could become it is held back until the block
 * ends (holdBackDsmlMarker); Nova Pro, Lite and Micro write their reasoning
 * as <thinking> tags in the text, which the splitter lifts into thinking
 * messages (ThinkingTagSplitter).
 */
interface StreamTextState {
  filterDsml: boolean;
  dsmlHold: string;
  thinkingTags?: ThinkingTagSplitter;
  isNova2: boolean;
}

function streamTextState(model: string): StreamTextState {
  return {
    filterDsml: leaksDsmlMarker(model),
    dsmlHold: "",
    thinkingTags: writesThinkingTags(model)
      ? new ThinkingTagSplitter()
      : undefined,
    isNova2: /nova-2-/i.test(model),
  };
}

function thinkingSplitMessages(split: ThinkingSplit): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (split.reasoning) {
    out.push({ role: "thinking", content: split.reasoning });
  }
  if (split.content) {
    out.push({ role: "assistant", content: split.content });
  }
  return out;
}

/** Text held back by the filters, released when a block or the message ends. */
function* flushHeldText(state: StreamTextState): Generator<ChatMessage> {
  if (state.dsmlHold) {
    const text = flushDsmlHold(state.dsmlHold);
    state.dsmlHold = "";
    if (text) yield { role: "assistant", content: text };
  }
  if (state.thinkingTags) {
    yield* thinkingSplitMessages(state.thinkingTags.flush());
  }
}

/** The messages for one content block delta: text, reasoning or tool input. */
function* deltaMessages(
  delta: ContentBlockDelta,
  state: StreamTextState,
): Generator<ChatMessage> {
  if (delta.text) {
    let text = delta.text;
    if (state.filterDsml) {
      const split = holdBackDsmlMarker(state.dsmlHold + text);
      state.dsmlHold = split.hold;
      text = split.emit;
    }
    if (state.thinkingTags) {
      yield* thinkingSplitMessages(state.thinkingTags.push(text));
    } else if (text) {
      yield { role: "assistant", content: text };
    }
    return;
  }
  const reasoning = delta.reasoningContent;
  if (reasoning?.redactedContent) {
    // Encrypted bytes; kept as base64, the form Anthropic's own API uses,
    // and decoded again in _convertMessages.
    yield {
      role: "thinking",
      content: "",
      redactedThinking: Buffer.from(reasoning.redactedContent).toString(
        "base64",
      ),
    };
    return;
  }
  if (reasoning?.text) {
    const redacted =
      state.isNova2 && reasoning.text === NOVA_REDACTED_REASONING;
    yield redacted
      ? { role: "thinking", content: "", redactedThinking: reasoning.text }
      : { role: "thinking", content: reasoning.text };
    return;
  }
  if (reasoning?.signature) {
    yield { role: "thinking", content: "", signature: reasoning.signature };
    return;
  }
  // A tool-call input fragment; the id and name came with the block start
  const toolUse = delta.toolUse as
    (ToolUseBlockDelta & ToolUseBlock) | undefined;
  if (toolUse) {
    yield {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: toolUse.toolUseId,
          type: "function",
          function: { name: toolUse.name, arguments: toolUse.input },
        },
      ],
    };
  }
}

/** The tool call a content block start opens, with its id and name. */
function toolCallStartMessage(
  event: ContentBlockStartEvent | undefined,
): ChatMessage | undefined {
  const start = event?.start as ContentBlockStart | undefined;
  const toolUse = start?.toolUse as ToolUseBlock | undefined;
  if (!toolUse?.toolUseId || !toolUse?.name) return undefined;
  return {
    role: "assistant",
    content: "",
    toolCalls: [
      {
        id: toolUse.toolUseId,
        type: "function",
        function: { name: toolUse.name, arguments: "" },
      },
    ],
  };
}

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
   * and models that require it by inference profile ID. Third-party models
   * carry the account's access state, and Anthropic models are flagged when
   * the account has not filled out Anthropic's use-case form.
   *
   * The answer is cached for an hour per account and region (see
   * bedrockCatalogCache.ts); `refresh` lists again regardless.
   */
  async listAvailableModels(options?: {
    refresh?: boolean;
  }): Promise<BedrockModelOption[]> {
    const cacheKey = this._catalogCacheKey();
    if (!options?.refresh) {
      const cached = readBedrockCatalogCache(cacheKey);
      if (cached) return cached;
    }
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

      let catalog = buildModelCatalog(models.modelSummaries ?? [], profiles);
      catalog = applyModelAccess(
        catalog,
        await this._modelAccess(client, modelsNeedingAccessCheck(catalog)),
      );
      if (await useCaseMissing) catalog = markAnthropicUseCaseNeeded(catalog);
      writeBedrockCatalogCache(cacheKey, catalog);
      return catalog;
    } catch (e) {
      throw this._withHint(e);
    }
  }

  /** The catalog cache key for this account and region (no network call). */
  private _catalogCacheKey(): string {
    return bedrockCatalogCacheKey(
      {
        apiKey: this._resolveApiKey(),
        accessKeyId: this.accessKeyId,
        profile: this._profileExplicit ? this.profile : undefined,
      },
      this.region,
    );
  }

  /**
   * The catalog listed for this account and region within the last hour, or
   * undefined. Never calls Bedrock.
   */
  cachedCatalog(): BedrockModelOption[] | undefined {
    return readBedrockCatalogCache(this._catalogCacheKey());
  }

  /**
   * A non-fatal config warning when `model` is a bare ID that the cached
   * catalog offers only through inference profiles and `crossRegionInference`
   * is unset: such a request fails with a ValidationException, so say so at
   * config load. Undefined when nothing is wrong or nothing is cached.
   */
  inferenceProfileWarning(): string | undefined {
    if (!this.model || this.crossRegionInference) return undefined;
    const catalog = this.cachedCatalog();
    if (!catalog) return undefined;
    const suggestion = inferenceProfileSuggestion(
      catalog,
      this.model,
      this.region,
    );
    return suggestion
      ? inferenceProfileWarning(this.model, this.region, suggestion)
      : undefined;
  }

  /**
   * The account's access state per base model ID, from
   * GetFoundationModelAvailability. Advisory like the use-case lookup: a
   * failed or late answer leaves that model without a state, and nothing here
   * rejects.
   */
  private async _modelAccess(
    client: BedrockClient,
    modelIds: string[],
  ): Promise<Map<string, BedrockModelAccess>> {
    const access = new Map<string, BedrockModelAccess>();
    if (modelIds.length === 0) return access;
    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), ACCESS_LOOKUP_DEADLINE_MS);
    const queue = [...modelIds];
    const worker = async () => {
      while (queue.length > 0 && !abort.signal.aborted) {
        const modelId = queue.shift()!;
        try {
          const availability: any = await client.send(
            new GetFoundationModelAvailabilityCommand({ modelId }),
            { abortSignal: abort.signal },
          );
          access.set(modelId, modelAccessFromAvailability(availability));
        } catch {
          // No state for this model.
        }
      }
    };
    try {
      await Promise.all(
        Array.from(
          { length: Math.min(ACCESS_LOOKUP_CONCURRENCY, modelIds.length) },
          worker,
        ),
      );
    } finally {
      clearTimeout(deadline);
    }
    return access;
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
      const accessMessage = bedrockModelAccessMessage(
        e,
        applyCrossRegionInference(
          options.model,
          this.crossRegionInference,
          this.region,
        ),
      );
      if (accessMessage && e instanceof Error) {
        // The same error object, so route failover still sees its name.
        e.message = accessMessage;
        throw e;
      }
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
        apiKey: !!this._resolveApiKey(),
      });
    if (hint && !e.message.includes(hint)) {
      e.message = `${e.message}\n\n${hint}`;
    }
    return e;
  }

  /**
   * Sends a ConverseStream request. A model that refuses `stopSequences` is
   * retried once without them, and a prefixed model ID that Bedrock does not
   * know is retried once as `fallbackModelId` (the bare ID, when the prefix
   * came from `crossRegionInference: auto`). Both are remembered, so later
   * requests skip the failing attempt. Both can apply to one model (Qwen
   * refuses the prefix and then the stops), so each is retried at most once.
   */
  private _sendConverseStream(
    client: BedrockRuntimeClient,
    input: ConverseStreamCommandInput,
    signal: AbortSignal,
    fallbackModelId?: string,
  ): Promise<ConverseStreamCommandOutput> {
    return this._sendWithRetries(
      input,
      fallbackModelId,
      async () =>
        (await client.send(new ConverseStreamCommand(input), {
          abortSignal: signal,
        })) as ConverseStreamCommandOutput,
    );
  }

  /** Converse (no stream), with the same retries as _sendConverseStream. */
  private _sendConverse(
    client: BedrockRuntimeClient,
    input: ConverseStreamCommandInput,
    signal: AbortSignal,
    fallbackModelId?: string,
  ): Promise<ConverseCommandOutput> {
    return this._sendWithRetries(
      input,
      fallbackModelId,
      async () =>
        (await client.send(new ConverseCommand(input), {
          abortSignal: signal,
        })) as ConverseCommandOutput,
    );
  }

  private async _sendWithRetries<T>(
    input: ConverseStreamCommandInput,
    fallbackModelId: string | undefined,
    send: () => Promise<T>,
  ): Promise<T> {
    const withoutStops = () => {
      input.inferenceConfig = {
        ...input.inferenceConfig,
        stopSequences: undefined,
      };
    };

    if (fallbackModelId && modelsWithoutInferencePrefix.has(input.modelId!)) {
      input.modelId = fallbackModelId;
    }
    if (modelsWithoutStopSequences.has(input.modelId ?? "")) withoutStops();

    let retriedStops = false;
    let retriedPrefix = false;
    for (;;) {
      try {
        return await send();
      } catch (e) {
        if (
          !retriedStops &&
          input.inferenceConfig?.stopSequences?.length &&
          isStopSequencesUnsupportedError(e)
        ) {
          retriedStops = true;
          modelsWithoutStopSequences.add(input.modelId ?? "");
          withoutStops();
          continue;
        }
        if (
          !retriedPrefix &&
          fallbackModelId &&
          input.modelId !== fallbackModelId &&
          isInvalidModelIdentifierError(e)
        ) {
          retriedPrefix = true;
          modelsWithoutInferencePrefix.add(input.modelId!);
          input.modelId = fallbackModelId;
          continue;
        }
        throw e;
      }
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
    const fallbackModelId = crossRegionFallbackModelId(
      options.model,
      this.crossRegionInference,
      this.region,
    );

    // Reset cache metrics for new request
    this._promptCachingMetrics = {
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
    };

    // Tools go through Converse for models that cannot stream them, and for
    // a model that refused them in streaming mode earlier in this process.
    if (
      input.toolConfig &&
      (bedrockToolsNeedNonStreaming(options.model) ||
        modelsWithoutStreamingTools.has(options.model))
    ) {
      yield* this._converseWholeMessage(client, input, signal, fallbackModelId);
      return;
    }

    let response: ConverseStreamCommandOutput;
    try {
      response = await this._sendConverseStream(
        client,
        input,
        signal,
        fallbackModelId,
      );
    } catch (e) {
      // Llama 4's refusal: retried once through Converse and remembered
      if (!input.toolConfig || !isStreamingToolUseUnsupportedError(e)) throw e;
      modelsWithoutStreamingTools.add(options.model);
      yield* this._converseWholeMessage(client, input, signal, fallbackModelId);
      return;
    }

    if (!response?.stream) {
      throw new Error("No stream received from Bedrock API");
    }

    try {
      let usage: Usage | undefined;
      let stopReason: string | undefined;
      let latencyMs: number | undefined;
      const state = streamTextState(options.model);
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
        if (chunk.contentBlockStop || chunk.messageStop) {
          yield* flushHeldText(state);
        }
        if (chunk.contentBlockDelta?.delta) {
          yield* deltaMessages(chunk.contentBlockDelta.delta, state);
          continue;
        }
        const started = toolCallStartMessage(chunk.contentBlockStart);
        if (started) yield started;
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
   * A request with tools to a model that cannot stream them
   * (bedrockToolsNeedNonStreaming): sent through Converse, and the whole
   * reply yielded as the messages the stream would have produced: text,
   * reasoning, each toolUse block as a complete tool call, then the usage with
   * the stop reason.
   */
  private async *_converseWholeMessage(
    client: BedrockRuntimeClient,
    input: ConverseStreamCommandInput,
    signal: AbortSignal,
    fallbackModelId: string | undefined,
  ): AsyncGenerator<ChatMessage> {
    const response = await this._sendConverse(
      client,
      input,
      signal,
      fallbackModelId,
    );
    const isNova2 = /nova-2-/i.test(input.modelId ?? "");
    for (const block of response.output?.message?.content ?? []) {
      if (block.text) {
        yield { role: "assistant", content: block.text };
      } else if (block.reasoningContent) {
        const { reasoningText, redactedContent } = block.reasoningContent;
        if (redactedContent) {
          yield {
            role: "thinking",
            content: "",
            redactedThinking: Buffer.from(redactedContent).toString("base64"),
          };
        } else if (reasoningText?.text) {
          if (isNova2 && reasoningText.text === NOVA_REDACTED_REASONING) {
            yield {
              role: "thinking",
              content: "",
              redactedThinking: reasoningText.text,
            };
          } else {
            yield { role: "thinking", content: reasoningText.text };
          }
          if (reasoningText.signature) {
            yield {
              role: "thinking",
              content: "",
              signature: reasoningText.signature,
            };
          }
        }
      } else if (block.toolUse?.toolUseId && block.toolUse.name) {
        yield {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: block.toolUse.toolUseId,
              type: "function",
              function: {
                name: block.toolUse.name,
                arguments: JSON.stringify(block.toolUse.input ?? {}),
              },
            },
          ],
        };
      }
    }
    if (response.usage) {
      yield {
        role: "assistant",
        content: "",
        usage: withResponseInfo(bedrockUsageToUsage(response.usage), {
          stopReason: response.stopReason,
          latencyMs: response.metrics?.latencyMs,
          requestId: response.$metadata?.requestId,
        }),
      };
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
    // Cache points go only where the model accepts them: Claude takes them on
    // the tools, the system prompt and the messages; Nova on the system prompt
    // and the messages only; GPT and Grok cache by themselves and reject a
    // request that carries a cachePoint field anywhere (checked live), so a
    // model config with `promptCaching: true` must not reach them. See
    // `bedrockCachePointFields`.
    const parts = bedrockCachePartsForModel(
      options.model,
      options.promptCaching,
      this.cacheBehavior,
      !!systemMessage,
    );
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
        // Without it Llama 3.3 writes the call as plain JSON text; every
        // tool-capable family accepts it (checked live, 2026-11-08).
        toolChoice: { auto: {} },
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
      fillMissingToolResults(
        this._convertMessages(
          messages,
          availableTools,
          {
            conversation: parts.conversation,
            ttl: cacheTtl,
            afterTextOnly: bedrockCachePointAfterTextOnly(options.model),
          },
          options.model,
        ),
        CANCELLED_TOOL_CALL_MESSAGE,
      ),
      options.model,
    );

    // The reasoning switch differs per family (see bedrockReasoningFields);
    // Claude's sampling fields depend on whether thinking is on.
    const reasoningRequest = bedrockReasoningFields(
      options.model,
      options.reasoning,
      options.reasoningBudgetTokens ?? DEFAULT_REASONING_TOKENS,
    );
    const sampling = bedrockSamplingParams(
      options.model,
      options.temperature,
      options.topP,
      !!options.reasoning,
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
        maxTokens: reasoningRequest.omitMaxTokens
          ? undefined
          : options.maxTokens,
        temperature: sampling.temperature,
        topP: sampling.topP,
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
        ...reasoningRequest.additionalModelRequestFields,
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
    cache?: { conversation: boolean; ttl?: "1h"; afterTextOnly?: boolean },
    modelId: string = this.model,
  ): Message[] {
    const replaysRedactedThinking = /claude/i.test(modelId);
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
            // Claude's encrypted bytes, base64 in the message (as the
            // streaming side and Anthropic's own API keep them), go back as
            // redactedContent. Nova 2's "[REDACTED]." placeholder carries
            // nothing to replay.
            if (!replaysRedactedThinking) continue;
            const block: ContentBlock.ReasoningContentMember = {
              reasoningContent: {
                redactedContent: new Uint8Array(
                  Buffer.from(message.redactedThinking, "base64"),
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
      this._addCachingToLastTwoUserMessages(
        converted,
        cache?.ttl,
        cache?.afterTextOnly ?? bedrockCachePointAfterTextOnly(modelId),
      );
    }

    return converted;
  }

  /**
   * Put cache points on the last two user messages.
   *
   * No per-process marker goes into the prompt. One used to (a random
   * `<!-- SID: ... -->` on the first user message, from continuedev/continue
   * #5035, meant to keep users of one AWS account from sharing cache
   * entries), but a cache hit needs the identical prefix and yields nothing
   * but a cheaper request, so the marker bought no isolation and made every
   * resumed or forked session rewrite its whole history at the cache-write
   * price instead of reading it (measured 2026-11-08).
   *
   * The task list block (core/util/taskPlan.ts) is the last text of the last
   * user message and changes between requests, so the cache point goes before
   * it: the next request, which no longer has the block there, then starts
   * with exactly the bytes this one cached.
   *
   * With `afterTextOnly` (Nova) a cache point goes right after the last text
   * block of a user message, and a user message with no text block (tool
   * results only) gets none: Nova refuses a cachePoint next to a toolResult
   * ("extraneous key [cachePoint]"). Claude takes it after a toolResult.
   */
  private _addCachingToLastTwoUserMessages(
    converted: Message[],
    ttl?: "1h",
    afterTextOnly = false,
  ) {
    const cachePoint = () => ({
      cachePoint: { type: "default" as const, ...(ttl ? { ttl } : {}) },
    });
    let numCached = 0;
    for (let i = converted.length - 1; i >= 0 && numCached < 2; i--) {
      const message = converted[i];
      if (message.role !== "user") continue;
      const content = message.content ?? [];
      if (afterTextOnly) {
        // The last text block that is not the task list (no findLastIndex:
        // the extension builds target an older lib)
        let at = -1;
        for (let j = content.length - 1; j >= 0; j--) {
          const text = content[j].text;
          if (text !== undefined && !isTaskPlanBlockText(text)) {
            at = j;
            break;
          }
        }
        if (at === -1) continue;
        content.splice(at + 1, 0, cachePoint());
      } else {
        const last = content[content.length - 1];
        if (content.length > 1 && isTaskPlanBlockText(last?.text)) {
          content.splice(content.length - 1, 0, cachePoint());
        } else {
          content.push(cachePoint());
        }
      }
      numCached++;
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
