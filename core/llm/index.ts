import { ModelRole } from "@continuedev/config-yaml";
import { fetchwithRequestOptions } from "@continuedev/fetch";
import { findLlmInfo } from "@continuedev/llm-info";
import {
  BaseLlmApi,
  ChatCompletionCreateParams,
  constructLlmApi,
} from "@continuedev/openai-adapters";
import Handlebars from "handlebars";

import { DevDataSqliteDb } from "../data/devdataSqlite.js";
import { DataLogger } from "../data/log.js";
import {
  CacheBehavior,
  ChatMessage,
  Chunk,
  CompletionOptions,
  ILLM,
  ILLMInteractionLog,
  ILLMLogger,
  LLMFullCompletionOptions,
  LLMOptions,
  MessageOption,
  ModelCapability,
  ModelInstaller,
  PromptLog,
  PromptTemplate,
  RequestOptions,
  TabAutocompleteOptions,
  TemplateType,
  Usage,
} from "../index.js";
import { isLemonadeInstalled } from "../util/lemonadeHelper.js";
import { Logger } from "../util/Logger.js";
import mergeJson from "../util/merge.js";
import { renderChatMessage } from "../util/messageContent.js";
import { isOllamaInstalled } from "../util/ollamaHelper.js";
import { TokensBatchingService } from "../util/TokensBatchingService.js";
import { withExponentialBackoff } from "../util/withExponentialBackoff.js";

import {
  autodetectPromptTemplates,
  autodetectTemplateFunction,
  autodetectTemplateType,
  modelSupportsImages,
} from "./autodetect.js";
import {
  DEFAULT_ARGS,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_BATCH_SIZE,
  DEFAULT_MAX_CHUNK_SIZE,
  DEFAULT_MAX_TOKENS,
  LLMConfigurationStatuses,
} from "./constants.js";
import {
  compileChatMessages,
  countTokens,
  pruneRawPromptFromTop,
} from "./countTokens.js";
import {
  fromChatCompletionChunk,
  fromChatResponse,
  LlmApiRequestType,
  toChatBody,
  toCompleteBody,
  toFimBody,
} from "./openaiTypeConverters.js";
export class LLMError extends Error {
  constructor(
    message: string,
    public llm: ILLM,
  ) {
    super(message);
  }
}

export function isModelInstaller(provider: any): provider is ModelInstaller {
  return (
    provider &&
    typeof provider.installModel === "function" &&
    typeof provider.isInstallingModel === "function"
  );
}

type InteractionStatus = "in_progress" | "success" | "error" | "cancelled";

export abstract class BaseLLM implements ILLM {
  static providerName: string;
  static defaultOptions: Partial<LLMOptions> | undefined = undefined;
  // Provider capabilities (overridable by subclasses)
  protected supportsReasoningField: boolean = false;
  protected supportsReasoningDetailsField: boolean = false;

  get providerName(): string {
    return (this.constructor as typeof BaseLLM).providerName;
  }

  /**
   * This exists because for the continue-proxy, sometimes we want to get the value of the underlying provider that is used on the server
   * For example, the underlying provider should always be sent with dev data
   */
  get underlyingProviderName(): string {
    return this.providerName;
  }

  autocompleteOptions?: Partial<TabAutocompleteOptions>;

  supportsFim(): boolean {
    return false;
  }

  supportsImages(): boolean {
    return modelSupportsImages(
      this.providerName,
      this.model,
      this.title,
      this.capabilities,
    );
  }

  supportsCompletions(): boolean {
    if (["openai", "azure"].includes(this.providerName)) {
      if (
        this.apiBase?.includes("api.groq.com") ||
        this.apiBase?.includes("api.mistral.ai") ||
        this.apiBase?.includes(":1337") ||
        this.apiBase?.includes("integrate.api.nvidia.com") ||
        this._llmOptions.useLegacyCompletionsEndpoint?.valueOf() === false
      ) {
        // Jan + Groq + Mistral don't support completions : (
        // Seems to be going out of style...
        return false;
      }
    }
    if (["groq", "mistral", "deepseek"].includes(this.providerName)) {
      return false;
    }
    return true;
  }

  supportsPrefill(): boolean {
    return ["ollama", "anthropic", "mistral"].includes(this.providerName);
  }

  uniqueId: string;
  model: string;

  title?: string;
  baseChatSystemMessage?: string;
  basePlanSystemMessage?: string;
  baseAgentSystemMessage?: string;
  _contextLength: number | undefined;
  maxStopWords?: number | undefined;
  completionOptions: CompletionOptions;
  requestOptions?: RequestOptions;
  template?: TemplateType;
  promptTemplates?: Record<string, PromptTemplate>;
  templateMessages?: (messages: ChatMessage[]) => string;
  logger?: ILLMLogger;
  llmRequestHook?: (model: string, prompt: string) => any;
  apiKey?: string;

