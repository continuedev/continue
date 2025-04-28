/*
 * Databricks.ts — Continue LLM adapter for Databricks Model Serving
 */
import OpenAI from "./OpenAI";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
} from "../../index";
import { fromChatCompletionChunk } from "../openaiTypeConverters";
import { renderChatMessage, stripImages } from "../../util/messageContent";

const isNode = typeof process !== 'undefined' && 
               typeof process.versions !== 'undefined' && 
               typeof process.versions.node !== 'undefined';

let fs: any = null;
let path: any = null;
let os: any = null;
let yaml: any = null;

if (isNode) {
  try {
    fs = require("fs");
    path = require("path");
    os = require("os");
    yaml = require("js-yaml");
  } catch (error) {
    console.warn("Node.js modules could not be imported:", error);
  }
} else {
  fs = {
    existsSync: () => false,
    readFileSync: () => '',
    writeFileSync: () => undefined,
    appendFileSync: () => undefined,
    mkdirSync: () => undefined
  };
  path = {
    join: (...args: string[]) => args.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
    isAbsolute: (p: string) => p.startsWith('/') || /^[A-Z]:[\\\/]/.test(p)
  };
  os = {
    homedir: () => '/'
  };
  yaml = {
    load: () => ({})
  };
}

type AssistantChatMessage = ChatMessage & {
  finish_reason?: string;
};

type ThinkingChatMessage = ChatMessage & {
  finish_reason?: string;
};

