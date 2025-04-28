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

/**
 * デバッグログをファイルに出力するためのユーティリティ
 */
const DEBUG_LOG_ENABLED = true; // デバッグログを有効/無効化するフラグ
const LOG_FILE_PATH = path.join(os.homedir(), "Desktop", "databricks-debug.log");

// 初期化時にログファイルをクリア
if (DEBUG_LOG_ENABLED) {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    fs.writeFileSync(
      LOG_FILE_PATH, 
      `=== デバッグログ開始: ${timestamp} ===\n\n`, 
      { encoding: "utf8" }
    );
    console.log(`デバッグログを開始: ${LOG_FILE_PATH}`);
  } catch (error) {
    console.error("ログファイル初期化エラー:", error);
  }
}

/**
 * 指定されたメッセージとオブジェクトをログファイルに書き込みます
 * @param message ログメッセージ
 * @param obj 追加のデータオブジェクト（オプション）
 */
function writeDebugLog(message: string, obj?: any): void {
  if (!DEBUG_LOG_ENABLED) return;
  
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
    fs.appendFileSync(LOG_FILE_PATH, logMessage + "\n\n", { encoding: "utf8" });
  } catch (err) {
    // ログ書き込み自体のエラーは標準コンソールに出力
    console.error("ログファイル書き込みエラー:", err);
  }
}

export default class Databricks extends OpenAI {
  static providerName = "databricks";
  private modelConfig: any = null;
  private globalConfig: any = null;

  /**
   * Load Databricks model configuration from .continue/config.yaml.
   * Reads all available configuration options for the specified model.
   * @param modelName The model identifier to match in the config.
   * @returns Complete model configuration object including all options.
   */
  private static loadConfigFromYaml(modelName: string): any {
    console.log("Attempting to load config from YAML for model:", modelName);
    writeDebugLog("Attempting to load config from YAML for model:", modelName);
    
    // Determine path to ~/.continue/config.yaml
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, ".continue", "config.yaml");
    console.log("Looking for config file at:", configPath);
    writeDebugLog("Looking for config file at:", configPath);
    
    try {
      if (fs.existsSync(configPath)) {
        console.log("Config file exists, reading content");
        writeDebugLog("Config file exists, reading content");
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        
        // Keep a reference to the complete config for global settings
        const globalConfig = parsed;
        
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          console.log(`Found ${parsed.models.length} models in config`);
          writeDebugLog(`Found ${parsed.models.length} models in config`);
          
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
            writeDebugLog("Found matching model config:", {
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
            writeDebugLog(`No model with name '${modelName}' and provider 'databricks' found in config`);
          }
        }
      } else {
        console.log("Config file not found at path:", configPath);
        writeDebugLog("Config file not found at path:", configPath);
      }
    } catch (error) {
      console.error("Error reading Databricks config.yaml:", error);
      writeDebugLog("Error reading Databricks config.yaml:", error);
    }
    
    // If config.yaml did not yield results, fall back to environment variables
    console.log("Trying environment variables as fallback");
    writeDebugLog("Trying environment variables as fallback");
    const pat = process.env.DATABRICKS_TOKEN;
    const base = process.env.YOUR_DATABRICKS_URL;
    if (pat && base) {
      console.log("Found environment variables, using them instead");
      writeDebugLog("Found environment variables, using them instead");
      return {
        modelConfig: {
          apiKey: pat,
          apiBase: base,
        },
        globalConfig: null
      };
    }
    
