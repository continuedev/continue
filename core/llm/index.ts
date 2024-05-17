import Handlebars from "handlebars";
import {
  ChatMessage,
  ChatMessageRole,
  CompletionOptions,
  ILLM,
  LLMFullCompletionOptions,
  LLMOptions,
  ModelName,
  ModelProvider,
  PromptLog,
  PromptTemplate,
  RequestOptions,
  TemplateType,
} from "../index.js";
import { DevDataSqliteDb } from "../util/devdataSqlite.js";
import { fetchwithRequestOptions } from "../util/fetchWithOptions.js";
import mergeJson from "../util/merge.js";
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
  DEFAULT_MAX_TOKENS,
} from "./constants.js";
import {
  compileChatMessages,
  countTokens,
  pruneRawPromptFromTop,
  stripImages,
} from "./countTokens.js";
import CompletionOptionsForModels from "./templates/options.js";

export abstract class BaseLLM implements ILLM {
  static providerName: ModelProvider;
  static defaultOptions: Partial<LLMOptions> | undefined = undefined;

  get providerName(): ModelProvider {
    return (this.constructor as typeof BaseLLM).providerName;
  }

  supportsImages(): boolean {
    return modelSupportsImages(this.providerName, this.model, this.title);
  }

  supportsCompletions(): boolean {
    if (this.providerName === "openai") {
      if (
        this.apiBase?.includes("api.groq.com") ||
        this.apiBase?.includes(":1337") ||
        this._llmOptions.useLegacyCompletionsEndpoint?.valueOf() === false
      ) {
        // Jan + Groq don't support completions : (
        return false;
      }
    }
    if (this.providerName === "groq") {
      return false;
    }
    return true;
  }

  supportsPrefill(): boolean {
    return ["ollama", "anthropic"].includes(this.providerName);
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
      options.template ?? autodetectTemplateType(options.model);

    this.title = options.title;
    this.uniqueId = options.uniqueId ?? "None";
    this.model = options.model;
    this.systemMessage = options.systemMessage;
    this.contextLength = options.contextLength ?? DEFAULT_CONTEXT_LENGTH;
    this.completionOptions = {
      ...options.completionOptions,
      model: options.model || "gpt-4",
      maxTokens: options.completionOptions?.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
    if (CompletionOptionsForModels[options.model as ModelName]) {
      this.completionOptions = mergeJson(
        this.completionOptions,
        CompletionOptionsForModels[options.model as ModelName] ?? {},
      );
    }
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
      );
    this.writeLog = options.writeLog;
    this.llmRequestHook = options.llmRequestHook;
    this.apiKey = options.apiKey;
    this.apiBase = options.apiBase;
    if (this.apiBase && !this.apiBase.endsWith("/")) {
      this.apiBase = this.apiBase + "/";
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

  private _logTokensGenerated(model: string, prompt: string, completion: string) {
    let promptTokens = this.countTokens(prompt);
    let generatedTokens = this.countTokens(completion);
    Telemetry.capture("tokens_generated", {
      model: model,
      provider: this.providerName,
      promptTokens: promptTokens,
      generatedTokens: generatedTokens,
    });
    DevDataSqliteDb.logTokensGenerated(model, this.providerName, promptTokens, generatedTokens);
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
          }
          throw new Error(
            `HTTP ${resp.status} ${resp.statusText} from ${resp.url}\n\n${text}`,
          );
        }

        return resp;
      } catch (e: any) {
        if (
          e.code === "ECONNREFUSED" &&
          e.message.includes("http://127.0.0.1:11434")
        ) {
          throw new Error(
            "Failed to connect to local Ollama instance. To start Ollama, first download it at https://ollama.ai.",
          );
        }
        throw new Error(`${e}`);
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
    delete options.log;

    const completionOptions: CompletionOptions = mergeJson(
      this.completionOptions,
      options,
    );

    return { completionOptions, log, raw };
  }

  private _formatChatMessages(messages: ChatMessage[]): string {
    const msgsCopy = messages ? messages.map((msg) => ({ ...msg })) : [];
    let formatted = "";
    for (let msg of msgsCopy) {
      if ("content" in msg && Array.isArray(msg.content)) {
        const content = stripImages(msg.content);
        msg.content = content;
      }
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
      completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
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

    this._logTokensGenerated(completionOptions.model, prompt, completion);

    if (log && this.writeLog) {
      await this.writeLog(`Completion:\n\n${completion}\n\n`);
    }

    return { prompt, completion, completionOptions };
  }

  async complete(prompt: string, options: LLMFullCompletionOptions = {}) {
    const { completionOptions, log, raw } =
      this._parseCompletionOptions(options);

    prompt = pruneRawPromptFromTop(
      completionOptions.model,
      this.contextLength,
      prompt,
      completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
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

    this._logTokensGenerated(completionOptions.model, prompt, completion);
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
  ): AsyncGenerator<ChatMessage, PromptLog> {
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

    this._logTokensGenerated(completionOptions.model, prompt, completion);
    if (log && this.writeLog) {
      await this.writeLog(`Completion:\n\n${completion}\n\n`);
    }

    return {
      prompt,
      completion,
      completionOptions,
    };
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

  public renderPromptTemplate(
    template: PromptTemplate,
    history: ChatMessage[],
    otherData: Record<string, string>,
    canPutWordsInModelsMouth: boolean = false,
  ): string | ChatMessage[] {
    if (typeof template === "string") {
      let data: any = {
        history: history,
        ...otherData,
      };
      if (history.length > 0 && history[0].role == "system") {
        data["system_message"] = history.shift()!.content;
      }

      const compiledTemplate = Handlebars.compile(template);
      return compiledTemplate(data);
    } else {
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
        return templateMessages(rendered);
      }
      return rendered;
    }
  }
}

