// VSCode API初期化の安全な実装 - Node.js環境とブラウザ環境の区別を強化
let vscodeApi: any = undefined;

// Node.js環境かどうかの検出を強化
const isNode = typeof process !== 'undefined' && 
               typeof process.versions !== 'undefined' && 
               typeof process.versions.node !== 'undefined';

// ブラウザ環境の場合のみwindowオブジェクトを参照
if (!isNode) {
  try {
    if (typeof window !== 'undefined') {
      // windowオブジェクトを安全に参照
      const win = window as any;
      
      // vscodeオブジェクトが存在する場合はそれを使用
      if (win.vscode) {
        vscodeApi = win.vscode;
      } 
      // acquireVsCodeApi関数が存在する場合はそれを呼び出す
      else if (typeof win.acquireVsCodeApi === 'function') {
        try {
          // 直接name属性を変更せず、関数を実行結果を取得
          vscodeApi = win.acquireVsCodeApi();
        } catch (apiError) {
          console.warn("Error calling acquireVsCodeApi:", apiError);
        }
      }
    }
  } catch (e) {
    console.warn("Error initializing VSCode API in browser environment:", e);
  }
}

import OpenAI from "./OpenAI";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelCapability,
} from "../../index";
import { ThinkingContent } from "../llms/index";
import { fromChatCompletionChunk } from "../openaiTypeConverters";
import { stripImages } from "../../util/messageContent";
import DatabricksThinking from "./DatabricksThinking";
import { registerThinkingPanel, updateThinking, thinkingCompleted } from './thinkingPanel';
import { setExtensionContext, getExtensionContext } from './index';
import { 
  normalizePath, 
  safeReadFile, 
  readFirstAvailableFile, 
  getDebugConfigPath,
  safeJoinPath
} from '../../util/paths';
import { parseAssistant } from '../../config/yaml/models';

// Node.js環境での必要なモジュール読み込み
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
    console.error("Error loading Node.js modules:", error);
  }
} else {
  // ブラウザ環境用のスタブ実装
  fs = {
    existsSync: () => false,
    readFileSync: () => '',
    writeFileSync: () => undefined,
    appendFileSync: () => undefined,
    mkdirSync: () => undefined,
    statSync: () => ({ isDirectory: () => false })
  };
  path = {
    join: (...args: string[]) => args.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
    isAbsolute: (p: string) => p.startsWith('/') || /^[A-Za-z]:[\\\/]/.test(p),
    resolve: (...args: string[]) => args.join('/')
  };
  os = { homedir: () => '/' };
  yaml = { load: () => ({}) };
}

type AssistantChatMessage = ChatMessage & { finish_reason?: string; };
type ThinkingChatMessage = ChatMessage & {
  finish_reason?: string;
  thinking_metadata?: {
    phase: string;
    progress: number;
    formatted_text?: string;
  };
  isThinking?: boolean;
};

interface ThinkingContentBlock { type: "thinking"; thinking: string; }
interface RedactedThinkingContentBlock { type: "redacted_thinking"; }
interface TextContentBlock { type: "text"; text: string; }
interface ToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string; };
}
interface ToolResponse {
  toolCallId: string;
  role: string;
  content: string;
}
type ContentBlock = ThinkingContentBlock | RedactedThinkingContentBlock | TextContentBlock;
interface StreamEvent {
  type: "content_block_start" | "content_block_delta" | "content_block_stop" | "message_delta" | "message_stop";
  content_block?: {
    type: "thinking" | "redacted_thinking" | "text";
    thinking?: string;
  };
  delta?: {
    type: "thinking_delta" | "text_delta";
    thinking?: string;
    text?: string;
  };
  message?: { content?: ContentBlock[]; };
}

// エクスポート
export { registerThinkingPanel, updateThinking, thinkingCompleted, setExtensionContext, getExtensionContext };

export default class Databricks extends OpenAI {
  static providerName = "databricks";
  private modelConfig: any = null;
  private globalConfig: any = null;
  capabilities: ModelCapability = {
    tools: true,
    uploadImage: false
  };
  