  // continueProperties
  apiKeyLocation?: string;
  envSecretLocations?: Record<string, string>;
  apiBase?: string;
  orgScopeId?: string | null;

  onPremProxyUrl?: string | null;

  cacheBehavior?: CacheBehavior;
  capabilities?: ModelCapability;
  roles?: ModelRole[];

  deployment?: string;
  apiVersion?: string;
  apiType?: string;
  region?: string;
  projectId?: string;
  accountId?: string;
  aiGatewaySlug?: string;
  profile?: string | undefined;
  accessKeyId?: string;
  secretAccessKey?: string;

  // For IBM watsonx
  deploymentId?: string;

  // Embedding options
  embeddingId: string;
  maxEmbeddingChunkSize: number;
  maxEmbeddingBatchSize: number;

  //URI to local block defining this LLM
  sourceFile?: string;

  isFromAutoDetect?: boolean;

  lastRequestId: string | undefined;

  private _llmOptions: LLMOptions;

  protected openaiAdapter?: BaseLlmApi;

  constructor(_options: LLMOptions) {
    this._llmOptions = _options;
    this.lastRequestId = undefined;

    // Set default options
    const options = {
      title: (this.constructor as typeof BaseLLM).providerName,
      ...(this.constructor as typeof BaseLLM).defaultOptions,
      ..._options,
    };

    this.model = options.model;
    // Use @continuedev/llm-info package to autodetect certain parameters
    const modelSearchString =
      this.providerName === "continue-proxy"
        ? this.model?.split("/").pop() || this.model
        : this.model;
    const llmInfo = findLlmInfo(modelSearchString, this.underlyingProviderName);

    const templateType =
      options.template ?? autodetectTemplateType(options.model);

    this.title = options.title;
    this.uniqueId = options.uniqueId ?? "None";
    this.baseAgentSystemMessage = options.baseAgentSystemMessage;
    this.basePlanSystemMessage = options.basePlanSystemMessage;
    this.baseChatSystemMessage = options.baseChatSystemMessage;
    this._contextLength = options.contextLength ?? llmInfo?.contextLength;
    this.maxStopWords = options.maxStopWords ?? this.maxStopWords;
    this.completionOptions = {
      ...options.completionOptions,
      model: options.model || "gpt-4",
      maxTokens:
        options.completionOptions?.maxTokens ??
        (llmInfo?.maxCompletionTokens
          ? Math.min(
              llmInfo.maxCompletionTokens,
              // Even if the model has a large maxTokens, we don't want to use that every time,
              // because it takes away from the context length
              this.contextLength / 4,
            )
          : DEFAULT_MAX_TOKENS),
    };
    this.requestOptions = options.requestOptions;
    this.promptTemplates = {
      ...autodetectPromptTemplates(options.model, templateType),
      ...options.promptTemplates,
    };
    this.templateMessages =
      options.templateMessages ??
      autodetectTemplateFunction(
        options.model,
        this.providerName,
        options.template,
      ) ??
      undefined;
    this.logger = options.logger;
    this.llmRequestHook = options.llmRequestHook;
    this.apiKey = options.apiKey;

    // continueProperties
    this.apiKeyLocation = options.apiKeyLocation;
    this.envSecretLocations = options.envSecretLocations;
    this.orgScopeId = options.orgScopeId;
    this.apiBase = options.apiBase;

    this.onPremProxyUrl = options.onPremProxyUrl;

    this.aiGatewaySlug = options.aiGatewaySlug;
    this.cacheBehavior = options.cacheBehavior;

    // watsonx deploymentId
    this.deploymentId = options.deploymentId;

    if (this.apiBase && !this.apiBase.endsWith("/")) {
      this.apiBase = `${this.apiBase}/`;
    }
    this.accountId = options.accountId;
    this.capabilities = options.capabilities;
    this.roles = options.roles;

    this.deployment = options.deployment;
    this.apiVersion = options.apiVersion;
    this.apiType = options.apiType;
    this.region = options.region;
    this.projectId = options.projectId;
    this.profile = options.profile;
    this.accessKeyId = options.accessKeyId;
    this.secretAccessKey = options.secretAccessKey;

    this.openaiAdapter = this.createOpenAiAdapter();

    this.maxEmbeddingBatchSize =
      options.maxEmbeddingBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.maxEmbeddingChunkSize =
      options.maxEmbeddingChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
    this.embeddingId = `${this.constructor.name}::${this.model}::${this.maxEmbeddingChunkSize}`;

    this.autocompleteOptions = options.autocompleteOptions;
    this.sourceFile = options.sourceFile;
    this.isFromAutoDetect = options.isFromAutoDetect;
  }

  get contextLength() {
    return this._contextLength ?? DEFAULT_CONTEXT_LENGTH;
  }

  getConfigurationStatus() {
    return LLMConfigurationStatuses.VALID;
  }