enum LogLevel {
  NONE = 0,
  BASIC = 1,
  DETAILED = 2,
  VERBOSE = 3
}

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
  
  private debugSettings: DebugSettings = {
    enabled: false,
    logPath: "",
    logLevel: "basic",
    logLevelValue: LogLevel.BASIC
  };
  
  private logLevelMap: Record<string, LogLevel> = {
    "none": LogLevel.NONE,
    "basic": LogLevel.BASIC,
    "detailed": LogLevel.DETAILED,
    "verbose": LogLevel.VERBOSE
  };

  private static loadConfigFromYaml(modelName: string): any {
    console.log("Attempting to load config from YAML for model:", modelName);
    
    if (!isNode) {
      console.log("Not in Node.js environment, using environment variables");
      return {
        modelConfig: {
          apiKey: process.env.DATABRICKS_TOKEN || "",
          apiBase: process.env.YOUR_DATABRICKS_URL || "",
          defaultCompletionOptions: {}
        },
        globalConfig: null
      };
    }
    
    try {
      const homeDir = os.homedir();
      const configPath = path.join(homeDir, ".continue", "config.yaml");
      console.log("Looking for config file at:", configPath);
      
      if (fs.existsSync(configPath)) {
        console.log("Config file exists, reading content");
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        
        const globalConfig = parsed;
        
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          console.log(`Found ${parsed.models.length} models in config`);
          
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
            
            // Claude 3.7 Sonnetの場合は特別な検証と設定
            const isClaudeModel = (modelConfig.model || "").toLowerCase().includes("claude");
            const isClaudeSonnet37 = isClaudeModel && (
              (modelConfig.model || "").toLowerCase().includes("claude-3-7") ||
              (modelConfig.model || "").toLowerCase().includes("claude-3.7")
            );
            
            if (isClaudeSonnet37) {
              console.log("Claude 3.7 Sonnetモデルを検出 - 特別な設定を適用");
              
              // Claude 3.7固有の設定を確保
              if (!modelConfig.defaultCompletionOptions) {
                modelConfig.defaultCompletionOptions = {};
              }
              
              // 思考モードの設定を確保
              if (!modelConfig.defaultCompletionOptions.thinking) {
                modelConfig.defaultCompletionOptions.thinking = {
                  type: "auto",  // auto, enabled, disabled
                  budget_tokens: 4000
                };
              }
              
              // 思考モードのデフォルト設定
              if (!modelConfig.defaultCompletionOptions.thinking.type) {
                modelConfig.defaultCompletionOptions.thinking.type = "auto";
              }
              
              if (!modelConfig.defaultCompletionOptions.thinking.budget_tokens) {
                modelConfig.defaultCompletionOptions.thinking.budget_tokens = 4000;
              }
              
              console.log("Claude 3.7 Sonnet設定:", {
                thinking: modelConfig.defaultCompletionOptions.thinking
              });
            }
            
            // 設定の検証
            Databricks.validateModelConfig(modelConfig, isClaudeSonnet37);
            
            if (modelConfig && typeof modelConfig.apiKey === "string" && typeof modelConfig.apiBase === "string") {
              return { modelConfig, globalConfig };
            }
          } else {
            console.log(`No model with name '${modelName}' and provider 'databricks' found in config`);
          }
        }
      } else {
        console.log("Config file not found at path:", configPath);
      }
      
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
      
    } catch (error) {
      console.error("Error reading Databricks config.yaml:", error);
    }
    
    console.log("No configuration found in YAML or environment variables");
    throw new Error(
      "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
    );
  }

  // 設定を検証するための新しいヘルパーメソッド
  private static validateModelConfig(config: any, isClaudeSonnet37: boolean): void {
    if (!config) {
      console.warn("設定オブジェクトが存在しません");
      return;
    }
    
    // 基本的な検証
    if (!config.apiKey) {
      console.warn("警告: apiKeyが設定されていません");
    }
    
    if (!config.apiBase) {
      console.warn("警告: apiBaseが設定されていません");
    }
    
    // defaultCompletionOptionsの検証
    if (!config.defaultCompletionOptions) {
      console.warn("警告: defaultCompletionOptionsが設定されていません、デフォルト値を使用します");
      config.defaultCompletionOptions = {};
    }
    
    // Claude 3.7固有の検証
    if (isClaudeSonnet37) {
      const options = config.defaultCompletionOptions;
      
      // 思考モードの設定
      if (!options.thinking) {
        console.warn("警告: Claude 3.7には思考モード設定が推奨されます、デフォルト値を使用します");
        options.thinking = { type: "auto", budget_tokens: 4000 };
      } else {
        if (!["auto", "enabled", "disabled"].includes(options.thinking.type)) {
          console.warn(`警告: 無効な思考モードタイプ "${options.thinking.type}", "auto"に設定します`);
          options.thinking.type = "auto";
        }
        
        if (typeof options.thinking.budget_tokens !== "number" || options.thinking.budget_tokens < 0) {
          console.warn(`警告: 無効な思考トークン予算 "${options.thinking.budget_tokens}", 4000に設定します`);
          options.thinking.budget_tokens = 4000;
        }
      }
      
      // ストリーミング設定の検証
      if (options.stream === undefined) {
        console.warn("警告: stream設定が未定義です、trueに設定します");
        options.stream = true;
      }
      
      // タイムアウト設定の検証
      if (options.timeout === undefined) {
        console.warn("警告: timeout設定が未定義です、300000msに設定します");
        options.timeout = 300000;
      } else if (typeof options.timeout !== "number" || options.timeout < 0) {
        console.warn(`警告: 無効なタイムアウト値 "${options.timeout}", 300000msに設定します`);
        options.timeout = 300000;
      }
    }
  }

  constructor(opts: LLMOptions) {
    console.log("Databricks constructor called with model:", opts.model);
    
    const modelName = opts.model;
    if (!modelName) {
      const error = new Error("No model specified for Databricks. Please include a model name in the options.");
      throw error;
    }
    
    console.log("Loading config for model:", modelName);
    const { modelConfig, globalConfig } = Databricks.loadConfigFromYaml(modelName);
    console.log("Loaded config:", { 
      apiKeyExists: !!modelConfig.apiKey, 
      endpoint: modelConfig.apiBase,
      defaultCompletionOptionsExist: !!modelConfig.defaultCompletionOptions
    });
    
    if (!modelConfig.apiKey || !modelConfig.apiBase) {
      const error = new Error(
        "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
      );
      throw error;
    }
    
    opts = {
      ...opts,
      apiKey: opts.apiKey ?? modelConfig.apiKey,
      apiBase: opts.apiBase ?? modelConfig.apiBase,
    };
    
    opts.apiBase = (opts.apiBase ?? "").replace(/\/+$/, "");
    console.log("Final apiBase after processing:", opts.apiBase);
    
    super(opts);
    
    this.modelConfig = modelConfig;
    this.globalConfig = globalConfig;
    
    this.initializeDebugSettings();
    
    this.writeDebugLog("Databricks constructor completed", undefined, "basic");
  }
  
  private initializeDebugSettings(): void {
    const debugEnabled = this.modelConfig?.defaultCompletionOptions?.debug?.enabled ?? false;
    const logPath = this.modelConfig?.defaultCompletionOptions?.debug?.logPath ?? "Desktop/databricks-debug.log";
    const logLevel = this.modelConfig?.defaultCompletionOptions?.debug?.logLevel ?? "basic";
    
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
    
    if (!isNode) {
      console.log("ブラウザ環境ではデバッグログを書き込めません");
      this.debugSettings = {
        enabled: false,
        logPath: "",
        logLevel: "none",
        logLevelValue: LogLevel.NONE
      };
      return;
    }
    
    try {
      const homeDir = os.homedir();
      const absoluteLogPath = path.isAbsolute(logPath) ? logPath : path.join(homeDir, logPath);
      const logDir = path.dirname(absoluteLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logLevelValue = this.logLevelMap[logLevel.toLowerCase()] ?? LogLevel.BASIC;
      
      this.debugSettings = {
        enabled: true,
        logPath: absoluteLogPath,
        logLevel: logLevel.toLowerCase(),
        logLevelValue: logLevelValue
      };
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      
      // モデル情報の取得
      const isClaudeModel = (this.modelConfig?.model || "").toLowerCase().includes("claude");
      const isClaudeSonnet37 = isClaudeModel && (
        (this.modelConfig?.model || "").toLowerCase().includes("claude-3-7") ||
        (this.modelConfig?.model || "").toLowerCase().includes("claude-3.7")
      );
      
      // モデル情報を含めた拡張ヘッダー
      const enhancedHeader = `=== デバッグログ開始: ${timestamp} ===
ログレベル: ${logLevel}
モデル: ${this.modelConfig?.model || "unknown"}
モデルタイプ: ${isClaudeModel ? "Claude" : "非Claude"}
Claude 3.7 Sonnet: ${isClaudeSonnet37 ? "はい" : "いいえ"}
思考モード: ${this.modelConfig?.defaultCompletionOptions?.thinking?.type || "undefined"}
思考トークン予算: ${this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || "undefined"}
ストリーミング: ${this.modelConfig?.defaultCompletionOptions?.stream !== undefined ? 
                 (this.modelConfig?.defaultCompletionOptions?.stream ? "有効" : "無効") : 
                 "未設定"}
タイムアウト: ${this.modelConfig?.defaultCompletionOptions?.timeout || "未設定"}

`;
      
      fs.writeFileSync(
        absoluteLogPath, 
        enhancedHeader,
        { encoding: "utf8" }
      );
      console.log(`デバッグログを開始: ${absoluteLogPath} (レベル: ${logLevel})`);
      
      this.writeRawDebugLog("デバッグ設定", {
        settings: this.debugSettings,
        model: this.modelConfig?.model,
        isClaudeModel,
        isClaudeSonnet37,
        thinking: this.modelConfig?.defaultCompletionOptions?.thinking
      });
      
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

  private writeDebugLog(message: string, obj?: any, level: string = "basic"): void {
    if (!this.debugSettings.enabled) return;
    
    const requestedLevel = this.logLevelMap[level] ?? LogLevel.BASIC;
    if (requestedLevel > this.debugSettings.logLevelValue) return;
    
    // コンテキスト情報を追加
    const isClaudeModel = (this.modelConfig?.model || "").toLowerCase().includes("claude");
    const isClaudeSonnet37 = isClaudeModel && (
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3-7") ||
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3.7")
    );
    
    const enhancedObj = obj ? {
      ...obj,
      _context: {
        timestamp: new Date().toISOString(),
        model: this.modelConfig?.model,
        isClaudeModel,
        isClaudeSonnet37
      }
    } : {
      _context: {
        timestamp: new Date().toISOString(),
        model: this.modelConfig?.model,
        isClaudeModel,
        isClaudeSonnet37
      }
    };
    
    this.writeRawDebugLog(message, enhancedObj);
  }
  
  private writeRawDebugLog(message: string, obj?: any): void {
    if (!this.debugSettings.enabled || !this.debugSettings.logPath) return;
    
    if (!isNode) return;
    
    try {
      const timestamp = new Date().toISOString();
      let logMessage = `[${timestamp}] ${message}`;
      
      if (obj !== undefined) {
        let objString;
        try {
          if (typeof obj === 'string') {
            objString = obj;
          } else {
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
      
      fs.appendFileSync(this.debugSettings.logPath, logMessage + "\n\n", { encoding: "utf8" });
    } catch (err) {
      console.error("ログファイル書き込みエラー:", err);
    }
  }

  private getTimeoutFromConfig(): number {
    const timeout = this.modelConfig?.defaultCompletionOptions?.timeout;
    if (typeof timeout === 'number' && timeout > 0) {
      this.writeDebugLog("タイムアウト設定を設定ファイルから読み込みました", { timeout }, "basic");
      return timeout;
    }
    
    this.writeDebugLog("デフォルトのタイムアウト設定を使用します", { timeout: 300000 }, "basic");
    return 300000;
  }

  private getInvocationUrl(): string {
    const url = (this.apiBase ?? "").replace(/\/+$/, "");
    console.log("Databricks adapter using URL:", url);
    this.writeDebugLog("Databricks adapter using URL:", url, "basic");
    return url;
  }

  protected _getHeaders(): { "Content-Type": string; Authorization: string; "api-key": string; } {
    const headers = super._getHeaders();
    
    const customHeaders = headers as any;
    
    customHeaders["Accept"] = "text/event-stream";
    
    if (!customHeaders["Content-Type"]) {
      customHeaders["Content-Type"] = "application/json";
    }
    
    console.log("送信ヘッダー:", customHeaders);
    this.writeDebugLog("送信ヘッダー:", customHeaders, "detailed");
    console.log("arg1 =", customHeaders);
    return headers;
  }

  private getEnableStreamingFromConfig(): boolean {
    if (this.modelConfig?.defaultCompletionOptions?.stream !== undefined) {
      console.log("Model-specific stream setting found:", this.modelConfig.defaultCompletionOptions.stream);
      this.writeDebugLog("Model-specific stream setting found:", this.modelConfig.defaultCompletionOptions.stream, "basic");
      return this.modelConfig.defaultCompletionOptions.stream;
    }
    
    if (this.globalConfig?.stream !== undefined) {
      console.log("Global stream setting found:", this.globalConfig.stream);
      this.writeDebugLog("Global stream setting found:", this.globalConfig.stream, "basic");
      return this.globalConfig.stream;
    }
    
    console.log("No stream setting found in config, using default: true");
    this.writeDebugLog("No stream setting found in config, using default: true", undefined, "basic");
    return true;
  }

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
    
    const enableStreaming = this.getEnableStreamingFromConfig();
    console.log("ストリーミングモード:", enableStreaming ? "有効" : "無効", "(設定ファイルから読み込み)");
    this.writeDebugLog("ストリーミングモード:", { 
      enabled: enableStreaming, 
      source: "設定ファイルから読み込み" 
    }, "basic");
    
    // 思考モードの設定を確認
    const isClaudeModel = (this.modelConfig?.model || "").toLowerCase().includes("claude");
    const isThinkingEnabled = options.reasoning || 
                            (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    const thinkingBudget = options.reasoningBudgetTokens || 
                          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
                          4000;
    
    if (isThinkingEnabled) {
      this.writeDebugLog("思考モード有効", { 
        budget: thinkingBudget,
        source: options.reasoning ? "options.reasoning" : "config.thinking.type",
        isClaudeModel: isClaudeModel
      }, "basic");
    }
    
    // Claudeモデルのバージョンを特定
    const isClaudeSonnet37 = isClaudeModel && (
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3-7") ||
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3.7")
    );
    
    this.writeDebugLog("モデル情報", {
      model: this.modelConfig?.model || options.model,
      isClaudeModel: isClaudeModel,
      isClaudeSonnet37: isClaudeSonnet37
    }, "basic");
    
    // 最大トークン数を設定（思考モードの場合は予算+余裕を持たせる）
    const maxTokens = Math.max(
      options.maxTokens ?? this.modelConfig?.defaultCompletionOptions?.maxTokens ?? 4096,
      isThinkingEnabled ? thinkingBudget + 1000 : 0
    );
    
    const finalOptions: any = {
      model: options.model || this.modelConfig?.model,
      temperature: options.temperature ?? this.modelConfig?.defaultCompletionOptions?.temperature ?? 0.7,
      max_tokens: maxTokens,
      stop: options.stop?.filter(x => x.trim() !== "") ?? this.modelConfig?.defaultCompletionOptions?.stop ?? [],
      stream: enableStreaming && (options.stream ?? true)
    };
    
    // Top-kとTop-pの設定（Claude 3.7の思考モードでは推奨されない）
    if (!isClaudeSonnet37 || !isThinkingEnabled) {
      finalOptions.top_k = options.topK ?? this.modelConfig?.defaultCompletionOptions?.topK ?? 100;
      finalOptions.top_p = options.topP ?? this.modelConfig?.defaultCompletionOptions?.topP ?? 0.95;
      
      if (isThinkingEnabled) {
        console.log("Note: Using top_k and top_p with thinking mode may affect performance");
        this.writeDebugLog("Note: Using top_k and top_p with thinking mode may affect performance", undefined, "basic");
      }
    } else {
      console.log("Omitting top_k and top_p parameters for Claude 3.7 with thinking enabled");
      this.writeDebugLog("Omitting top_k and top_p parameters for Claude 3.7 with thinking enabled", undefined, "basic");
    }
    
    // 思考モードのパラメータを追加（Claude 3.7用に最適化）
    if (isThinkingEnabled) {
      if (isClaudeSonnet37) {
        // Claude 3.7の正式なAPIフォーマット
        finalOptions.thinking = {
          type: "enabled",
          budget_tokens: thinkingBudget
        };
        console.log("Added Claude 3.7 thinking parameter with budget:", thinkingBudget);
        this.writeDebugLog("Added Claude 3.7 thinking parameter", {
          type: "enabled",
          budget_tokens: thinkingBudget
        }, "basic");
      } else {
        // 他のモデル用の互換モード
        finalOptions.thinking = {
          type: "enabled",
          budget_tokens: thinkingBudget
        };
        console.log("Added thinking parameter with budget:", thinkingBudget);
        this.writeDebugLog("Added thinking parameter with budget:", thinkingBudget, "basic");
      }
      
      console.log("Ensured max_tokens is greater than thinking budget:", maxTokens);
      this.writeDebugLog("Ensured max_tokens is greater than thinking budget:", maxTokens, "basic");
    }
    
    console.log("Final API parameters:", JSON.stringify(finalOptions, null, 2));
    this.writeDebugLog("Final API parameters:", finalOptions, "basic");
    
    return finalOptions;
  }

  private convertMessages(msgs: ChatMessage[]): any[] {
    console.log(`Converting ${msgs.length} messages to Databricks format`);
    this.writeDebugLog(`Converting ${msgs.length} messages to Databricks format`, undefined, "basic");
    
    const filteredMessages = msgs.filter(
      (m) => m.role !== "system" && !!m.content
    );
    
    const messages = filteredMessages.map((message) => {
      if (typeof message.content === "string") {
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      } else {
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

  private createEnhancedSystemMessage(
    options: CompletionOptions, 
    originalSystemMessage?: string
  ): string {
    let systemMessage = originalSystemMessage || "";
    
    const isClaudeModel = (this.modelConfig?.model || "").toLowerCase().includes("claude");
    const isClaudeSonnet37 = isClaudeModel && (
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3-7") ||
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3.7")
    );
    
    // Claude 3.7の場合は思考指示をシステムメッセージに含めない（API経由で制御）
    const enableThinking = options.reasoning || 
      (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    if (enableThinking && !isClaudeSonnet37) {
      // Claude 3.7以外のモデルの場合は従来通りシステムメッセージに指示を追加
      const budgetTokens = options.reasoningBudgetTokens || 
        this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
        4000;
      
      const thinkingInstructions = `\n\nI'd like you to solve this problem step-by-step, showing your reasoning process clearly. Take your time to think through this thoroughly before giving your final answer. Use up to ${budgetTokens} tokens to explore different approaches and ensure your solution is correct.`;
      
      systemMessage += thinkingInstructions;
      console.log("Added thinking instructions to system message for non-Claude 3.7 model");
      this.writeDebugLog("Added thinking instructions to system message", {
        forModel: "non-Claude 3.7",
        budgetTokens: budgetTokens
      }, "basic");
    } else if (enableThinking && isClaudeSonnet37) {
      console.log("Using Claude 3.7 native thinking capabilities via API parameters");
      this.writeDebugLog("Using Claude 3.7 native thinking capabilities", {
        method: "API parameters",
        systemMessageModified: false
      }, "basic");
    }
    
    this.writeDebugLog("Enhanced system message", { 
      length: systemMessage.length, 
      preview: systemMessage.substring(0, 100) + (systemMessage.length > 100 ? "..." : ""),
      modelIsClaudeSonnet37: isClaudeSonnet37,
      thinkingEnabled: enableThinking
    }, "detailed");
    
    return systemMessage;
  }

  // バッファからコンテンツを回復するためのヘルパーメソッド
  private tryRecoverContentFromBuffer(buffer: string): string | null {
    // バッファから有効なJSONを抽出する試み
    try {
      // JSONオブジェクトのパターンを検索
      const jsonPattern = /{[\s\S]*?}/g;
      const jsonMatches = buffer.match(jsonPattern);
      
      if (!jsonMatches || jsonMatches.length === 0) {
        return null;
      }
      
      // 最も長いJSONマッチを試行
      const sortedMatches = [...jsonMatches].sort((a, b) => b.length - a.length);
      
      for (const match of sortedMatches) {
        try {
          const json = JSON.parse(match);
          
          // 考えられるレスポンス形式をチェック
          if (json.choices && json.choices[0]?.message?.content) {
            return json.choices[0].message.content;
          }
          
          if (json.content && typeof json.content === "string") {
            return json.content;
          }
          
          if (json.content && Array.isArray(json.content) && json.content[0]?.text) {
            return json.content[0].text;
          }
          
          if (json.completion) {
            return json.completion;
          }
          
          if (json.thinking) {
            return "[思考プロセス] " + json.thinking;
          }
        } catch (e) {
          // この特定のマッチの解析に失敗 - 次を試す
          continue;
        }
      }
      
      // 特定のパターンに一致しない場合はプレーンテキストを抽出
      const textMatches = buffer.match(/\"text\":\s*\"([\s\S]*?)\"/g);
      if (textMatches && textMatches.length > 0) {
        // 最も長いテキストマッチを取得
        const longestTextMatch = [...textMatches].sort((a, b) => b.length - a.length)[0];
        const content = longestTextMatch.replace(/\"text\":\s*\"/, "").replace(/\"$/, "");
        return content;
      }
      
      return null;
    } catch (e) {
      console.error("バッファからのコンテンツ回復エラー:", e);
      return null;
    }
  }

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
    
    const convertedMessages = this.convertMessages(msgs);
    const originalSystemMessage = this.extractSystemMessage(msgs);
    this.writeDebugLog("Converted messages", { 
      convertedCount: convertedMessages.length,
      hasSystemMessage: !!originalSystemMessage
    }, "basic");
    
    const enhancedSystemMessage = this.createEnhancedSystemMessage(options, originalSystemMessage);
    
    const body = {
      ...this.convertArgs(options),
      messages: convertedMessages,
      system: enhancedSystemMessage
    };
    
    const enableStreaming = this.getEnableStreamingFromConfig();
    body.stream = enableStreaming && (body.stream !== false);
    this.writeDebugLog("ストリーミング設定", { enabled: body.stream }, "basic");
    
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
    
    const invocationUrl = this.getInvocationUrl();
    console.log("Sending request to:", invocationUrl);
    
    try {
      const timeout = this.getTimeoutFromConfig();
      
      const fetchOptions = {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
        timeout: timeout
      };
      
      console.log("タイムアウト設定:", `${timeout}ms`);
      this.writeDebugLog("タイムアウト設定", { timeoutMs: timeout }, "basic");
      
      const res = await this.fetch(invocationUrl, fetchOptions);
      
      console.log("Response status:", res.status);
      console.log("レスポンスヘッダー:", Object.fromEntries([...res.headers.entries()]));
      console.log("コンテンツタイプ:", res.headers.get("content-type"));
      
      this.writeDebugLog("Response received", { 
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type"),
        headers: Object.fromEntries([...res.headers.entries()])
      }, "basic");
      
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

      if (body.stream === false) {
        console.log("Non-streaming mode, processing single response");
        this.writeDebugLog("Non-streaming mode, processing single response", undefined, "basic");
        const jsonResponse = await res.json();
        console.log("Received complete response:", JSON.stringify(jsonResponse, null, 2));
        this.writeDebugLog("Received complete response", jsonResponse, "detailed");
        
        try {
          if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
            this.writeDebugLog("OpenAI形式のレスポンスを検出", { 
              content: jsonResponse.choices[0].message.content.substring(0, 100) + "..." 
            }, "basic");
            const message: ChatMessage = {
              role: "assistant",
              content: jsonResponse.choices[0].message.content
            };
            yield message;
          } else if (jsonResponse.content) {
            const contentValue = jsonResponse.content;
            this.writeDebugLog("直接コンテンツ形式のレスポンスを検出", { 
              contentType: typeof contentValue,
              isArray: Array.isArray(contentValue)
            }, "basic");
            if (typeof contentValue === "string") {
              const message: ChatMessage = {
                role: "assistant",
                content: contentValue
              };
              yield message;
            } else if (Array.isArray(contentValue)) {
              const textContent = contentValue.find(item => item.type === "text")?.text || 
                                 (contentValue[0] && contentValue[0].text) || 
                                 JSON.stringify(contentValue);
              const message: ChatMessage = {
                role: "assistant",
                content: textContent
              };
              yield message;
            } else {
              const message: ChatMessage = {
                role: "assistant",
                content: "複雑なレスポンス形式: " + JSON.stringify(contentValue)
              };
              yield message;
            }
          } else if (jsonResponse.completion) {
            this.writeDebugLog("Anthropic互換形式のレスポンスを検出", {
              completion: jsonResponse.completion.substring(0, 100) + "..."
            }, "basic");
            const message: ChatMessage = {
              role: "assistant",
              content: jsonResponse.completion
            };
            yield message;
          } else if (jsonResponse.message?.content) {
            this.writeDebugLog("別の形式のOpenAI互換レスポンスを検出", {
              content: jsonResponse.message.content.substring(0, 100) + "..."
            }, "basic");
            const message: ChatMessage = {
              role: "assistant",
              content: jsonResponse.message.content
            };
            yield message;
          } else {
            console.log("未知のレスポンス形式:", jsonResponse);
            this.writeDebugLog("未知のレスポンス形式", jsonResponse, "basic");
            const message: ChatMessage = {
              role: "assistant",
              content: "Response format not recognized: " + JSON.stringify(jsonResponse)
            };
            yield message;
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
      let rawBuffer = "";
      let thinkingContent = "";
      
      const parseSSE = (
        str: string,
      ): { done: boolean; messages: ChatMessage[] } => {
        buffer += str;
        const out: ChatMessage[] = [];
        
        // 思考出力のマーカーを検出するための正規表現
        const thinkingStartRegex = /^thinking:(.*)$/i;
        
        // バッファ全体がJSONオブジェクトである場合の処理
        if (buffer.trim() && !buffer.includes("\n")) {
          try {
            const trimmedBuffer = buffer.trim();
            // "data:" プレフィックスを処理
            const jsonStr = trimmedBuffer.startsWith("data:") ? 
                         trimmedBuffer.slice(trimmedBuffer.indexOf("{")) : 
                         trimmedBuffer;
            
            console.log("単一JSONの解析を試行:", jsonStr);
            this.writeDebugLog("単一JSONの解析を試行", jsonStr, "verbose");
            
            const json = JSON.parse(jsonStr);
            console.log("単一JSONを解析:", json);
            this.writeDebugLog("単一JSONを解析", json, "detailed");
            
            // 終了シグナルの検出
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
              this.writeDebugLog("終了シグナル検出（単一JSON）", json, "basic");
              buffer = "";
              return { done: true, messages: out };
            }
            
            // 完全なレスポンスの検出（OpenAI互換形式）
            if (json.choices && json.choices[0]?.message?.content) {
              console.log("OpenAI形式の完全なレスポンスを検出");
              this.writeDebugLog("OpenAI形式の完全なレスポンスを検出", { 
                content: json.choices[0].message.content.substring(0, 100) + "..." 
              }, "basic");
              const message: ChatMessage = {
                role: "assistant",
                content: json.choices[0].message.content
              };
              out.push(message);
              buffer = "";
              return { done: true, messages: out };
            }
            
            // Claude 3.7の思考出力形式の検出（単一JSON）
            if (json.thinking || (json.content && json.content[0]?.type === "reasoning")) {
              const thinkingContent = json.thinking || 
                                    (json.content && json.content[0]?.type === "reasoning" 
                                      ? json.content[0].summary?.[0]?.text || "" 
                                      : "");
              
              if (thinkingContent) {
                console.log("Claude 3.7の思考出力を検出 (単一JSON)");
                this.writeDebugLog("Claude 3.7の思考出力を検出 (単一JSON)", {
                  contentLength: thinkingContent.length,
                  preview: thinkingContent.substring(0, 100) + "..."
                }, "basic");
                
                const message: ThinkingChatMessage = {
                  role: "assistant",
                  content: "[思考中...] " + thinkingContent,
                  finish_reason: "thinking"
                };
                out.push(message);
                buffer = "";
                return { done: false, messages: out };
              }
            }
          } catch (e) {
            console.log("単一JSON解析エラー、行解析に切り替え:", e);
            this.writeDebugLog("単一JSON解析エラー、行解析に切り替え", { 
              error: (e as Error).message, 
              buffer: buffer.substring(0, 200) + "..."
            }, "basic");
          }
        }
        
        // 行ごとの処理
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          
          console.log("処理中の行:", line);
          this.writeDebugLog("処理中の行", line, "verbose");
          
          if (!line) continue;
          
          // "data:" プレフィックスの処理
          if (!line.startsWith("data:") && !line.startsWith("data: ")) {
            // Claude 3.7の思考出力マーカーの検出
            const thinkingMatch = line.match(thinkingStartRegex);
            if (thinkingMatch) {
              const thinkingContent = thinkingMatch[1].trim();
              console.log("Claude 3.7の思考マーカーを検出:", thinkingContent);
              this.writeDebugLog("Claude 3.7の思考マーカーを検出", {
                content: thinkingContent.substring(0, 100) + (thinkingContent.length > 100 ? "..." : "")
              }, "basic");
              
              const message: ThinkingChatMessage = {
                role: "assistant",
                content: "[思考中...] " + thinkingContent,
                finish_reason: "thinking"
              };
              out.push(message);
              continue;
            }
            
            console.log("data:プレフィックスのない行をスキップ:", line);
            this.writeDebugLog("data:プレフィックスのない行をスキップ", line, "verbose");
            continue;
          }
          
          const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();
          
          if (data === "[DONE]") {
            console.log("Received [DONE] marker");
            this.writeDebugLog("Received [DONE] marker - ending stream", undefined, "basic");
            return { done: true, messages: out };
          }
          
          try {
            const json = JSON.parse(data);
            console.log("Received SSE data:", JSON.stringify(json, null, 2));
            this.writeDebugLog("Parsed SSE JSON data", {
              dataType: typeof json,
              hasThinking: !!(json.thinking || (json.content && json.content[0]?.type === "reasoning")),
              messageType: json.type,
              complete: json.done === true || json.choices?.[0]?.finish_reason === "stop"
            }, "detailed");
            
            // 終了シグナルの検出
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
              this.writeDebugLog("終了シグナル検出", json, "basic");
              return { done: true, messages: out };
            }
            
            // Claude 3.7の思考出力の処理
            if (json.thinking || (json.content && json.content[0]?.type === "reasoning")) {
              console.log("思考出力を検出");
              let newThinkingContent = "";
              
              if (json.thinking) {
                newThinkingContent = json.thinking;
              } else if (json.content && json.content[0]?.type === "reasoning") {
                newThinkingContent = json.content[0].summary?.[0]?.text || "";
              }
              
              if (newThinkingContent) {
                thinkingContent += newThinkingContent;
                
                console.log("\n==== THINKING OUTPUT ====");
                console.log(newThinkingContent);
                console.log("========================\n");
                
                this.writeDebugLog("Claude 3.7思考出力を検出", {
                  format: json.thinking ? "direct" : "content",
                  contentLength: newThinkingContent.length,
                  preview: newThinkingContent.substring(0, 100) + "..."
                }, "basic");
                
                const message: ThinkingChatMessage = {
                  role: "assistant",
                  content: "[思考中...] " + newThinkingContent,
                  finish_reason: "thinking"
                };
                out.push(message);
              }
            }
            else if (json.type === "content_block_delta" && json.delta?.text) {
              console.log("Anthropic形式のデルタを検出");
              this.writeDebugLog("Anthropic形式のデルタを検出", {
                text: json.delta.text
              }, "detailed");
              const message: ChatMessage = {
                role: "assistant",
                content: json.delta.text
              };
              out.push(message);
            }
            else if (json.choices && json.choices[0]?.delta?.content) {
              console.log("OpenAI形式のデルタを検出");
              this.writeDebugLog("OpenAI形式のデルタを検出", {
                content: json.choices[0].delta.content
              }, "detailed");
              const message: ChatMessage = {
                role: "assistant",
                content: json.choices[0].delta.content
              };
              out.push(message);
            }
            else if (json.content && typeof json.content === "string") {
              console.log("直接content形式を検出");
              this.writeDebugLog("直接content形式を検出", {
                content: json.content.substring(0, 100) + "..."
              }, "detailed");
              const message: ChatMessage = {
                role: "assistant",
                content: json.content
              };
              out.push(message);
            }
            else if (json.content && Array.isArray(json.content) && json.content[0]?.text) {
              console.log("コンテンツ配列形式を検出");
              this.writeDebugLog("コンテンツ配列形式を検出", {
                text: json.content[0].text.substring(0, 100) + "..."
              }, "detailed");
              const message: ChatMessage = {
                role: "assistant",
                content: json.content[0].text
              };
              out.push(message);
            }
            else if (json.text) {
              console.log("直接テキスト形式を検出");
              this.writeDebugLog("直接テキスト形式を検出", {
                text: json.text.substring(0, 100) + "..."
              }, "detailed");
              const message: ChatMessage = {
                role: "assistant",
                content: json.text
              };
              out.push(message);
            }
            else {
              const delta = fromChatCompletionChunk(json);
              if (delta?.content) {
                console.log("OpenAI形式のチャンクからコンテンツを抽出");
                this.writeDebugLog("OpenAI形式のチャンクからコンテンツを抽出", {
                  content: delta.content
                }, "detailed");
                const message: ChatMessage = {
                  role: "assistant",
                  content: delta.content
                };
                out.push(message);
              } else {
                console.log("不明なJSON形式:", json);
                this.writeDebugLog("不明なJSON形式", json, "basic");
              }
            }
          } catch (e) {
            console.log("SSEストリームでJSON解析エラー:", e);
            this.writeDebugLog("SSEストリームでJSON解析エラー", { 
              error: (e as Error).message, 
              line: line
            }, "basic");
            
            // エラーが発生しても処理を継続
            continue;
          }
        }
        return { done: false, messages: out };
      };
      
      if (typeof (res.body as any).getReader === "function") {
        console.log("Using WHATWG streams reader");
        this.writeDebugLog("Using WHATWG streams reader", undefined, "basic");
        const reader = (res.body as any).getReader();
        
        const startTime = Date.now();
        let chunkCount = 0;
        
        const streamTimeout = this.getTimeoutFromConfig();
        let lastActivityTimestamp = Date.now();
        
        while (true) {
          try {
            const { done, value } = await reader.read();
            
            // 活動の記録を更新
            lastActivityTimestamp = Date.now();
            
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
            
            const chunkSize = value ? value.length : 0;
            console.log(`[${elapsedSec}s] 受信したチャンク（バイト）:`, value ? 
              Array.from(new Uint8Array(value as ArrayBuffer)).map((b: number) => b.toString(16)).join(' ') : 
              'null');
            this.writeDebugLog(`[${elapsedSec}s] チャンク#${chunkCount}受信`, { 
              sizeBytes: chunkSize
            }, "detailed");
            
            const decodedChunk = decoder.decode(value as Uint8Array, { stream: true });
            rawBuffer += decodedChunk;
            console.log(`[${elapsedSec}s] 受信したチャンク（テキスト）:`, decodedChunk);
            this.writeDebugLog(`チャンク#${chunkCount}デコード`, { 
              text: decodedChunk,
              length: decodedChunk.length
            }, "verbose");
            
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
              const contentLength = typeof m.content === 'string' ? m.content.length : 'not-string';
              this.writeDebugLog("UIにメッセージを送信", { 
                role: m.role,
                contentLength: contentLength,
                finished: end
              }, "basic");
              yield m;
            }
            
            if (end) {
              console.log("ストリーム終了マーカーを検出");
              this.writeDebugLog("ストリーム終了マーカーを検出 - ループを終了します", undefined, "basic");
              
              const message: ChatMessage = {
                role: "assistant",
                content: ""
              };
              yield message;
              
              return;
            }
          } catch (chunkError) {
            console.error("チャンク読み取りエラー:", chunkError);
            this.writeDebugLog("チャンク読み取りエラー", { 
              error: (chunkError as Error).message, 
              stack: (chunkError as Error).stack 
            }, "basic");
            
            // ストリーム中断からの回復を試みる
            // 一定時間アクティビティがない場合は処理を中止
            if (Date.now() - lastActivityTimestamp > 10000) {
              console.log("ストリーム活動なし - 回復不可能として処理を終了");
              this.writeDebugLog("ストリーム活動なし - 回復不可能", {
                timeSinceLastActivity: Date.now() - lastActivityTimestamp,
                totalChunks: chunkCount
              }, "basic");
              
              // 最良の努力で部分的な結果を返す
              const message: ChatMessage = {
                role: "assistant",
                content: "[ストリーム中断] 部分的な応答: " + 
                        (thinkingContent ? "\n\n[思考プロセス]\n" + thinkingContent.substring(0, 1000) + "..." : "")
              };
              yield message;
              return;
            }
            
            // 短時間待機して再試行
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
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
        
        console.log("完全な受信データ:", rawBuffer);
        this.writeDebugLog("完全な受信データサイズ", { 
          bytes: rawBuffer.length,
          approximateTokens: Math.round(rawBuffer.length / 4)
        }, "basic");
        return;
      }
      
      console.log("Using Node.js Readable stream");
      this.writeDebugLog("Using Node.js Readable stream", undefined, "basic");
      
      const startTime = Date.now();
      let chunkCount = 0;
      
      const streamTimeout = this.getTimeoutFromConfig();
      let lastActivityTimestamp = Date.now();
      
      try {
        for await (const chunk of res.body as any) {
          try {
            chunkCount++;
            
            // 活動の記録を更新
            lastActivityTimestamp = Date.now();
            
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (Date.now() - startTime > streamTimeout) {
              this.writeDebugLog("ストリーム処理がタイムアウトしました - 強制終了します", {
                elapsedMs: Date.now() - startTime,
                totalChunks: chunkCount,
                timeoutMs: streamTimeout
              }, "basic");
              return;
            }
            
            console.log(`[${elapsedSec}s] 受信したチャンク（バイト）:`, typeof chunk === 'object' ? '(バイナリデータ)' : chunk);
            this.writeDebugLog(`[${elapsedSec}s] チャンク#${chunkCount}受信`, { 
              type: typeof chunk,
              isBuffer: Buffer && Buffer.isBuffer ? Buffer.isBuffer(chunk) : false,
              size: chunk.length || 0
            }, "detailed");
            
            const decodedChunk = decoder.decode(chunk as Buffer, { stream: true });
            rawBuffer += decodedChunk;
            console.log(`[${elapsedSec}s] 受信したチャンク（テキスト）:`, decodedChunk);
            this.writeDebugLog(`チャンク#${chunkCount}デコード`, { 
              text: decodedChunk,
              length: decodedChunk.length
            }, "verbose");
            
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
              const contentLength = typeof m.content === 'string' ? m.content.length : 'not-string';
              this.writeDebugLog("UIにメッセージを送信", { 
                role: m.role,
                contentLength: contentLength,
                finished: done
              }, "basic");
              yield m;
            }
            
            if (done) {
              console.log("ストリーム終了マーカーを検出");
              this.writeDebugLog("ストリーム終了マーカーを検出 - ループを終了します", undefined, "basic");
              
              const message: ChatMessage = {
                role: "assistant",
                content: ""
              };
              yield message;
              
              return;
            }
          } catch (e) {
            console.error("チャンク処理中のエラー:", e);
            this.writeDebugLog("チャンク処理中のエラー", { 
              error: (e as Error).message, 
              stack: (e as Error).stack 
            }, "basic");
            
            // ストリーム中断からの回復を試みる
            // 一定時間アクティビティがない場合は処理を中止
            if (Date.now() - lastActivityTimestamp > 10000) {
              console.log("ストリーム活動なし - 回復不可能として処理を終了");
              this.writeDebugLog("ストリーム活動なし - 回復不可能", {
                timeSinceLastActivity: Date.now() - lastActivityTimestamp,
                totalChunks: chunkCount
              }, "basic");
              
              // 最良の努力で部分的な結果を返す
              const message: ChatMessage = {
                role: "assistant",
                content: "[ストリーム中断] 部分的な応答: " + 
                        (thinkingContent ? "\n\n[思考プロセス]\n" + thinkingContent.substring(0, 1000) + "..." : "")
              };
              yield message;
              return;
            }
            
            // 短時間待機して再試行
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
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
        
        // エラーからの回復処理
        this.writeDebugLog("ストリーム処理中の重大なエラー - 回復を試みます", {
          errorType: (streamError as Error).name,
          bufferSize: buffer.length,
          rawBufferSize: rawBuffer.length
        }, "basic");
        
        // バッファに内容があれば解析して返す
        if (rawBuffer && rawBuffer.trim()) {
          try {
            console.log("エラー発生後にバッファーからの回復を試みます");
            const recoveredContent = this.tryRecoverContentFromBuffer(rawBuffer);
            if (recoveredContent) {
              const message: ChatMessage = {
                role: "assistant",
                content: recoveredContent
              };
              yield message;
            }
          } catch (recoveryError) {
            console.error("回復処理中のエラー:", recoveryError);
          }
        }
        
        throw streamError;
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