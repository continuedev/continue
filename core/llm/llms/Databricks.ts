/*
 * Databricks.ts — Continue LLM adapter for Databricks Model Serving
 * Copyright (c) 2025
 *
 * Required configuration:
 *   - API Token: Personal Access Token (PAT)
 *   - Base URL: Workspace URL (e.g., https://adb-xxxx.azuredatabricks.net)
 *
 * This class extends the OpenAI base class to access Databricks Serving Endpoints
 * via Streaming Chat Completions (SSE).
 */
import OpenAI from "./OpenAI";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
} from "../../index";
import { fromChatCompletionChunk } from "../openaiTypeConverters";
import { renderChatMessage, stripImages } from "../../util/messageContent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "js-yaml";

// デバッグログレベルの定義
enum LogLevel {
  NONE = 0,
  BASIC = 1,
  DETAILED = 2,
  VERBOSE = 3
}

// デバッグ設定の型定義
interface DebugSettings {
  enabled: boolean;
  logPath: string;
  logLevel: string;
  logLevelValue: LogLevel;
}

export default class Databricks extends OpenAI {
  static providerName = "databricks";
  private modelConfig: any = null;
  private globalConfig: any = null;
  
  // デバッグ設定
  private debugSettings: DebugSettings = {
    enabled: false,
    logPath: "",
    logLevel: "basic",
    logLevelValue: LogLevel.BASIC
  };
  
  // ログレベルの文字列からの変換マップ
  private logLevelMap: Record<string, LogLevel> = {
    "none": LogLevel.NONE,
    "basic": LogLevel.BASIC,
    "detailed": LogLevel.DETAILED,
    "verbose": LogLevel.VERBOSE
  };

  /**
   * Load Databricks model configuration from .continue/config.yaml.
   * Reads all available configuration options for the specified model.
   * @param modelName The model identifier to match in the config.
   * @returns Complete model configuration object including all options.
   */
  private static loadConfigFromYaml(modelName: string): any {
    console.log("Attempting to load config from YAML for model:", modelName);
    
    // Determine path to ~/.continue/config.yaml
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, ".continue", "config.yaml");
    console.log("Looking for config file at:", configPath);
    
