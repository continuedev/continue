let vscode: any = undefined;
try {
  if (typeof window !== 'undefined' && (window as any).vscode) {
    vscode = (window as any).vscode;
  } else if (typeof window !== 'undefined' && 'acquireVsCodeApi' in window) {
    vscode = (window as any).acquireVsCodeApi();
  }
} catch (e) {}

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
import { normalizePath, safeReadFile, readFirstAvailableFile } from '../../config/load';

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
    console.error("Error loading Node.js modules:", error);
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
      const homeDir = os.homedir();
      const configPath = path.join(homeDir, ".continue", "config.yaml");
      
      if (fs.existsSync(configPath)) {
        const fileContents = fs.readFileSync(configPath, "utf8");
        const parsed = yaml.load(fileContents) as any;
        const globalConfig = parsed;
        
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.models)) {
          const modelConfig = (parsed.models as any[]).find(
            (m) => m.provider === "databricks" && m.model === modelName
          );
          
          if (modelConfig) {
            const isClaudeModel = (modelConfig.model || "").toLowerCase().includes("claude");
            const isClaudeSonnet37 = isClaudeModel && (
              (modelConfig.model || "").toLowerCase().includes("claude-3-7") ||
              (modelConfig.model || "").toLowerCase().includes("claude-3.7")
            );
            
            if (isClaudeSonnet37) {
              if (!modelConfig.defaultCompletionOptions) {
                modelConfig.defaultCompletionOptions = {};
              }
              
              // Thinking設定を確認して初期値を設定
              if (!modelConfig.defaultCompletionOptions.thinking) {
                modelConfig.defaultCompletionOptions.thinking = {
                  type: "enabled",
                  budget_tokens: 16000
                };
              }
              
              if (!modelConfig.defaultCompletionOptions.thinking.type) {
                modelConfig.defaultCompletionOptions.thinking.type = "enabled";
              }
              
              if (!modelConfig.defaultCompletionOptions.thinking.budget_tokens) {
                modelConfig.defaultCompletionOptions.thinking.budget_tokens = 16000;
              }
              
              // ステップバイステップ思考モードのデフォルト値
              if (modelConfig.defaultCompletionOptions.stepByStepThinking === undefined) {
                modelConfig.defaultCompletionOptions.stepByStepThinking = true;
              }
              
              // モデルケイパビリティの設定
              if (!modelConfig.capabilities || !Array.isArray(modelConfig.capabilities)) {
                modelConfig.capabilities = ["tool_use"];
              }
            }
            
            Databricks.validateModelConfig(modelConfig, isClaudeSonnet37);
            
            if (modelConfig && typeof modelConfig.apiKey === "string" && typeof modelConfig.apiBase === "string") {
              return { modelConfig, globalConfig };
            }
          }
        }
      }
      
      // MCPサーバー設定ファイルからの読み込みを試みる
      try {
        const mcpServerDir = path.join(homeDir, ".continue", "mcpServers");
        // 複数の場所を検索
        const searchPaths = [
          path.join(mcpServerDir, "databricks.yaml"),
          path.join(process.cwd(), ".continue", "mcpServers", "databricks.yaml"),
          path.join(process.cwd(), "extensions", ".continue-debug", "mcpServers", "databricks.yaml")
        ];
        
        // 正規化されたパスで検索
        const normalizedPaths = searchPaths.map(p => normalizePath(p));
        const mcpConfig = readFirstAvailableFile(normalizedPaths);
        
        if (mcpConfig) {
          console.log(`Found MCP server config at: ${mcpConfig.path}`);
          const mcpYaml = yaml.load(mcpConfig.content);
          
          if (mcpYaml && mcpYaml.serving_endpoint) {
            return {
              modelConfig: {
                apiKey: mcpYaml.api_token || process.env.DATABRICKS_TOKEN,
                apiBase: mcpYaml.serving_endpoint,
                defaultCompletionOptions: {
                  thinking: {
                    type: "enabled",
                    budget_tokens: 16000
                  },
                  stepByStepThinking: true
                }
              },
              globalConfig: null
            };
          }
        }
      } catch (e) {
        console.warn("Error loading MCP server config:", e);
      }
      
      // 環境変数からの読み込み（フォールバック）
      const pat = process.env.DATABRICKS_TOKEN;
      const base = process.env.YOUR_DATABRICKS_URL;
      if (pat && base) {
        return {
          modelConfig: {
            apiKey: pat,
            apiBase: base,
          },
          globalConfig: null
        };
      }
      
    } catch (error) {
      console.error("Error loading config from YAML:", error);
    }
    
    throw new Error(
      "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
    );
  }

  private static validateModelConfig(config: any, isClaudeSonnet37: boolean): void {
    if (!config) return;
    
    // デフォルト設定のチェックと初期化
    if (!config.defaultCompletionOptions) {
      config.defaultCompletionOptions = {};
    }
    
    // ケイパビリティのチェックと初期化
    if (!config.capabilities) {
      config.capabilities = ["tool_use"];
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
      
      config.capabilities = newCapabilities;
    }
    
    // Claude 3.7 Sonnet特有の設定
    if (isClaudeSonnet37) {
      const options = config.defaultCompletionOptions;
      
      // 思考設定の検証
      if (!options.thinking) {
        options.thinking = { type: "enabled", budget_tokens: 16000 };
      } else {
        if (!["auto", "enabled", "disabled"].includes(options.thinking.type)) {
          options.thinking.type = "enabled";
        }
        
        if (typeof options.thinking.budget_tokens !== "number" || options.thinking.budget_tokens < 0) {
          options.thinking.budget_tokens = 16000;
        }
      }
      
      // ステップバイステップ思考モードの設定
      if (options.stepByStepThinking === undefined) {
        options.stepByStepThinking = true;
      } else if (typeof options.stepByStepThinking !== "boolean") {
        options.stepByStepThinking = true;
      }
      
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
    }
  }

  constructor(opts: LLMOptions) {
    const modelName = opts.model;
    if (!modelName) {
      throw new Error("No model specified for Databricks. Please include a model name in the options.");
    }
    
    const { modelConfig, globalConfig } = Databricks.loadConfigFromYaml(modelName);
    
    if (!modelConfig.apiKey || !modelConfig.apiBase) {
      throw new Error(
        "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
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
  }
  
  /**
   * モデルのケイパビリティを検出して設定する
   */
  private detectModelCapabilities(): void {
    // モデル名からClaude 3.7 Sonnetを検出
    const isClaudeModel = (this.modelConfig?.model || "").toLowerCase().includes("claude");
    const isClaudeSonnet37 = isClaudeModel && (
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3-7") ||
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3.7")
    );
    
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
    return tools.map(tool => {
      return {
        type: "function",
        function: {
          name: tool.name || tool.function?.name,
          description: tool.description || tool.function?.description,
          parameters: tool.parameters || tool.function?.parameters
        }
      };
    });
  }

  private convertArgs(options: CompletionOptions): any {
    const enableStreaming = this.getEnableStreamingFromConfig();
    
    const isClaudeModel = (this.modelConfig?.model || "").toLowerCase().includes("claude");
    const isThinkingEnabled = options.reasoning || 
                            (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    const thinkingBudget = options.reasoningBudgetTokens || 
                          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
                          16000;
    
    const isClaudeSonnet37 = isClaudeModel && (
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3-7") ||
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3.7")
    );
    
    // 必要なトークン数をThinking用の余裕を持って設定
    const maxTokens = Math.max(
      options.maxTokens ?? this.modelConfig?.defaultCompletionOptions?.maxTokens ?? 4096,
      isThinkingEnabled ? thinkingBudget + 2000 : 0 // 余裕を持たせる (1000→2000)
    );
    
    // オプションを構築
    const finalOptions: any = {
      model: options.model || this.modelConfig?.model,
      temperature: options.temperature ?? this.modelConfig?.defaultCompletionOptions?.temperature ?? 0.7,
      max_tokens: maxTokens,
      stop: options.stop?.filter(x => x.trim() !== "") ?? this.modelConfig?.defaultCompletionOptions?.stop ?? [],
      stream: enableStreaming && (options.stream ?? true)
    };
    
    // ステップバイステップ思考を使用する場合は温度を少し下げる
    const useStepByStepThinking = 
      options.stepByStepThinking !== undefined ? 
      !!options.stepByStepThinking : 
      (this.modelConfig?.defaultCompletionOptions?.stepByStepThinking === true);
    
    if (useStepByStepThinking && options.temperature === undefined && 
        this.modelConfig?.defaultCompletionOptions?.temperature === undefined) {
      finalOptions.temperature = 0.6;
    }
    
    // Claude 3.7 Sonnet非対応、または思考機能無効の場合のオプション
    if (!isClaudeSonnet37 || !isThinkingEnabled) {
      finalOptions.top_k = options.topK ?? this.modelConfig?.defaultCompletionOptions?.topK ?? 100;
      finalOptions.top_p = options.topP ?? this.modelConfig?.defaultCompletionOptions?.topP ?? 0.95;
    }
    
    // 思考機能の初期化と設定
    if (this.thinking.initializeThinking(options)) {
      // Thinking設定をAPIリクエストに追加
      finalOptions.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget
      };
    }
    
    // ツール定義があれば追加
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      finalOptions.tools = Databricks.convertToolDefinitionsForDatabricks(options.tools);
      finalOptions.tool_choice = options.toolChoice || "auto";
    }
    
    return finalOptions;
  }

  private convertMessages(msgs: ChatMessage[]): any[] {
    // roleが"system"でない、contentを持つメッセージだけをフィルタリング
    const filteredMessages = msgs.filter(m => m.role !== "system" && !!m.content);
    
    // メッセージ変換
    const messages = filteredMessages.map((message) => {
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
            id: call.id,
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
          content: message.content
        };
      }
    });
    
    return messages;
  }

  private extractSystemMessage(msgs: ChatMessage[]): string | undefined {
    // システムメッセージを抽出し、画像を除去
    const systemMessage = stripImages(
      msgs.filter((m) => m.role === "system")[0]?.content ?? ""
    );
    
    return systemMessage || undefined;
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
    
    const enableThinking = options.reasoning || 
      (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    const useStepByStepThinking = 
      options.stepByStepThinking !== undefined ? 
      !!options.stepByStepThinking : 
      (this.modelConfig?.defaultCompletionOptions?.stepByStepThinking === true);
    
    // 思考モードが有効な場合、システムメッセージに指示を追加
    if (enableThinking) {
      if (useStepByStepThinking) {
        const stepByStepInstructions = `\n\nBefore answering, think step-by-step and explain your reasoning in detail. Please provide detailed, step-by-step reasoning before arriving at a conclusion.`;
        systemMessage += stepByStepInstructions;
      } else if (!isClaudeSonnet37) {
        const budgetTokens = options.reasoningBudgetTokens || 
          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
          16000;
        
        const thinkingInstructions = `\n\nI'd like you to solve this problem step-by-step, showing your reasoning process clearly. Take your time to think through this thoroughly before giving your final answer. Use up to ${budgetTokens} tokens to explore different approaches and ensure your solution is correct.`;
        systemMessage += thinkingInstructions;
      }
    }
    
    // ツールが指定されている場合、ツール使用の指示を追加
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      const agentInstructions = `\n\nWhen appropriate, use the provided tools to help solve the problem. These tools allow you to interact with the external environment to gather information or perform actions needed to complete the task.`;
      systemMessage += agentInstructions;
    }
    
    return systemMessage;
  }

  private processChunk(chunk: Uint8Array | Buffer): string {
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

  /**
   * 改良版リトライ機能付きのフェッチ関数
   * @param url リクエストURL
   * @param options フェッチオプション
   * @param retryCount 現在のリトライ回数
   * @returns レスポンス
   */
  private async fetchWithRetry(url: string, options: any, retryCount: number = 0): Promise<Response> {
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

  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    try {
      const convertedMessages = this.convertMessages(msgs);
      const originalSystemMessage = this.extractSystemMessage(msgs);
      const enhancedSystemMessage = this.createEnhancedSystemMessage(options, originalSystemMessage);
      
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
      
      // バッファと状態の初期化
      let buffer = "";
      let rawBuffer = "";
      let thinkingContent = "";
      let lastActivityTime = Date.now();
      const activityTimeoutMs = 30000; // 30秒の非アクティブタイムアウト
      
      // SSEパーサー関数
      const parseSSE = (
        str: string,
      ): { done: boolean; messages: (ChatMessage | ThinkingContent)[] } => {
        buffer += str;
        const out: (ChatMessage | ThinkingContent)[] = [];
        
        // アクティビティ時間を更新
        lastActivityTime = Date.now();
        
        const thinkingStartRegex = /^thinking:(.*)$/i;
        
        // 一行のみで完結するJSONの処理
        if (buffer.trim() && !buffer.includes("\n")) {
          try {
            const trimmedBuffer = buffer.trim();
            const jsonStr = trimmedBuffer.startsWith("data:") ? 
                         trimmedBuffer.slice(trimmedBuffer.indexOf("{")) : 
                         trimmedBuffer;
            
            const json = JSON.parse(jsonStr);
            
            // 完了シグナルの検出
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
                
              buffer = "";
              this.thinking.ensureThinkingComplete();
              return { done: true, messages: out };
            }
            
            // 完了メッセージの内容
            if (json.choices && json.choices[0]?.message?.content) {
              const message: ChatMessage = {
                role: "assistant",
                content: json.choices[0].message.content
              };
              out.push(message);
              buffer = "";
              
              this.thinking.ensureThinkingComplete();
              return { done: true, messages: out };
            }
            
            // ツール呼び出しの処理
            if (json.choices && json.choices[0]?.message?.tool_calls) {
              const toolCalls = json.choices[0].message.tool_calls;
              const message: ChatMessage = {
                role: "assistant",
                content: "",
                toolCalls: toolCalls.map((call: ToolCall) => ({
                  id: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  type: "function",
                  function: {
                    name: call.function.name,
                    arguments: call.function.arguments
                  }
                }))
              };
              out.push(message);
              buffer = "";
              
              this.thinking.ensureThinkingComplete();
              return { done: true, messages: out };
            }
            
            // 思考内容の処理
            const thinkingObj = this.thinking.processStreamEventThinking(json);
            if (thinkingObj) {
              out.push(thinkingObj);
              buffer = "";
              return { done: false, messages: out };
            }
          } catch (e) {}
        }
        
        // 複数行の処理
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          
          if (!line) continue;
          
          // 特殊なデータ行の処理
          if (!line.startsWith("data:") && !line.startsWith("data: ")) {
            const thinkingMatch = line.match(thinkingStartRegex);
            if (thinkingMatch) {
              const thinkingContent = thinkingMatch[1].trim();
              
              // 思考内容を処理
              const thinkingObj = this.thinking.processStreamEventThinking({ thinking: thinkingContent });
              if (thinkingObj) {
                out.push(thinkingObj);
              }
              continue;
            }
            
            continue;
          }
          
          // SSEデータ行の処理
          const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();
          
          if (data === "[DONE]") {
            this.thinking.ensureThinkingComplete();
            return { done: true, messages: out };
          }
          
          try {
            const json = JSON.parse(data);
            
            // 完了シグナルのチェック
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
                
              this.thinking.ensureThinkingComplete();
              return { done: true, messages: out };
            }
            
            // 思考内容の処理
            const thinkingObj = this.thinking.processStreamEventThinking(json);
            if (thinkingObj) {
              out.push(thinkingObj);
              continue;
            }
            
            // テキストデルタの処理
            if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
              const message: ChatMessage = {
                role: "assistant",
                content: json.delta.text || ""
              };
              out.push(message);
            }
            // 通常のテキストコンテンツデルタの処理
            else if (json.choices && json.choices[0]?.delta?.content) {
              const message: ChatMessage = {
                role: "assistant",
                content: json.choices[0].delta.content
              };
              out.push(message);
            }
            // ツール呼び出しデルタの処理
            else if (json.choices && json.choices[0]?.delta?.tool_calls) {
              const message: ChatMessage = {
                role: "assistant",
                content: "",
                toolCalls: json.choices[0].delta.tool_calls.map((call: ToolCall) => ({
                  id: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  type: "function",
                  function: {
                    name: call.function.name,
                    arguments: call.function.arguments || "{}"
                  }
                }))
              };
              out.push(message);
            }
            // 直接のコンテンツ（文字列）の処理
            else if (json.content && typeof json.content === "string") {
              const message: ChatMessage = {
                role: "assistant",
                content: json.content
              };
              out.push(message);
            }
            // 配列コンテンツの処理
            else if (json.content && Array.isArray(json.content) && json.content[0]?.text) {
              const message: ChatMessage = {
                role: "assistant",
                content: json.content[0].text
              };
              out.push(message);
            }
            // テキストプロパティの処理
            else if (json.text) {
              const message: ChatMessage = {
                role: "assistant",
                content: json.text
              };
              out.push(message);
            }
            // ツール呼び出しの処理
            else if (json.tool_calls && Array.isArray(json.tool_calls)) {
              const message: ChatMessage = {
                role: "assistant",
                content: "",
                toolCalls: json.tool_calls.map((call: ToolCall) => ({
                  id: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  type: "function",
                  function: {
                    name: call.function.name,
                    arguments: call.function.arguments || "{}"
                  }
                }))
              };
              out.push(message);
            }
            // その他のデルタチャンクの処理
            else {
              const delta = fromChatCompletionChunk(json);
              if (delta?.content) {
                const message: ChatMessage = {
                  role: "assistant",
                  content: delta.content
                };
                out.push(message);
              }
            }
          } catch (e) {
            console.error("Error parsing SSE JSON:", e);
            continue;
          }
        }
        return { done: false, messages: out };
      };
      
      // fetch APIのReader APIを使用する場合
      if (typeof (res.body as any).getReader === "function") {
        const reader = (res.body as any).getReader();
        
        const startTime = Date.now();
        let chunkCount = 0;
        
        const streamTimeout = this.getTimeoutFromConfig();
        
        try {
          let continueReading = true;
          
          while (continueReading) {
            // タイムアウトチェック
            if (Date.now() - startTime > streamTimeout) {
              console.log("Stream timeout reached");
              this.thinking.ensureThinkingComplete();
              return;
            }
            
            // 非アクティブチェック
            if (Date.now() - lastActivityTime > activityTimeoutMs) {
              console.log("Stream inactive timeout reached");
              
              // 接続状況を確認する小さなヘルスチェック
              try {
                // 非同期でチェックを実行
                const healthCheckUrl = invocationUrl.replace(/\/invocations$/, '/health');
                
                // タイムアウト付きフェッチを実装
                const healthCheckPromise = this.fetch(healthCheckUrl, {
                  method: "GET",
                  headers: this._getHeaders()
                });
                
                // 非同期でタイムアウトを設定
                const timeoutPromise = new Promise<null>((_, reject) => {
                  setTimeout(() => reject(new Error("Health check timeout")), 30000);
                });
                
                // 最初に完了した方を採用
                const healthCheckResult: Response | null = await Promise.race([
                  healthCheckPromise, 
                  timeoutPromise
                ]);
                
                if (!healthCheckResult || !healthCheckResult.ok) {
                  throw new Error("Health check failed");
                }
                
                // サーバーは生きているが、ストリームが停止している可能性がある
                console.log("API server is responsive but stream may be stalled");
              } catch (healthError) {
                console.error("Health check failed:", healthError);
                throw new Error("Stream connection lost and health check failed");
              }
            }
            
            // チャンクの読み取り
            const { done, value } = await reader.read();
            
            // アクティビティタイムスタンプを更新
            lastActivityTime = Date.now();
            
            if (done) {
              console.log("Stream reader done");
              this.thinking.ensureThinkingComplete();
              break;
            }
            
            chunkCount++;
            
            const decodedChunk = this.processChunk(value as Uint8Array);
            rawBuffer += decodedChunk;
            
            if (!decodedChunk || decodedChunk.trim() === "") {
              continue;
            }
            
            const { done: end, messages } = parseSSE(decodedChunk);
            
            const isThinkingMessage = (msg: any): boolean => {
              if ('type' in msg && msg.type === 'thinking') {
                return true;
              }
              if ((msg as ThinkingChatMessage).isThinking) {
                return true;
              }
              if (typeof msg.content === 'string' && msg.content.startsWith('[thinking]')) {
                return true;
              }
              return false;
            };

            // 思考メッセージではないメッセージのみを返す
            for (const m of messages) {
              if (isThinkingMessage(m)) {
                // 思考メッセージはUIで処理
              } else {
                yield m as ChatMessage;
              }
            }
            
            if (end) {
              console.log("Stream end signal received");
              this.thinking.ensureThinkingComplete();
              
              const message: ChatMessage = {
                role: "assistant",
                content: ""
              };
              yield message;
              
              continueReading = false;
              break;
            }
          }
        } catch (chunkError) {
          console.error("Error during stream processing:", chunkError);
          this.thinking.ensureThinkingComplete();
          
          if (Date.now() - lastActivityTime > 10000) {
            // 自動復旧試行
            console.log("Stream interruption detected. Attempting to recover the response...");
            
            // エラーメッセージを表示
            const errorMessage = "⚠️ ストリームが中断されました。応答の復旧を試みています...";
            updateThinking(errorMessage, "error", 0.9);
            
            // 再接続を試みる
            try {
              // 再接続用の短縮メッセージ配列を作成
              const reconnectMessages = msgs.slice(-3); // 最後の3つのメッセージのみを使用
              
              // 再接続メッセージを構築
              const recoverMessage: ChatMessage = {
                role: "assistant",
                content: "⚠️ 接続が中断されました。会話を回復中です..."
              };
              yield recoverMessage;
              
              // 非ストリーミングモードで再試行
              const recoveryOptions = {
                ...options,
                stream: false,
                // トークン長を短めに設定して迅速な応答を得る
                maxTokens: Math.min(options.maxTokens || 4096, 1000)
              };
              
              // フォールバックシステムメッセージを使用
              const fallbackSystemMessage = "The user's request was interrupted. Please provide a brief, helpful response based on the latest messages.";
              
              const reconnectUrl = this.getInvocationUrl();
              const reconnectBody = {
                ...this.convertArgs(recoveryOptions),
                messages: this.convertMessages(reconnectMessages),
                system: fallbackSystemMessage
              };
              
              // ツールを引き継ぐ
              if (toolsParameter) {
                reconnectBody.tools = toolsParameter;
                reconnectBody.tool_choice = options.toolChoice || "auto";
              }
              
              const reconnectOptions = {
                method: "POST",
                headers: this._getHeaders(),
                body: JSON.stringify(reconnectBody),
                timeout: timeout / 2 // 通常の半分のタイムアウトで素早く応答を得る
              };
              
              // リトライ機能付きフェッチを使用
              const reconnectRes = await this.fetchWithRetry(reconnectUrl, reconnectOptions);
              
              if (reconnectRes.ok) {
                const jsonResponse = await reconnectRes.json();
                if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
                  const recoveredMessage: ChatMessage = {
                    role: "assistant",
                    content: "🔄 会話を回復しました:\n\n" + jsonResponse.choices[0].message.content
                  };
                  yield recoveredMessage;
                  return;
                }
              }
            } catch (reconnectError) {
              console.error("Error during reconnection attempt:", reconnectError);
            }
            
            // 再接続に失敗した場合は元の部分的な応答を表示
            try {
              // バッファからの復旧を試みる
              const recoveredContent = this.thinking.tryRecoverContentFromBuffer(rawBuffer);
              
              const message: ChatMessage = {
                role: "assistant",
                content: "⚠️ ストリームが中断され、再接続に失敗しました。部分的な応答を表示します:\n\n" + 
                        (recoveredContent || thinkingContent ? 
                         (recoveredContent || "[思考プロセス]\n" + thinkingContent.substring(0, 1000) + "...") : 
                         "応答を取得できませんでした。お手数ですが、もう一度お試しください。")
              };
              yield message;
              return;
            } catch (bufferRecoveryError) {
              // 最終手段 - 汎用エラーメッセージを表示
              const message: ChatMessage = {
                role: "assistant",
                content: "⚠️ 申し訳ありません。接続が中断され、応答を完全に取得できませんでした。もう一度お試しください。"
              };
              yield message;
              return;
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (buffer.trim()) {
          const { messages } = parseSSE("");
          for (const m of messages) {
            const isThinking = 'type' in m && m.type === 'thinking';
            
            if (!isThinking) {
              yield m as ChatMessage;
            }
          }
        }
        
        this.thinking.ensureThinkingComplete();
        return;
      }
      
      // Node.jsスタイルのストリーム処理（for-await-of）
      const startTime = Date.now();
      
      const streamTimeout = this.getTimeoutFromConfig();
      
      try {
        for await (const chunk of res.body as any) {
          try {
            // アクティビティタイムスタンプを更新
            lastActivityTime = Date.now();
            
            // タイムアウトチェック
            if (Date.now() - startTime > streamTimeout) {
              console.log("Stream timeout reached");
              this.thinking.ensureThinkingComplete();
              return;
            }
            
            // 非アクティブチェック
            if (Date.now() - lastActivityTime > activityTimeoutMs) {
              console.log("Stream inactive timeout reached");
              throw new Error("Stream inactive for too long");
            }
            
            const decodedChunk = this.processChunk(chunk as Buffer);
            rawBuffer += decodedChunk;
            
            if (!decodedChunk || decodedChunk.trim() === "") {
              continue;
            }
            
            const { done, messages } = parseSSE(decodedChunk);
            
            const isThinkingMessage = (msg: any): boolean => {
              if ('type' in msg && msg.type === 'thinking') {
                return true;
              }
              if ((msg as ThinkingChatMessage).isThinking) {
                return true;
              }
              if (typeof msg.content === 'string' && msg.content.startsWith('[thinking]')) {
                return true;
              }
              return false;
            };

            // 思考メッセージではないメッセージのみを返す
            for (const m of messages) {
              if (isThinkingMessage(m)) {
                // 思考メッセージはUIで処理
              } else {
                yield m as ChatMessage;
              }
            }
            
            if (done) {
              console.log("Stream end signal received");
              this.thinking.ensureThinkingComplete();
              
              const message: ChatMessage = {
                role: "assistant",
                content: ""
              };
              yield message;
              
              return;
            }
          } catch (e) {
            console.error("Error processing stream chunk:", e);
            if (Date.now() - lastActivityTime > 10000) {
              this.thinking.ensureThinkingComplete();
              
              // 自動復旧試行
              console.log("Stream interruption detected. Attempting to recover the response...");
              
              // エラーメッセージを表示
              const errorMessage = "⚠️ ストリームが中断されました。応答の復旧を試みています...";
              updateThinking(errorMessage, "error", 0.9);
              
              // 再接続を試みる
              try {
                // 再接続用の短縮メッセージ配列を作成
                const reconnectMessages = msgs.slice(-3); // 最後の3つのメッセージのみを使用
                
                // 再接続メッセージを構築
                const recoverMessage: ChatMessage = {
                  role: "assistant",
                  content: "⚠️ 接続が中断されました。会話を回復中です..."
                };
                yield recoverMessage;
                
                // 非ストリーミングモードで再試行
                const recoveryOptions = {
                  ...options,
                  stream: false,
                  // トークン長を短めに設定
                  maxTokens: Math.min(options.maxTokens || 4096, 1000)
                };
                
                // フォールバックシステムメッセージを使用
                const fallbackSystemMessage = "The user's request was interrupted. Please provide a brief, helpful response based on the latest messages.";
                
                const reconnectUrl = this.getInvocationUrl();
                const reconnectBody = {
                  ...this.convertArgs(recoveryOptions),
                  messages: this.convertMessages(reconnectMessages),
                  system: fallbackSystemMessage
                };
                
                if (toolsParameter) {
                  reconnectBody.tools = toolsParameter;
                  reconnectBody.tool_choice = options.toolChoice || "auto";
                }
                
                const reconnectOptions = {
                  method: "POST",
                  headers: this._getHeaders(),
                  body: JSON.stringify(reconnectBody),
                  timeout: timeout / 2
                };
                
                // リトライ機能付きフェッチを使用
                const reconnectRes = await this.fetchWithRetry(reconnectUrl, reconnectOptions);
                
                if (reconnectRes.ok) {
                  const jsonResponse = await reconnectRes.json();
                  if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
                    const recoveredMessage: ChatMessage = {
                      role: "assistant",
                      content: "🔄 会話を回復しました:\n\n" + jsonResponse.choices[0].message.content
                    };
                    yield recoveredMessage;
                    return;
                  }
                }
              } catch (reconnectError) {
                console.error("Error during reconnection attempt:", reconnectError);
              }
              
              // 再接続に失敗した場合は元の部分的な応答を表示
              try {
                // バッファからの復旧を試みる
                const recoveredContent = this.thinking.tryRecoverContentFromBuffer(rawBuffer);
                
                const message: ChatMessage = {
                  role: "assistant",
                  content: "⚠️ ストリームが中断され、再接続に失敗しました。部分的な応答を表示します:\n\n" + 
                          (recoveredContent || thinkingContent ? 
                           (recoveredContent || "[思考プロセス]\n" + thinkingContent.substring(0, 1000) + "...") : 
                           "応答を取得できませんでした。お手数ですが、もう一度お試しください。")
                };
                yield message;
                return;
              } catch (bufferRecoveryError) {
                // 最終手段 - 汎用エラーメッセージを表示
                const message: ChatMessage = {
                  role: "assistant",
                  content: "⚠️ 申し訳ありません。接続が中断され、応答を完全に取得できませんでした。もう一度お試しください。"
                };
                yield message;
                return;
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        if (buffer.trim()) {
          const { messages } = parseSSE("");
          for (const m of messages) {
            const isThinking = 'type' in m && m.type === 'thinking';
            
            if (!isThinking) {
              yield m as ChatMessage;
            }
          }
        }
        
        this.thinking.ensureThinkingComplete();
      } catch (streamError) {
        console.error("Stream error:", streamError);
        this.thinking.ensureThinkingComplete();
        
        // エラー時のコンテンツ復旧
        if (rawBuffer && rawBuffer.trim()) {
          try {
            const recoveredContent = this.thinking.tryRecoverContentFromBuffer(rawBuffer);
            if (recoveredContent) {
              // エラーメッセージを改善
              const errorMessage = "⚠️ ストリームが中断されました。部分的な応答を表示します:";
              updateThinking(errorMessage, "error", 1.0);
              
              const message: ChatMessage = {
                role: "assistant",
                content: errorMessage + "\n\n" + recoveredContent
              };
              yield message;
              return;
            }
          } catch (recoveryError) {
            console.error("Error recovering content:", recoveryError);
          }
        }
        
        // 最終的なフォールバック
        const message: ChatMessage = {
          role: "assistant",
          content: "⚠️ 申し訳ありません。応答の生成中にエラーが発生しました。もう一度お試しください。"
        };
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