import { findLlmInfo } from "@continuedev/llm-info";
import Handlebars from "handlebars";
import {
  CacheBehavior,
  ChatMessage,
  ChatMessageRole,
  CompletionOptions,
  ILLM,
  LLMFullCompletionOptions,
  LLMOptions,
  ModelCapability,
  ModelName,
  ModelProvider,
  PromptLog,
  PromptTemplate,
  RequestOptions,
  TemplateType,
} from "../index.js";
import { logDevData } from "../util/devdata.js";
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
} from "./countTokens.js";
import { stripImages } from "./images.js";
import CompletionOptionsForModels from "./templates/options.js";

export abstract class BaseLLM implements ILLM {
  static providerName: ModelProvider;
  static defaultOptions: Partial<LLMOptions> | undefined = undefined;

  get providerName(): ModelProvider {
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
  times: number[];
  ttfts: number[];
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
  apiBase?: string;
  cacheBehavior?: CacheBehavior;
  capabilities?: ModelCapability;

  engine?: string;
  apiVersion?: string;
  apiType?: string;
  region?: string;
  projectId?: string;
  accountId?: string;
  aiGatewaySlug?: string;

  // For IBM watsonx only.
  watsonxUrl?: string;
  watsonxCreds?: string;
  watsonxProjectId?: string;
  watsonxStopToken?: string;
  watsonxApiVersion?: string;
  watsonxFullUrl?: string;

  private _llmOptions: LLMOptions;

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
    this.aiGatewaySlug = options.aiGatewaySlug;
    this.apiBase = options.apiBase;
    this.cacheBehavior = options.cacheBehavior;

    // for watsonx only
    this.watsonxUrl = options.watsonxUrl;
    this.watsonxCreds = options.watsonxCreds;
    this.watsonxProjectId = options.watsonxProjectId;
    this.watsonxStopToken = options.watsonxStopToken;
    this.watsonxApiVersion = options.watsonxApiVersion;
    this.watsonxFullUrl = options.watsonxFullUrl;

    if (this.apiBase && !this.apiBase.endsWith("/")) {
      this.apiBase = `${this.apiBase}/`;
    }
    this.accountId = options.accountId;
    this.capabilities = options.capabilities;

    this.engine = options.engine;
    this.apiVersion = options.apiVersion;
    this.apiType = options.apiType;
    this.region = options.region;
    this.projectId = options.projectId;
    // 新增 times 数组
    this.times = [];
    this.ttfts = [];
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
      "##### Completion options (modified!) #####\n" +
      completionOptionsLog +
      (requestOptionsLog
        ? "\n\n##### Request options #####\n" + requestOptionsLog
        : "") +
      "\n\n##### Prompt #####\n" +
      prompt
      +"\n\n"
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

    logDevData("tokens_generated", {
      model: model,
      provider: this.providerName,
      promptTokens: promptTokens,
      generatedTokens: generatedTokens,
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
          console.debug(
            `${e.message}\n\nCode: ${e.code}\nError number: ${e.errno}\nSyscall: ${e.erroredSysCall}\nType: ${e.type}\n\n${e.stack}`,
          );

          if (
            e.code === "ECONNREFUSED" &&
            e.message.includes("http://127.0.0.1:11434")
          ) {
            throw new Error(
              "Failed to connect to local Ollama instance. To start Ollama, first download it at https://ollama.ai.",
            );
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

    return { completionOptions, log, raw };
  }

  private _formatChatMessages(messages: ChatMessage[]): string {
    const msgsCopy = messages ? messages.map((msg) => ({ ...msg })) : [];
    let formatted = "";
    for (const msg of msgsCopy) {
      if ("content" in msg && Array.isArray(msg.content)) {
        const content = stripImages(msg.content);
        msg.content = content;
      }
      formatted += `<${msg.role}>\n${msg.content || ""}\n\n`;
    }
    return formatted;
  }

  protected async *_streamFim(
    prefix: string,
    suffix: string,
    options: CompletionOptions,
  ): AsyncGenerator<string, PromptLog> {
    throw new Error("Not implemented");
  }
  
  async *streamFim(
    prefix: string,
    suffix: string,
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<string> {
    const startTime = Date.now();
    const { completionOptions, log } = this._parseCompletionOptions(options);

    const madeUpFimPrompt = `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;
    if (log) {
      if (this.writeLog) {
        await this.writeLog(
          "---------------------streamFim--------------------------\n"+
          this._compileLogMessage(madeUpFimPrompt, completionOptions),
        );
      }
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, madeUpFimPrompt);
      }
    }

    let completion = "";
    for await (const chunk of this._streamFim(
      prefix,
      suffix,
      completionOptions,
    )) {
        let newChunk = chunk;
        // 新增后处理
        // 如果第一行为空行，不返回
        if (completion.length === 0 || completion[completion.length - 1] === "\n") {
          while (newChunk.startsWith("\n")) {
            newChunk = newChunk.slice(1);
          }
          if (newChunk.length === 0) {
              continue;
          }
        }
        completion += newChunk;
        yield newChunk;
      }
      

    this._logTokensGenerated(
      completionOptions.model,
      madeUpFimPrompt,
      completion,
    );
    const time = Date.now() - startTime;

    const prefixLines = prefix.split('\n').filter(line => line.trim() !== "");
    const lastNonEmptyLine = prefixLines[prefixLines.length - 1];

    if (log && this.writeLog) {
      await this.writeLog(
        "core/llm/index.ts\n"
        + "streamFim - time："+time/1000+"s\n"
        + "streamFim - completion: \n"+completion+"\n"
      );
    }
    return {
      prompt: madeUpFimPrompt,
      completion,
      completionOptions,
    };
  }

  async *streamComplete(
    _prompt: string,
    options: LLMFullCompletionOptions = {},
  ) {
    const startTime = Date.now();

    const { completionOptions, log, raw } =
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

    if (log) {
      if (this.writeLog) {
        await this.writeLog(
          "---------------------streamComplete--------------------------\n"+
          this._compileLogMessage(prompt, completionOptions)
        );
      }
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }



    let completion = "";
    let flag = false;

    const start_TTFT_Time = Date.now(); // 记录开始时间
    for await (const chunk of this._streamComplete(prompt, completionOptions)) {
      let newChunk = chunk;
      // 新增后处理
      // 如果第一行为空行，不返回
      if (completion.length === 0 || completion[completion.length - 1] === "\n") {
        while (newChunk.startsWith("\n")) {
          newChunk = newChunk.slice(1);
        }
        if (newChunk.length === 0) {
            continue;
        }
      }

      // 计算ttft时间
      if (!flag) {
        flag = true;
        const ttfts = Date.now() - start_TTFT_Time; // 计算ttft时间，单位为秒
        this.ttfts.push(ttfts);
      }
    
      completion += newChunk;
      yield newChunk;
    }
    this._logTokensGenerated(completionOptions.model, prompt, completion);
    const time = Date.now() - startTime;
    if (log && this.writeLog) {
      this.times.push(time);
      
      // 计算时间的统计数据
      const meanTime = this.times.reduce((acc, t) => acc + t, 0) / this.times.length;
      const sortedTimes = [...this.times].sort((a, b) => a - b);
      const mid = Math.floor(sortedTimes.length / 2);
      const medianTime = sortedTimes.length % 2 !== 0 ? sortedTimes[mid] : (sortedTimes[mid - 1] + sortedTimes[mid]) / 2;
      const p95Time = sortedTimes[Math.ceil(0.95 * sortedTimes.length) - 1];
      const p99Time = sortedTimes[Math.ceil(0.99 * sortedTimes.length) - 1];
      
      // 计算TTFT的统计数据
      const meanTTFT = this.ttfts.reduce((acc, t) => acc + t, 0) / this.ttfts.length;
      const sortedTTFT = [...this.ttfts].sort((a, b) => a - b);
      const midTTFT = Math.floor(sortedTTFT.length / 2);
      const medianTTFT = sortedTTFT.length % 2 !== 0 ? sortedTTFT[midTTFT] : (sortedTTFT[midTTFT - 1] + sortedTTFT[midTTFT]) / 2;
      const p95TTFT = sortedTTFT[Math.ceil(0.95 * sortedTTFT.length) - 1];
      const p99TTFT = sortedTTFT[Math.ceil(0.99 * sortedTTFT.length) - 1];
      await this.writeLog(
        "core/llm/index.ts\n" +
        "streamComplete - Completion: \n" + completion + "\n" +
        "----------------------Time------------------------\n" +
        "streamComplete - Time: " + (time / 1000) + "s\n" +
        "streamComplete - Data Count: " + this.times.length + "\n" + 
        "streamComplete - Mean Time: " + (meanTime / 1000) + "s\n" +
        "streamComplete - Median Time: " + (medianTime / 1000) + "s\n" +
        "streamComplete - P95 Time: " + (p95Time / 1000) + "s\n" + 
        "streamComplete - P99 Time: " + (p99Time / 1000) + "s\n" +
        "----------------------Time to First Token------------------------\n" +
        "streamComplete - TTFT: " + (this.ttfts[this.ttfts.length - 1] / 1000) + "s\n" +
        "streamComplete - TTFT Count: " + this.ttfts.length + "\n" +
        "streamComplete - Mean TTFT: " + (meanTTFT / 1000) + "s\n" +
        "streamComplete - Median TTFT: " + (medianTTFT / 1000) + "s\n" +
        "streamComplete - P95 TTFT: " + (p95TTFT / 1000) + "s\n" +
        "streamComplete - P99 TTFT: " + (p99TTFT / 1000) + "s\n"
      );
    }

    return {
      modelTitle: this.title ?? completionOptions.model,
      prompt,
      completion,
      completionOptions,
    };
  }

  async complete(_prompt: string, options: LLMFullCompletionOptions = {}) {
    const startTime = Date.now();
    const { completionOptions, log, raw } =
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

    if (log) {
      if (this.writeLog) {
        await this.writeLog(
        "---------------------complete--------------------------\n"+
        this._compileLogMessage(prompt, completionOptions));
      }
      if (this.llmRequestHook) {
        this.llmRequestHook(completionOptions.model, prompt);
      }
    }

    const completion = await this._complete(prompt, completionOptions);

    this._logTokensGenerated(completionOptions.model, prompt, completion);

    const time = Date.now() - startTime;
    if (log && this.writeLog) {
      await this.writeLog(
        "core/llm/index.ts\n"
        + "complete - time: "+time/1000+"s\n"
        + "complete - completion: \n"+completion+"\n"
      );
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
    _messages: ChatMessage[],
    options: LLMFullCompletionOptions = {},
  ): AsyncGenerator<ChatMessage, PromptLog> {
    const startTime = Date.now();
    const { completionOptions, log, raw } =
      this._parseCompletionOptions(options);

    const messages = this._compileChatMessages(completionOptions, _messages);

    const prompt = this.templateMessages
      ? this.templateMessages(messages)
      : this._formatChatMessages(messages);
    if (log) {
      if (this.writeLog) {
        await this.writeLog(
          "---------------------streamChat--------------------------\n"+
          this._compileLogMessage(prompt, completionOptions)
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

    const time = Date.now() - startTime;
    if (log && this.writeLog) {
      await this.writeLog(
        "core/llm/index.ts\n" +
        "streamChat - time: "+time/1000 + "s\n" +
        "streamChat - completion: \n"+completion + "\n"
      );
    }

    return {
      modelTitle: this.title ?? completionOptions.model,
      prompt,
      completion,
      completionOptions,
    };
  }

  // biome-ignore lint/correctness/useYield: Purposefully not implemented
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
      /** DEBUG: llm 配置格式问题
       * 读取到的 qwen模型 model 信息不在 this.model，而在 this.completionOptions.model
       * */ 
      let this_model = this.model;
      if (this.model === undefined){
        this_model = this.completionOptions.model;
      }
      const templateMessages = autodetectTemplateFunction(
        this_model,
        this.providerName,
        autodetectTemplateType(this_model),
      );
      return templateMessages(rendered);
    }
    return rendered;
  }
}
