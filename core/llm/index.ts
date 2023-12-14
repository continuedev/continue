import {
  ChatMessage,
  CompletionOptions,
  ILLM,
  LLMFullCompletionOptions,
  LLMOptions,
  ModelProvider,
  RequestOptions,
  TemplateType,
} from "..";
import { CONTEXT_LENGTH_FOR_MODEL, DEFAULT_ARGS } from "./constants";
import {
  compileChatMessages,
  countTokens,
  pruneRawPromptFromTop,
} from "./countTokens";
import {
  anthropicTemplateMessages,
  chatmlTemplateMessages,
  deepseekTemplateMessages,
  llama2TemplateMessages,
  phindTemplateMessages,
  templateAlpacaMessages,
  zephyrTemplateMessages,
} from "./templates/chat";
import {
  alpacaEditPrompt,
  codellamaEditPrompt,
  deepseekEditPrompt,
  phindEditPrompt,
  simplestEditPrompt,
  zephyrEditPrompt,
} from "./templates/edit";

function autodetectTemplateType(model: string): TemplateType | undefined {
  const lower = model.toLowerCase();

  if (
    lower.includes("gpt") ||
    lower.includes("chat-bison") ||
    lower.includes("pplx") ||
    lower.includes("gemini")
  ) {
    return undefined;
  }

  if (lower.includes("phind")) {
    return "phind";
  }

  if (lower.includes("llama")) {
    return "llama2";
  }

  if (lower.includes("zephyr")) {
    return "zephyr";
  }

  if (lower.includes("claude")) {
    return "anthropic";
  }

  if (lower.includes("alpaca") || lower.includes("wizard")) {
    return "alpaca";
  }

  if (lower.includes("mistral")) {
    return "llama2";
  }

  if (lower.includes("deepseek")) {
    return "deepseek";
  }

  return "chatml";
}

function autodetectTemplateFunction(
  model: string,
  explicitTemplate: TemplateType | undefined = undefined
) {
  const templateType = explicitTemplate || autodetectTemplateType(model);

  if (templateType) {
    const mapping: Record<TemplateType, any> = {
      llama2: llama2TemplateMessages,
      alpaca: templateAlpacaMessages,
      phind: phindTemplateMessages,
      zephyr: zephyrTemplateMessages,
      anthropic: anthropicTemplateMessages,
      chatml: chatmlTemplateMessages,
      deepseek: deepseekTemplateMessages,
    };

    return mapping[templateType];
  }

  return null;
}

function autodetectPromptTemplates(
  model: string,
  explicitTemplate: TemplateType | undefined = undefined
) {
  const templateType = explicitTemplate || autodetectTemplateType(model);
  const templates: Record<string, any> = {};

  let editTemplate = null;

  if (templateType === "phind") {
    editTemplate = phindEditPrompt;
  } else if (templateType === "zephyr") {
    editTemplate = zephyrEditPrompt;
  } else if (templateType === "llama2") {
    editTemplate = codellamaEditPrompt;
  } else if (templateType === "alpaca") {
    editTemplate = alpacaEditPrompt;
  } else if (templateType === "deepseek") {
    editTemplate = deepseekEditPrompt;
  } else if (templateType) {
    editTemplate = simplestEditPrompt;
  }

  if (editTemplate !== null) {
    templates["edit"] = editTemplate;
  }

  return templates;
}

export abstract class BaseLLM implements ILLM {
  static providerName: ModelProvider;
  static defaultOptions: Partial<LLMOptions> | undefined = undefined;

  get providerName(): ModelProvider {
    return (this.constructor as typeof BaseLLM).providerName;
  }

  uniqueId: string;
  model: string;

  title?: string;
  systemMessage?: string;
  contextLength: number;
  completionOptions: CompletionOptions;
  requestOptions?: RequestOptions;
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

  constructor(options: LLMOptions) {
    // Set default options
    options = {
      title: (this.constructor as typeof BaseLLM).providerName,
      ...(this.constructor as typeof BaseLLM).defaultOptions,
      ...options,
    };

    const templateType = autodetectTemplateType(options.model);

    this.title = options.title;
    this.uniqueId = options.uniqueId || "None";
    this.model = options.model;
    this.systemMessage = options.systemMessage;
    this.contextLength = options.contextLength || 4096;
    this.completionOptions = {
      ...options.completionOptions,
      model: options.model || "gpt-4",
      maxTokens: options.completionOptions?.maxTokens || 1024,
    };
    this.requestOptions = options.requestOptions;
    this.promptTemplates = {
      ...options.promptTemplates,
      ...autodetectPromptTemplates(options.model, templateType),
    };
    this.templateMessages =
      options.templateMessages ||
      autodetectTemplateFunction(options.model, templateType);
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

  private _compileChatMessages(
    options: CompletionOptions,
    messages: ChatMessage[],
    functions?: any[]
  ) {
    let contextLength = this.contextLength;
    if (
      options.model !== this.model &&
      options.model in CONTEXT_LENGTH_FOR_MODEL
    ) {
      contextLength = CONTEXT_LENGTH_FOR_MODEL[options.model] || 4096;
    }

    return compileChatMessages(
      options.model,
      messages,
      contextLength,
      options.maxTokens,
      undefined,
      functions,
      this.systemMessage
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
    completionOptions: CompletionOptions
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
    // TODO
    // posthogLogger.captureEvent("tokens_generated", {
    //   model: model,
    //   tokens: tokens,
    //   model_class: this.constructor.name,
    // });
  }

  protected fetch(url: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    for (const [key, value] of Object.entries(
      this.requestOptions?.headers || {}
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

    const completionOptions: CompletionOptions = {
      ...this.completionOptions,
      ...options,
    };

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
    options: LLMFullCompletionOptions = {}
  ) {
    const { completionOptions, log, raw } =
      this._parseCompletionOptions(options);

    prompt = pruneRawPromptFromTop(
      completionOptions.model,
      this.contextLength,
      prompt,
      completionOptions.maxTokens
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
  }

  async complete(prompt: string, options: LLMFullCompletionOptions = {}) {
    const { completionOptions, log, raw } =
      this._parseCompletionOptions(options);

    prompt = pruneRawPromptFromTop(
      completionOptions.model,
      this.contextLength,
      prompt,
      completionOptions.maxTokens
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
    return completion;
  }

  async *streamChat(
    messages: ChatMessage[],
    options: LLMFullCompletionOptions = {}
  ): AsyncGenerator<ChatMessage> {
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
          completionOptions
        )) {
          completion += chunk;
          yield { role: "assistant", content: chunk };
        }
      } else {
        for await (const chunk of this._streamChat(
          messages,
          completionOptions
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
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    throw new Error("Not implemented");
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    if (!this.templateMessages) {
      throw new Error(
        "You must either implement templateMessages or _streamChat"
      );
    }

    for await (const chunk of this._streamComplete(
      this.templateMessages(messages),
      options
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
}
