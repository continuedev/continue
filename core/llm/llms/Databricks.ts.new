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
import { streamSse } from "../stream";

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

export default class Databricks extends OpenAI {
  static providerName = "databricks";
  private modelConfig: any = null;
  private globalConfig: any = null;

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
            (m) =>
              m.provider === "databricks" &&
              m.model === modelName
          );
          
          if (modelConfig) {
            // Claude 3.7 Sonnetの場合は特別な検証と設定
            const isClaudeModel = (modelConfig.model || "").toLowerCase().includes("claude");
            const isClaudeSonnet37 = isClaudeModel && (
              (modelConfig.model || "").toLowerCase().includes("claude-3-7") ||
              (modelConfig.model || "").toLowerCase().includes("claude-3.7")
            );
            
            if (isClaudeSonnet37) {
              // Claude 3.7固有の設定を確保
              if (!modelConfig.defaultCompletionOptions) {
                modelConfig.defaultCompletionOptions = {};
              }
              
              // 思考モードの設定を確保
              if (!modelConfig.defaultCompletionOptions.thinking) {
                modelConfig.defaultCompletionOptions.thinking = {
                  type: "auto",
                  budget_tokens: 16000
                };
              }
              
              // 思考モードのデフォルト設定
              if (!modelConfig.defaultCompletionOptions.thinking.type) {
                modelConfig.defaultCompletionOptions.thinking.type = "auto";
              }
              
              if (!modelConfig.defaultCompletionOptions.thinking.budget_tokens) {
                modelConfig.defaultCompletionOptions.thinking.budget_tokens = 16000;
              }
            }
            
            // 設定の検証
            Databricks.validateModelConfig(modelConfig, isClaudeSonnet37);
            
            if (modelConfig && typeof modelConfig.apiKey === "string" && typeof modelConfig.apiBase === "string") {
              return { modelConfig, globalConfig };
            }
          }
        }
      }
      
      // 環境変数からのフォールバック
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
      console.error("Error reading Databricks config.yaml:", error);
    }
    
    throw new Error(
      "Databricks connection information not found. Please configure 'apiKey' and 'apiBase' for the model in .continue/config.yaml."
    );
  }

  // 設定を検証するための新しいヘルパーメソッド
  private static validateModelConfig(config: any, isClaudeSonnet37: boolean): void {
    if (!config) {
      return;
    }
    
    // defaultCompletionOptionsの検証
    if (!config.defaultCompletionOptions) {
      config.defaultCompletionOptions = {};
    }
    
    // Claude 3.7固有の検証
    if (isClaudeSonnet37) {
      const options = config.defaultCompletionOptions;
      
      // 思考モードの設定
      if (!options.thinking) {
        options.thinking = { type: "auto", budget_tokens: 16000 };
      } else {
        if (!["auto", "enabled", "disabled"].includes(options.thinking.type)) {
          options.thinking.type = "auto";
        }
        
        if (typeof options.thinking.budget_tokens !== "number" || options.thinking.budget_tokens < 0) {
          options.thinking.budget_tokens = 16000;
        }
      }
      
      // ストリーミング設定の検証
      if (options.stream === undefined) {
        options.stream = true;
      }
      
      // タイムアウト設定の検証
      if (options.timeout === undefined) {
        options.timeout = 600000;
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
    };
    
    opts.apiBase = (opts.apiBase ?? "").replace(/\/+$/, "");
    
    super(opts);
    
    this.modelConfig = modelConfig;
    this.globalConfig = globalConfig;
  }

  private getTimeoutFromConfig(): number {
    const timeout = this.modelConfig?.defaultCompletionOptions?.timeout;
    if (typeof timeout === 'number' && timeout > 0) {
      return timeout;
    }
    return 600000; // デフォルト値を10分に設定
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
    
    return true;
  }

  private convertArgs(options: CompletionOptions): any {
    const enableStreaming = this.getEnableStreamingFromConfig();
    
    // 思考モードの設定を確認
    const isClaudeModel = (this.modelConfig?.model || "").toLowerCase().includes("claude");
    const isThinkingEnabled = options.reasoning || 
                            (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    const thinkingBudget = options.reasoningBudgetTokens || 
                          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
                          16000;
    
    // Claudeモデルのバージョンを特定
    const isClaudeSonnet37 = isClaudeModel && (
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3-7") ||
      (this.modelConfig?.model || "").toLowerCase().includes("claude-3.7")
    );
    
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
    }
    
    // 思考モードのパラメータを追加（Claude 3.7用に最適化）
    if (isThinkingEnabled) {
      finalOptions.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget
      };
    }
    
    return finalOptions;
  }

  private convertMessages(msgs: ChatMessage[]): any[] {
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
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      }
    });
    
    return messages;
  }

  private extractSystemMessage(msgs: ChatMessage[]): string | undefined {
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
    
    // Claude 3.7の場合は思考指示をシステムメッセージに含めない（API経由で制御）
    const enableThinking = options.reasoning || 
      (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    if (enableThinking && !isClaudeSonnet37) {
      // Claude 3.7以外のモデルの場合は従来通りシステムメッセージに指示を追加
      const budgetTokens = options.reasoningBudgetTokens || 
        this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
        16000;
      
      const thinkingInstructions = `\n\nI'd like you to solve this problem step-by-step, showing your reasoning process clearly. Take your time to think through this thoroughly before giving your final answer. Use up to ${budgetTokens} tokens to explore different approaches and ensure your solution is correct.`;
      
      systemMessage += thinkingInstructions;
    }
    
    return systemMessage;
  }

  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const convertedMessages = this.convertMessages(msgs);
    const originalSystemMessage = this.extractSystemMessage(msgs);
    const enhancedSystemMessage = this.createEnhancedSystemMessage(options, originalSystemMessage);
    
    const body = {
      ...this.convertArgs(options),
      messages: convertedMessages,
      system: enhancedSystemMessage
    };
    
    const enableStreaming = this.getEnableStreamingFromConfig();
    body.stream = enableStreaming && (body.stream !== false);
    
    const invocationUrl = this.getInvocationUrl();
    
    try {
      const timeout = this.getTimeoutFromConfig();
      
      const fetchOptions = {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
        timeout: timeout
      };
      
      const res = await this.fetch(invocationUrl, fetchOptions);
      
      if (!res.ok || !res.body) {
        const errorMsg = `HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      if (body.stream === false) {
        const jsonResponse = await res.json();
        
        if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
          const message: ChatMessage = {
            role: "assistant",
            content: jsonResponse.choices[0].message.content
          };
          yield message;
        } else if (jsonResponse.content) {
          const contentValue = jsonResponse.content;
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
          const message: ChatMessage = {
            role: "assistant",
            content: jsonResponse.completion
          };
          yield message;
        } else if (jsonResponse.message?.content) {
          const message: ChatMessage = {
            role: "assistant",
            content: jsonResponse.message.content
          };
          yield message;
        } else {
          const message: ChatMessage = {
            role: "assistant",
            content: "Response format not recognized: " + JSON.stringify(jsonResponse)
          };
          yield message;
        }
        return;
      }
      
      for await (const value of streamSse(res)) {
        if (value.thinking) {
          const message: ChatMessage = {
            role: "assistant",
            content: "[思考中...] " + value.thinking,
          };
          yield message;
        }
        else if (value.type === "content_block_delta" && value.delta?.text) {
          const message: ChatMessage = {
            role: "assistant",
            content: value.delta.text
          };
          yield message;
        }
        else if (value.choices && value.choices[0]?.delta?.content) {
          const message: ChatMessage = {
            role: "assistant",
            content: value.choices[0].delta.content
          };
          yield message;
        }
        else if (value.content && typeof value.content === "string") {
          const message: ChatMessage = {
            role: "assistant",
            content: value.content
          };
          yield message;
        }
        else if (value.content && Array.isArray(value.content) && value.content[0]?.text) {
          const message: ChatMessage = {
            role: "assistant",
            content: value.content[0].text
          };
          yield message;
        }
        else if (value.text) {
          const message: ChatMessage = {
            role: "assistant",
            content: value.text
          };
          yield message;
        }
        else {
          const delta = fromChatCompletionChunk(value);
          if (delta?.content) {
            const message: ChatMessage = {
              role: "assistant",
              content: delta.content
            };
            yield message;
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }
}