  protected createOpenAiAdapter() {
    return constructLlmApi({
      provider: this.providerName as any,
      apiKey: this.apiKey ?? "",
      apiBase: this.apiBase,
      requestOptions: this.requestOptions,
      env: this._llmOptions.env,
    });
  }

  listModels(): Promise<string[]> {
    return Promise.resolve([]);
  }

  private _templatePromptLikeMessages(prompt: string): string {
    if (!this.templateMessages) {
      return prompt;
    }

    // NOTE system message no longer supported here

    const msgs: ChatMessage[] = [{ role: "user", content: prompt }];

    return this.templateMessages(msgs);
  }

  private _logEnd(
    model: string,
    prompt: string,
    completion: string,
    thinking: string | undefined,
    interaction: ILLMInteractionLog | undefined,
    usage: Usage | undefined,
    error?: any,
  ): InteractionStatus {
    let promptTokens = this.countTokens(prompt);
    let generatedTokens = this.countTokens(completion);
    let thinkingTokens = thinking ? this.countTokens(thinking) : 0;

    TokensBatchingService.getInstance().addTokens(
      model,
      this.providerName,
      promptTokens,
      generatedTokens,
    );

    void DevDataSqliteDb.logTokensGenerated(
      model,
      this.providerName,
      promptTokens,
      generatedTokens,
    );

    void DataLogger.getInstance().logDevData({
      name: "tokensGenerated",
      data: {
        model: model,
        provider: this.underlyingProviderName,
        promptTokens: promptTokens,
        generatedTokens: generatedTokens,
      },
    });

    if (typeof error === "undefined") {
      interaction?.logItem({
        kind: "success",
        promptTokens,
        generatedTokens,
        thinkingTokens,
        usage,
      });
      return "success";
    } else {
      if (error === "cancel" || error?.name?.includes("AbortError")) {
        interaction?.logItem({
          kind: "cancel",
          promptTokens,
          generatedTokens,
          thinkingTokens,
          usage,
        });
        return "cancelled";
      } else {
        console.log(error);
        interaction?.logItem({
          kind: "error",
          name: error.name,
          message: error.message,
          promptTokens,
          generatedTokens,
          thinkingTokens,
          usage,
        });
        return "error";
      }
    }
  }

  private async parseError(resp: any): Promise<Error> {
    let text = await resp.text();

    if (resp.status === 404 && !resp.url.includes("/v1")) {
      const parsedError = JSON.parse(text);
      const errorMessageRaw = parsedError?.error ?? parsedError?.message;
      const error =
        typeof errorMessageRaw === "string"
          ? errorMessageRaw.replace(/"/g, "'")
          : undefined;
      let model = error?.match(/model '(.*)' not found/)?.[1];
      if (model && resp.url.match("127.0.0.1:11434")) {
        text = `The model "${model}" was not found. To download it, run \`ollama run ${model}\`.`;
        return new LLMError(text, this); // No need to add HTTP status details
      } else if (text.includes("/api/chat")) {
        text =
          "The /api/chat endpoint was not found. This may mean that you are using an older version of Ollama that does not support /api/chat. Upgrading to the latest version will solve the issue.";
      } else {
        text =
          "This may mean that you forgot to add '/v1' to the end of your 'apiBase' in config.json.";
      }
    } else if (resp.status === 404 && resp.url.includes("api.openai.com")) {
      text =
        "You may need to add pre-paid credits before using the OpenAI API.";
    } else if (
      resp.status === 401 &&
      (resp.url.includes("api.mistral.ai") ||
        resp.url.includes("codestral.mistral.ai"))
    ) {
      if (resp.url.includes("codestral.mistral.ai")) {
        return new Error(
          "You are using a Mistral API key, which is not compatible with the Codestral API. Please either obtain a Codestral API key, or use the Mistral API by setting 'apiBase' to 'https://api.mistral.ai/v1' in config.json.",
        );
      } else {
        return new Error(
          "You are using a Codestral API key, which is not compatible with the Mistral API. Please either obtain a Mistral API key, or use the the Codestral API by setting 'apiBase' to 'https://codestral.mistral.ai/v1' in config.json.",
        );
      }
    }
    return new Error(
      `HTTP ${resp.status} ${resp.statusText} from ${resp.url}\n\n${text}`,
    );
  }

  fetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Custom Node.js fetch
    const customFetch = async (input: URL | RequestInfo, init: any) => {
      try {
        const resp = await fetchwithRequestOptions(
          new URL(input as any),
          { ...init },
          { ...this.requestOptions },
        );

        // Error mapping to be more helpful
        if (!resp.ok) {
          if (resp.status === 499) {
            return resp; // client side cancellation
          }

          const error = await this.parseError(resp);
          throw error;
        }

        return resp;
      } catch (e: any) {
        // Capture all fetch errors to Sentry for monitoring
        Logger.error(e, {
          context: "llm_fetch",
          url: String(input),
          method: init?.method || "GET",
          model: this.model,
          provider: this.providerName,
        });

        // Errors to ignore
        if (e.message.includes("/api/tags")) {
          throw new Error(`Error fetching tags: ${e.message}`);
        } else if (e.message.includes("/api/show")) {
          throw new Error(
            `HTTP ${e.response.status} ${e.response.statusText} from ${e.response.url}\n\n${e.response.body}`,
          );
        } else {
          if (e.name !== "AbortError") {
            // Don't pollute console with abort errors. Check on name instead of instanceof, to avoid importing node-fetch here
            console.debug(
              `${e.message}\n\nCode: ${e.code}\nError number: ${e.errno}\nSyscall: ${e.erroredSysCall}\nType: ${e.type}\n\n${e.stack}`,
            );
          }
          if (
            e.code === "ECONNREFUSED" &&
            e.message.includes("http://127.0.0.1:11434")
          ) {
            const message = (await isOllamaInstalled())
              ? "Unable to connect to local Ollama instance. Ollama may not be running."
              : "Unable to connect to local Ollama instance. Ollama may not be installed or may not running.";
            throw new Error(message);
          }
          if (
            e.code === "ECONNREFUSED" &&
            e.message.includes("http://localhost:8000")
          ) {
            const isInstalled = await isLemonadeInstalled();
            let message: string;
            if (process.platform === "linux") {
              // On Linux, isLemonadeInstalled checks if it's running (via health endpoint)
              message =
                "Unable to connect to local Lemonade instance. Please ensure Lemonade is running. Visit http://lemonade-server.ai for setup instructions.";
            } else {
              // On Windows, we can check if it's installed
              message = isInstalled
                ? "Unable to connect to local Lemonade instance. Lemonade server may not be running."
                : "Unable to connect to local Lemonade instance. Lemonade may not be installed or may not be running.";
            }
            throw new Error(message);
          }
        }
        throw e;
      }
    };
    return withExponentialBackoff<Response>(
      () => customFetch(url, init) as any,
      5,
      0.5,
    );
  }

