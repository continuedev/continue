import {
  ChatMessage,
  ChatMessageRole,
  CompletionOptions,
  ILLM,
  LLMFullCompletionOptions,
  LLMOptions,
  LLMReturnValue,
  ModelName,
  ModelProvider,
  RequestOptions,
  TemplateType,
} from "..";
import mergeJson from "../util/merge";
import { Telemetry } from "../util/posthog";
import {
  autodetectPromptTemplates,
  autodetectTemplateFunction,
  autodetectTemplateType,
  modelSupportsImages,
} from "./autodetect";
import {
  CONTEXT_LENGTH_FOR_MODEL,
  DEFAULT_ARGS,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_MAX_TOKENS,
} from "./constants";
import {
  compileChatMessages,
  countTokens,
  pruneRawPromptFromTop,
} from "./countTokens";
import CompletionOptionsForModels from "./templates/options";

export abstract class BaseLLM implements ILLM {
  static providerName: ModelProvider;
  static defaultOptions: Partial<LLMOptions> | undefined = undefined;

  get providerName(): ModelProvider {
    return (this.constructor as typeof BaseLLM).providerName;
  }

  supportsImages(): boolean {
    return modelSupportsImages(this.providerName, this.model);
  }

  uniqueId: string;
  model: string;

  title?: string;
  systemMessage?: string;
  contextLength: number;
  completionOptions: CompletionOptions;
  requestOptions?: RequestOptions;
  template?: TemplateType;
  promptTemplates?: Record<string, string>;
  templateMessages?: (messages: ChatMessage[]) => string;
  writeLog?: (str: string) => Promise<void>;
  llmRequestHook?: (model: string, prompt: string) => any;
  apiKey?: string;
  apiBase?: string;

  engine?: string;
  apiVersion?: string;
  apiType?: string;
  region?: string;
  projectId?: string;

  private _llmOptions: LLMOptions;

