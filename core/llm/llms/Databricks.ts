/*
 * Databricks.ts — Continue LLM adapter for Databricks Model Serving
 */

// VSCode モジュールを条件付きでインポート
let vscode: any = undefined;
try {
  if (typeof window !== 'undefined' && (window as any).vscode) {
    vscode = (window as any).vscode;
  } else if (typeof window !== 'undefined' && 'acquireVsCodeApi' in window) {
    // @ts-ignore
    vscode = acquireVsCodeApi();
  }
} catch (e) {
  console.warn("VSCode API not available");
}

import OpenAI from "./OpenAI";
import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelCapability,
} from "../../index";
// ThinkingContent を直接インポート
import { ThinkingContent } from "../llms/index";
import { fromChatCompletionChunk } from "../openaiTypeConverters";
import { renderChatMessage, stripImages } from "../../util/messageContent";
import { updateThinking, thinkingCompleted } from './thinkingPanel';

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

// Enhanced type for thinking messages with additional metadata
type ThinkingChatMessage = ChatMessage & {
  finish_reason?: string;
  thinking_metadata?: {
    phase: string;
    progress: number;
    formatted_text?: string;
  };
  isThinking?: boolean; // フラグを追加してリアルタイム処理を強化
};

// Interface for thinking content blocks in the stream
interface ThinkingContentBlock {
  type: "thinking";
  thinking: string;
}

interface RedactedThinkingContentBlock {
  type: "redacted_thinking";
}

interface TextContentBlock {
  type: "text";
  text: string;
}

// ツール呼び出し関連の型定義
interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

// ツール応答の型定義
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
  message?: {
    content?: ContentBlock[];
  };
}

// Export the registerThinkingPanel function for use in the VS Code extension
export { registerThinkingPanel } from './thinkingPanel';

export default class Databricks extends OpenAI {
  static providerName = "databricks";
  private modelConfig: any = null;
  private globalConfig: any = null;
  
  // Agent機能のサポートを宣言（ModelCapabilityとして定義）
  capabilities: ModelCapability = {
    tools: true,      // ツール使用をサポート
    uploadImage: false // 画像アップロードは非サポート
  };
  
  // Track thinking progress for UI visualization
  private thinkingProgress: number = 0;
  private thinkingPhase: string = "initial";
  private thinkingBuffer: string = "";
  private totalThinkingTokens: number = 0;
  private thinkingStartTime: number = 0;
  private lastThinkingUpdateTime: number = 0;
  private thinkingUpdateInterval: number = 300; // 更新間隔を50msから300msに変更
  // バッファ管理の改善
  private pendingThinkingUpdates: string[] = [];
  
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
            
            const isClaudeModel = (modelConfig.model || "").toLowerCase().includes("claude");
            const isClaudeSonnet37 = isClaudeModel && (
              (modelConfig.model || "").toLowerCase().includes("claude-3-7") ||
              (modelConfig.model || "").toLowerCase().includes("claude-3.7")
            );
            
            if (isClaudeSonnet37) {
              console.log("Claude 3.7 Sonnet model detected - applying special configuration");
              
              if (!modelConfig.defaultCompletionOptions) {
                modelConfig.defaultCompletionOptions = {};
              }
              
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
              
              // Ensure capabilities are properly defined (array format)
              if (!modelConfig.capabilities || !Array.isArray(modelConfig.capabilities)) {
                console.log("Converting capabilities to array format");
                modelConfig.capabilities = ["tool_use"];
              }
              
              console.log("Claude 3.7 Sonnet configuration:", {
                thinking: modelConfig.defaultCompletionOptions.thinking,
                capabilities: modelConfig.capabilities
              });
            }
            
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