  private _parseCompletionOptions(options: LLMFullCompletionOptions) {
    const log = options.log ?? true;
    const raw = options.raw ?? false;
    options.log = undefined;

    const completionOptions: CompletionOptions = mergeJson(
      this.completionOptions,
      options,
    );

    return { completionOptions, logEnabled: log, raw };
  }

  private _formatChatMessages(messages: ChatMessage[]): string {
    const msgsCopy = messages ? messages.map((msg) => ({ ...msg })) : [];
    let formatted = "";
    for (const msg of msgsCopy) {
      formatted += this._formatChatMessage(msg);
    }
    return formatted;
  }

  private _formatChatMessage(msg: ChatMessage): string {
    let contentToShow = renderChatMessage(msg);
    if (msg.role === "assistant" && msg.toolCalls?.length) {
      contentToShow +=
        "\n" +
        msg.toolCalls
          ?.map(
            (toolCall) =>
              `${toolCall.function?.name}(${toolCall.function?.arguments})`,
          )
          .join("\n");
    }

    return `<${msg.role}>\n${contentToShow}\n\n`;
  }

  protected async *_streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string, PromptLog> {
    throw new Error("Not implemented");
  }

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [];

  private shouldUseOpenAIAdapter(requestType: LlmApiRequestType) {
    return (
      this.useOpenAIAdapterFor.includes(requestType) ||
      this.useOpenAIAdapterFor.includes("*")
    );
  }