    try {
      if (fs.existsSync(configPath)) {
        console.log("Config file exists, reading content");
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        
        // Keep a reference to the complete config for global settings
        const globalConfig = parsed;
        
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          console.log(`Found ${parsed.models.length} models in config`);
          
          // Find the model configuration for Databricks with matching model name
          const modelConfig = (parsed.models as any[]).find(
            (m) =>
              m.provider === "databricks" &&
              m.model === modelName
          );
          
          if (modelConfig) {
            console.log("Found matching model config:", {
              name: modelConfig.name,
              provider: modelConfig.provider,
              model: modelConfig.model,
              hasApiKey: !!modelConfig.apiKey,
              hasApiBase: !!modelConfig.apiBase,
              hasDefaultCompletionOptions: !!modelConfig.defaultCompletionOptions
            });
            
            if (modelConfig && typeof modelConfig.apiKey === "string" && typeof modelConfig.apiBase === "string") {
              // Return the complete model configuration with global config
              return { modelConfig, globalConfig };
            }
          } else {
            console.log(`No model with name '${modelName}' and provider 'databricks' found in config`);
          }
        }
      } else {
        console.log("Config file not found at path:", configPath);
      }
    } catch (error) {
      console.error("Error reading Databricks config.yaml:", error);
    }
    
    // If config.yaml did not yield results, fall back to environment variables
    console.log("Trying environment variables as fallback");
    const pat = process.env.DATABRICKS_TOKEN;
    const base = process.env.YOUR_DATABRICKS_URL;
    if (pat && base) {
      console.log("Found environment variables, using them instead");
      return {
        modelConfig: {
          apiKey: pat,
          apiBase: base,
        },
        globalConfig: null
      };
    }
    
    console.log("No configuration found in YAML or environment variables");
    // If neither config.yaml nor environment variables worked, throw error
    throw new Error(
      "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
    );
  }

  constructor(opts: LLMOptions) {
    console.log("Databricks constructor called with model:", opts.model);
    
    // Ensure a model name is provided
    const modelName = opts.model;
    if (!modelName) {
      const error = new Error("No model specified for Databricks. Please include a model name in the options.");
      throw error;
    }
    
    // Load complete configuration for this model from YAML
    console.log("Loading config for model:", modelName);
    const { modelConfig, globalConfig } = Databricks.loadConfigFromYaml(modelName);
    console.log("Loaded config:", { 
      apiKeyExists: !!modelConfig.apiKey, 
      endpoint: modelConfig.apiBase,
      defaultCompletionOptionsExist: !!modelConfig.defaultCompletionOptions
    });
    
    // Validate that apiKey and endpoint are present
    if (!modelConfig.apiKey || !modelConfig.apiBase) {
      const error = new Error(
        "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
      );
      throw error;
    }
    
    // Merge loaded credentials into options (allow overrides via opts)
    opts = {
      ...opts,
      apiKey: opts.apiKey ?? modelConfig.apiKey,
      apiBase: opts.apiBase ?? modelConfig.apiBase,
    };
    
    // Remove any trailing slashes from the apiBase URL
    opts.apiBase = (opts.apiBase ?? "").replace(/\/+$/, "");
    console.log("Final apiBase after processing:", opts.apiBase);
    
    // Call the base class constructor with updated options
    // Important: super() must be called before accessing 'this'
    super(opts);
    
    // Store model config for later use in parameter conversion
    // This must be done after the super() call
    this.modelConfig = modelConfig;
    this.globalConfig = globalConfig;
    
    // デバッグ設定の初期化
    this.initializeDebugSettings();
    
    this.writeDebugLog("Databricks constructor completed", undefined, "basic");
  }
  
  /**
   * デバッグログの設定を初期化します
   * config.yamlからデバッグ設定を読み込みます
   */
  private initializeDebugSettings(): void {
    // configファイルからデバッグ設定を読み込む
    const debugEnabled = this.modelConfig?.defaultCompletionOptions?.debug?.enabled ?? false;
    const logPath = this.modelConfig?.defaultCompletionOptions?.debug?.logPath ?? "Desktop/databricks-debug.log";
    const logLevel = this.modelConfig?.defaultCompletionOptions?.debug?.logLevel ?? "basic";
    
    // デバッグ設定をログに出力するための一時的なフラグ
    const tempDebugEnabled = debugEnabled;
    
    if (!tempDebugEnabled) {
      console.log("デバッグログが無効化されています");
      this.debugSettings = {
        enabled: false,
        logPath: "",
        logLevel: "none",
        logLevelValue: LogLevel.NONE
      };
      return;
    }
    
    try {
      // ユーザーのホームディレクトリを取得
      const homeDir = os.homedir();
      // 相対パスを絶対パスに変換
      const absoluteLogPath = path.isAbsolute(logPath) ? logPath : path.join(homeDir, logPath);
      // ログファイルのディレクトリを確保
      const logDir = path.dirname(absoluteLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // ログレベルの文字列を数値に変換
      const logLevelValue = this.logLevelMap[logLevel.toLowerCase()] ?? LogLevel.BASIC;
      
      // デバッグ設定をクラスプロパティに保存
      this.debugSettings = {
        enabled: true,
        logPath: absoluteLogPath,
        logLevel: logLevel.toLowerCase(),
        logLevelValue: logLevelValue
      };
      
      // ログファイルの初期化
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      fs.writeFileSync(
        absoluteLogPath, 
        `=== デバッグログ開始: ${timestamp} ===\nログレベル: ${logLevel}\n\n`, 
        { encoding: "utf8" }
      );
      console.log(`デバッグログを開始: ${absoluteLogPath} (レベル: ${logLevel})`);
      
      // デバッグ設定自体を記録
      this.writeRawDebugLog("デバッグ設定", this.debugSettings);
      
    } catch (error) {
      console.error("ログファイル初期化エラー:", error);
      this.debugSettings = { 
        enabled: false, 
        logPath: "", 
        logLevel: "none",
        logLevelValue: LogLevel.NONE
      };
    }
  }

  /**
   * 指定されたメッセージとオブジェクトをログファイルに書き込みます
   * @param message ログメッセージ
   * @param obj 追加のデータオブジェクト（オプション）
   * @param level ログレベル（"basic", "detailed", "verbose"のいずれか）
   */
  private writeDebugLog(message: string, obj?: any, level: string = "basic"): void {
    // デバッグが無効の場合は処理しない
    if (!this.debugSettings.enabled) return;
    
    // 指定されたレベルが現在のログレベルより詳細な場合は処理しない
    const requestedLevel = this.logLevelMap[level] ?? LogLevel.BASIC;
    if (requestedLevel > this.debugSettings.logLevelValue) return;
    
    this.writeRawDebugLog(message, obj);
  }
  
  /**
   * ログレベルのチェックなしでログを書き込む内部メソッド
   */
  private writeRawDebugLog(message: string, obj?: any): void {
    if (!this.debugSettings.enabled || !this.debugSettings.logPath) return;
    
    try {
      const timestamp = new Date().toISOString();
      let logMessage = `[${timestamp}] ${message}`;
      
      if (obj !== undefined) {
        let objString;
        try {
          // オブジェクトを文字列に変換（循環参照などを考慮）
          if (typeof obj === 'string') {
            objString = obj;
          } else {
            // 大きすぎるオブジェクトは一部だけ表示
            const stringified = JSON.stringify(obj, (key, value) => {
              if (typeof value === 'string' && value.length > 2000) {
                return value.substring(0, 2000) + '... [切り詰め]';
              }
              return value;
            }, 2);
            objString = stringified;
          }
          logMessage += `\n${objString}`;
        } catch (err) {
          logMessage += `\n[オブジェクト変換エラー: ${(err as Error).message}]`;
        }
      }
      
      // ファイルに追記
      fs.appendFileSync(this.debugSettings.logPath, logMessage + "\n\n", { encoding: "utf8" });
    } catch (err) {
      // ログ書き込み自体のエラーは標準コンソールに出力
      console.error("ログファイル書き込みエラー:", err);
    }
  }

  /**
   * config.yamlからタイムアウト設定を取得します
   * @returns タイムアウト値（ミリ秒）
   */
  private getTimeoutFromConfig(): number {
    const timeout = this.modelConfig?.defaultCompletionOptions?.timeout;
    if (typeof timeout === 'number' && timeout > 0) {
      this.writeDebugLog("タイムアウト設定を設定ファイルから読み込みました", { timeout }, "basic");
      return timeout;
    }
    
    // デフォルト値は5分
    this.writeDebugLog("デフォルトのタイムアウト設定を使用します", { timeout: 300000 }, "basic");
    return 300000;
  }

  /**
   * Generate the full URL for invoking the serving endpoint.
   * For config compatibility, returns the apiBase directly since it already contains
   * the full path including /serving-endpoints/{model}/invocations
   * @returns The invocation URL as a string.
   */
  private getInvocationUrl(): string {
    const url = (this.apiBase ?? "").replace(/\/+$/, "");
    console.log("Databricks adapter using URL:", url);
    this.writeDebugLog("Databricks adapter using URL:", url, "basic");
    return url;
  }

  /**
   * Override the header generation to add Accept header for streaming
   * @returns Headers object with auth and content type headers
   */
  protected _getHeaders(): { "Content-Type": string; Authorization: string; "api-key": string; } {
    const headers = super._getHeaders();
    
    // ヘッダーを型安全にカスタマイズするため、any型にキャスト
    const customHeaders = headers as any;
    
    // ストリーミングのためのヘッダーを追加
    customHeaders["Accept"] = "text/event-stream";
    
    // Content-Typeが未設定の場合は追加（元のヘッダーオブジェクトには含まれているはず）
    if (!customHeaders["Content-Type"]) {
      customHeaders["Content-Type"] = "application/json";
    }
    
    console.log("送信ヘッダー:", customHeaders);
    this.writeDebugLog("送信ヘッダー:", customHeaders, "detailed");
    console.log("arg1 =", customHeaders);
    return headers;
  }

  /**
   * Get the streaming setting from global config or model config
   * @returns Boolean indicating whether streaming should be enabled
   */
  private getEnableStreamingFromConfig(): boolean {
    // まずモデル固有の設定を確認
    if (this.modelConfig?.defaultCompletionOptions?.stream !== undefined) {
      console.log("Model-specific stream setting found:", this.modelConfig.defaultCompletionOptions.stream);
      this.writeDebugLog("Model-specific stream setting found:", this.modelConfig.defaultCompletionOptions.stream, "basic");
      return this.modelConfig.defaultCompletionOptions.stream;
    }
    
    // グローバル設定を確認（存在する場合）
    if (this.globalConfig?.stream !== undefined) {
      console.log("Global stream setting found:", this.globalConfig.stream);
      this.writeDebugLog("Global stream setting found:", this.globalConfig.stream, "basic");
      return this.globalConfig.stream;
    }
    
    // 両方とも存在しない場合はデフォルトでtrueを返す
    console.log("No stream setting found in config, using default: true");
    this.writeDebugLog("No stream setting found in config, using default: true", undefined, "basic");
    return true;
  }

  /**
   * Convert CompletionOptions to Databricks API parameters.
   * @param options CompletionOptions to convert
   * @returns Converted parameters for Databricks API
   */
  private convertArgs(options: CompletionOptions): any {
    console.log("Converting args with options:", {
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
      maxTokens: options.maxTokens,
      reasoning: options.reasoning,
      reasoningBudgetTokens: options.reasoningBudgetTokens,
      stop: options.stream
    });
    this.writeDebugLog("Converting args with options:", {
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
      maxTokens: options.maxTokens,
      reasoning: options.reasoning,
      reasoningBudgetTokens: options.reasoningBudgetTokens,
      stop: options.stream
    }, "basic");
    
    // 設定ファイルからストリーミングモードの設定を取得
    const enableStreaming = this.getEnableStreamingFromConfig();
    console.log("ストリーミングモード:", enableStreaming ? "有効" : "無効", "(設定ファイルから読み込み)");
    this.writeDebugLog("ストリーミングモード:", { 
      enabled: enableStreaming, 
      source: "設定ファイルから読み込み" 
    }, "basic");
    
    // Determine thinking budget and if thinking is enabled
    const thinkingBudget = options.reasoningBudgetTokens || 
                          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
                          4000;
    
    const isThinkingEnabled = options.reasoning || 
                              (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    // 思考モードの設定をログに記録
    if (isThinkingEnabled) {
      this.writeDebugLog("思考モード有効", { 
        budget: thinkingBudget,
        source: options.reasoning ? "options.reasoning" : "config.thinking.type"
      }, "basic");
    }
    
    // Ensure max_tokens is greater than thinking budget
    const maxTokens = Math.max(
      options.maxTokens ?? this.modelConfig?.defaultCompletionOptions?.maxTokens ?? 4096,
      thinkingBudget + 1000 // Add buffer to ensure it's greater than thinking budget
    );
    
    // Build parameters object with conditional parameters based on thinking mode
    const finalOptions: any = {
      model: options.model || this.modelConfig?.model,
      temperature: options.temperature ?? this.modelConfig?.defaultCompletionOptions?.temperature ?? 0.7,
      max_tokens: maxTokens,
      stop: options.stop?.filter(x => x.trim() !== "") ?? this.modelConfig?.defaultCompletionOptions?.stop ?? [],
      stream: enableStreaming && (options.stream ?? true)
    };
    
    // Only add top_k and top_p if thinking is not enabled
    if (!isThinkingEnabled) {
      finalOptions.top_k = options.topK ?? this.modelConfig?.defaultCompletionOptions?.topK ?? 100;
      finalOptions.top_p = options.topP ?? this.modelConfig?.defaultCompletionOptions?.topP ?? 0.95;
    } else {
      console.log("Omitting top_k and top_p parameters because thinking is enabled");
      this.writeDebugLog("Omitting top_k and top_p parameters because thinking is enabled", undefined, "basic");
    }
    
    // 思考モードの設定がある場合、Databricksの思考パラメータを追加
    if (isThinkingEnabled) {
      // Databricksの思考パラメータを追加
      finalOptions.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget
      };
      console.log("Added thinking parameter with budget:", thinkingBudget);
      this.writeDebugLog("Added thinking parameter with budget:", thinkingBudget, "basic");
      console.log("Ensured max_tokens is greater than thinking budget:", maxTokens);
      this.writeDebugLog("Ensured max_tokens is greater than thinking budget:", maxTokens, "basic");
    }
    
    // Log the final parameters being sent
    console.log("Final API parameters:", JSON.stringify(finalOptions, null, 2));
    this.writeDebugLog("Final API parameters:", finalOptions, "basic");
    
    return finalOptions;
  }

  /**
   * Convert messages to Databricks API format.
   * This method only processes the actual message content and returns an array
   * as expected by the OpenAI base class.
   * System messages are handled separately by extractSystemMessage().
   * 
   * @param msgs Array of ChatMessage objects
   * @returns Array of messages formatted for Databricks API
   */
  private convertMessages(msgs: ChatMessage[]): any[] {
    console.log(`Converting ${msgs.length} messages to Databricks format`);
    this.writeDebugLog(`Converting ${msgs.length} messages to Databricks format`, undefined, "basic");
    
    // Filter out system messages as they're handled separately
    const filteredMessages = msgs.filter(
      (m) => m.role !== "system" && !!m.content
    );
    
    // Convert remaining messages to Databricks format
    const messages = filteredMessages.map((message) => {
      if (typeof message.content === "string") {
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      } else {
        // Handle messages with complex content (like images)
        console.log("Converting complex message content");
        this.writeDebugLog("Converting complex message content", undefined, "detailed");
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      }
    });
    
    console.log(`Converted to ${messages.length} messages`);
    this.writeDebugLog(`Converted to ${messages.length} messages`, undefined, "basic");
    return messages;
  }

  /**
   * Extract system message from the messages array.
   * @param msgs Array of ChatMessage objects
   * @returns Extracted system message or undefined if not present
   */
  private extractSystemMessage(msgs: ChatMessage[]): string | undefined {
    const systemMessage = stripImages(
      msgs.filter((m) => m.role === "system")[0]?.content ?? ""
    );
    
    if (systemMessage) {
      console.log("Found system message, length:", systemMessage.length);
      this.writeDebugLog("Found system message", { length: systemMessage.length }, "basic");
      return systemMessage;
    }
    
    return undefined;
  }

  /**
   * Create a system message that enables thinking mode if requested.
   * Based on the Anthropic implementation approach.
   * @param options CompletionOptions
   * @param originalSystemMessage Original system message if any
   * @returns Enhanced system message with thinking instructions
   */
  private createEnhancedSystemMessage(
    options: CompletionOptions, 
    originalSystemMessage?: string
  ): string {
    // Start with the original system message
    let systemMessage = originalSystemMessage || "";
    
    // Determine if thinking mode should be enabled
    const enableThinking = options.reasoning || 
      (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    // Add thinking instructions if enabled
    if (enableThinking) {
      const budgetTokens = options.reasoningBudgetTokens || 
        this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
        4000;
      
      const thinkingInstructions = `\n\nI'd like you to solve this problem step-by-step, showing your reasoning process clearly. Take your time to think through this thoroughly before giving your final answer. Use up to ${budgetTokens} tokens to explore different approaches and ensure your solution is correct.`;
      
      systemMessage += thinkingInstructions;
      console.log("Enabled thinking mode with budget:", budgetTokens);
      this.writeDebugLog("Enabled thinking mode with budget:", budgetTokens, "basic");
    }
    
    this.writeDebugLog("Enhanced system message", { 
      length: systemMessage.length, 
      preview: systemMessage.substring(0, 100) + "..." 
    }, "detailed");
    
    return systemMessage;
  }

  /**
   * Read Databricks streaming chat completion (SSE) and yield ChatMessages.
   * Converts the SSE data into OpenAI-style chat deltas.
   * @param msgs Initial chat history messages to send.
   * @param signal AbortSignal to cancel the request.
   * @param options Completion options like temperature, max_tokens, etc.
   */
  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    console.log("_streamChat called with messages length:", msgs.length);
    this.writeDebugLog("_streamChat called", { 
      messagesCount: msgs.length,
      options: JSON.stringify({
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        reasoning: options.reasoning,
        reasoningBudgetTokens: options.reasoningBudgetTokens,
        stream: options.stream
      })
    }, "basic");
    
    // Convert messages and extract system message
    const convertedMessages = this.convertMessages(msgs);
    const originalSystemMessage = this.extractSystemMessage(msgs);
    this.writeDebugLog("Converted messages", { 
      convertedCount: convertedMessages.length,
      hasSystemMessage: !!originalSystemMessage
    }, "basic");
    
    // Create enhanced system message with thinking instructions if needed
    const enhancedSystemMessage = this.createEnhancedSystemMessage(options, originalSystemMessage);
    
    // Build request body
    const body = {
      ...this.convertArgs(options),
      messages: convertedMessages,
      system: enhancedSystemMessage
    };
    
    // 設定ファイルからストリーミング設定を取得し、明示的に無効化されていない限り有効にする
    const enableStreaming = this.getEnableStreamingFromConfig();
    body.stream = enableStreaming && (body.stream !== false);
    this.writeDebugLog("ストリーミング設定", { enabled: body.stream }, "basic");
    
    // Log the final request body (sanitized for security)
    const sanitizedBody = { ...body };
    if (body.messages) {
      sanitizedBody.messages = `[${convertedMessages.length} messages]`;
    }
    console.log("Sending request with body:", JSON.stringify(sanitizedBody, null, 2));
    this.writeDebugLog("Sending request", { 
      url: this.getInvocationUrl(),
      body: sanitizedBody,
      streamEnabled: body.stream
    }, "basic");
    
    // Send POST request to the invocation URL
    const invocationUrl = this.getInvocationUrl();
    console.log("Sending request to:", invocationUrl);
    
    try {
      // タイムアウト設定を設定ファイルから読み込む
      const timeout = this.getTimeoutFromConfig();
      
      // fetchオプションを設定
      const fetchOptions = {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
        timeout: timeout // 設定ファイルからのタイムアウト
      };
      
      // ログにタイムアウト設定を出力
      console.log("タイムアウト設定:", `${timeout}ms`);
      this.writeDebugLog("タイムアウト設定", { timeoutMs: timeout }, "basic");
      
      const res = await this.fetch(invocationUrl, fetchOptions);
      
      console.log("Response status:", res.status);
      console.log("レスポンスヘッダー:", Object.fromEntries([...res.headers.entries()]));
      console.log("コンテンツタイプ:", res.headers.get("content-type"));
      
      // レスポンス受信のログ
      this.writeDebugLog("Response received", { 
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type"),
        headers: Object.fromEntries([...res.headers.entries()])
      }, "basic");
      
      // Check for HTTP errors or missing body
      if (!res.ok || !res.body) {
        const errorMsg = `HTTP ${res.status}`;
        console.error("HTTP error response:", res.status, res.statusText);
        this.writeDebugLog("HTTP error response", { 
          status: res.status, 
          statusText: res.statusText,
          error: errorMsg
        }, "basic");
        throw new Error(errorMsg);
      }

      // ストリーミングが無効の場合、1回のレスポンスを返す
      if (body.stream === false) {
        console.log("Non-streaming mode, processing single response");
        this.writeDebugLog("Non-streaming mode, processing single response", undefined, "basic");
        const jsonResponse = await res.json();
        console.log("Received complete response:", JSON.stringify(jsonResponse, null, 2));
        this.writeDebugLog("Received complete response", jsonResponse, "detailed");
        
        try {
          // さまざまな形式を処理
          if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
            // OpenAI形式
            this.writeDebugLog("OpenAI形式のレスポンスを検出", { 
              content: jsonResponse.choices[0].message.content.substring(0, 100) + "..." 
            }, "basic");
            yield {
              role: "assistant",
              content: jsonResponse.choices[0].message.content
            };
          } else if (jsonResponse.content) {
            // 直接コンテンツ形式
            const contentValue = jsonResponse.content;
            this.writeDebugLog("直接コンテンツ形式のレスポンスを検出", { 
              contentType: typeof contentValue,
              isArray: Array.isArray(contentValue)
            }, "basic");
            if (typeof contentValue === "string") {
              yield {
                role: "assistant",
                content: contentValue
              };
            } else if (Array.isArray(contentValue)) {
              // 配列形式のコンテンツ（Anthropic形式など）
              const textContent = contentValue.find(item => item.type === "text")?.text || 
                                 (contentValue[0] && contentValue[0].text) || 
                                 JSON.stringify(contentValue);
              yield {
                role: "assistant",
                content: textContent
              };
            } else {
              // オブジェクト形式（未知の形式）
              yield {
                role: "assistant",
                content: "複雑なレスポンス形式: " + JSON.stringify(contentValue)
              };
            }
          } else if (jsonResponse.completion) {
            // Anthropic互換形式
            this.writeDebugLog("Anthropic互換形式のレスポンスを検出", {
              completion: jsonResponse.completion.substring(0, 100) + "..."
            }, "basic");
            yield {
              role: "assistant",
              content: jsonResponse.completion
            };
          } else if (jsonResponse.message?.content) {
            // 別の形式のOpenAI互換
            this.writeDebugLog("別の形式のOpenAI互換レスポンスを検出", {
              content: jsonResponse.message.content.substring(0, 100) + "..."
            }, "basic");
            yield {
              role: "assistant",
              content: jsonResponse.message.content
            };
          } else {
            console.log("未知のレスポンス形式:", jsonResponse);
            this.writeDebugLog("未知のレスポンス形式", jsonResponse, "basic");
            yield {
              role: "assistant",
              content: "Response format not recognized: " + JSON.stringify(jsonResponse)
            };
          }
        } catch (e) {
          console.error("レスポンス処理エラー:", e);
          this.writeDebugLog("レスポンス処理エラー", { 
            error: (e as Error).message, 
            stack: (e as Error).stack,
            response: jsonResponse
          }, "basic");
          throw e;
        }
        return;
      }
      
      const decoder = new TextDecoder();
      let buffer = "";
      let rawBuffer = ""; // すべてのレスポンスデータを記録
      let thinkingContent = ""; // 思考出力を蓄積するための変数
      
      /**
       * 受信したバッファをSSEラインに解析してメッセージを抽出します。
       * @param str SSEデータの文字列チャンク。
       * @returns 'done'フラグとChatMessagesの配列を含むオブジェクト。
       */
      const parseSSE = (
        str: string,
      ): { done: boolean; messages: ChatMessage[] } => {
        buffer += str;
        const out: ChatMessage[] = [];
        
        // バッファ全体がJSON形式かどうかを確認
        if (buffer.trim() && !buffer.includes("\n")) {
          try {
            const trimmedBuffer = buffer.trim();
            // データプレフィックスを削除
            const jsonStr = trimmedBuffer.startsWith("data:") ? 
                         trimmedBuffer.slice(trimmedBuffer.indexOf("{")) : 
                         trimmedBuffer;
            
            console.log("単一JSONの解析を試行:", jsonStr);
            this.writeDebugLog("単一JSONの解析を試行", jsonStr, "verbose");
            const json = JSON.parse(jsonStr);
            console.log("単一JSONを解析:", json);
            this.writeDebugLog("単一JSONを解析", json, "detailed");
            
            // 終了シグナルの検出を強化
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
              this.writeDebugLog("終了シグナル検出（単一JSON）", json, "basic");
              buffer = "";
              return { done: true, messages: out };
            }
            
            // 異なる形式のレスポンスを処理
            if (json.choices && json.choices[0]?.message?.content) {
              // OpenAI形式の完全なレスポンス
              console.log("OpenAI形式の完全なレスポンスを検出");
              this.writeDebugLog("OpenAI形式の完全なレスポンスを検出", { 
                content: json.choices[0].message.content.substring(0, 100) + "..." 
              }, "basic");
              out.push({
                role: "assistant",
                content: json.choices[0].message.content
              });
              buffer = "";
              return { done: true, messages: out };
            }
          } catch (e) {
            console.log("単一JSON解析エラー、行解析に切り替え:", e);
            this.writeDebugLog("単一JSON解析エラー、行解析に切り替え", { 
              error: (e as Error).message, 
              buffer: buffer.substring(0, 200) + "..."
            }, "basic");
          }
        }
        
        let idx: number;
        // Process each line in the buffer
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          
          console.log("処理中の行:", line);
          this.writeDebugLog("処理中の行", line, "verbose");
          
          // 空行をスキップ
          if (!line) continue;
          
          // "data:"プレフィックスを確認
          if (!line.startsWith("data:") && !line.startsWith("data: ")) {
            console.log("data:プレフィックスのない行をスキップ:", line);
            this.writeDebugLog("data:プレフィックスのない行をスキップ", line, "verbose");
            continue;
          }
          
          // プレフィックスを削除してデータを取得
          const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();
          
          // [DONE]マーカーを確認
          if (data === "[DONE]") {
            console.log("Received [DONE] marker");
            this.writeDebugLog("Received [DONE] marker - ending stream", undefined, "basic");
            return { done: true, messages: out };
          }
          
          try {
            // Parse JSON and convert to chat message delta
            const json = JSON.parse(data);
            console.log("Received SSE data:", JSON.stringify(json, null, 2));
            this.writeDebugLog("Parsed SSE JSON data", {
              dataType: typeof json,
              hasThinking: !!(json.thinking || (json.content && json.content[0]?.type === "reasoning")),
              messageType: json.type,
              complete: json.done === true || json.choices?.[0]?.finish_reason === "stop"
            }, "detailed");
            
            // 終了シグナルの検出を強化
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
              this.writeDebugLog("終了シグナル検出", json, "basic");
              return { done: true, messages: out };
            }
            
            // 複数の形式をサポート
            
            // 1. 思考出力がある場合
            if (json.thinking || (json.content && json.content[0]?.type === "reasoning")) {
              console.log("思考出力を検出");
              let newThinkingContent = "";
              
              // Databricks形式の思考出力を処理
              if (json.thinking) {
                newThinkingContent = json.thinking;
              } else if (json.content && json.content[0]?.type === "reasoning") {
                newThinkingContent = json.content[0].summary[0]?.text || "";
              }
              
              // 思考コンテンツを追加して書式化したログを出力
              if (newThinkingContent) {
                thinkingContent += newThinkingContent;
                
                // 思考出力を強調表示（デバッグ用）
                console.log("\n==== THINKING OUTPUT ====");
                console.log(newThinkingContent);
                console.log("========================\n");
                
                this.writeDebugLog("思考出力を検出", {
                  format: json.thinking ? "direct" : "content",
                  contentLength: newThinkingContent.length,
                  content: newThinkingContent.substring(0, 100) + "..."
                }, "basic");
                
                out.push({
                  role: "thinking",
                  content: newThinkingContent
                });
              }
            }
            // 2. Anthropic形式のデルタ
            else if (json.type === "content_block_delta" && json.delta?.text) {
              console.log("Anthropic形式のデルタを検出");
              this.writeDebugLog("Anthropic形式のデルタを検出", {
                text: json.delta.text
              }, "detailed");
              out.push({
                role: "assistant",
                content: json.delta.text
              });
            }
            // 3. OpenAI形式のデルタ
            else if (json.choices && json.choices[0]?.delta?.content) {
              console.log("OpenAI形式のデルタを検出");
              this.writeDebugLog("OpenAI形式のデルタを検出", {
                content: json.choices[0].delta.content
              }, "detailed");
              out.push({
                role: "assistant",
                content: json.choices[0].delta.content
              });
            }
            // 4. 直接content形式
            else if (json.content && typeof json.content === "string") {
              console.log("直接content形式を検出");
              this.writeDebugLog("直接content形式を検出", {
                content: json.content.substring(0, 100) + "..."
              }, "detailed");
              out.push({
                role: "assistant",
                content: json.content
              });
            }
            // 5. コンテンツ配列を持つ形式
            else if (json.content && Array.isArray(json.content) && json.content[0]?.text) {
              console.log("コンテンツ配列形式を検出");
              this.writeDebugLog("コンテンツ配列形式を検出", {
                text: json.content[0].text.substring(0, 100) + "..."
              }, "detailed");
              out.push({
                role: "assistant",
                content: json.content[0].text
              });
            }
            // 6. 直接テキスト形式
            else if (json.text) {
              console.log("直接テキスト形式を検出");
              this.writeDebugLog("直接テキスト形式を検出", {
                text: json.text.substring(0, 100) + "..."
              }, "detailed");
              out.push({
                role: "assistant",
                content: json.text
              });
            }
            // 7. OpenAI形式のチャンク
            else {
              const delta = fromChatCompletionChunk(json);
              if (delta?.content) {
                console.log("OpenAI形式のチャンクからコンテンツを抽出");
                this.writeDebugLog("OpenAI形式のチャンクからコンテンツを抽出", {
                  content: delta.content
                }, "detailed");
                out.push({
                  role: "assistant",
                  content: delta.content
                });
              } else {
                console.log("不明なJSON形式:", json);
                this.writeDebugLog("不明なJSON形式", json, "basic");
              }
            }
          } catch (e) {
            // JSONの解析エラーをログに記録
            console.log("SSEストリームでJSON解析エラー:", e);
            this.writeDebugLog("SSEストリームでJSON解析エラー", { 
              error: (e as Error).message, 
              line: line
            }, "basic");
          }
        }
        return { done: false, messages: out };
      };
      
      /*
       * WHATWG Streams reader (Node 18+ or browser)
       */
      if (typeof (res.body as any).getReader === "function") {
        console.log("Using WHATWG streams reader");
        this.writeDebugLog("Using WHATWG streams reader", undefined, "basic");
        const reader = (res.body as any).getReader();
        
        // タイムスタンプを記録（思考モードの経過時間計測用）
        const startTime = Date.now();
        let chunkCount = 0;
        
        // タイムアウト値を設定ファイルから取得
        const streamTimeout = this.getTimeoutFromConfig();
        
        while (true) {
          const { done, value } = await reader.read();
          
          // 長時間の処理を防ぐためのタイムアウト処理を追加
          if (Date.now() - startTime > streamTimeout) {
            this.writeDebugLog("ストリーム処理がタイムアウトしました - 強制終了します", {
              elapsedMs: Date.now() - startTime,
              totalChunks: chunkCount,
              timeoutMs: streamTimeout
            }, "basic");
            return;
          }
          
          if (done) {
            console.log("ストリーム読み取り完了");
            this.writeDebugLog("ストリーム読み取り完了", {
              totalChunks: chunkCount,
              elapsedMs: Date.now() - startTime
            }, "basic");
            break;
          }
          
          chunkCount++;
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
          
          // チャンクのバイナリデータをログ（型付けの問題を修正）
          const chunkSize = value ? value.length : 0;
          console.log(`[${elapsedSec}s] 受信したチャンク（バイト）:`, value ? 
            Array.from(new Uint8Array(value as ArrayBuffer)).map((b: number) => b.toString(16)).join(' ') : 
            'null');
          this.writeDebugLog(`[${elapsedSec}s] チャンク#${chunkCount}受信`, { 
            sizeBytes: chunkSize
          }, "detailed");
          
          const decodedChunk = decoder.decode(value as Uint8Array, { stream: true });
          rawBuffer += decodedChunk; // 全てのデータを記録
          console.log(`[${elapsedSec}s] 受信したチャンク（テキスト）:`, decodedChunk);
          this.writeDebugLog(`チャンク#${chunkCount}デコード`, { 
            text: decodedChunk,
            length: decodedChunk.length
          }, "verbose");
          
          // チャンクが空でないことを確認
          if (!decodedChunk || decodedChunk.trim() === "") {
            console.log("空のチャンクを受信しました");
            this.writeDebugLog("空のチャンクを受信しました", undefined, "detailed");
            continue;
          }
          
          const { done: end, messages } = parseSSE(decodedChunk);
          this.writeDebugLog("チャンク解析結果", { 
            isDone: end, 
            messagesCount: messages.length 
          }, "basic");
          
          for (const m of messages) {
            this.writeDebugLog("メッセージ生成", { 
              role: m.role,
              contentLength: typeof m.content === 'string' ? m.content.length : 'not-string'
            }, "basic");
            yield m;
          }
          
          if (end) {
            console.log("ストリーム終了マーカーを検出");
            this.writeDebugLog("ストリーム終了マーカーを検出 - ループを終了します", undefined, "basic");
            return;
          }
        }
        
        // ストリーム終了後にバッファに残っているものを処理
        if (buffer.trim()) {
          console.log("残りのバッファを処理:", buffer);
          this.writeDebugLog("残りのバッファを処理", { 
            buffer: buffer.substring(0, 200) + "...",
            length: buffer.length
          }, "detailed");
          const { messages } = parseSSE("");
          for (const m of messages) {
            yield m;
          }
        }
        
        // 思考プロセスの要約を表示
        if (thinkingContent) {
          console.log("\n======= THINKING PROCESS SUMMARY =======");
          console.log("思考モードで生成された内容の合計トークン数（概算）:", Math.round(thinkingContent.length / 4));
          console.log("処理時間:", ((Date.now() - startTime) / 1000).toFixed(2), "秒");
          console.log("======================================\n");
          
          this.writeDebugLog("思考プロセス要約", {
            approximateTokens: Math.round(thinkingContent.length / 4),
            processingTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
            contentLength: thinkingContent.length
          }, "basic");
        }
        
        // 全レスポンスの記録
        console.log("完全な受信データ:", rawBuffer);
        this.writeDebugLog("完全な受信データサイズ", { 
          bytes: rawBuffer.length,
          approximateTokens: Math.round(rawBuffer.length / 4)
        }, "basic");
        return;
      }
      
      /*
       * Node.js Readable stream (Node 16 and below)
       */
      console.log("Using Node.js Readable stream");
      this.writeDebugLog("Using Node.js Readable stream", undefined, "basic");
      
      // タイムスタンプを記録（思考モードの経過時間計測用）
      const startTime = Date.now();
      let chunkCount = 0;
      
      // タイムアウト値を設定ファイルから取得
      const streamTimeout = this.getTimeoutFromConfig();
      
      try {
        for await (const chunk of res.body as any) {
          try {
            chunkCount++;
            
            // タイムスタンプとの差分を計算（経過秒数）
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            
            // 長時間の処理を防ぐためのタイムアウト処理を追加
            if (Date.now() - startTime > streamTimeout) {
              this.writeDebugLog("ストリーム処理がタイムアウトしました - 強制終了します", {
                elapsedMs: Date.now() - startTime,
                totalChunks: chunkCount,
                timeoutMs: streamTimeout
              }, "basic");
              return;
            }
            
            // チャンクの生データをログ（オブジェクトそのものを出力）
            console.log(`[${elapsedSec}s] 受信したチャンク（バイト）:`, typeof chunk === 'object' ? '(バイナリデータ)' : chunk);
            this.writeDebugLog(`[${elapsedSec}s] チャンク#${chunkCount}受信`, { 
              type: typeof chunk,
              isBuffer: Buffer.isBuffer(chunk),
              size: chunk.length || 0
            }, "detailed");
            
            const decodedChunk = decoder.decode(chunk as Buffer, { stream: true });
            rawBuffer += decodedChunk; // 全てのデータを記録
            console.log(`[${elapsedSec}s] 受信したチャンク（テキスト）:`, decodedChunk);
            this.writeDebugLog(`チャンク#${chunkCount}デコード`, { 
              text: decodedChunk,
              length: decodedChunk.length
            }, "verbose");
            
            // チャンクが空でないことを確認
            if (!decodedChunk || decodedChunk.trim() === "") {
              console.log("空のチャンクを受信しました");
              this.writeDebugLog("空のチャンクを受信しました", undefined, "detailed");
              continue;
            }
            
            const { done, messages } = parseSSE(decodedChunk);
            this.writeDebugLog("チャンク解析結果", { 
              isDone: done, 
              messagesCount: messages.length 
            }, "basic");
            
            for (const m of messages) {
              this.writeDebugLog("メッセージ生成", { 
                role: m.role,
                contentLength: typeof m.content === 'string' ? m.content.length : 'not-string'
              }, "basic");
              yield m;
            }
            
            if (done) {
              console.log("ストリーム終了マーカーを検出");
              this.writeDebugLog("ストリーム終了マーカーを検出 - ループを終了します", undefined, "basic");
              return;
            }
          } catch (e) {
            console.error("チャンク処理中のエラー:", e);
            this.writeDebugLog("チャンク処理中のエラー", { 
              error: (e as Error).message, 
              stack: (e as Error).stack 
            }, "basic");
          }
        }
        
        // ストリーム終了後にバッファに残っているものを処理
        if (buffer.trim()) {
          console.log("残りのバッファを処理:", buffer);
          this.writeDebugLog("残りのバッファを処理", { 
            buffer: buffer.substring(0, 200) + "...",
            length: buffer.length
          }, "detailed");
          const { messages } = parseSSE("");
          for (const m of messages) {
            yield m;
          }
        }
        
        // 思考プロセスの要約を表示
        if (thinkingContent) {
          console.log("\n======= THINKING PROCESS SUMMARY =======");
          console.log("思考モードで生成された内容の合計トークン数（概算）:", Math.round(thinkingContent.length / 4));
          console.log("処理時間:", ((Date.now() - startTime) / 1000).toFixed(2), "秒");
          console.log("======================================\n");
          
          this.writeDebugLog("思考プロセス要約", {
            approximateTokens: Math.round(thinkingContent.length / 4),
            processingTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
            contentLength: thinkingContent.length
          }, "basic");
        }
        
        // 全レスポンスの記録
        console.log("完全な受信データ:", rawBuffer);
        this.writeDebugLog("完全な受信データサイズ", { 
          bytes: rawBuffer.length, 
          approximateTokens: Math.round(rawBuffer.length / 4)
        }, "basic");
      } catch (streamError) {
        console.error("ストリーム読み取り中のエラー:", streamError);
        this.writeDebugLog("ストリーム読み取り中のエラー", { 
          error: (streamError as Error).message, 
          stack: (streamError as Error).stack 
        }, "basic");
        
        // エラーが発生した場合でも、受信したデータを処理
        console.log("エラー発生後に受信データを処理:", rawBuffer);
        this.writeDebugLog("エラー発生後に受信データを処理", { 
          dataLength: rawBuffer.length 
        }, "basic");
        
        // レスポンス全体をJSONとして解析を試みる
        try {
          const jsonResponse = JSON.parse(rawBuffer);
          console.log("レスポンス全体をJSONとして解析:", jsonResponse);
          this.writeDebugLog("レスポンス全体をJSONとして解析", jsonResponse, "detailed");
          
          if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
            yield {
              role: "assistant",
              content: jsonResponse.choices[0].message.content
            };
          } else if (jsonResponse.content) {
            yield {
              role: "assistant",
              content: typeof jsonResponse.content === "string" ? 
                jsonResponse.content : 
                JSON.stringify(jsonResponse.content)
            };
          }
        } catch (parseError) {
          console.error("最終解析の試みに失敗:", parseError);
          this.writeDebugLog("最終解析の試みに失敗", { 
            error: (parseError as Error).message, 
            stack: (parseError as Error).stack 
          }, "basic");
          throw streamError; // 元のエラーを再スロー
        }
      }
    } catch (error) {
      console.error("Error in _streamChat:", error);
      this.writeDebugLog("Error in _streamChat", { 
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      }, "basic");
      throw error;
    }
  }
}