  private static validateModelConfig(config: any, isClaudeSonnet37: boolean): void {
    if (!config) {
      console.warn("Configuration object doesn't exist");
      return;
    }
    
    if (!config.apiKey) {
      console.warn("Warning: apiKey is not configured");
    }
    
    if (!config.apiBase) {
      console.warn("Warning: apiBase is not configured");
    }
    
    if (!config.defaultCompletionOptions) {
      console.warn("Warning: defaultCompletionOptions is not configured, using defaults");
      config.defaultCompletionOptions = {};
    }
    
    // 必ずcapabilitiesを配列形式にする（配列でない場合は変換）
    if (!config.capabilities) {
      config.capabilities = ["tool_use"];
      console.log("Warning: capabilities not configured, setting defaults:", config.capabilities);
    } else if (!Array.isArray(config.capabilities)) {
      // オブジェクト形式から配列形式への変換
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
      
      console.log("Converting capabilities from object to array format:", 
                 { before: config.capabilities, after: newCapabilities });
      
      config.capabilities = newCapabilities;
    }
    
    if (isClaudeSonnet37) {
      const options = config.defaultCompletionOptions;
      
      if (!options.thinking) {
        console.warn("Warning: Thinking mode configuration is recommended for Claude 3.7, using defaults");
        options.thinking = { type: "enabled", budget_tokens: 16000 };
      } else {
        if (!["auto", "enabled", "disabled"].includes(options.thinking.type)) {
          console.warn(`Warning: Invalid thinking mode type "${options.thinking.type}", setting to "enabled"`);
          options.thinking.type = "enabled";
        }
        
        if (typeof options.thinking.budget_tokens !== "number" || options.thinking.budget_tokens < 0) {
          console.warn(`Warning: Invalid thinking token budget "${options.thinking.budget_tokens}", setting to 16000`);
          options.thinking.budget_tokens = 16000;
        }
      }
      
      if (options.stream === undefined) {
        console.warn("Warning: stream setting is undefined, setting to true");
        options.stream = true;
      }
      
      if (options.timeout === undefined) {
        console.warn("Warning: timeout setting is undefined, setting to 600000ms");
        options.timeout = 600000;
      } else if (typeof options.timeout !== "number" || options.timeout < 0) {
        console.warn(`Warning: Invalid timeout value "${options.timeout}", setting to 600000ms`);
        options.timeout = 600000;
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
      defaultCompletionOptionsExist: !!modelConfig.defaultCompletionOptions,
      capabilities: modelConfig.capabilities
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
      // ModelCapabilityの形式で渡す
      capabilities: {
        tools: Array.isArray(modelConfig.capabilities) ? 
              modelConfig.capabilities.includes("tool_use") : 
              true,
        uploadImage: false
      }
    };
    
    opts.apiBase = (opts.apiBase ?? "").replace(/\/+$/, "");
    console.log("Final apiBase after processing:", opts.apiBase);
    
    super(opts);
    
    this.modelConfig = modelConfig;
    this.globalConfig = globalConfig;
  }

  private getTimeoutFromConfig(): number {
    const timeout = this.modelConfig?.defaultCompletionOptions?.timeout;
    if (typeof timeout === 'number' && timeout > 0) {
      console.log("Timeout setting loaded from config file:", timeout);
      return timeout;
    }
    
    console.log("Using default timeout setting: 600000ms");
    return 600000;
  }

  private getInvocationUrl(): string {
    const url = (this.apiBase ?? "").replace(/\/+$/, "");
    
    const safeUrl = this.sanitizeUrlForLogs(url);
    
    console.log("Databricks adapter using URL:", safeUrl);
    return url;
  }

  private sanitizeUrlForLogs(url: string): any {
    if (!url) return '';
    
    return Array.from(url).map((c, i) => ({ [i]: c }));
  }

  protected _getHeaders(): { "Content-Type": string; Authorization: string; "api-key": string; } {
    const headers = super._getHeaders();
    
    const customHeaders = headers as any;
    
    customHeaders["Accept"] = "text/event-stream";
    
    if (!customHeaders["Content-Type"]) {
      customHeaders["Content-Type"] = "application/json";
    }
    
    const sanitizedHeaders = { ...customHeaders };
    if (sanitizedHeaders["Authorization"]) {
      sanitizedHeaders["Authorization"] = "[REDACTED]";
    }
    if (sanitizedHeaders["api-key"]) {
      sanitizedHeaders["api-key"] = "[REDACTED]";
    }
    
    console.log("Request headers:", sanitizedHeaders);
    
    return headers;
  }

  private getEnableStreamingFromConfig(): boolean {
    if (this.modelConfig?.defaultCompletionOptions?.stream !== undefined) {
      console.log("Model-specific stream setting found:", this.modelConfig.defaultCompletionOptions.stream);
      return this.modelConfig.defaultCompletionOptions.stream;
    }
    
    if (this.globalConfig?.stream !== undefined) {
      console.log("Global stream setting found:", this.globalConfig.stream);
      return this.globalConfig.stream;
    }
    
    console.log("No stream setting found in config, using default: true");
    return true;
  }

  // Format thinking content for better readability
  private formatThinkingText(text: string): string {
    // Add Markdown formatting to improve readability
    
    // Format numbered lists
    text = text.replace(/^(\d+)\.\s+(.+)$/gm, "**$1.** $2");
    
    // Format section headers
    text = text.replace(/^(Step \d+:)(.+)$/gmi, "### $1$2");
    text = text.replace(/^(Let's|I'll|I will|First|Now|Next|Finally|Then)(.+):$/gmi, "### $1$2:");
    
    // Emphasize key insights
    text = text.replace(/(Key insight|Note|Important|Remember):/gi, "**$1:**");
    
    // Format code blocks
    text = text.replace(/```([\s\S]*?)```/g, (match) => {
      return match.replace(/\n/g, '\n    ');
    });
    
    // Detect thinking phases based on content
    if (text.match(/start|let's|i'll|i will|first/i)) {
      this.thinkingPhase = "planning";
      this.thinkingProgress = 0.1;
    } else if (text.match(/analyze|examining|looking at/i)) {
      this.thinkingPhase = "analyzing";
      this.thinkingProgress = 0.3;
    } else if (text.match(/approach|strategy|method/i)) {
      this.thinkingPhase = "strategizing";
      this.thinkingProgress = 0.5;
    } else if (text.match(/implement|create|write|coding/i)) {
      this.thinkingPhase = "implementing";
      this.thinkingProgress = 0.7;
    } else if (text.match(/review|check|verify|test/i)) {
      this.thinkingPhase = "reviewing";
      this.thinkingProgress = 0.9;
    } else if (text.match(/conclusion|summary|final|therefore/i)) {
      this.thinkingPhase = "concluding";
      this.thinkingProgress = 1.0;
    } else {
      // Increment progress based on tokens
      const tokenEstimate = Math.round(text.length / 4);
      const progressIncrement = tokenEstimate / 16000 * 0.2;
      this.thinkingProgress = Math.min(0.95, this.thinkingProgress + progressIncrement);
    }
    
    // バッファに現在のチャンクを追加
    this.thinkingBuffer += text;
    this.pendingThinkingUpdates.push(text);
    
    // 更新間隔に達したときだけ思考パネルを更新
    const now = Date.now();
    if (now - this.lastThinkingUpdateTime > this.thinkingUpdateInterval) {
      // 保留中の更新をすべて送信
      if (this.pendingThinkingUpdates.length > 0) {
        const combinedUpdates = this.pendingThinkingUpdates.join("");
        this.pendingThinkingUpdates = [];
        
        // 思考パネルを更新
        updateThinking(combinedUpdates, this.thinkingPhase, this.thinkingProgress);
        this.lastThinkingUpdateTime = now;
      }
    }
    
    return text;
  }
  
  // Estimate thinking progress based on elapsed time, tokens, and phase
  private estimateThinkingProgress(): number {
    const elapsedMs = Date.now() - this.thinkingStartTime;
    const elapsedSec = elapsedMs / 1000;
    
    // Weight by elapsed time (max 2 minutes expected for thinking)
    const timeProgress = Math.min(1.0, elapsedSec / 120);
    
    // Weight by token usage (assuming budget from config)
    const tokenBudget = this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 16000;
    const tokenProgress = Math.min(1.0, this.totalThinkingTokens / tokenBudget);
    
    // Combine with phase-based progress (from content analysis)
    return Math.min(0.95, (timeProgress * 0.3) + (tokenProgress * 0.3) + (this.thinkingProgress * 0.4));
  }

  // ツール定義をDatabricksのAPI形式に変換
  private static convertToolDefinitionsForDatabricks(tools: any[]): any[] {
    return tools.map(tool => {
      // Databricks API形式に変換
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
    console.log("Converting args with options:", {
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
      maxTokens: options.maxTokens,
      reasoning: options.reasoning,
      reasoningBudgetTokens: options.reasoningBudgetTokens,
      stream: options.stream,
      // ツール関連のオプションも表示
      tools: options.tools ? `[${options.tools.length} tools]` : undefined,
      toolChoice: options.toolChoice
    });
    
    const enableStreaming = this.getEnableStreamingFromConfig();
    console.log("Streaming mode:", enableStreaming ? "enabled" : "disabled", "(loaded from config file)");
    
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
    
    if (!isClaudeSonnet37 || !isThinkingEnabled) {
      finalOptions.top_k = options.topK ?? this.modelConfig?.defaultCompletionOptions?.topK ?? 100;
      finalOptions.top_p = options.topP ?? this.modelConfig?.defaultCompletionOptions?.topP ?? 0.95;
      
      if (isThinkingEnabled) {
        console.log("Note: Using top_k and top_p with thinking mode may affect performance");
      }
    } else {
      console.log("Omitting top_k and top_p parameters for Claude 3.7 with thinking enabled");
    }
    
    if (isThinkingEnabled) {
      // Reset thinking tracking variables for a new request
      this.thinkingProgress = 0;
      this.thinkingPhase = "initial";
      this.thinkingBuffer = "";
      this.totalThinkingTokens = 0;
      this.thinkingStartTime = Date.now();
      this.lastThinkingUpdateTime = Date.now();
      this.pendingThinkingUpdates = [];
      
      // Notify the thinking panel that we're starting to think
      updateThinking("Starting a new thinking process...\n\n", "initial", 0);
      
      if (isClaudeSonnet37) {
        finalOptions.thinking = {
          type: "enabled",
          budget_tokens: thinkingBudget
        };
        console.log("Added Claude 3.7 thinking parameter with budget:", thinkingBudget);
      } else {
        finalOptions.thinking = {
          type: "enabled",
          budget_tokens: thinkingBudget
        };
        console.log("Added thinking parameter with budget:", thinkingBudget);
      }
      
      console.log("Ensured max_tokens is greater than thinking budget:", maxTokens);
    }
    
    // ツール関連の設定を追加
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      console.log("Adding tool definitions to request");
      finalOptions.tools = Databricks.convertToolDefinitionsForDatabricks(options.tools);
      
      // ツール選択方法を設定
      if (options.toolChoice) {
        finalOptions.tool_choice = options.toolChoice;
      } else {
        finalOptions.tool_choice = "auto";
      }
      
      console.log(`Added ${finalOptions.tools.length} tools to request with tool_choice=${finalOptions.tool_choice}`);
    }
    
    console.log("Final API parameters:", JSON.stringify(finalOptions, null, 2));
    
    return finalOptions;
  }

  private convertMessages(msgs: ChatMessage[]): any[] {
    console.log(`Converting ${msgs.length} messages to Databricks format`);
    
    const filteredMessages = msgs.filter(
      (m) => m.role !== "system" && !!m.content
    );
    
    const messages = filteredMessages.map((message) => {
      if (typeof message.content === "string") {
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      } else if (message.role === "assistant" && message.toolCalls) {
        // ツール呼び出しを含むアシスタントメッセージをサポート
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
        // ツール応答メッセージをサポート
        return {
          role: "tool",
          content: message.content || "",
          tool_call_id: message.toolCallId
        };
      } else {
        console.log("Converting complex message content");
        return {
          role: message.role === "user" ? "user" : "assistant",
          content: message.content
        };
      }
    });
    
    console.log(`Converted to ${messages.length} messages`);
    return messages;
  }

  private extractSystemMessage(msgs: ChatMessage[]): string | undefined {
    const systemMessage = stripImages(
      msgs.filter((m) => m.role === "system")[0]?.content ?? ""
    );
    
    if (systemMessage) {
      console.log("Found system message, length:", systemMessage.length);
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
    
    const enableThinking = options.reasoning || 
      (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    if (enableThinking && !isClaudeSonnet37) {
      const budgetTokens = options.reasoningBudgetTokens || 
        this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
        16000;
      
      const thinkingInstructions = `\n\nI'd like you to solve this problem step-by-step, showing your reasoning process clearly. Take your time to think through this thoroughly before giving your final answer. Use up to ${budgetTokens} tokens to explore different approaches and ensure your solution is correct.`;
      
      systemMessage += thinkingInstructions;
      console.log("Added thinking instructions to system message for non-Claude 3.7 model");
    } else if (enableThinking && isClaudeSonnet37) {
      console.log("Using Claude 3.7 native thinking capabilities via API parameters");
    }
    
    // Agentモードを使用する場合の追加指示
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      const agentInstructions = `\n\nWhen appropriate, use the provided tools to help solve the problem. These tools allow you to interact with the external environment to gather information or perform actions needed to complete the task.`;
      
      systemMessage += agentInstructions;
      console.log("Added agent instructions to system message");
    }
    
    return systemMessage;
  }

  private tryRecoverContentFromBuffer(buffer: string): string | null {
    try {
      buffer = buffer.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g, match => {
        try {
          return match;
        } catch (e) {
          return '';
        }
      });
    
      const jsonPattern = /{[\s\S]*?}/g;
      const jsonMatches = buffer.match(jsonPattern);
      
      if (!jsonMatches || jsonMatches.length === 0) {
        return null;
      }
      
      const sortedMatches = [...jsonMatches].sort((a, b) => b.length - a.length);
      
      for (const match of sortedMatches) {
        try {
          const json = JSON.parse(match);
          
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
            return "[Thinking Process] " + json.thinking;
          }
          
          // ツール呼び出しの処理
          if (json.tool_calls) {
            return JSON.stringify(json.tool_calls);
          }
        } catch (e) {
          continue;
        }
      }
      
      const textMatches = buffer.match(/\"text\":\s*\"([\s\S]*?)\"/g);
      if (textMatches && textMatches.length > 0) {
        const longestTextMatch = [...textMatches].sort((a, b) => b.length - a.length)[0];
        const content = longestTextMatch.replace(/\"text\":\s*\"/, "").replace(/\"$/, "");
        return content;
      }
      
      return null;
    } catch (e) {
      console.error("Error recovering content from buffer:", e);
      return null;
    }
  }

  private processChunk(chunk: Uint8Array | Buffer): string {
    try {
      const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });
      return decoder.decode(chunk, { stream: true });
    } catch (e) {
      console.error("Chunk decoding error:", e);
      
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
    console.log("_streamChat called with messages length:", msgs.length);
    
    const convertedMessages = this.convertMessages(msgs);
    const originalSystemMessage = this.extractSystemMessage(msgs);
    
    const enhancedSystemMessage = this.createEnhancedSystemMessage(options, originalSystemMessage);
    
    // Agent機能のためのツール定義サポートを追加
    let toolsParameter: any = undefined;
    
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      console.log(`Converting ${options.tools.length} tools for Databricks API`);
      toolsParameter = Databricks.convertToolDefinitionsForDatabricks(options.tools);
    }
    
    const body = {
      ...this.convertArgs(options),
      messages: convertedMessages,
      system: enhancedSystemMessage
    };
    
    // ツールが定義されている場合はリクエストに追加
    if (toolsParameter) {
      body.tools = toolsParameter;
      // ツールの選択パラメータを設定
      body.tool_choice = options.toolChoice || "auto";
    }
    
    const enableStreaming = this.getEnableStreamingFromConfig();
    body.stream = enableStreaming && (body.stream !== false);
    
    const sanitizedBody = { ...body };
    if (body.messages) {
      sanitizedBody.messages = `[${convertedMessages.length} messages]`;
    }
    console.log("Sending request with body:", JSON.stringify(sanitizedBody, null, 2));
    
    const invocationUrl = this.getInvocationUrl();
    console.log("Sending request to:", this.sanitizeUrlForLogs(invocationUrl));
    
    try {
      const timeout = this.getTimeoutFromConfig();
      
      const fetchOptions = {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
        timeout: timeout
      };
      
      console.log("Timeout setting:", `${timeout}ms`);
      
      const res = await this.fetch(invocationUrl, fetchOptions);
      
      console.log("Response status:", res.status);
      console.log("Response headers:", Object.fromEntries([...res.headers.entries()]));
      console.log("Content type:", res.headers.get("content-type"));
      
      if (!res.ok || !res.body) {
        const errorMsg = `HTTP ${res.status}`;
        console.error("HTTP error response:", res.status, res.statusText);
        throw new Error(errorMsg);
      }

      if (body.stream === false) {
        console.log("Non-streaming mode, processing single response");
        const jsonResponse = await res.json();
        console.log("Received complete response:", JSON.stringify(jsonResponse, null, 2));
        
        try {
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
                content: "Complex response format: " + JSON.stringify(contentValue)
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
          } else if (jsonResponse.tool_calls && Array.isArray(jsonResponse.tool_calls)) {
            // ツール呼び出しの処理
            const message: ChatMessage = {
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
            yield message;
          } else {
            console.log("Unknown response format:", jsonResponse);
            const message: ChatMessage = {
              role: "assistant",
              content: "Response format not recognized: " + JSON.stringify(jsonResponse)
            };
            yield message;
          }
        } catch (e) {
          console.error("Response processing error:", e);
          throw e;
        }
        return;
      }
      
      const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });
      let buffer = "";
      let rawBuffer = "";
      let thinkingContent = "";
      
      const parseSSE = (
        str: string,
      ): { done: boolean; messages: (ChatMessage | ThinkingContent)[] } => {
        buffer += str;
        const out: (ChatMessage | ThinkingContent)[] = [];
        
        const thinkingStartRegex = /^thinking:(.*)$/i;
        
        if (buffer.trim() && !buffer.includes("\n")) {
          try {
            const trimmedBuffer = buffer.trim();
            const jsonStr = trimmedBuffer.startsWith("data:") ? 
                         trimmedBuffer.slice(trimmedBuffer.indexOf("{")) : 
                         trimmedBuffer;
            
            console.log("Attempting to parse single JSON:", jsonStr);
            
            const json = JSON.parse(jsonStr);
            console.log("Parsed single JSON:", json);
            
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
                
              buffer = "";
              
              // Signal the thinking panel that thinking is complete
              thinkingCompleted();
              
              return { done: true, messages: out };
            }
            
            if (json.choices && json.choices[0]?.message?.content) {
              console.log("Detected complete response in OpenAI format");
              
              const message: ChatMessage = {
                role: "assistant",
                content: json.choices[0].message.content
              };
              out.push(message);
              buffer = "";
              
              // Signal the thinking panel that thinking is complete
              thinkingCompleted();
              
              return { done: true, messages: out };
            }
            
            // ツール呼び出しの検出
            if (json.choices && json.choices[0]?.message?.tool_calls) {
              console.log("Detected tool calls response");
              
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
              
              // Signal the thinking panel that thinking is complete
              thinkingCompleted();
              
              return { done: true, messages: out };
            }
            
            if (json.thinking || (json.content && json.content[0]?.type === "reasoning")) {
              const thinkingContent = json.thinking || 
                                    (json.content && json.content[0]?.type === "reasoning" 
                                      ? json.content[0].summary?.[0]?.text || "" 
                                      : "");
              
              if (thinkingContent) {
                console.log("Detected Claude 3.7 thinking output (single JSON)");
                
                // Format thinking content for better readability
                const formattedThinking = this.formatThinkingText(thinkingContent);
                
                // Track token usage
                const tokenEstimate = Math.round(thinkingContent.length / 4);
                this.totalThinkingTokens += tokenEstimate;
                
                // Update progress estimate
                const progress = this.estimateThinkingProgress();
                
                // Send as ThinkingContent instead of ChatMessage
                const thinkingMessage: ThinkingContent = {
                  type: "thinking",
                  thinking: formattedThinking,
                  metadata: {
                    phase: this.thinkingPhase,
                    progress: progress,
                    tokens: this.totalThinkingTokens,
                    elapsed_ms: Date.now() - this.thinkingStartTime
                  }
                };
                
                // 特別なフラグを設定して即時更新を強制
                const chatMessage: ThinkingChatMessage = {
                  role: "assistant",
                  content: `[thinking] ${formattedThinking}`,
                  isThinking: true,
                  thinking_metadata: {
                    phase: this.thinkingPhase,
                    progress: progress,
                    formatted_text: formattedThinking
                  }
                };
                
                out.push(chatMessage as ChatMessage);
                buffer = "";
                return { done: false, messages: out };
              }
            }
          } catch (e) {
            console.log("Single JSON parsing error, switching to line parsing:", e);
          }
        }
        
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          
          console.log("Processing line:", line);
          
          if (!line) continue;
          
          if (!line.startsWith("data:") && !line.startsWith("data: ")) {
            const thinkingMatch = line.match(thinkingStartRegex);
            if (thinkingMatch) {
              const thinkingContent = thinkingMatch[1].trim();
              console.log("Detected Claude 3.7 thinking marker:", thinkingContent);
              
              // Format thinking content for better readability
              const formattedThinking = this.formatThinkingText(thinkingContent);
              
              // Track token usage
              const tokenEstimate = Math.round(thinkingContent.length / 4);
              this.totalThinkingTokens += tokenEstimate;
              
              // Update progress estimate
              const progress = this.estimateThinkingProgress();
              
              // 特別なフラグを設定して即時更新を強制
              const chatMessage: ThinkingChatMessage = {
                role: "assistant",
                content: `[thinking] ${formattedThinking}`,
                isThinking: true,
                thinking_metadata: {
                  phase: this.thinkingPhase,
                  progress: progress,
                  formatted_text: formattedThinking
                }
              };
              
              out.push(chatMessage as ChatMessage);
              continue;
            }
            
            console.log("Skipping line without data: prefix:", line);
            continue;
          }
          
          const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();
          
          if (data === "[DONE]") {
            console.log("Received [DONE] marker");
            
            // Signal the thinking panel that thinking is complete
            thinkingCompleted();
            
            return { done: true, messages: out };
          }
          
          try {
            const json = JSON.parse(data);
            console.log("Received SSE data:", JSON.stringify(json, null, 2));
            
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
                
              // Signal the thinking panel that thinking is complete
              thinkingCompleted();
                
              return { done: true, messages: out };
            }
            
            if (json.thinking || (json.content && json.content[0]?.type === "reasoning")) {
              console.log("Detected thinking output");
              let newThinkingContent = "";
              
              if (json.thinking) {
                newThinkingContent = json.thinking;
              } else if (json.content && json.content[0]?.type === "reasoning") {
                newThinkingContent = json.content[0].summary?.[0]?.text || "";
              }
              
              if (newThinkingContent) {
                thinkingContent += newThinkingContent;
                this.thinkingBuffer += newThinkingContent;
                
                console.log("\n==== THINKING OUTPUT ====");
                console.log(newThinkingContent);
                console.log("========================\n");
                
                // Format thinking content for better readability
                const formattedThinking = this.formatThinkingText(newThinkingContent);
                
                // Track token usage
                const tokenEstimate = Math.round(newThinkingContent.length / 4);
                this.totalThinkingTokens += tokenEstimate;
                
                // Update progress estimate
                const progress = this.estimateThinkingProgress();
                
                // 特別なフラグを設定して即時更新を強制
                const chatMessage: ThinkingChatMessage = {
                  role: "assistant",
                  content: `[thinking] ${formattedThinking}`,
                  isThinking: true,
                  thinking_metadata: {
                    phase: this.thinkingPhase,
                    progress: progress,
                    formatted_text: formattedThinking
                  }
                };
                
                out.push(chatMessage as ChatMessage);
              }
            }
            else if (json.type === "content_block_start" && json.content_block?.type === "thinking") {
              console.log("Detected Anthropic thinking block start");
              
              if (json.content_block.thinking) {
                const thinkingText = json.content_block.thinking;
                
                // Format thinking content for better readability
                const formattedThinking = this.formatThinkingText(thinkingText);
                
                // Track token usage
                const tokenEstimate = Math.round(thinkingText.length / 4);
                this.totalThinkingTokens += tokenEstimate;
                
                // Update progress estimate
                const progress = this.estimateThinkingProgress();
                
                // 特別なフラグを設定して即時更新を強制
                const chatMessage: ThinkingChatMessage = {
                  role: "assistant",
                  content: `[thinking] ${formattedThinking}`,
                  isThinking: true,
                  thinking_metadata: {
                    phase: this.thinkingPhase,
                    progress: progress,
                    formatted_text: formattedThinking
                  }
                };
                
                out.push(chatMessage as ChatMessage);
              }
            }
            else if (json.type === "content_block_delta" && json.delta?.type === "thinking_delta") {
              console.log("Detected Anthropic thinking delta");
              
              if (json.delta.thinking) {
                const thinkingDelta = json.delta.thinking;
                
                // Format thinking content for better readability
                const formattedThinking = this.formatThinkingText(thinkingDelta);
                
                // Track token usage
                const tokenEstimate = Math.round(thinkingDelta.length / 4);
                this.totalThinkingTokens += tokenEstimate;
                
                // Update progress estimate
                const progress = this.estimateThinkingProgress();
                
                // 特別なフラグを設定して即時更新を強制
                const chatMessage: ThinkingChatMessage = {
                  role: "assistant",
                  content: `[thinking] ${formattedThinking}`,
                  isThinking: true,
                  thinking_metadata: {
                    phase: this.thinkingPhase,
                    progress: progress,
                    formatted_text: formattedThinking
                  }
                };
                
                out.push(chatMessage as ChatMessage);
              }
            }
            else if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
              console.log("Detected Anthropic text delta");
              
              const message: ChatMessage = {
                role: "assistant",
                content: json.delta.text || ""
              };
              out.push(message);
            }
            else if (json.choices && json.choices[0]?.delta?.content) {
              console.log("Detected OpenAI format delta");
              
              const message: ChatMessage = {
                role: "assistant",
                content: json.choices[0].delta.content
              };
              out.push(message);
            }
            else if (json.choices && json.choices[0]?.delta?.tool_calls) {
              console.log("Detected OpenAI tool calls delta");
              
              // ツール呼び出しのデルタ更新
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
            else if (json.content && typeof json.content === "string") {
              console.log("Detected direct content format");
              
              const message: ChatMessage = {
                role: "assistant",
                content: json.content
              };
              out.push(message);
            }
            else if (json.content && Array.isArray(json.content) && json.content[0]?.text) {
              console.log("Detected content array format");
              
              const message: ChatMessage = {
                role: "assistant",
                content: json.content[0].text
              };
              out.push(message);
            }
            else if (json.text) {
              console.log("Detected direct text format");
              
              const message: ChatMessage = {
                role: "assistant",
                content: json.text
              };
              out.push(message);
            }
            else if (json.tool_calls && Array.isArray(json.tool_calls)) {
              console.log("Detected direct tool calls format");
              
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
            else {
              const delta = fromChatCompletionChunk(json);
              if (delta?.content) {
                console.log("Extracted content from OpenAI format chunk");
                
                const message: ChatMessage = {
                  role: "assistant",
                  content: delta.content
                };
                out.push(message);
              } else {
                console.log("Unknown JSON format:", json);
              }
            }
          } catch (e) {
            console.log("JSON parsing error in SSE stream:", e);
            
            continue;
          }
        }
        return { done: false, messages: out };
      };
      
      if (typeof (res.body as any).getReader === "function") {
        console.log("Using WHATWG streams reader");
        const reader = (res.body as any).getReader();
        
        const startTime = Date.now();
        let chunkCount = 0;
        
        const streamTimeout = this.getTimeoutFromConfig();
        let lastActivityTimestamp = Date.now();
        
        while (true) {
          try {
            const { done, value } = await reader.read();
            
            lastActivityTimestamp = Date.now();
            
            if (Date.now() - startTime > streamTimeout) {
              return;
            }
            
            if (done) {
              console.log("Stream reading complete");
              
              // Signal the thinking panel that thinking is complete
              thinkingCompleted();
              
              break;
            }
            
            chunkCount++;
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            
            const chunkSize = value ? value.length : 0;
            console.log(`[${elapsedSec}s] Received chunk (bytes):`, value ? 
              Array.from(new Uint8Array(value as ArrayBuffer)).map((b: number) => b.toString(16)).join(' ') : 
              'null');
            
            const decodedChunk = this.processChunk(value as Uint8Array);
            rawBuffer += decodedChunk;
            console.log(`[${elapsedSec}s] Received chunk (text):`, decodedChunk);
            
            if (!decodedChunk || decodedChunk.trim() === "") {
              console.log("Received empty chunk");
              continue;
            }
            
            const { done: end, messages } = parseSSE(decodedChunk);
            
            // 各メッセージごとに即時yieldして出力を更新
            for (const m of messages) {
              // 大きな思考チャンクを分割して処理（UIのレスポンシブ性向上）
              if ('type' in m && m.type === 'thinking' && m.thinking.length > 2000) {
                // 長い思考内容は段落ごとに分割して処理
                const paragraphs = m.thinking.split(/\n\n+/);
                let buffer = "";
                
                for (const paragraph of paragraphs) {
                  buffer += paragraph + "\n\n";
                  
                  // ある程度たまったらyield
                  if (buffer.length > 500) {
                    const chatMessage: ThinkingChatMessage = {
                      role: "assistant",
                      content: `[thinking] ${buffer}`,
                      isThinking: true,
                      thinking_metadata: {
                        phase: this.thinkingPhase,
                        progress: this.thinkingProgress,
                        formatted_text: buffer
                      }
                    };
                    yield chatMessage as ChatMessage;
                    buffer = "";
                  }
                }
                
                // 残りがあれば最後にyield
                if (buffer) {
                  const chatMessage: ThinkingChatMessage = {
                    role: "assistant",
                    content: `[thinking] ${buffer}`,
                    isThinking: true,
                    thinking_metadata: {
                      phase: this.thinkingPhase,
                      progress: this.thinkingProgress,
                      formatted_text: buffer
                    }
                  };
                  yield chatMessage as ChatMessage;
                }
              }
              // ThinkingContentかどうかを確認
              else if ('type' in m && m.type === 'thinking') {
                // ThinkingContentをChatMessageに変換して返す
                const chatMessage: ThinkingChatMessage = {
                  role: "assistant",
                  content: `[thinking] ${m.thinking}`,
                  isThinking: true,
                  thinking_metadata: {
                    phase: this.thinkingPhase,
                    progress: this.thinkingProgress,
                    formatted_text: m.thinking
                  }
                };
                yield chatMessage as ChatMessage;
              } else if ((m as ThinkingChatMessage).isThinking) {
                // 既にThinkingChatMessageになっている場合はそのままyield
                yield m as ChatMessage;
              } else {
                // 通常のChatMessageの場合
                yield m as ChatMessage;
              }
            }
            
            if (end) {
              console.log("Detected stream end marker");
              
              const message: ChatMessage = {
                role: "assistant",
                content: ""
              };
              yield message;
              
              return;
            }
          } catch (chunkError) {
            console.error("Chunk reading error:", chunkError);
            
            if (Date.now() - lastActivityTimestamp > 10000) {
              console.log("No stream activity - terminating as unrecoverable");
              
              // Signal the thinking panel that thinking is complete
              try {
                if (typeof vscode !== 'undefined' && vscode && vscode.commands) {
                  vscode.commands.executeCommand('continue.thinkingCompleted');
                }
              } catch (e) {
                console.debug("Error executing VSCode command:", e);
                // Ignore errors, as vscode API might not be available
              }
              
              const message: ChatMessage = {
                role: "assistant",
                content: "[Stream interrupted] Partial response: " + 
                        (thinkingContent ? "\n\n[Thinking Process]\n" + thinkingContent.substring(0, 1000) + "..." : "")
              };
              yield message;
              return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        if (buffer.trim()) {
          console.log("Processing remaining buffer:", buffer.length);
          const { messages } = parseSSE("");
          for (const m of messages) {
            if ('type' in m && m.type === 'thinking') {
              // ThinkingContentをChatMessageに変換して返す
              const chatMessage: ThinkingChatMessage = {
                role: "assistant", 
                content: `[thinking] ${m.thinking}`,
                isThinking: true,
                thinking_metadata: {
                  phase: this.thinkingPhase,
                  progress: this.thinkingProgress,
                  formatted_text: m.thinking
                }
              };
              yield chatMessage as ChatMessage;
            } else {
              yield m as ChatMessage;
            }
          }
        }
        
        if (thinkingContent) {
          console.log("\n======= THINKING PROCESS SUMMARY =======");
          console.log("Estimated tokens generated in thinking mode:", Math.round(thinkingContent.length / 4));
          console.log("Processing time:", ((Date.now() - startTime) / 1000).toFixed(2), "seconds");
          console.log("======================================\n");
        }
        
        console.log("Total received data size:", rawBuffer.length);
        return;
      }
      
      console.log("Using Node.js Readable stream");
      
      const startTime = Date.now();
      let chunkCount = 0;
      
      const streamTimeout = this.getTimeoutFromConfig();
      let lastActivityTimestamp = Date.now();
      
      try {
        for await (const chunk of res.body as any) {
          try {
            chunkCount++;
            
            lastActivityTimestamp = Date.now();
            
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (Date.now() - startTime > streamTimeout) {
              return;
            }
            
            console.log(`[${elapsedSec}s] Received chunk (bytes):`, typeof chunk === 'object' ? '(binary data)' : chunk);
            
            const decodedChunk = this.processChunk(chunk as Buffer);
            rawBuffer += decodedChunk;
            console.log(`[${elapsedSec}s] Received chunk (text):`, decodedChunk);
            
            if (!decodedChunk || decodedChunk.trim() === "") {
              console.log("Received empty chunk");
              continue;
            }
            
            const { done, messages } = parseSSE(decodedChunk);
            
            // 各メッセージごとに即時yieldして出力を更新
            for (const m of messages) {
              // 大きな思考チャンクを分割して処理（UIのレスポンシブ性向上）
              if ('type' in m && m.type === 'thinking' && m.thinking.length > 2000) {
                // 長い思考内容は段落ごとに分割して処理
                const paragraphs = m.thinking.split(/\n\n+/);
                let buffer = "";
                
                for (const paragraph of paragraphs) {
                  buffer += paragraph + "\n\n";
                  
                  // ある程度たまったらyield
                  if (buffer.length > 500) {
                    const chatMessage: ThinkingChatMessage = {
                      role: "assistant",
                      content: `[thinking] ${buffer}`,
                      isThinking: true,
                      thinking_metadata: {
                        phase: this.thinkingPhase,
                        progress: this.thinkingProgress,
                        formatted_text: buffer
                      }
                    };
                    yield chatMessage as ChatMessage;
                    buffer = "";
                  }
                }
                
                // 残りがあれば最後にyield
                if (buffer) {
                  const chatMessage: ThinkingChatMessage = {
                    role: "assistant",
                    content: `[thinking] ${buffer}`,
                    isThinking: true,
                    thinking_metadata: {
                      phase: this.thinkingPhase,
                      progress: this.thinkingProgress,
                      formatted_text: buffer
                    }
                  };
                  yield chatMessage as ChatMessage;
                }
              }
              // ThinkingContentかどうかを確認
              else if ('type' in m && m.type === 'thinking') {
                // ThinkingContentをChatMessageに変換して返す
                const chatMessage: ThinkingChatMessage = {
                  role: "assistant",
                  content: `[thinking] ${m.thinking}`,
                  isThinking: true,
                  thinking_metadata: {
                    phase: this.thinkingPhase,
                    progress: this.thinkingProgress,
                    formatted_text: m.thinking
                  }
                };
                yield chatMessage as ChatMessage;
              } else if ((m as ThinkingChatMessage).isThinking) {
                // 既にThinkingChatMessageになっている場合はそのままyield
                yield m as ChatMessage;
              } else {
                // 通常のChatMessageの場合
                yield m as ChatMessage;
              }
            }
            
            if (done) {
              console.log("Detected stream end marker");
              
              // Signal the thinking panel that thinking is complete
              try {
                if (typeof vscode !== 'undefined' && vscode && vscode.commands) {
                  vscode.commands.executeCommand('continue.thinkingCompleted');
                }
              } catch (e) {
                console.debug("Error executing VSCode command:", e);
                // Ignore errors, as vscode API might not be available
              }
              
              const message: ChatMessage = {
                role: "assistant",
                content: ""
              };
              yield message;
              
              return;
            }
          } catch (e) {
            console.error("Error during chunk processing:", e);
            
            if (Date.now() - lastActivityTimestamp > 10000) {
              console.log("No stream activity - terminating as unrecoverable");
              
              // Signal the thinking panel that thinking is complete
              try {
                if (typeof vscode !== 'undefined' && vscode && vscode.commands) {
                  vscode.commands.executeCommand('continue.thinkingCompleted');
                }
              } catch (e) {
                console.debug("Error executing VSCode command:", e);
                // Ignore errors, as vscode API might not be available
              }
              
              const message: ChatMessage = {
                role: "assistant",
                content: "[Stream interrupted] Partial response: " + 
                        (thinkingContent ? "\n\n[Thinking Process]\n" + thinkingContent.substring(0, 1000) + "..." : "")
              };
              yield message;
              return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        if (buffer.trim()) {
          console.log("Processing remaining buffer:", buffer.length);
          const { messages } = parseSSE("");
          for (const m of messages) {
            if ('type' in m && m.type === 'thinking') {
              // ThinkingContentをChatMessageに変換して返す
              const chatMessage: ThinkingChatMessage = {
                role: "assistant",
                content: `[thinking] ${m.thinking}`,
                isThinking: true,
                thinking_metadata: {
                  phase: this.thinkingPhase,
                  progress: this.thinkingProgress,
                  formatted_text: m.thinking
                }
              };
              yield chatMessage as ChatMessage;
            } else {
              yield m as ChatMessage;
            }
          }
        }
        
        if (thinkingContent) {
          console.log("\n======= THINKING PROCESS SUMMARY =======");
          console.log("Estimated tokens generated in thinking mode:", Math.round(thinkingContent.length / 4));
          console.log("Processing time:", ((Date.now() - startTime) / 1000).toFixed(2), "seconds");
          console.log("======================================\n");
        }
        
        console.log("Total received data size:", rawBuffer.length);
      } catch (streamError) {
        console.error("Error during stream reading:", streamError);
        
        // Signal the thinking panel that thinking is complete
        thinkingCompleted();
        
        if (rawBuffer && rawBuffer.trim()) {
          try {
            console.log("Attempting to recover from buffer after error");
            const recoveredContent = this.tryRecoverContentFromBuffer(rawBuffer);
            if (recoveredContent) {
              const message: ChatMessage = {
                role: "assistant",
                content: recoveredContent
              };
              yield message;
            }
          } catch (recoveryError) {
            console.error("Error during recovery processing:", recoveryError);
          }
        }
        
        throw streamError;
      }
    } catch (error) {
      console.error("Error in _streamChat:", error);
      
      // Signal the thinking panel that thinking is complete
      thinkingCompleted();
      
      throw error;
    }
  }
}