  private maxRetryAttempts: number = 5; // 最大リトライ回数
  private backoffFactor: number = 1.5; // 指数バックオフの係数
  private thinking: DatabricksThinking;
  
  private static loadConfigFromYaml(modelName: string): any {
    if (!isNode) {
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
      // 開発モードかどうかを確認
      const isDevMode = process.env.NODE_ENV === "development";
      console.log(`Current mode: ${isDevMode ? "development" : "production"}`);
      
      // 環境に合わせた設定パスを取得
      let homeDir = "";
      try {
        homeDir = os.homedir();
        if (!homeDir) {
          console.warn("Home directory path is empty, using fallback.");
          homeDir = process.env.HOME || process.env.USERPROFILE || "/";
        }
      } catch (e) {
        console.error("Error getting home directory:", e);
        homeDir = process.env.HOME || process.env.USERPROFILE || "/";
      }
      
      // 1. デバッグモードの場合はデバッグ用の設定ファイルを試す
      if (isDevMode) {
        const debugConfigPath = getDebugConfigPath('config');
        if (debugConfigPath && fs.existsSync(debugConfigPath)) {
          console.log(`Using debug config from: ${debugConfigPath}`);
          const fileContents = fs.readFileSync(debugConfigPath, "utf8");
          const parsed = yaml.load(fileContents) as any;
          const globalConfig = parsed;
          
          if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
            const modelConfig = (parsed.models as any[]).find(
              (m) => m.provider === "databricks" && m.model === modelName
            );
            
            if (modelConfig) {
              const isClaudeModel = DatabricksThinking.isClaudeModel(modelConfig.model);
              const isClaudeSonnet37 = DatabricksThinking.isClaudeSonnet37(modelConfig.model);
              
              if (isClaudeSonnet37) {
                DatabricksThinking.initializeModelConfig(modelConfig);
              }
              
              Databricks.validateModelConfig(modelConfig, isClaudeSonnet37);
              
              if (modelConfig && typeof modelConfig.apiKey === "string" && typeof modelConfig.apiBase === "string") {
                return { modelConfig, globalConfig };
              }
            }
          }
        }
      }
      
      // 2. 通常の設定ファイルを試す
      let configPath;
      try {
        configPath = safeJoinPath(homeDir, ".continue", "config.yaml");
      } catch (e) {
        console.error("Error joining config path:", e);
        // フォールバックとして直接パスを構築
        configPath = homeDir + "/.continue/config.yaml";
      }
      
      console.log("Checking standard config at:", configPath);
      
      if (configPath && fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        const globalConfig = parsed;
        
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          const modelConfig = (parsed.models as any[]).find(
            (m) => m.provider === "databricks" && m.model === modelName
          );
          
          if (modelConfig) {
            const isClaudeModel = DatabricksThinking.isClaudeModel(modelConfig.model);
            const isClaudeSonnet37 = DatabricksThinking.isClaudeSonnet37(modelConfig.model);
            
            if (isClaudeSonnet37) {
              DatabricksThinking.initializeModelConfig(modelConfig);
            }
            
            Databricks.validateModelConfig(modelConfig, isClaudeSonnet37);
            
            if (modelConfig && typeof modelConfig.apiKey === "string" && typeof modelConfig.apiBase === "string") {
              return { modelConfig, globalConfig };
            }
          }
        }
      }
      