  async *streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<string> {
    this.lastRequestId = undefined;
    const { completionOptions, logEnabled } =
      this._parseCompletionOptions(options);
    const interaction = logEnabled
      ? this.logger?.createInteractionLog()
      : undefined;
    let status: InteractionStatus = "in_progress";

    const fimLog = `Prefix: ${prefix}\nSuffix: ${suffix}`;
    if (logEnabled) {
      interaction?.logItem({
        kind: "startFim",
        prefix,
        suffix,
        options: completionOptions,
        provider: this.providerName,
      });
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, fimLog);
      }
    }

    let completion = "";
    try {
      if (this.shouldUseOpenAIAdapter("streamFim") && this.openaiAdapter) {
        const stream = this.openaiAdapter.fimStream(
          toFimBody(prefix, suffix, completionOptions),
          signal,
        );
        for await (const chunk of stream) {
          if (!this.lastRequestId && typeof (chunk as any).id === "string") {
            this.lastRequestId = (chunk as any).id;
          }
          const result = fromChatCompletionChunk(chunk);
          if (result) {
            const content = renderChatMessage(result);
            const formattedContent = this._formatChatMessage(result);
            interaction?.logItem({
              kind: "chunk",
              chunk: formattedContent,
            });

            completion += formattedContent;
            yield content;
          }
        }
      } else {
        for await (const chunk of this._streamFim(
          prefix,
          suffix,
          signal,
          completionOptions,
        )) {
          interaction?.logItem({
            kind: "chunk",
            chunk,
          });

          completion += chunk;
          yield chunk;
        }
      }

      status = this._logEnd(
        completionOptions.model,
        fimLog,
        completion,
        undefined,
        interaction,
        undefined,
      );
    } catch (e) {
      // Capture FIM (Fill-in-the-Middle) completion failures to Sentry
      Logger.error(e as Error, {
        context: "llm_stream_fim",
        model: completionOptions.model,
        provider: this.providerName,
        useOpenAIAdapter: this.shouldUseOpenAIAdapter("streamFim"),
      });

      status = this._logEnd(
        completionOptions.model,
        fimLog,
        completion,
        undefined,
        interaction,
        undefined,
        e,
      );
      throw e;
    } finally {
      if (status === "in_progress") {
        this._logEnd(
          completionOptions.model,
          fimLog,
          completion,
          undefined,
          interaction,
          undefined,
          "cancel",
        );
      }
    }

    return {
      prompt: fimLog,
      completion,
      completionOptions,
    };
  }

  async *streamComplete(
    _prompt: string,
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
  ) {
    this.lastRequestId = undefined;
    const { completionOptions, logEnabled, raw } =
      this._parseCompletionOptions(options);
    const interaction = logEnabled
      ? this.logger?.createInteractionLog()
      : undefined;
    let status: InteractionStatus = "in_progress";

    let prompt = pruneRawPromptFromTop(
      completionOptions.model,
      this.contextLength,
      _prompt,
      completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
    );

    if (!raw) {
      prompt = this._templatePromptLikeMessages(prompt);
    }

    if (logEnabled) {
      interaction?.logItem({
        kind: "startComplete",
        prompt,
        options: completionOptions,
        provider: this.providerName,
      });
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }

    let completion = "";
    try {
      if (this.shouldUseOpenAIAdapter("streamComplete") && this.openaiAdapter) {
        if (completionOptions.stream === false) {
          // Stream false
          const response = await this.openaiAdapter.completionNonStream(
            { ...toCompleteBody(prompt, completionOptions), stream: false },
            signal,
          );
          this.lastRequestId = response.id ?? this.lastRequestId;
          completion = response.choices[0]?.text ?? "";
          yield completion;
        } else {
          // Stream true
          for await (const chunk of this.openaiAdapter.completionStream(
            {
              ...toCompleteBody(prompt, completionOptions),
              stream: true,
            },
            signal,
          )) {
            if (!this.lastRequestId && typeof (chunk as any).id === "string") {
              this.lastRequestId = (chunk as any).id;
            }
            const content = chunk.choices[0]?.text ?? "";
            completion += content;
            interaction?.logItem({
              kind: "chunk",
              chunk: content,
            });
            yield content;
          }
        }
      } else {
        for await (const chunk of this._streamComplete(
          prompt,
          signal,
          completionOptions,
        )) {
          completion += chunk;
          interaction?.logItem({
            kind: "chunk",
            chunk,
          });
          yield chunk;
        }
      }
      status = this._logEnd(
        completionOptions.model,
        prompt,
        completion,
        undefined,
        interaction,
        undefined,
      );
    } catch (e) {
      // Capture streaming completion failures to Sentry
      Logger.error(e as Error, {
        context: "llm_stream_complete",
        model: completionOptions.model,
        provider: this.providerName,
        useOpenAIAdapter: this.shouldUseOpenAIAdapter("streamComplete"),
        streamEnabled: completionOptions.stream !== false,
      });

      status = this._logEnd(
        completionOptions.model,
        prompt,
        completion,
        undefined,
        interaction,
        undefined,
        e,
      );
      throw e;
    } finally {
      if (status === "in_progress") {
        this._logEnd(
          completionOptions.model,
          prompt,
          completion,
          undefined,
          interaction,
          undefined,
          "cancel",
        );
      }
    }

    return {
      modelTitle: this.title ?? completionOptions.model,
      modelProvider: this.underlyingProviderName,
      prompt,
      completion,
      completionOptions,
    };
  }

  async complete(
    _prompt: string,
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
  ) {
    this.lastRequestId = undefined;
    const { completionOptions, logEnabled, raw } =
      this._parseCompletionOptions(options);
    const interaction = logEnabled
      ? this.logger?.createInteractionLog()
      : undefined;
    let status: InteractionStatus = "in_progress";

    let prompt = pruneRawPromptFromTop(
      completionOptions.model,
      this.contextLength,
      _prompt,
      completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
    );

    if (!raw) {
      prompt = this._templatePromptLikeMessages(prompt);
    }

    if (logEnabled) {
      interaction?.logItem({
        kind: "startComplete",
        prompt: prompt,
        options: completionOptions,
        provider: this.providerName,
      });
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }

    let completion: string = "";

    try {
      if (this.shouldUseOpenAIAdapter("complete") && this.openaiAdapter) {
        const result = await this.openaiAdapter.completionNonStream(
          {
            ...toCompleteBody(prompt, completionOptions),
            stream: false,
          },
          signal,
        );
        this.lastRequestId = result.id ?? this.lastRequestId;
        completion = result.choices[0].text;
      } else {
        completion = await this._complete(prompt, signal, completionOptions);
      }

      interaction?.logItem({
        kind: "chunk",
        chunk: completion,
      });

      status = this._logEnd(
        completionOptions.model,
        prompt,
        completion,
        undefined,
        interaction,
        undefined,
      );
    } catch (e) {
      // Capture completion failures to Sentry
      Logger.error(e as Error, {
        context: "llm_complete",
        model: completionOptions.model,
        provider: this.providerName,
        useOpenAIAdapter: this.shouldUseOpenAIAdapter("complete"),
      });

      status = this._logEnd(
        completionOptions.model,
        prompt,
        completion,
        undefined,
        interaction,
        undefined,
        e,
      );
      throw e;
    } finally {
      if (status === "in_progress") {
        this._logEnd(
          completionOptions.model,
          prompt,
          completion,
          undefined,
          interaction,
          undefined,
          "cancel",
        );
      }
    }

    return completion;
  }

  async chat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
  ) {
    let completion = "";
    for await (const message of this.streamChat(messages, signal, options)) {
      completion += renderChatMessage(message);
    }
    return { role: "assistant" as const, content: completion };
  }

  compileChatMessages(
    message: ChatMessage[],
    options: LLMFullCompletionOptions,
  ) {
    let { completionOptions } = this._parseCompletionOptions(options);
    completionOptions = this._modifyCompletionOptions(completionOptions);

    return compileChatMessages({
      modelName: completionOptions.model,
      msgs: message,
      knownContextLength: this._contextLength,
      maxTokens: completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
      supportsImages: this.supportsImages(),
      tools: options.tools,
    });
  }

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    return body;
  }

  private _modifyCompletionOptions(
    completionOptions: CompletionOptions,
  ): CompletionOptions {
    // As of 01/14/25 streaming is currently not available with o1
    // See these threads:
    // - https://github.com/continuedev/continue/issues/3698
    // - https://community.openai.com/t/streaming-support-for-o1-o1-2024-12-17-resulting-in-400-unsupported-value/1085043
    if (completionOptions.model === "o1") {
      completionOptions.stream = false;
    }

    return completionOptions;
  }

  // Update the processChatChunk method:
  private processChatChunk(
    chunk: ChatMessage,
    interaction: ILLMInteractionLog | undefined,
  ): {
    completion: string[];
    thinking: string[];
    usage: Usage | null;
    chunk: ChatMessage;
  } {
    const completion: string[] = [];
    const thinking: string[] = [];
    let usage: Usage | null = null;

    if (chunk.role === "assistant") {
      completion.push(this._formatChatMessage(chunk));
    } else if (chunk.role === "thinking" && typeof chunk.content === "string") {
      thinking.push(chunk.content);
    }

    interaction?.logItem({
      kind: "message",
      message: chunk,
    });

    if (chunk.role === "assistant" && chunk.usage) {
      usage = chunk.usage;
    }

    return {
      completion,
      thinking,
      usage,
      chunk,
    };
  }

  private canUseOpenAIResponses(options: CompletionOptions): boolean {
    return (
      this.providerName === "openai" &&
      typeof (this as any)._streamResponses === "function" &&
      (this as any).isOSeriesOrGpt5Model(options.model)
    );
  }

  private async *openAIAdapterStream(
    body: ChatCompletionCreateParams,
    signal: AbortSignal,
    onCitations: (c: string[]) => void,
  ): AsyncGenerator<ChatMessage> {
    const stream = this.openaiAdapter!.chatCompletionStream(
      { ...body, stream: true },
      signal,
    );
    for await (const chunk of stream) {
      if (!this.lastRequestId && typeof (chunk as any).id === "string") {
        this.lastRequestId = (chunk as any).id;
      }
      const chatChunk = fromChatCompletionChunk(chunk as any);
      if (chatChunk) {
        yield chatChunk;
      }
      if ((chunk as any).citations && Array.isArray((chunk as any).citations)) {
        onCitations((chunk as any).citations);
      }
    }
  }

  private async *openAIAdapterNonStream(
    body: ChatCompletionCreateParams,
    signal: AbortSignal,
  ): AsyncGenerator<ChatMessage> {
    const response = await this.openaiAdapter!.chatCompletionNonStream(
      { ...body, stream: false },
      signal,
    );
    this.lastRequestId = response.id ?? this.lastRequestId;
    const messages = fromChatResponse(response as any);
    for (const msg of messages) {
      yield msg;
    }
  }

  private async *responsesStream(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const g = (this as any)._streamResponses(
      messages,
      signal,
      options,
    ) as AsyncGenerator<ChatMessage>;
    for await (const m of g) {
      yield m;
    }
  }

  private async *responsesNonStream(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const msg = await (this as any)._responses(messages, signal, options);
    yield msg as ChatMessage;
  }

  // Update the streamChat method:
  async *streamChat(
    _messages: ChatMessage[],
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
    messageOptions?: MessageOption,
  ): AsyncGenerator<ChatMessage, PromptLog> {
    this.lastRequestId = undefined;
    let { completionOptions, logEnabled } =
      this._parseCompletionOptions(options);
    const interaction = logEnabled
      ? this.logger?.createInteractionLog()
      : undefined;
    let status: InteractionStatus = "in_progress";

    completionOptions = this._modifyCompletionOptions(completionOptions);

    let messages = _messages;

    // If not precompiled, compile the chat messages
    if (!messageOptions?.precompiled) {
      const { compiledChatMessages } = compileChatMessages({
        modelName: completionOptions.model,
        msgs: _messages,
        knownContextLength: this._contextLength,
        maxTokens: completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
        supportsImages: this.supportsImages(),
        tools: options.tools,
      });

      messages = compiledChatMessages;
    }

    const messagesCopy = [...messages]; // templateMessages may modify messages.

    const prompt = this.templateMessages
      ? this.templateMessages(messagesCopy)
      : this._formatChatMessages(messagesCopy);

    if (logEnabled) {
      interaction?.logItem({
        kind: "startChat",
        messages,
        options: completionOptions,
        provider: this.providerName,
      });
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }

    // Performance optimization: Use arrays instead of string concatenation.
    // String concatenation in loops creates new string objects for each operation,
    // which is O(n²) for n chunks. Arrays with push() are O(1) per operation,
    // making the total O(n). We join() only once at the end.
    const thinking: string[] = [];
    const completion: string[] = [];
    let usage: Usage | undefined = undefined;
    let citations: null | string[] = null;

    try {
      if (this.templateMessages) {
        for await (const chunk of this._streamComplete(
          prompt,
          signal,
          completionOptions,
        )) {
          completion.push(chunk);
          interaction?.logItem({
            kind: "chunk",
            chunk: chunk,
          });
          yield { role: "assistant", content: chunk };
        }
      } else {
        if (this.shouldUseOpenAIAdapter("streamChat") && this.openaiAdapter) {
          let body = toChatBody(messages, completionOptions, {
            includeReasoningField: this.supportsReasoningField,
            includeReasoningDetailsField: this.supportsReasoningDetailsField,
          });
          body = this.modifyChatBody(body);

          if (logEnabled) {
            interaction?.logItem({
              kind: "startChat",
              messages,
              options: {
                ...completionOptions,
                requestBody: body,
              } as CompletionOptions,
              provider: this.providerName,
            });
            if (this.llmRequestHook) {
              this.llmRequestHook(completionOptions.model, prompt);
            }
          }

          const canUseResponses = this.canUseOpenAIResponses(completionOptions);
          const useStream = completionOptions.stream !== false;

          let iterable: AsyncIterable<ChatMessage>;
          if (canUseResponses) {
            iterable = useStream
              ? this.responsesStream(messages, signal, completionOptions)
              : this.responsesNonStream(messages, signal, completionOptions);
          } else {
            iterable = useStream
              ? this.openAIAdapterStream(body, signal, (c) => {
                  if (!citations) {
                    citations = c;
                  }
                })
              : this.openAIAdapterNonStream(body, signal);
          }

          for await (const chunk of iterable) {
            const result = this.processChatChunk(chunk, interaction);
            completion.push(...result.completion);
            thinking.push(...result.thinking);
            if (result.usage !== null) {
              usage = result.usage;
            }
            yield result.chunk;
          }
        } else {
          if (logEnabled) {
            interaction?.logItem({
              kind: "startChat",
              messages,
              options: completionOptions,
              provider: this.providerName,
            });
            if (this.llmRequestHook) {
              this.llmRequestHook(completionOptions.model, prompt);
            }
          }

          for await (const chunk of this._streamChat(
            messages,
            signal,
            completionOptions,
          )) {
            const result = this.processChatChunk(chunk, interaction);
            completion.push(...result.completion);
            thinking.push(...result.thinking);
            if (result.usage !== null) {
              usage = result.usage;
            }
            yield result.chunk;
          }
        }
      }

      if (citations) {
        const cits = citations as string[];
        interaction?.logItem({
          kind: "message",
          message: {
            role: "assistant",
            content: `\n\nCitations:\n${cits.map((c: string, i: number) => `${i + 1}: ${c}`).join("\n")}\n\n`,
          },
        });
      }

      status = this._logEnd(
        completionOptions.model,
        prompt,
        completion.join(""),
        thinking.join(""),
        interaction,
        usage,
      );
    } catch (e) {
      // Capture chat streaming failures to Sentry
      Logger.error(e as Error, {
        context: "llm_stream_chat",
        model: completionOptions.model,
        provider: this.providerName,
        useOpenAIAdapter: this.shouldUseOpenAIAdapter("streamChat"),
        streamEnabled: completionOptions.stream !== false,
        templateMessages: !!this.templateMessages,
      });

      status = this._logEnd(
        completionOptions.model,
        prompt,
        completion.join(""),
        thinking.join(""),
        interaction,
        usage,
        e,
      );
      throw e;
    } finally {
      if (status === "in_progress") {
        this._logEnd(
          completionOptions.model,
          prompt,
          completion.join(""),
          undefined,
          interaction,
          usage,
          "cancel",
        );
      }
    }
    /*
  TODO: According to: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
  During tool use, you must pass thinking and redacted_thinking blocks back to the API,
  and you must include the complete unmodified block back to the API. This is critical
  for maintaining the model's reasoning flow and conversation integrity.

  On the other hand, adding thinking and redacted_thinking blocks are ignored on subsequent
  requests when not using tools, so it's the simplest option to always add to history.
  */

    return {
      modelTitle: this.title ?? completionOptions.model,
      modelProvider: this.underlyingProviderName,
      prompt,
      completion: completion.join(""),
    };
  }

  getBatchedChunks(chunks: string[]): string[][] {
    const batchedChunks = [];

    for (let i = 0; i < chunks.length; i += this.maxEmbeddingBatchSize) {
      batchedChunks.push(chunks.slice(i, i + this.maxEmbeddingBatchSize));
    }

    return batchedChunks;
  }

  async embed(chunks: string[]): Promise<number[][]> {
    const batches = this.getBatchedChunks(chunks);

    return (
      await Promise.all(
        batches.map(async (batch) => {
          if (batch.length === 0) {
            return [];
          }

          const embeddings = await withExponentialBackoff<number[][]>(
            async () => {
              if (this.shouldUseOpenAIAdapter("embed") && this.openaiAdapter) {
                const result = await this.openaiAdapter.embed({
                  model: this.model,
                  input: batch,
                });
                return result.data.map((chunk) => chunk.embedding);
              }

              return await this._embed(batch);
            },
          );

          return embeddings;
        }),
      )
    ).flat();
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (this.shouldUseOpenAIAdapter("rerank") && this.openaiAdapter) {
      const results = await this.openaiAdapter.rerank({
        model: this.model,
        query,
        documents: chunks.map((chunk) => chunk.content),
      });

      // Standard OpenAI format
      if (results.data && Array.isArray(results.data)) {
        return results.data
          .sort((a, b) => a.index - b.index)
          .map((result) => result.relevance_score);
      }

      throw new Error(
        `Unexpected rerank response format from ${this.providerName}. ` +
          `Expected 'data' array but got: ${JSON.stringify(Object.keys(results))}`,
      );
    }

    throw new Error(
      `Reranking is not supported for provider type ${this.providerName}`,
    );
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    throw new Error("Not implemented");
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    if (!this.templateMessages) {
      throw new Error(
        "You must either implement templateMessages or _streamChat",
      );
    }

    for await (const chunk of this._streamComplete(
      this.templateMessages(messages),
      signal,
      options,
    )) {
      yield { role: "assistant", content: chunk };
    }
  }

  protected async _complete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ) {
    let completion = "";
    for await (const chunk of this._streamComplete(prompt, signal, options)) {
      completion += chunk;
    }
    return completion;
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    throw new Error(
      `Embedding is not supported for provider type ${this.providerName}`,
    );
  }

  countTokens(text: string): number {
    return countTokens(text, this.model);
  }

  protected collectArgs(options: CompletionOptions): any {
    return {
      ...DEFAULT_ARGS,
      // model: this.model,
      ...options,
    };
  }

  public renderPromptTemplate(
    template: PromptTemplate,
    history: ChatMessage[],
    otherData: Record<string, string>,
    canPutWordsInModelsMouth = false,
  ): string | ChatMessage[] {
    if (typeof template === "string") {
      const data: any = {
        history: history,
        ...otherData,
      };
      if (history.length > 0 && history[0].role === "system") {
        data.system_message = history.shift()!.content;
      }

      const compiledTemplate = Handlebars.compile(template);
      return compiledTemplate(data);
    }
    const rendered = template(history, {
      ...otherData,
      supportsCompletions: this.supportsCompletions() ? "true" : "false",
      supportsPrefill: this.supportsPrefill() ? "true" : "false",
    });
    if (
      typeof rendered !== "string" &&
      rendered[rendered.length - 1]?.role === "assistant" &&
      !canPutWordsInModelsMouth
    ) {
      // Some providers don't allow you to put words in the model's mouth
      // So we have to manually compile the prompt template and use
      // raw /completions, not /chat/completions
      const templateMessages = autodetectTemplateFunction(
        this.model,
        this.providerName,
        autodetectTemplateType(this.model),
      );
      if (templateMessages) {
        return templateMessages(rendered);
      }
    }
    return rendered;
  }
}