// グローバルなエラーハンドラーを追加
process.on('uncaughtException', (error) => {
  // 静的なwriteDebugLogを使用
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] 重大なエラー: uncaughtException\n${JSON.stringify({
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    }, null, 2)}`;
    
    // 最後に使用されたログパスを取得しようとする
    // 可能であれば、config.yamlからパスを直接読み取る
    try {
      const homeDir = os.homedir();
      const configPath = path.join(homeDir, ".continue", "config.yaml");
      if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          // Databricksモデルを探す
          const databricksModel = (parsed.models as any[]).find(m => m.provider === "databricks");
          if (databricksModel && databricksModel.defaultCompletionOptions?.debug?.enabled) {
            const logPath = databricksModel.defaultCompletionOptions.debug.logPath;
            const absoluteLogPath = path.isAbsolute(logPath) ? 
              logPath : path.join(homeDir, logPath);
            fs.appendFileSync(absoluteLogPath, logMessage + "\n\n", { encoding: "utf8" });
          }
        }
      }
    } catch (logError) {
      // フォールバック: デスクトップにログを書き込む
      fs.appendFileSync(
        path.join(os.homedir(), "Desktop", "databricks-error.log"), 
        logMessage + "\n\n", 
        { encoding: "utf8" }
      );
    }
  } catch (e) {
    console.error("ログ出力中にエラーが発生しました:", e);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  // 静的なwriteDebugLogを使用
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] 重大なエラー: unhandledRejection\n${JSON.stringify({
      reason: reason instanceof Error ? 
        { name: reason.name, message: reason.message, stack: reason.stack } : 
        String(reason),
      promise: String(promise)
    }, null, 2)}`;
    
    // 最後に使用されたログパスを取得しようとする
    try {
      const homeDir = os.homedir();
      const configPath = path.join(homeDir, ".continue", "config.yaml");
      if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          // Databricksモデルを探す
          const databricksModel = (parsed.models as any[]).find(m => m.provider === "databricks");
          if (databricksModel && databricksModel.defaultCompletionOptions?.debug?.enabled) {
            const logPath = databricksModel.defaultCompletionOptions.debug.logPath;
            const absoluteLogPath = path.isAbsolute(logPath) ? 
              logPath : path.join(homeDir, logPath);
            fs.appendFileSync(absoluteLogPath, logMessage + "\n\n", { encoding: "utf8" });
          }
        }
      }
    } catch (logError) {
      // フォールバック: デスクトップにログを書き込む
      fs.appendFileSync(
        path.join(os.homedir(), "Desktop", "databricks-error.log"), 
        logMessage + "\n\n", 
        { encoding: "utf8" }
      );
    }
  } catch (e) {
    console.error("ログ出力中にエラーが発生しました:", e);
  }
});