      // 3. MCPサーバー設定ファイルからの読み込みを試みる
      console.log("Checking MCP server configurations...");
      try {
        // MCP設定を探すパスの準備（優先順位順）
        const searchPaths = [];
        
        // デバッグモードの場合はデバッグ用の設定を優先
        if (isDevMode) {
          const debugMcpPath = getDebugConfigPath('mcpServer');
          if (debugMcpPath) {
            try {
              const stats = fs.statSync(debugMcpPath);
              if (stats.isDirectory()) {
                let databricksPath;
                try {
                  databricksPath = safeJoinPath(debugMcpPath, "databricks.yaml");
                } catch (e) {
                  console.error("Error joining debug databricks path:", e);
                  databricksPath = debugMcpPath + "/databricks.yaml";
                }
                console.debug(`[PATH DEBUG] Debug databricks path: ${databricksPath}`);
                if (databricksPath) {
                  searchPaths.push(databricksPath);
                }
              } else {
                searchPaths.push(debugMcpPath);
              }
            } catch (e) {
              console.error("Error checking debug MCP path:", e);
            }
          }
        }
        
        // 標準の設定パスを追加
        let homeMcpServerDir;
        try {
          homeMcpServerDir = safeJoinPath(homeDir, ".continue", "mcpServers");
        } catch (e) {
          console.error("Error joining MCP server directory path:", e);
          homeMcpServerDir = homeDir + "/.continue/mcpServers";
        }
        
        let homeDatabricksPath;
        try {
          homeDatabricksPath = safeJoinPath(homeMcpServerDir, "databricks.yaml");
        } catch (e) {
          console.error("Error joining home databricks path:", e);
          homeDatabricksPath = homeMcpServerDir + "/databricks.yaml";
        }
        
        if (homeDatabricksPath) {
          searchPaths.push(homeDatabricksPath);
        }
        
        // プロジェクトルートの設定を追加
        const cwdPath = process.cwd();
        console.debug(`[PATH DEBUG] Current working directory: ${cwdPath}`);
        
        // ルートパスからの設定パスを追加
        if (cwdPath) {
          let cwdMcpServerPath;
          try {
            cwdMcpServerPath = safeJoinPath(cwdPath, ".continue", "mcpServers", "databricks.yaml");
          } catch (e) {
            console.error("Error joining CWD MCP server path:", e);
            cwdMcpServerPath = cwdPath + "/.continue/mcpServers/databricks.yaml";
          }
          
          if (cwdMcpServerPath) {
            searchPaths.push(cwdMcpServerPath);
          }
        }
        
        // 検索パスを表示（詳細情報付き）
        console.log("Searching for MCP server config in the following paths:");
        searchPaths.forEach((p, i) => {
          if (!p) {
            console.log(`  ${i + 1}. [Invalid path]`);
            return;
          }
          
          const hasDrive = path.isAbsolute(p);
          const hasDoubleDrive = /[A-Za-z]:[\\\/].*[A-Za-z]:[\\\/]/i.test(p);
          console.log(`  ${i + 1}. ${p} (Absolute: ${hasDrive ? 'Yes' : 'No'}, Double drive: ${hasDoubleDrive ? '⚠️ YES!' : 'No'})`);
        });
        
        // 無効なパスを除去
        const validSearchPaths = searchPaths.filter(p => p);
        
        // 最初に見つかったファイルを読み込む
        const mcpConfig = validSearchPaths.length > 0 ? readFirstAvailableFile(validSearchPaths) : null;
        
        if (mcpConfig) {
          console.log(`Found MCP server config at: ${mcpConfig.path}`);
          const mcpYaml = yaml.load(mcpConfig.content);
          
          if (mcpYaml) {
            // MCPサーバー設定からモデル設定を構築
            const modelConfig = {
              apiKey: mcpYaml.api_token || process.env.DATABRICKS_TOKEN,
              apiBase: mcpYaml.serving_endpoint || mcpYaml.host,
              model: modelName,
              provider: "databricks",
              capabilities: ["tool_use", "image_input"],
              defaultCompletionOptions: {
                thinking: {
                  type: "enabled",
                  budget_tokens: 16000
                },
                stepByStepThinking: true,
                stream: true,
                maxTokens: 100000,
                timeout: 600000 // 10分
              }
            };
            
            // モデル設定を検証
            const isClaudeSonnet37 = DatabricksThinking.isClaudeSonnet37(modelName);
            Databricks.validateModelConfig(modelConfig, isClaudeSonnet37);
            
            return { modelConfig, globalConfig: null };
          }
        }
      } catch (e) {
        console.warn("Error loading MCP server config:", e);
      }
      