  constructor(options: LLMOptions) {
    this._llmOptions = options;

    // Set default options
    options = {
      title: (this.constructor as typeof BaseLLM).providerName,
      ...(this.constructor as typeof BaseLLM).defaultOptions,
      ...options,
    };

    const templateType =
      options.template || autodetectTemplateType(options.model);

    this.title = options.title;
    this.uniqueId = options.uniqueId || "None";
    this.model = options.model;
    this.systemMessage = options.systemMessage;
    this.contextLength = options.contextLength || DEFAULT_CONTEXT_LENGTH;
    this.completionOptions = {
      ...options.completionOptions,
      model: options.model || "gpt-4",
      maxTokens: options.completionOptions?.maxTokens || DEFAULT_MAX_TOKENS,
    };
    if (CompletionOptionsForModels[options.model as ModelName]) {
      this.completionOptions = mergeJson(
        this.completionOptions,
        CompletionOptionsForModels[options.model as ModelName] || {},
      );
    }
    this.requestOptions = options.requestOptions;
    this.promptTemplates = {
      ...autodetectPromptTemplates(options.model, templateType),
      ...options.promptTemplates,
    };
    this.templateMessages =
      options.templateMessages ||
      autodetectTemplateFunction(
        options.model,
        this.providerName,
        options.template,
      );
    this.writeLog = options.writeLog;
    this.llmRequestHook = options.llmRequestHook;
    this.apiKey = options.apiKey;
    this.apiBase = options.apiBase;
    if (this.apiBase?.endsWith("/")) {
      this.apiBase = this.apiBase.slice(0, -1);
    }

    this.engine = options.engine;
    this.apiVersion = options.apiVersion;
    this.apiType = options.apiType;
    this.region = options.region;
    this.projectId = options.projectId;
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
      options.maxTokens || DEFAULT_MAX_TOKENS,
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

  private _compileLogMessage(
    prompt: string,
    completionOptions: CompletionOptions,
  ): string {
    const dict = { contextLength: this.contextLength, ...completionOptions };
    const settings = Object.entries(dict)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    return `Settings:
${settings}

############################################

${prompt}`;
  }

  private _logTokensGenerated(model: string, completion: string) {
    let tokens = this.countTokens(completion);
    Telemetry.capture("tokens_generated", {
      model: model,
      provider: this.providerName,
      tokens: tokens,
    });
    Telemetry.capture("tokensGenerated", {
      model: model,
      provider: this.providerName,
      tokens: tokens,
    });
  }

  _fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> =
    undefined;

  protected fetch(
    url: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (this._fetch) {
      // Custom Node.js fetch
      return this._fetch(url, init);
    }

    // Most of the requestOptions aren't available in the browser
    const headers = new Headers(init?.headers);
    for (const [key, value] of Object.entries(
      this.requestOptions?.headers || {},
    )) {
      headers.append(key, value as string);
    }

    return fetch(url, {
      ...init,
      headers,
    });
  }

  private _parseCompletionOptions(options: LLMFullCompletionOptions) {
    const log = options.log ?? true;
    const raw = options.raw ?? false;
    delete options.log;
    delete options.raw;

    const completionOptions: CompletionOptions = mergeJson(
      this.completionOptions,
      options,
    );

    return { completionOptions, log, raw };
  }

  private _formatChatMessages(messages: ChatMessage[]): string {
    let formatted = "";
    for (let msg of messages) {
      formatted += `<${msg.role}>\n${msg.content || ""}\n\n`;
    }
    return formatted;
  }

  async *streamComplete(
    prompt: string,
    options: LLMFullCompletionOptions = {},
  ) {
    const { completionOptions, log, raw } =
      this._parseCompletionOptions(options);

    prompt = pruneRawPromptFromTop(
      completionOptions.model,
      this.contextLength,
      prompt,
      completionOptions.maxTokens || DEFAULT_MAX_TOKENS,
    );

    if (!raw) {
      prompt = this._templatePromptLikeMessages(prompt);
    }

    if (log) {
      if (this.writeLog) {
        await this.writeLog(this._compileLogMessage(prompt, completionOptions));
      }
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }

    let completion = "";
    for await (const chunk of this._streamComplete(prompt, completionOptions)) {
      completion += chunk;
      yield chunk;
    }

    this._logTokensGenerated(completionOptions.model, completion);

    if (log && this.writeLog) {
      await this.writeLog(`Completion:\n\n${completion}\n\n`);
    }

    return { prompt, completion };
  }

  async complete(prompt: string, options: LLMFullCompletionOptions = {}) {
    const { completionOptions, log, raw } =
      this._parseCompletionOptions(options);

    prompt = pruneRawPromptFromTop(
      completionOptions.model,
      this.contextLength,
      prompt,
      completionOptions.maxTokens || DEFAULT_MAX_TOKENS,
    );

    if (!raw) {
      prompt = this._templatePromptLikeMessages(prompt);
    }

    if (log) {
      if (this.writeLog) {
        await this.writeLog(this._compileLogMessage(prompt, completionOptions));
      }
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }

    const completion = await this._complete(prompt, completionOptions);

    this._logTokensGenerated(completionOptions.model, completion);
    if (log && this.writeLog) {
      await this.writeLog(`Completion:\n\n${completion}\n\n`);
    }

    return completion;
  }

  async chat(messages: ChatMessage[], options: LLMFullCompletionOptions = {}) {
    let completion = "";
    for await (const chunk of this.streamChat(messages, options)) {
      completion += chunk.content;
    }
    return { role: "assistant" as ChatMessageRole, content: completion };
  }

  async *streamChat(
    messages: ChatMessage[],
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<ChatMessage, LLMReturnValue> {
    const { completionOptions, log, raw } =
      this._parseCompletionOptions(options);

    messages = this._compileChatMessages(completionOptions, messages);

    const prompt = this.templateMessages
      ? this.templateMessages(messages)
      : this._formatChatMessages(messages);
    if (log) {
      if (this.writeLog) {
        await this.writeLog(this._compileLogMessage(prompt, completionOptions));
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
          completionOptions,
        )) {
          completion += chunk;
          yield { role: "assistant", content: chunk };
        }
      } else {
        for await (const chunk of this._streamChat(
          messages,
          completionOptions,
        )) {
          completion += chunk.content;
          yield chunk;
        }
      }
    } catch (error) {
      console.log(error);
      throw error;
    }

    this._logTokensGenerated(completionOptions.model, completion);
    if (log && this.writeLog) {
      await this.writeLog(`Completion:\n\n${completion}\n\n`);
    }

    return { prompt, completion };
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    throw new Error("Not implemented");
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    if (!this.templateMessages) {
      throw new Error(
        "You must either implement templateMessages or _streamChat",
      );
    }

    for await (const chunk of this._streamComplete(
      this.templateMessages(messages),
      options,
    )) {
      yield { role: "assistant", content: chunk };
    }
  }

  protected async _complete(prompt: string, options: CompletionOptions) {
    let completion = "";
    for await (const chunk of this._streamComplete(prompt, options)) {
      completion += chunk;
    }
    return completion;
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

  private _shouldRequestDirectly() {
    if (typeof window === "undefined") {
      return true;
    }
    return window?.ide !== "vscode";
  }
}