    console.log("No configuration found in YAML or environment variables");
    writeDebugLog("No configuration found in YAML or environment variables");
    // If neither config.yaml nor environment variables worked, throw error
    throw new Error(
      "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
    );
  }

  constructor(opts: LLMOptions) {
    console.log("Databricks constructor called with model:", opts.model);
    writeDebugLog("Databricks constructor called with model:", opts.model);
    
    // Ensure a model name is provided
    const modelName = opts.model;
    if (!modelName) {
      const error = new Error("No model specified for Databricks. Please include a model name in the options.");
      writeDebugLog("Error: No model specified", error);
      throw error;
    }
    
    // Load complete configuration for this model from YAML
    console.log("Loading config for model:", modelName);
    writeDebugLog("Loading config for model:", modelName);
    const { modelConfig, globalConfig } = Databricks.loadConfigFromYaml(modelName);
    console.log("Loaded config:", { 
      apiKeyExists: !!modelConfig.apiKey, 
      endpoint: modelConfig.apiBase,
      defaultCompletionOptionsExist: !!modelConfig.defaultCompletionOptions
    });
    writeDebugLog("Loaded config:", { 
      apiKeyExists: !!modelConfig.apiKey, 
      endpoint: modelConfig.apiBase,
      defaultCompletionOptionsExist: !!modelConfig.defaultCompletionOptions
    });
    
    // Validate that apiKey and endpoint are present
    if (!modelConfig.apiKey || !modelConfig.apiBase) {
      const error = new Error(
        "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
      );
      writeDebugLog("Error: Missing connection info", error);
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
    writeDebugLog("Final apiBase after processing:", opts.apiBase);
    
    // Call the base class constructor with updated options
    // Important: super() must be called before accessing 'this'
    super(opts);
    
    // Store model config for later use in parameter conversion
    // This must be done after the super() call
    this.modelConfig = modelConfig;
    this.globalConfig = globalConfig;
    
    writeDebugLog("Databricks constructor completed");
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
    writeDebugLog("Databricks adapter using URL:", url);
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
    writeDebugLog("送信ヘッダー:", customHeaders);
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
      writeDebugLog("Model-specific stream setting found:", this.modelConfig.defaultCompletionOptions.stream);
      return this.modelConfig.defaultCompletionOptions.stream;
    }
    
    // グローバル設定を確認（存在する場合）
    if (this.globalConfig?.stream !== undefined) {
      console.log("Global stream setting found:", this.globalConfig.stream);
      writeDebugLog("Global stream setting found:", this.globalConfig.stream);
      return this.globalConfig.stream;
    }
    
    // 両方とも存在しない場合はデフォルトでtrueを返す
    console.log("No stream setting found in config, using default: true");
    writeDebugLog("No stream setting found in config, using default: true");
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
    writeDebugLog("Converting args with options:", {
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
      maxTokens: options.maxTokens,
      reasoning: options.reasoning,
      reasoningBudgetTokens: options.reasoningBudgetTokens,
      stop: options.stream
    });
    
    // 設定ファイルからストリーミングモードの設定を取得
    const enableStreaming = this.getEnableStreamingFromConfig();
    console.log("ストリーミングモード:", enableStreaming ? "有効" : "無効", "(設定ファイルから読み込み)");
    writeDebugLog("ストリーミングモード:", { 
      enabled: enableStreaming, 
      source: "設定ファイルから読み込み" 
    });
    
    // Determine thinking budget and if thinking is enabled
    const thinkingBudget = options.reasoningBudgetTokens || 
                          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
                          4000;
    
    const isThinkingEnabled = options.reasoning || 
                              (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    // 思考モードの設定をログに記録
    if (isThinkingEnabled) {
      writeDebugLog("思考モード有効", { 
        budget: thinkingBudget,
        source: options.reasoning ? "options.reasoning" : "config.thinking.type"
      });
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
      writeDebugLog("Omitting top_k and top_p parameters because thinking is enabled");
    }
    
    // 思考モードの設定がある場合、Databricksの思考パラメータを追加
    if (isThinkingEnabled) {
      // Databricksの思考パラメータを追加
      finalOptions.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget
      };
      console.log("Added thinking parameter with budget:", thinkingBudget);
      writeDebugLog("Added thinking parameter with budget:", thinkingBudget);
      console.log("Ensured max_tokens is greater than thinking budget:", maxTokens);
      writeDebugLog("Ensured max_tokens is greater than thinking budget:", maxTokens);
    }
    
    // Log the final parameters being sent
    console.log("Final API parameters:", JSON.stringify(finalOptions, null, 2));
    writeDebugLog("Final API parameters:", finalOptions);
    
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
    writeDebugLog(`Converting ${msgs.length} messages to Databricks format`);
    
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
        writeDebugLog("Converting complex message content");
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      }
    });
    
    console.log(`Converted to ${messages.length} messages`);
    writeDebugLog(`Converted to ${messages.length} messages`);
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
      writeDebugLog("Found system message", { length: systemMessage.length });
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
      writeDebugLog("Enabled thinking mode with budget:", budgetTokens);
    }
    
    writeDebugLog("Enhanced system message", { 
      length: systemMessage.length, 
      preview: systemMessage.substring(0, 100) + "..." 
    });
    
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
    writeDebugLog("_streamChat called", { 
      messagesCount: msgs.length,
      options: JSON.stringify({
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        reasoning: options.reasoning,
        reasoningBudgetTokens: options.reasoningBudgetTokens,
        stream: options.stream
      })
    });
    
    // Convert messages and extract system message
    const convertedMessages = this.convertMessages(msgs);
    const originalSystemMessage = this.extractSystemMessage(msgs);
    writeDebugLog("Converted messages", { 
      convertedCount: convertedMessages.length,
      hasSystemMessage: !!originalSystemMessage
    });
    
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
    writeDebugLog("ストリーミング設定", { enabled: body.stream });
    
    // Log the final request body (sanitized for security)
    const sanitizedBody = { ...body };
    if (body.messages) {
      sanitizedBody.messages = `[${convertedMessages.length} messages]`;
    }
    console.log("Sending request with body:", JSON.stringify(sanitizedBody, null, 2));
    writeDebugLog("Sending request", { 
      url: this.getInvocationUrl(),
      body: sanitizedBody,
      streamEnabled: body.stream
    });
    
    // Send POST request to the invocation URL
    const invocationUrl = this.getInvocationUrl();
    console.log("Sending request to:", invocationUrl);
    
    try {
      // タイムアウト設定を追加
      const fetchOptions = {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
        timeout: 300000 // 5分のタイムアウト
      };
      
      // fetchオプションに明示的にタイムアウトを追加できない場合はこの行を削除
      const timeoutOption = (fetchOptions as any).timeout;
      console.log("タイムアウト設定:", timeoutOption ? `${timeoutOption}ms` : "未設定");
      writeDebugLog("タイムアウト設定:", timeoutOption ? `${timeoutOption}ms` : "未設定");
      
      const res = await this.fetch(invocationUrl, fetchOptions);
      
      console.log("Response status:", res.status);
      console.log("レスポンスヘッダー:", Object.fromEntries([...res.headers.entries()]));
      console.log("コンテンツタイプ:", res.headers.get("content-type"));
      
      // レスポンス受信のログ
      writeDebugLog("Response received", { 
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type"),
        headers: Object.fromEntries([...res.headers.entries()])
      });
      
      // Check for HTTP errors or missing body
      if (!res.ok || !res.body) {
        const errorMsg = `HTTP ${res.status}`;
        console.error("HTTP error response:", res.status, res.statusText);
        writeDebugLog("HTTP error response", { 
          status: res.status, 
          statusText: res.statusText,
          error: errorMsg
        });
        throw new Error(errorMsg);
      }

      // ストリーミングが無効の場合、1回のレスポンスを返す
      if (body.stream === false) {
        console.log("Non-streaming mode, processing single response");
        writeDebugLog("Non-streaming mode, processing single response");
        const jsonResponse = await res.json();
        console.log("Received complete response:", JSON.stringify(jsonResponse, null, 2));
        writeDebugLog("Received complete response", jsonResponse);
        
        try {
          // さまざまな形式を処理
          if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
            // OpenAI形式
            writeDebugLog("OpenAI形式のレスポンスを検出", { 
              content: jsonResponse.choices[0].message.content.substring(0, 100) + "..." 
            });
            yield {
              role: "assistant",
              content: jsonResponse.choices[0].message.content
            };
          } else if (jsonResponse.content) {
            // 直接コンテンツ形式
            const contentValue = jsonResponse.content;
            writeDebugLog("直接コンテンツ形式のレスポンスを検出", { 
              contentType: typeof contentValue,
              isArray: Array.isArray(contentValue)
            });
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
            writeDebugLog("Anthropic互換形式のレスポンスを検出", {
              completion: jsonResponse.completion.substring(0, 100) + "..."
            });
            yield {
              role: "assistant",
              content: jsonResponse.completion
            };
          } else if (jsonResponse.message?.content) {
            // 別の形式のOpenAI互換
            writeDebugLog("別の形式のOpenAI互換レスポンスを検出", {
              content: jsonResponse.message.content.substring(0, 100) + "..."
            });
            yield {
              role: "assistant",
              content: jsonResponse.message.content
            };
          } else {
            console.log("未知のレスポンス形式:", jsonResponse);
            writeDebugLog("未知のレスポンス形式", jsonResponse);
            yield {
              role: "assistant",
              content: "Response format not recognized: " + JSON.stringify(jsonResponse)
            };
          }
        } catch (e) {
          console.error("レスポンス処理エラー:", e);
          writeDebugLog("レスポンス処理エラー", { 
            error: (e as Error).message, 
            stack: (e as Error).stack,
            response: jsonResponse
          });
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
            writeDebugLog("単一JSONの解析を試行", jsonStr);
            const json = JSON.parse(jsonStr);
            console.log("単一JSONを解析:", json);
            writeDebugLog("単一JSONを解析", json);
            
            // 終了シグナルの検出を強化
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
              writeDebugLog("終了シグナル検出（単一JSON）", json);
              buffer = "";
              return { done: true, messages: out };
            }
            
            // 異なる形式のレスポンスを処理
            if (json.choices && json.choices[0]?.message?.content) {
              // OpenAI形式の完全なレスポンス
              console.log("OpenAI形式の完全なレスポンスを検出");
              writeDebugLog("OpenAI形式の完全なレスポンスを検出", { 
                content: json.choices[0].message.content.substring(0, 100) + "..." 
              });
              out.push({
                role: "assistant",
                content: json.choices[0].message.content
              });
              buffer = "";
              return { done: true, messages: out };
            }
          } catch (e) {
            console.log("単一JSON解析エラー、行解析に切り替え:", e);
            writeDebugLog("単一JSON解析エラー、行解析に切り替え", { 
              error: (e as Error).message, 
              buffer: buffer.substring(0, 200) + "..."
            });
          }
        }
        
        let idx: number;
        // Process each line in the buffer
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          
          console.log("処理中の行:", line);
          writeDebugLog("処理中の行", line);
          
          // 空行をスキップ
          if (!line) continue;
          
          // "data:"プレフィックスを確認
          if (!line.startsWith("data:") && !line.startsWith("data: ")) {
            console.log("data:プレフィックスのない行をスキップ:", line);
            writeDebugLog("data:プレフィックスのない行をスキップ", line);
            continue;
          }
          
          // プレフィックスを削除してデータを取得
          const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();
          
          // [DONE]マーカーを確認
          if (data === "[DONE]") {
            console.log("Received [DONE] marker");
            writeDebugLog("Received [DONE] marker - ending stream");
            return { done: true, messages: out };
          }
          
          try {
            // Parse JSON and convert to chat message delta
            const json = JSON.parse(data);
            console.log("Received SSE data:", JSON.stringify(json, null, 2));
            writeDebugLog("Parsed SSE JSON data", {
              dataType: typeof json,
              hasThinking: !!(json.thinking || (json.content && json.content[0]?.type === "reasoning")),
              messageType: json.type,
              complete: json.done === true || json.choices?.[0]?.finish_reason === "stop"
            });
            
            // 終了シグナルの検出を強化
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
              writeDebugLog("終了シグナル検出", json);
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
                
                writeDebugLog("思考出力を検出", {
                  format: json.thinking ? "direct" : "content",
                  contentLength: newThinkingContent.length,
                  content: newThinkingContent.substring(0, 100) + "..."
                });
                
                out.push({
                  role: "thinking",
                  content: newThinkingContent
                });
              }
            }
            // 2. Anthropic形式のデルタ
            else if (json.type === "content_block_delta" && json.delta?.text) {
              console.log("Anthropic形式のデルタを検出");
              writeDebugLog("Anthropic形式のデルタを検出", {
                text: json.delta.text
              });
              out.push({
                role: "assistant",
                content: json.delta.text
              });
            }
            // 3. OpenAI形式のデルタ
            else if (json.choices && json.choices[0]?.delta?.content) {
              console.log("OpenAI形式のデルタを検出");
              writeDebugLog("OpenAI形式のデルタを検出", {
                content: json.choices[0].delta.content
              });
              out.push({
                role: "assistant",
                content: json.choices[0].delta.content
              });
            }
            // 4. 直接content形式
            else if (json.content && typeof json.content === "string") {
              console.log("直接content形式を検出");
              writeDebugLog("直接content形式を検出", {
                content: json.content.substring(0, 100) + "..."
              });
              out.push({
                role: "assistant",
                content: json.content
              });
            }
            // 5. コンテンツ配列を持つ形式
            else if (json.content && Array.isArray(json.content) && json.content[0]?.text) {
              console.log("コンテンツ配列形式を検出");
              writeDebugLog("コンテンツ配列形式を検出", {
                text: json.content[0].text.substring(0, 100) + "..."
              });
              out.push({
                role: "assistant",
                content: json.content[0].text
              });
            }
            // 6. 直接テキスト形式
            else if (json.text) {
              console.log("直接テキスト形式を検出");
              writeDebugLog("直接テキスト形式を検出", {
                text: json.text.substring(0, 100) + "..."
              });
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
                writeDebugLog("OpenAI形式のチャンクからコンテンツを抽出", {
                  content: delta.content
                });
                out.push({
                  role: "assistant",
                  content: delta.content
                });
              } else {
                console.log("不明なJSON形式:", json);
                writeDebugLog("不明なJSON形式", json);
              }
            }
          } catch (e) {
            // JSONの解析エラーをログに記録
            console.log("SSEストリームでJSON解析エラー:", e);
            writeDebugLog("SSEストリームでJSON解析エラー", { 
              error: (e as Error).message, 
              line: line
            });
          }
        }
        return { done: false, messages: out };
      };
      
      /*
       * WHATWG Streams reader (Node 18+ or browser)
       */
      if (typeof (res.body as any).getReader === "function") {
        console.log("Using WHATWG streams reader");
        writeDebugLog("Using WHATWG streams reader");
        const reader = (res.body as any).getReader();
        
        // タイムスタンプを記録（思考モードの経過時間計測用）
        const startTime = Date.now();
        let chunkCount = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          
          // 長時間の処理を防ぐためのタイムアウト処理を追加
          if (Date.now() - startTime > 300000) { // 5分のタイムアウト
            writeDebugLog("ストリーム処理がタイムアウトしました - 強制終了します", {
              elapsedMs: Date.now() - startTime,
              totalChunks: chunkCount
            });
            return;
          }
          
          if (done) {
            console.log("ストリーム読み取り完了");
            writeDebugLog("ストリーム読み取り完了", {
              totalChunks: chunkCount,
              elapsedMs: Date.now() - startTime
            });
            break;
          }
          
          chunkCount++;
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
          
          // チャンクのバイナリデータをログ（型付けの問題を修正）
          const chunkSize = value ? value.length : 0;
          console.log(`[${elapsedSec}s] 受信したチャンク（バイト）:`, value ? 
            Array.from(new Uint8Array(value as ArrayBuffer)).map((b: number) => b.toString(16)).join(' ') : 
            'null');
          writeDebugLog(`[${elapsedSec}s] チャンク#${chunkCount}受信`, { 
            sizeBytes: chunkSize
          });
          
          const decodedChunk = decoder.decode(value as Uint8Array, { stream: true });
          rawBuffer += decodedChunk; // 全てのデータを記録
          console.log(`[${elapsedSec}s] 受信したチャンク（テキスト）:`, decodedChunk);
          writeDebugLog(`チャンク#${chunkCount}デコード`, { 
            text: decodedChunk,
            length: decodedChunk.length
          });
          
          // チャンクが空でないことを確認
          if (!decodedChunk || decodedChunk.trim() === "") {
            console.log("空のチャンクを受信しました");
            writeDebugLog("空のチャンクを受信しました");
            continue;
          }
          
          const { done: end, messages } = parseSSE(decodedChunk);
          writeDebugLog("チャンク解析結果", { 
            isDone: end, 
            messagesCount: messages.length 
          });
          
          for (const m of messages) {
            writeDebugLog("メッセージ生成", { 
              role: m.role,
              contentLength: typeof m.content === 'string' ? m.content.length : 'not-string'
            });
            yield m;
          }
          
          if (end) {
            console.log("ストリーム終了マーカーを検出");
            writeDebugLog("ストリーム終了マーカーを検出 - ループを終了します");
            return;
          }
        }
        
        // ストリーム終了後にバッファに残っているものを処理
        if (buffer.trim()) {
          console.log("残りのバッファを処理:", buffer);
          writeDebugLog("残りのバッファを処理", { 
            buffer: buffer.substring(0, 200) + "...",
            length: buffer.length
          });
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
          
          writeDebugLog("思考プロセス要約", {
            approximateTokens: Math.round(thinkingContent.length / 4),
            processingTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
            contentLength: thinkingContent.length
          });
        }
        
        // 全レスポンスの記録
        console.log("完全な受信データ:", rawBuffer);
        writeDebugLog("完全な受信データサイズ", { 
          bytes: rawBuffer.length,
          approximateTokens: Math.round(rawBuffer.length / 4)
        });
        return;
      }
      
      /*
       * Node.js Readable stream (Node 16 and below)
       */
      console.log("Using Node.js Readable stream");
      writeDebugLog("Using Node.js Readable stream");
      
      // タイムスタンプを記録（思考モードの経過時間計測用）
      const startTime = Date.now();
      let chunkCount = 0;
      
      try {
        for await (const chunk of res.body as any) {
          try {
            chunkCount++;
            
            // タイムスタンプとの差分を計算（経過秒数）
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            
            // 長時間の処理を防ぐためのタイムアウト処理を追加
            if (Date.now() - startTime > 300000) { // 5分のタイムアウト
              writeDebugLog("ストリーム処理がタイムアウトしました - 強制終了します", {
                elapsedMs: Date.now() - startTime,
                totalChunks: chunkCount
              });
              return;
            }
            
            // チャンクの生データをログ（オブジェクトそのものを出力）
            console.log(`[${elapsedSec}s] 受信したチャンク（バイト）:`, typeof chunk === 'object' ? '(バイナリデータ)' : chunk);
            writeDebugLog(`[${elapsedSec}s] チャンク#${chunkCount}受信`, { 
              type: typeof chunk,
              isBuffer: Buffer.isBuffer(chunk),
              size: chunk.length || 0
            });
            
            const decodedChunk = decoder.decode(chunk as Buffer, { stream: true });
            rawBuffer += decodedChunk; // 全てのデータを記録
            console.log(`[${elapsedSec}s] 受信したチャンク（テキスト）:`, decodedChunk);
            writeDebugLog(`チャンク#${chunkCount}デコード`, { 
              text: decodedChunk,
              length: decodedChunk.length
            });
            
            // チャンクが空でないことを確認
            if (!decodedChunk || decodedChunk.trim() === "") {
              console.log("空のチャンクを受信しました");
              writeDebugLog("空のチャンクを受信しました");
              continue;
            }
            
            const { done, messages } = parseSSE(decodedChunk);
            writeDebugLog("チャンク解析結果", { 
              isDone: done, 
              messagesCount: messages.length 
            });
            
            for (const m of messages) {
              writeDebugLog("メッセージ生成", { 
                role: m.role,
                contentLength: typeof m.content === 'string' ? m.content.length : 'not-string'
              });
              yield m;
            }
            
            if (done) {
              console.log("ストリーム終了マーカーを検出");
              writeDebugLog("ストリーム終了マーカーを検出 - ループを終了します");
              return;
            }
          } catch (e) {
            console.error("チャンク処理中のエラー:", e);
            writeDebugLog("チャンク処理中のエラー", { 
              error: (e as Error).message, 
              stack: (e as Error).stack 
            });
          }
        }
        
        // ストリーム終了後にバッファに残っているものを処理
        if (buffer.trim()) {
          console.log("残りのバッファを処理:", buffer);
          writeDebugLog("残りのバッファを処理", { 
            buffer: buffer.substring(0, 200) + "...",
            length: buffer.length
          });
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
          
          writeDebugLog("思考プロセス要約", {
            approximateTokens: Math.round(thinkingContent.length / 4),
            processingTimeSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
            contentLength: thinkingContent.length
          });
        }
        
        // 全レスポンスの記録
        console.log("完全な受信データ:", rawBuffer);
        writeDebugLog("完全な受信データサイズ", { 
          bytes: rawBuffer.length, 
          approximateTokens: Math.round(rawBuffer.length / 4)
        });
      } catch (streamError) {
        console.error("ストリーム読み取り中のエラー:", streamError);
        writeDebugLog("ストリーム読み取り中のエラー", { 
          error: (streamError as Error).message, 
          stack: (streamError as Error).stack 
        });
        
        // エラーが発生した場合でも、受信したデータを処理
        console.log("エラー発生後に受信データを処理:", rawBuffer);
        writeDebugLog("エラー発生後に受信データを処理", { 
          dataLength: rawBuffer.length 
        });
        
        // レスポンス全体をJSONとして解析を試みる
        try {
          const jsonResponse = JSON.parse(rawBuffer);
          console.log("レスポンス全体をJSONとして解析:", jsonResponse);
          writeDebugLog("レスポンス全体をJSONとして解析", jsonResponse);
          
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
          writeDebugLog("最終解析の試みに失敗", { 
            error: (parseError as Error).message, 
            stack: (parseError as Error).stack 
          });
          throw streamError; // 元のエラーを再スロー
        }
      }
    } catch (error) {
      console.error("Error in _streamChat:", error);
      writeDebugLog("Error in _streamChat", { 
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }
}

// グローバルなエラーハンドラーを追加
process.on('uncaughtException', (error) => {
  writeDebugLog("重大なエラー: uncaughtException", {
    name: (error as Error).name,
    message: (error as Error).message,
    stack: (error as Error).stack
  });
});

process.on('unhandledRejection', (reason, promise) => {
  writeDebugLog("重大なエラー: unhandledRejection", {
    reason: reason,
    promise: String(promise)
  });
});