      // 4. 環境変数からの読み込み（最終フォールバック）
      const pat = process.env.DATABRICKS_TOKEN;
      const base = process.env.YOUR_DATABRICKS_URL;
      if (pat && base) {
        console.log("Using Databricks configuration from environment variables");
        
        // 環境変数からモデル設定を構築
        const modelConfig = {
          apiKey: pat,
          apiBase: base,
          model: modelName,
          provider: "databricks",
          defaultCompletionOptions: {
            thinking: {
              type: "enabled",
              budget_tokens: 16000
            },
            stepByStepThinking: true,
            stream: true,
            maxTokens: 100000,
            timeout: 600000
          }
        };
        
        // モデル設定を検証
        const isClaudeSonnet37 = DatabricksThinking.isClaudeSonnet37(modelName);
        Databricks.validateModelConfig(modelConfig, isClaudeSonnet37);
        
        return { modelConfig, globalConfig: null };
      }
      
      // 5. すべてのオプションが失敗した場合、デフォルト設定を使用
      console.warn("No configuration found, using default Databricks configuration");
      const defaultConfig = parseAssistant(null);
      
      // デフォルト設定を検証
      Databricks.validateModelConfig(defaultConfig, true);
      
      return {
        modelConfig: {
          apiKey: "",
          apiBase: "",
          model: modelName,
          ...defaultConfig
        },
        globalConfig: null
      };
      
    } catch (error) {
      console.error("Error loading config from YAML:", error);
      
      // エラー発生時もデフォルト設定を提供
      const defaultConfig = parseAssistant(null);
      
      return {
        modelConfig: {
          apiKey: "",
          apiBase: "",
          model: modelName,
          ...defaultConfig
        },
        globalConfig: null
      };
    }
  }

  /**
   * モデル設定のバリデーション（強化版）
   */
  private static validateModelConfig(config: any, isClaudeSonnet37: boolean): void {
    if (!config) {
      console.warn("Empty model config, creating default configuration");
      config = parseAssistant(null);
      return;
    }
    
    // 必須パラメータの確認と警告
    if (!config.apiKey) {
      console.warn("Missing required 'apiKey' in model config");
    }
    
    if (!config.apiBase) {
      console.warn("Missing required 'apiBase' in model config");
    }
    
    // デフォルト設定のチェックと初期化
    if (!config.defaultCompletionOptions) {
      config.defaultCompletionOptions = {};
    }
    
    // 思考設定のチェックと初期化
    if (!config.defaultCompletionOptions.thinking) {
      config.defaultCompletionOptions.thinking = {
        type: "enabled",
        budget_tokens: 16000
      };
    } else if (typeof config.defaultCompletionOptions.thinking === 'object') {
      // 部分的な設定の場合は不足部分を補完
      const thinking = config.defaultCompletionOptions.thinking;
      if (!thinking.type) thinking.type = 'enabled';
      if (!thinking.budget_tokens) thinking.budget_tokens = 16000;
    } else {
      // オブジェクトでない場合は完全に置き換え
      config.defaultCompletionOptions.thinking = {
        type: 'enabled',
        budget_tokens: 16000
      };
    }
    
    // ステップバイステップ思考のデフォルト値
    if (config.defaultCompletionOptions.stepByStepThinking === undefined) {
      config.defaultCompletionOptions.stepByStepThinking = true;
    }
    
    // ケイパビリティのチェックと初期化
    if (!config.capabilities) {
      config.capabilities = ["tool_use", "image_input"];
    } else if (!Array.isArray(config.capabilities)) {
      const newCapabilities: string[] = [];
      
      if (config.capabilities.agent || config.capabilities.toolUse) {
        newCapabilities.push("tool_use");
      }
      if (config.capabilities.edit) {
        newCapabilities.push("edit");
      }
      if (config.capabilities.chat) {
        newCapabilities.push("chat");
      }
      if (config.capabilities.imageInput || config.capabilities.image) {
        newCapabilities.push("image_input");
      }
      
      config.capabilities = newCapabilities;
    }
    
    // Claude 3.7 Sonnet特有の設定
    if (isClaudeSonnet37) {
      const options = config.defaultCompletionOptions;
      
      // ストリーミング設定のデフォルト値
      if (options.stream === undefined) {
        options.stream = true;
      }
      
      // タイムアウト設定のデフォルト値
      if (options.timeout === undefined) {
        options.timeout = 600000; // 10分
      } else if (typeof options.timeout !== "number" || options.timeout < 0) {
        options.timeout = 600000;
      }
      
      // 最大トークン数のデフォルト値
      if (options.maxTokens === undefined) {
        options.maxTokens = 100000;
      }
    }
  }

  constructor(opts: LLMOptions) {
    const modelName = opts.model;
    if (!modelName) {
      throw new Error("No model specified for Databricks. Please include a model name in the options.");
    }
    
    try {
      // 設定読み込み
      const { modelConfig, globalConfig } = Databricks.loadConfigFromYaml(modelName);
      
      if (!modelConfig.apiKey || !modelConfig.apiBase) {
        throw new Error(
          "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml or mcpServers/databricks.yaml."
        );
      }
      
      opts = {
        ...opts,
        apiKey: opts.apiKey ?? modelConfig.apiKey,
        apiBase: opts.apiBase ?? modelConfig.apiBase,
        capabilities: {
          tools: Array.isArray(modelConfig.capabilities) ? 
                modelConfig.capabilities.includes("tool_use") : 
                true,
          uploadImage: Array.isArray(modelConfig.capabilities) ? 
                     modelConfig.capabilities.includes("image_input") : 
                     false
        }
      };
      
      // APIベースURLの末尾のスラッシュを削除
      opts.apiBase = (opts.apiBase ?? "").replace(/\/+$/, "");
      
      super(opts);
      
      this.modelConfig = modelConfig;
      this.globalConfig = globalConfig;
      this.thinking = new DatabricksThinking(modelConfig);
      
      // ケイパビリティの検出
      this.detectModelCapabilities();
    } catch (error) {
      console.error("Error during Databricks initialization:", error);
      throw error;
    }
  }
  
  /**
   * モデルのケイパビリティを検出して設定する
   */
  private detectModelCapabilities(): void {
    // モデル名からClaude 3.7 Sonnetを検出
    const isClaudeModel = DatabricksThinking.isClaudeModel(this.modelConfig?.model);
    const isClaudeSonnet37 = DatabricksThinking.isClaudeSonnet37(this.modelConfig?.model);
    
    if (isClaudeSonnet37) {
      // Claude 3.7 Sonnetは常にツール使用をサポート
      this.capabilities.tools = true;
      
      // モデル設定からイメージ入力サポートを検出
      const supportsImageInput = Array.isArray(this.modelConfig?.capabilities) && 
                               this.modelConfig.capabilities.includes("image_input");
      
      this.capabilities.uploadImage = supportsImageInput;
      
      console.log(`Detected Claude 3.7 Sonnet model. Capabilities: tools=${this.capabilities.tools}, uploadImage=${this.capabilities.uploadImage}`);
    }
  }

  private getTimeoutFromConfig(): number {
    const timeout = this.modelConfig?.defaultCompletionOptions?.timeout;
    if (typeof timeout === 'number' && timeout > 0) {
      return timeout;
    }
    return 600000; // デフォルト10分
  }

  private getInvocationUrl(): string {
    return (this.apiBase ?? "").replace(/\/+$/, "");
  }

  protected _getHeaders(): { "Content-Type": string; Authorization: string; "api-key": string; } {
    const headers = super._getHeaders();
    const customHeaders = headers as any;
    customHeaders["Accept"] = "text/event-stream";
    
    if (!customHeaders["Content-Type"]) {
      customHeaders["Content-Type"] = "application/json";
    }
    
    return headers;
  }

  private getEnableStreamingFromConfig(): boolean {
    if (this.modelConfig?.defaultCompletionOptions?.stream !== undefined) {
      return this.modelConfig.defaultCompletionOptions.stream;
    }
    
    if (this.globalConfig?.stream !== undefined) {
      return this.globalConfig.stream;
    }
    
    return true; // デフォルトはストリーミング有効
  }

  private static convertToolDefinitionsForDatabricks(tools: any[]): any[] {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return [];
    }
    
    return tools.map(tool => {
      if (!tool) return null;
      
      return {
        type: "function",
        function: {
          name: tool.name || tool.function?.name || "unknown_function",
          description: tool.description || tool.function?.description || "",
          parameters: tool.parameters || tool.function?.parameters || {}
        }
      };
    }).filter(Boolean); // nullを除外
  }

  private convertArgs(options: CompletionOptions): any {
    const enableStreaming = this.getEnableStreamingFromConfig();
    
    // リクエストオプションの構築を思考クラスに委譲
    const {
      isThinkingEnabled,
      thinkingOptions,
      finalOptions
    } = this.thinking.prepareLLMOptions(options);
    
    // 基本的なオプションの設定
    finalOptions.stream = enableStreaming && (options.stream ?? true);
    
    // ツール定義があれば追加
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      finalOptions.tools = Databricks.convertToolDefinitionsForDatabricks(options.tools);
      finalOptions.tool_choice = options.toolChoice || "auto";
    }
    
    return finalOptions;
  }

  private convertMessages(msgs: ChatMessage[]): any[] {
    if (!msgs || !Array.isArray(msgs)) {
      console.warn("Invalid or missing messages array");
      return [];
    }
    
    // roleが"system"でない、contentを持つメッセージだけをフィルタリング
    const filteredMessages = msgs.filter(m => m && m.role !== "system" && !!m.content);
    
    // メッセージ変換
    const messages = filteredMessages.map((message) => {
      if (!message) {
        return { role: "user", content: "" };
      }
      
      if (typeof message.content === "string") {
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      } else if (message.role === "assistant" && message.toolCalls) {
        return {
          role: "assistant",
          content: message.content || "",
          tool_calls: message.toolCalls.map(call => ({
            id: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: "function",
            function: {
              name: call.function?.name || "",
              arguments: call.function?.arguments || "{}"
            }
          }))
        };
      } else if (message.role === "tool" && message.toolCallId) {
        return {
          role: "tool",
          content: message.content || "",
          tool_call_id: message.toolCallId
        };
      } else {
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content || ""
        };
      }
    });
    
    return messages;
  }

  private extractSystemMessage(msgs: ChatMessage[]): string | undefined {
    if (!msgs || !Array.isArray(msgs)) {
      return undefined;
    }
    
    // システムメッセージを抽出し、画像を除去
    const systemMessage = stripImages(
      msgs.filter((m) => m && m.role === "system")[0]?.content ?? ""
    );
    
    return systemMessage || undefined;
  }

  /**
   * 改良版リトライ機能付きのフェッチ関数
   * @param url リクエストURL
   * @param options フェッチオプション
   * @param retryCount 現在のリトライ回数
   * @returns レスポンス
   */
  private async fetchWithRetry(url: string, options: any, retryCount: number = 0): Promise<Response> {
    if (!url) {
      throw new Error("Invalid URL: URL cannot be empty");
    }
    
    try {
      console.log(`Making API request to ${url}${retryCount > 0 ? ` (retry ${retryCount}/${this.maxRetryAttempts})` : ''}`);
      
      // リクエスト開始時間を記録
      const requestStartTime = Date.now();
      
      // タイムアウト値を取得してoptionsから削除（標準のRequestInitには存在しないため）
      const timeoutMs = options.timeout || 30000;
      const fetchOptions = { ...options };
      delete fetchOptions.timeout;
      
      // タイムアウト付きフェッチを実装
      const fetchPromise = this.fetch(url, fetchOptions);
      const timeoutPromise = new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      
      // Promise.raceでタイムアウト処理を実装
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      // レスポンス時間を計算
      const responseTime = Date.now() - requestStartTime;
      console.log(`Received response in ${responseTime}ms with status ${response.status}`);
      
      if (!response.ok && retryCount < this.maxRetryAttempts) {
        const statusCode = response.status;
        
        // 429 Too Many Requestsとサーバーエラーのみをリトライ対象とする
        if (statusCode === 429 || statusCode >= 500) {
          // Retry-After ヘッダーの確認
          let retryAfter = response.headers.get('Retry-After');
          let retryDelay: number;
          
          if (retryAfter && !isNaN(parseInt(retryAfter))) {
            // ヘッダーが秒単位で指定されている場合
            retryDelay = parseInt(retryAfter) * 1000;
          } else {
            // 指数バックオフ + ジッター（ランダム要素を追加）
            const baseDelay = 1000 * Math.pow(this.backoffFactor, retryCount);
            const jitter = baseDelay * 0.1 * Math.random(); // 10%のランダム値
            retryDelay = Math.min(baseDelay + jitter, 30000); // 最大30秒まで
          }
          
          console.log(`Request failed with status ${statusCode}. Retrying after ${Math.round(retryDelay / 1000)} seconds...`);
          
          // カスタムエラーレスポンスの読み取りを試みる
          let errorDetails = "";
          try {
            const errorText = await response.text();
            if (errorText) {
              errorDetails = ` Error details: ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`;
            }
          } catch (e) {}
          
          console.warn(`API error (${statusCode})${errorDetails}. Retry ${retryCount + 1}/${this.maxRetryAttempts} scheduled.`);
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return this.fetchWithRetry(url, options, retryCount + 1);
        }
      }
      
      return response;
    } catch (error) {
      if (retryCount < this.maxRetryAttempts) {
        // ネットワークエラーの場合のリトライ
        const retryDelay = Math.min(1000 * Math.pow(this.backoffFactor, retryCount), 30000);
        console.error(`Network error: ${error}. Retrying after ${Math.round(retryDelay / 1000)} seconds...`);
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      
      console.error(`All retry attempts failed. Last error: ${error}`);
      throw error;
    }
  }

  /**
   * チャンクデータをデコードする関数
   * @param chunk チャンクデータ
   * @returns デコードされた文字列
   */
  protected processChunk(chunk: Uint8Array | Buffer): string {
    if (!chunk || (chunk.length === 0)) {
      return "";
    }
    
    try {
      const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });
      return decoder.decode(chunk, { stream: true });
    } catch (e) {
      console.error("Error processing chunk:", e);
      // フォールバック処理
      return Array.from(new Uint8Array(chunk as any))
        .map(b => String.fromCharCode(b))
        .join('');
    }
  }

  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    if (!msgs || !Array.isArray(msgs)) {
      console.error("Invalid messages array");
      yield {
        role: "assistant",
        content: "エラー: メッセージデータが無効です。"
      };
      return;
    }
    
    try {
      const convertedMessages = this.convertMessages(msgs);
      const originalSystemMessage = this.extractSystemMessage(msgs);
      const enhancedSystemMessage = this.thinking.createEnhancedSystemMessage(options, originalSystemMessage);
      
      let toolsParameter: any = undefined;
      
      // ツール定義の変換
      if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
        toolsParameter = Databricks.convertToolDefinitionsForDatabricks(options.tools);
      }
      
      // リクエストボディの構築
      const body = {
        ...this.convertArgs(options),
        messages: convertedMessages,
        system: enhancedSystemMessage
      };
      
      // ツールパラメータがある場合は追加
      if (toolsParameter) {
        body.tools = toolsParameter;
        body.tool_choice = options.toolChoice || "auto";
      }
      
      // ストリーミングの設定
      const enableStreaming = this.getEnableStreamingFromConfig();
      body.stream = enableStreaming && (body.stream !== false);
      
      // リクエスト情報
      const invocationUrl = this.getInvocationUrl();
      if (!invocationUrl) {
        throw new Error("Invalid invocation URL: URL cannot be empty");
      }
      
      const timeout = this.getTimeoutFromConfig();
      
      // フェッチオプションの構築
      const fetchOptions = {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
        timeout: timeout
      };

      console.log(`Preparing request to Databricks API: ${invocationUrl}`);
      
      // リトライ機能付きフェッチを使用
      const res = await this.fetchWithRetry(invocationUrl, fetchOptions);
      
      // エラーレスポンスのチェック
      if (!res.ok || !res.body) {
        this.thinking.ensureThinkingComplete();
        
        // エラーメッセージを取得
        let errorText = await res.text();
        let friendlyError = `HTTP ${res.status}`;
        
        try {
          // JSONエラーの場合はより詳細なメッセージを表示
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            friendlyError += ` - ${errorJson.error.message}`;
          } else if (errorJson.message) {
            friendlyError += ` - ${errorJson.message}`;
          } else {
            friendlyError += ` - ${errorText}`;
          }
        } catch (e) {
          friendlyError += ` - ${errorText}`;
        }
        
        throw new Error(friendlyError);
      }

      // 非ストリーミングモードの処理
      if (body.stream === false) {
        const jsonResponse = await res.json();
        this.thinking.ensureThinkingComplete();
        
        try {
          // 様々なレスポンス形式に対応
          if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
            yield {
              role: "assistant",
              content: jsonResponse.choices[0].message.content
            };
          } else if (jsonResponse.content) {
            const contentValue = jsonResponse.content;
            if (typeof contentValue === "string") {
              yield {
                role: "assistant",
                content: contentValue
              };
            } else if (Array.isArray(contentValue)) {
              const textContent = contentValue.find(item => item.type === "text")?.text || 
                                 (contentValue[0] && contentValue[0].text) || 
                                 JSON.stringify(contentValue);
              yield {
                role: "assistant",
                content: textContent
              };
            } else {
              yield {
                role: "assistant",
                content: "Complex response format: " + JSON.stringify(contentValue)
              };
            }
          } else if (jsonResponse.completion) {
            yield {
              role: "assistant",
              content: jsonResponse.completion
            };
          } else if (jsonResponse.message?.content) {
            yield {
              role: "assistant",
              content: jsonResponse.message.content
            };
          } else if (jsonResponse.tool_calls && Array.isArray(jsonResponse.tool_calls)) {
            yield {
              role: "assistant",
              content: "",
              toolCalls: jsonResponse.tool_calls.map((call: any) => ({
                id: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                type: "function",
                function: {
                  name: call.function.name,
                  arguments: call.function.arguments
                }
              }))
            };
          } else {
            yield {
              role: "assistant",
              content: "Response format not recognized: " + JSON.stringify(jsonResponse)
            };
          }
        } catch (e) {
          console.error("Error processing non-streaming response:", e);
          throw e;
        }
        return;
      }
      
      // ストリーミングモードの処理
      const streamResult = await this.thinking.handleStreaming(
        res, 
        this.processChunk.bind(this), 
        this.fetchWithRetry.bind(this),
        invocationUrl, 
        msgs, 
        options, 
        timeout,
        toolsParameter
      );
      
      for await (const message of streamResult) {
        yield message;
      }
      
    } catch (error) {
      console.error("_streamChat error:", error);
      this.thinking.ensureThinkingComplete();
      
      // ユーザーフレンドリーなエラーメッセージを構築
      let errorMessage = "リクエスト処理中にエラーが発生しました。";
      
      if (error instanceof Error) {
        // エラーメッセージからAPIキーやURLなどの機密情報を除去
        const sanitizedMessage = error.message
          .replace(/api[-_]?key[^a-zA-Z0-9]/i, "[REDACTED]")
          .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/i, "Bearer [REDACTED]")
          .replace(/(https?:\/\/)[^/\s]+/g, "$1[REDACTED-DOMAIN]");
        
        errorMessage = `エラー: ${sanitizedMessage}`;
      }
      
      // エラーをラップして通知
      const errorNotificationMessage: ChatMessage = {
        role: "assistant",
        content: `⚠️ ${errorMessage}`
      };
      yield errorNotificationMessage;
    } finally {
      // 後処理
      this.thinking.ensureThinkingComplete();
      this.thinking.resetThinking();
    }
  }
}