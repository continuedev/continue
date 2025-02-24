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
  LLMFullCompletionOptions,
  LLMOptions,
  ModelCapability,
  PromptLog,
  PromptTemplate,
  RequestOptions,
  TemplateType,
} from "../index.js";
import mergeJson from "../util/merge.js";
import { renderChatMessage } from "../util/messageContent.js";
import { isOllamaInstalled } from "../util/ollamaHelper.js";
import { Telemetry } from "../util/posthog.js";
import { withExponentialBackoff } from "../util/withExponentialBackoff.js";

import {
  autodetectPromptTemplates,
  autodetectTemplateFunction,
  autodetectTemplateType,
  modelSupportsImages,
} from "./autodetect.js";
import {
  CONTEXT_LENGTH_FOR_MODEL,
  DEFAULT_ARGS,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_BATCH_SIZE,
  DEFAULT_MAX_CHUNK_SIZE,
  DEFAULT_MAX_TOKENS,
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

export abstract class BaseLLM implements ILLM {
  static providerName: string;
  static defaultOptions: Partial<LLMOptions> | undefined = undefined;

  get providerName(): string {
    return (this.constructor as typeof BaseLLM).providerName;
  }

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
  systemMessage?: string;
  contextLength: number;
  maxStopWords?: number | undefined;
  completionOptions: CompletionOptions;
  requestOptions?: RequestOptions;
  template?: TemplateType;
  promptTemplates?: Record<string, PromptTemplate>;
  templateMessages?: (messages: ChatMessage[]) => string;
  writeLog?: (str: string) => Promise<void>;
  llmRequestHook?: (model: string, prompt: string) => any;
  apiKey?: string;

  // continueProperties
  apiKeyLocation?: string;
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

  // For IBM watsonx
  deploymentId?: string;

  // Embedding options
  embeddingId: string;
  maxEmbeddingChunkSize: number;
  maxEmbeddingBatchSize: number;

  private _llmOptions: LLMOptions;

  protected openaiAdapter?: BaseLlmApi;

  constructor(_options: LLMOptions) {
    this._llmOptions = _options;

    // Set default options
    const options = {
      title: (this.constructor as typeof BaseLLM).providerName,
      ...(this.constructor as typeof BaseLLM).defaultOptions,
      ..._options,
    };

    this.model = options.model;
    // Use @continuedev/llm-info package to autodetect certain parameters
    const llmInfo = findLlmInfo(this.model);

    const templateType =
      options.template ?? autodetectTemplateType(options.model);

    this.title = options.title;
    this.uniqueId = options.uniqueId ?? "None";
    this.systemMessage = options.systemMessage;
    this.contextLength =
      options.contextLength ?? llmInfo?.contextLength ?? DEFAULT_CONTEXT_LENGTH;
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
    this.writeLog = options.writeLog;
    this.llmRequestHook = options.llmRequestHook;
    this.apiKey = options.apiKey;

    // continueProperties
    this.apiKeyLocation = options.apiKeyLocation;
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

    this.openaiAdapter = this.createOpenAiAdapter();

    this.maxEmbeddingBatchSize =
      options.maxEmbeddingBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.maxEmbeddingChunkSize =
      options.maxEmbeddingChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
    this.embeddingId = `${this.constructor.name}::${this.model}::${this.maxEmbeddingChunkSize}`;
  }

  protected createOpenAiAdapter() {
    return constructLlmApi({
      provider: this.providerName as any,
      apiKey: this.apiKey ?? "",
      apiBase: this.apiBase,
      requestOptions: this.requestOptions,
    });
  }

  listModels(): Promise<string[]> {
    return Promise.resolve([]);
  }

  private _compileChatMessages(
    options: CompletionOptions,
    messages: ChatMessage[],
    functions?: any[],
  ) {
    let contextLength = this.contextLength;
    if (
      options.model !== this.model &&
      options.model in CONTEXT_LENGTH_FOR_MODEL
    ) {
      contextLength =
        CONTEXT_LENGTH_FOR_MODEL[options.model] || DEFAULT_CONTEXT_LENGTH;
    }

    return compileChatMessages(
      options.model,
      messages,
      contextLength,
      options.maxTokens ?? DEFAULT_MAX_TOKENS,
      this.supportsImages(),
      undefined,
      functions,
      this.systemMessage,
    );
  }

  private _getSystemMessage(): string | undefined {
    // TODO: Merge with config system message
    return this.systemMessage;
  }

  private _templatePromptLikeMessages(prompt: string): string {
    if (!this.templateMessages) {
      return prompt;
    }

    const msgs: ChatMessage[] = [{ role: "user", content: prompt }];

    const systemMessage = this._getSystemMessage();
    if (systemMessage) {
      msgs.unshift({ role: "system", content: systemMessage });
    }

    return this.templateMessages(msgs);
  }

  private _compilePromptForLog(
    prompt: string,
    completionOptions: CompletionOptions,
  ): string {
    const completionOptionsLog = JSON.stringify(
      {
        contextLength: this.contextLength,
        ...completionOptions,
      },
      null,
      2,
    );

    let requestOptionsLog = "";
    if (this.requestOptions) {
      requestOptionsLog = JSON.stringify(this.requestOptions, null, 2);
    }

    return (
      "##### Completion options #####\n" +
      completionOptionsLog +
      (requestOptionsLog
        ? "\n\n##### Request options #####\n" + requestOptionsLog
        : "") +
      "\n\n##### Prompt #####\n" +
      prompt
    );
  }

  private _logTokensGenerated(
    model: string,
    prompt: string,
    completion: string,
  ) {
    let promptTokens = this.countTokens(prompt);
    let generatedTokens = this.countTokens(completion);

    void Telemetry.capture(
      "tokens_generated",
      {
        model: model,
        provider: this.providerName,
        promptTokens: promptTokens,
        generatedTokens: generatedTokens,
      },
      true,
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
        provider: this.providerName,
        promptTokens: promptTokens,
        generatedTokens: generatedTokens,
      },
    });
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
          let text = await resp.text();
          if (resp.status === 404 && !resp.url.includes("/v1")) {
            if (text.includes("try pulling it first")) {
              const model = JSON.parse(text).error.split(" ")[1].slice(1, -1);
              text = `The model "${model}" was not found. To download it, run \`ollama run ${model}\`.`;
            } else if (text.includes("/api/chat")) {
              text =
                "The /api/chat endpoint was not found. This may mean that you are using an older version of Ollama that does not support /api/chat. Upgrading to the latest version will solve the issue.";
            } else {
              text =
                "This may mean that you forgot to add '/v1' to the end of your 'apiBase' in config.json.";
            }
          } else if (
            resp.status === 404 &&
            resp.url.includes("api.openai.com")
          ) {
            text =
              "You may need to add pre-paid credits before using the OpenAI API.";
          } else if (
            resp.status === 401 &&
            (resp.url.includes("api.mistral.ai") ||
              resp.url.includes("codestral.mistral.ai"))
          ) {
            if (resp.url.includes("codestral.mistral.ai")) {
              throw new Error(
                "You are using a Mistral API key, which is not compatible with the Codestral API. Please either obtain a Codestral API key, or use the Mistral API by setting 'apiBase' to 'https://api.mistral.ai/v1' in config.json.",
              );
            } else {
              throw new Error(
                "You are using a Codestral API key, which is not compatible with the Mistral API. Please either obtain a Mistral API key, or use the the Codestral API by setting 'apiBase' to 'https://codestral.mistral.ai/v1' in config.json.",
              );
            }
          }
          throw new Error(
            `HTTP ${resp.status} ${resp.statusText} from ${resp.url}\n\n${text}`,
          );
        }

        return resp;
      } catch (e: any) {
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
        }
        throw new Error(e.message);
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
      let contentToShow = "";
      if (msg.role === "tool") {
        contentToShow = msg.content;
      } else if (msg.role === "assistant" && msg.toolCalls) {
        contentToShow = msg.toolCalls
          ?.map(
            (toolCall) =>
              `${toolCall.function?.name}(${toolCall.function?.arguments})`,
          )
          .join("\n");
      } else if ("content" in msg) {
        if (Array.isArray(msg.content)) {
          msg.content = renderChatMessage(msg);
        }
        contentToShow = msg.content;
      }

      formatted += `<${msg.role}>\n${contentToShow}\n\n`;
    }
    return formatted;
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
    const { completionOptions, logEnabled } =
      this._parseCompletionOptions(options);

    const fimLog = `Prefix: ${prefix}\nSuffix: ${suffix}`;
    if (logEnabled) {
      if (this.writeLog) {
        await this.writeLog(
          this._compilePromptForLog(fimLog, completionOptions),
        );
      }
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, fimLog);
      }
    }

    let completion = "";

    if (this.shouldUseOpenAIAdapter("streamFim") && this.openaiAdapter) {
      const stream = this.openaiAdapter.fimStream(
        toFimBody(prefix, suffix, completionOptions),
        signal,
      );
      for await (const chunk of stream) {
        const result = fromChatCompletionChunk(chunk);
        if (result) {
          const content = renderChatMessage(result);
          completion += content;
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
        completion += chunk;
        yield chunk;
      }
    }

    this._logTokensGenerated(completionOptions.model, fimLog, completion);

    if (logEnabled && this.writeLog) {
      await this.writeLog(`Completion:\n${completion}\n\n`);
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
    const { completionOptions, logEnabled, raw } =
      this._parseCompletionOptions(options);

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
      if (this.writeLog) {
        await this.writeLog(
          this._compilePromptForLog(prompt, completionOptions),
        );
      }
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
            const content = chunk.choices[0]?.text ?? "";
            completion += content;
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
          yield chunk;
        }
      }
    } finally {
      this._logTokensGenerated(completionOptions.model, prompt, completion);

      if (logEnabled && this.writeLog) {
        await this.writeLog(`Completion:\n${completion}\n\n`);
      }
    }

    return {
      modelTitle: this.title ?? completionOptions.model,
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
    const { completionOptions, logEnabled, raw } =
      this._parseCompletionOptions(options);

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
      if (this.writeLog) {
        await this.writeLog(
          this._compilePromptForLog(prompt, completionOptions),
        );
      }
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }

    let completion: string;
    if (this.shouldUseOpenAIAdapter("complete") && this.openaiAdapter) {
      const result = await this.openaiAdapter.completionNonStream(
        {
          ...toCompleteBody(prompt, completionOptions),
          stream: false,
        },
        signal,
      );
      completion = result.choices[0].text;
    } else {
      completion = await this._complete(prompt, signal, completionOptions);
    }

    this._logTokensGenerated(completionOptions.model, prompt, completion);

    if (logEnabled && this.writeLog) {
      await this.writeLog(`Completion:\n${completion}\n\n`);
    }

    return completion;
  }

  async chat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
  ) {
    let completion = "";
    for await (const chunk of this.streamChat(messages, signal, options)) {
      completion += chunk.content;
    }
    return { role: "assistant" as const, content: completion };
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

  async *streamChat(
    _messages: ChatMessage[],
    signal: AbortSignal,
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<ChatMessage, PromptLog> {
    let { completionOptions, logEnabled } =
      this._parseCompletionOptions(options);

    completionOptions = this._modifyCompletionOptions(completionOptions);

    const messages = this._compileChatMessages(completionOptions, _messages);

    const prompt = this.templateMessages
      ? this.templateMessages(messages)
      : this._formatChatMessages(messages);
    if (logEnabled) {
      if (this.writeLog) {
        await this.writeLog(
          this._compilePromptForLog(prompt, completionOptions),
        );
      }
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }

    let completion = "";

    try {
      if (this.templateMessages) {
        for await (const chunk of this._streamComplete(
          prompt,
          signal,
          completionOptions,
        )) {
          completion += chunk;
          yield { role: "assistant", content: chunk };
        }
      } else {
        if (this.shouldUseOpenAIAdapter("streamChat") && this.openaiAdapter) {
          let body = toChatBody(messages, completionOptions);
          body = this.modifyChatBody(body);

          if (completionOptions.stream === false) {
            // Stream false
            const response = await this.openaiAdapter.chatCompletionNonStream(
              { ...body, stream: false },
              signal,
            );
            const msg = fromChatResponse(response);
            yield msg;
            completion = renderChatMessage(msg);
          } else {
            // Stream true
            const stream = this.openaiAdapter.chatCompletionStream(
              {
                ...body,
                stream: true,
              },
              signal,
            );
            for await (const chunk of stream) {
              const result = fromChatCompletionChunk(chunk);
              if (result) {
                yield result;
              }
            }
          }
        } else {
          for await (const chunk of this._streamChat(
            messages,
            signal,
            completionOptions,
          )) {
            completion += chunk.content;
            yield chunk;
          }
        }
      }
    } catch (error) {
      console.log(error);
      throw error;
    }

    this._logTokensGenerated(completionOptions.model, prompt, completion);

    if (logEnabled && this.writeLog) {
      await this.writeLog(`Completion:\n${completion}\n\n`);
    }

    return {
      modelTitle: this.title ?? completionOptions.model,
      prompt,
      completion,
      completionOptions,
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

      // Put them in the order they were given
      const sortedResults = results.data.sort((a, b) => a.index - b.index);
      return sortedResults.map((result) => result.relevance_score);
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
