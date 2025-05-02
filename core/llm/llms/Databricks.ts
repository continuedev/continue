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

import { registerThinkingPanel } from './thinkingPanel';
import { setExtensionContext, getExtensionContext } from './index';

// ThinkingPanelをエクスポート
export { registerThinkingPanel, setExtensionContext, getExtensionContext };

export default class Databricks extends OpenAI {
  static providerName = "databricks";
  private modelConfig: any = null;
  private globalConfig: any = null;
  capabilities: ModelCapability = {
    tools: true,
    uploadImage: false
  };
  
  private thinkingProgress: number = 0;
  private thinkingPhase: string = "initial";
  private thinkingBuffer: string = "";
  private thinkingContentBuffer: string = "";
  private totalThinkingTokens: number = 0;
  private thinkingStartTime: number = 0;
  private lastThinkingUpdateTime: number = 0;
  private thinkingUpdateInterval: number = 2000;
  private pendingThinkingUpdates: string[] = [];
  private sentThinkingHashes: Set<string> = new Set<string>();
  private isStreamActive: boolean = false;
  private hasCompletedThinking: boolean = false;
  private thinkingStarted: boolean = false;
  private useStepByStepThinking: boolean = false;
  private bufferTimeoutId: NodeJS.Timeout | null = null;
  private sentCompleteSentences: Set<string> = new Set<string>();
  private maxRetryAttempts: number = 3; // 最大リトライ回数を設定
  
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
              
              if (modelConfig.defaultCompletionOptions.stepByStepThinking === undefined) {
                modelConfig.defaultCompletionOptions.stepByStepThinking = true;
              }
              
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
    
    if (!config.defaultCompletionOptions) {
      config.defaultCompletionOptions = {};
    }
    
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
    
    if (isClaudeSonnet37) {
      const options = config.defaultCompletionOptions;
      
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
      
      if (options.stepByStepThinking === undefined) {
        options.stepByStepThinking = true;
      } else if (typeof options.stepByStepThinking !== "boolean") {
        options.stepByStepThinking = true;
      }
      
      if (options.stream === undefined) {
        options.stream = true;
      }
      
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
      capabilities: {
        tools: Array.isArray(modelConfig.capabilities) ? 
              modelConfig.capabilities.includes("tool_use") : 
              true,
        uploadImage: Array.isArray(modelConfig.capabilities) ? 
                   modelConfig.capabilities.includes("image_input") : 
                   false
      }
    };
    
    opts.apiBase = (opts.apiBase ?? "").replace(/\/+$/, "");
    
    super(opts);
    
    this.modelConfig = modelConfig;
    this.globalConfig = globalConfig;
    
    this.useStepByStepThinking = this.modelConfig?.defaultCompletionOptions?.stepByStepThinking === true;
    
    // キャパビリティの検出
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
    return 600000;
  }

  private getInvocationUrl(): string {
    return (this.apiBase ?? "").replace(/\/+$/, "");
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

  private hashThinkingContent(text: string): string {
    return text.substring(0, 100);
  }

  private formatThinkingText(text: string): string {
    const contentHash = this.hashThinkingContent(text);
    if (this.sentThinkingHashes.has(contentHash)) {
      return "";
    }
    
    this.sentThinkingHashes.add(contentHash);
    
    // HTMLエスケープは thinkingPanel.ts で行うため、ここでは行わない
    
    text = text.replace(/^(\d+)\.\s+(.+)$/gm, "**$1.** $2");
    text = text.replace(/^(Step \d+)[:：](.+)$/gm, "### $1:$2");
    text = text.replace(/^(Let's|I'll|I will|First|Now|Next|Finally|Then)(.+):$/gmi, "### $1$2:");
    
    if (this.useStepByStepThinking) {
      text = text.replace(/^(First|To start|Initially|Let me start by)(.+?)[:：]/gmi, "### Initial Analysis:$2:");
      text = text.replace(/^(Next|Then|Moving on|After that|Subsequently)(.+?)[:：]/gmi, "### Next Step:$2:");
      text = text.replace(/^(Finally|In conclusion|To conclude|Therefore|As a result)(.+?)[:：]/gmi, "### Conclusion:$2:");
    }
    
    text = text.replace(/(Key insight|Note|Important|Remember|Key point)[:：]/gi, "**$1:**");
    
    text = text.replace(/```([\s\S]*?)```/g, (match) => {
      return match.replace(/\n/g, '\n    ');
    });
    
    if (text.match(/start|let's|i'll|i will|first/i)) {
      this.thinkingPhase = this.useStepByStepThinking ? "initial_analysis" : "planning";
      this.thinkingProgress = 0.1;
    } else if (text.match(/analyze|examining|looking at/i)) {
      this.thinkingPhase = this.useStepByStepThinking ? "analyzing" : "analyzing";
      this.thinkingProgress = 0.3;
    } else if (text.match(/approach|strategy|method/i)) {
      this.thinkingPhase = this.useStepByStepThinking ? "strategizing" : "strategizing";
      this.thinkingProgress = 0.5;
    } else if (text.match(/implement|create|write|coding/i)) {
      this.thinkingPhase = this.useStepByStepThinking ? "implementing" : "implementing";
      this.thinkingProgress = 0.7;
    } else if (text.match(/review|check|verify|test/i)) {
      this.thinkingPhase = this.useStepByStepThinking ? "reviewing" : "reviewing";
      this.thinkingProgress = 0.9;
    } else if (text.match(/conclusion|summary|final|therefore/i)) {
      this.thinkingPhase = this.useStepByStepThinking ? "concluding" : "concluding";
      this.thinkingProgress = 1.0;
    } else {
      const tokenEstimate = Math.round(text.length / 4);
      const progressIncrement = tokenEstimate / 16000 * 0.2;
      this.thinkingProgress = Math.min(0.95, this.thinkingProgress + progressIncrement);
    }
    
    this.thinkingBuffer += text;
    
    // バッファを使用して思考コンテンツを更新
    this.thinkingContentBuffer += text;
    this.flushThinkingBufferIfReady();
    
    return text;
  }
  
  private flushThinkingBufferIfReady() {
    if (this.bufferTimeoutId) {
      clearTimeout(this.bufferTimeoutId);
    }
    
    this.bufferTimeoutId = setTimeout(() => {
      if (this.thinkingContentBuffer.trim()) {
        // バッファ全体を送信してクリアする (簡素化)
        updateThinking(this.thinkingContentBuffer, this.thinkingPhase, this.thinkingProgress);
        this.thinkingContentBuffer = "";
      }
      
      this.bufferTimeoutId = null;
    }, 500);
  }
  
  private hashSentence(sentence: string): string {
    return sentence.substring(0, 100) + sentence.length.toString();
  }
  
  private estimateThinkingProgress(): number {
    const elapsedMs = Date.now() - this.thinkingStartTime;
    const elapsedSec = elapsedMs / 1000;
    
    const timeProgress = Math.min(1.0, elapsedSec / 120);
    
    const tokenBudget = this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 16000;
    const tokenProgress = Math.min(1.0, this.totalThinkingTokens / tokenBudget);
    
    return Math.min(0.95, (timeProgress * 0.3) + (tokenProgress * 0.3) + (this.thinkingProgress * 0.4));
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
    
    this.useStepByStepThinking = 
      options.stepByStepThinking !== undefined ? 
      !!options.stepByStepThinking : 
      (this.modelConfig?.defaultCompletionOptions?.stepByStepThinking === true);
    
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
    
    if (this.useStepByStepThinking && options.temperature === undefined && 
        this.modelConfig?.defaultCompletionOptions?.temperature === undefined) {
      finalOptions.temperature = 0.6;
    }
    
    if (!isClaudeSonnet37 || !isThinkingEnabled) {
      finalOptions.top_k = options.topK ?? this.modelConfig?.defaultCompletionOptions?.topK ?? 100;
      finalOptions.top_p = options.topP ?? this.modelConfig?.defaultCompletionOptions?.topP ?? 0.95;
    }
    
    if (isThinkingEnabled && !this.thinkingStarted) {
      this.thinkingProgress = 0;
      this.thinkingPhase = "initial";
      this.thinkingBuffer = "";
      this.thinkingContentBuffer = "";
      this.totalThinkingTokens = 0;
      this.thinkingStartTime = Date.now();
      this.lastThinkingUpdateTime = Date.now();
      this.pendingThinkingUpdates = [];
      this.isStreamActive = false;
      this.hasCompletedThinking = false;
      this.sentThinkingHashes.clear();
      this.sentCompleteSentences.clear();
      this.thinkingStarted = true;
      
      if (this.bufferTimeoutId) {
        clearTimeout(this.bufferTimeoutId);
        this.bufferTimeoutId = null;
      }
      
      const startMessage = this.useStepByStepThinking ? 
        "Starting step-by-step thinking process...\n\n" : 
        "Starting a new thinking process...\n\n";
      
      updateThinking(startMessage, "initial", 0);
      
      finalOptions.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget
      };
    }
    
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      finalOptions.tools = Databricks.convertToolDefinitionsForDatabricks(options.tools);
      finalOptions.tool_choice = options.toolChoice || "auto";
    }
    
    return finalOptions;
  }

  private convertMessages(msgs: ChatMessage[]): any[] {
    const filteredMessages = msgs.filter(m => m.role !== "system" && !!m.content);
    
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
    
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      const agentInstructions = `\n\nWhen appropriate, use the provided tools to help solve the problem. These tools allow you to interact with the external environment to gather information or perform actions needed to complete the task.`;
      systemMessage += agentInstructions;
    }
    
    return systemMessage;
  }

  private tryRecoverContentFromBuffer(buffer: string): string | null {
    try {
      buffer = buffer.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g, match => {
        try { return match; } catch (e) { return ''; }
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
          
          if (json.tool_calls) {
            return JSON.stringify(json.tool_calls);
          }
        } catch (e) { continue; }
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

  private inspectThinkingJSON(json: any) {
    if (!json) return;
    // JSON検査のロジックが必要な場合はここに追加
  }

  private processChunk(chunk: Uint8Array | Buffer): string {
    try {
      const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });
      return decoder.decode(chunk, { stream: true });
    } catch (e) {
      console.error("Error processing chunk:", e);
      return Array.from(new Uint8Array(chunk as any))
        .map(b => String.fromCharCode(b))
        .join('');
    }
  }

  private processLargeThinkingContent(content: string, phase: string, progress: number) {
    // バッファに追加
    this.thinkingContentBuffer += content;
    this.flushThinkingBufferIfReady();
  }

  private ensureThinkingComplete() {
    // バッファの残りを処理
    if (this.thinkingContentBuffer.trim()) {
      updateThinking(this.thinkingContentBuffer, this.thinkingPhase, 1.0);
      this.thinkingContentBuffer = "";
    }
    
    // タイムアウトをクリア
    if (this.bufferTimeoutId) {
      clearTimeout(this.bufferTimeoutId);
      this.bufferTimeoutId = null;
    }
    
    if (!this.hasCompletedThinking && this.thinkingStarted) {
      thinkingCompleted();
      this.hasCompletedThinking = true;
      this.thinkingStarted = false;
    }
  }

  /**
   * リトライ機能付きのフェッチ関数
   * @param url リクエストURL
   * @param options フェッチオプション
   * @param retryCount 現在のリトライ回数
   * @returns レスポンス
   */
  private async fetchWithRetry(url: string, options: any, retryCount: number = 0): Promise<Response> {
    try {
      const response = await this.fetch(url, options);
      
      if (!response.ok && retryCount < this.maxRetryAttempts) {
        // レート制限エラーか一時的なエラーの場合にリトライ
        if (response.status === 429 || response.status >= 500) {
          // 指数バックオフでリトライ間隔を計算
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`Retrying request after ${retryDelay}ms (attempt ${retryCount + 1}/${this.maxRetryAttempts})`);
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return this.fetchWithRetry(url, options, retryCount + 1);
        }
      }
      
      return response;
    } catch (error) {
      if (retryCount < this.maxRetryAttempts) {
        // ネットワークエラーなどの場合にリトライ
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Network error, retrying after ${retryDelay}ms (attempt ${retryCount + 1}/${this.maxRetryAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      
      throw error;
    }
  }

  protected async *_streamChat(
    msgs: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    this.isStreamActive = true;
    this.hasCompletedThinking = false;
    this.thinkingStarted = false;
    this.sentThinkingHashes.clear();
    this.sentCompleteSentences.clear();
    
    try {
      const convertedMessages = this.convertMessages(msgs);
      const originalSystemMessage = this.extractSystemMessage(msgs);
      const enhancedSystemMessage = this.createEnhancedSystemMessage(options, originalSystemMessage);
      
      let toolsParameter: any = undefined;
      
      if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
        toolsParameter = Databricks.convertToolDefinitionsForDatabricks(options.tools);
      }
      
      const body = {
        ...this.convertArgs(options),
        messages: convertedMessages,
        system: enhancedSystemMessage
      };
      
      if (toolsParameter) {
        body.tools = toolsParameter;
        body.tool_choice = options.toolChoice || "auto";
      }
      
      const enableStreaming = this.getEnableStreamingFromConfig();
      body.stream = enableStreaming && (body.stream !== false);
      
      const invocationUrl = this.getInvocationUrl();
      const timeout = this.getTimeoutFromConfig();
      
      const fetchOptions = {
        method: "POST",
        headers: this._getHeaders(),
        body: JSON.stringify(body),
        signal,
        timeout: timeout
      };

      console.log(`Making request to ${invocationUrl}`);
      
      // リトライ機能付きフェッチを使用
      const res = await this.fetchWithRetry(invocationUrl, fetchOptions);
      
      if (!res.ok || !res.body) {
        this.ensureThinkingComplete();
        throw new Error(`HTTP ${res.status} - ${await res.text()}`);
      }

      if (body.stream === false) {
        const jsonResponse = await res.json();
        this.ensureThinkingComplete();
        
        try {
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
            
            const json = JSON.parse(jsonStr);
            
            this.inspectThinkingJSON(json);
            
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
                
              buffer = "";
              this.ensureThinkingComplete();
              return { done: true, messages: out };
            }
            
            if (json.choices && json.choices[0]?.message?.content) {
              const message: ChatMessage = {
                role: "assistant",
                content: json.choices[0].message.content
              };
              out.push(message);
              buffer = "";
              
              this.ensureThinkingComplete();
              return { done: true, messages: out };
            }
            
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
              
              this.ensureThinkingComplete();
              return { done: true, messages: out };
            }
            
            if (json.thinking || 
                (json.content && json.content[0]?.type === "reasoning") ||
                (json.choices && json.choices[0]?.delta?.content && 
                 Array.isArray(json.choices[0].delta.content) && 
                 json.choices[0].delta.content[0]?.type === "reasoning")) {
              
              let thinkingContent = "";
              
              if (json.thinking) {
                thinkingContent = json.thinking;
              } else if (json.content && json.content[0]?.type === "reasoning") {
                thinkingContent = json.content[0].summary?.[0]?.text || "";
              } else if (json.choices && json.choices[0]?.delta?.content && 
                        Array.isArray(json.choices[0].delta.content) && 
                        json.choices[0].delta.content[0]?.type === "reasoning") {
                thinkingContent = json.choices[0].delta.content[0].summary?.[0]?.text || "";
              }
              
              if (thinkingContent) {
                const formattedThinking = this.formatThinkingText(thinkingContent);
                
                if (formattedThinking.trim() !== "") {
                  const tokenEstimate = Math.round(thinkingContent.length / 4);
                  this.totalThinkingTokens += tokenEstimate;
                  
                  const progress = this.estimateThinkingProgress();
                  
                  const thinkingObj: ThinkingContent = {
                    type: "thinking",
                    thinking: formattedThinking,
                    metadata: {
                      phase: this.thinkingPhase,
                      progress: progress,
                      tokens: tokenEstimate,
                      elapsed_ms: Date.now() - this.thinkingStartTime
                    }
                  };
                  
                  out.push(thinkingObj);
                }
                
                buffer = "";
                return { done: false, messages: out };
              }
            }
          } catch (e) {}
        }
        
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          
          if (!line) continue;
          
          if (!line.startsWith("data:") && !line.startsWith("data: ")) {
            const thinkingMatch = line.match(thinkingStartRegex);
            if (thinkingMatch) {
              const thinkingContent = thinkingMatch[1].trim();
              
              const formattedThinking = this.formatThinkingText(thinkingContent);
              
              if (formattedThinking.trim() !== "") {
                const tokenEstimate = Math.round(thinkingContent.length / 4);
                this.totalThinkingTokens += tokenEstimate;
                
                const progress = this.estimateThinkingProgress();
                
                const thinkingObj: ThinkingContent = {
                  type: "thinking",
                  thinking: formattedThinking,
                  metadata: {
                    phase: this.thinkingPhase,
                    progress: progress,
                    tokens: tokenEstimate,
                    elapsed_ms: Date.now() - this.thinkingStartTime
                  }
                };
                
                out.push(thinkingObj);
              }
              continue;
            }
            
            continue;
          }
          
          const data = line.startsWith("data: ") ? line.slice(6).trim() : line.slice(5).trim();
          
          if (data === "[DONE]") {
            this.ensureThinkingComplete();
            return { done: true, messages: out };
          }
          
          try {
            const json = JSON.parse(data);
            
            this.inspectThinkingJSON(json);
            
            if (json.type === "message_stop" || 
                json.done === true || 
                (json.choices && json.choices[0]?.finish_reason === "stop")) {
                
              this.ensureThinkingComplete();
              return { done: true, messages: out };
            }
            
            if (json.thinking || 
                (json.content && json.content[0]?.type === "reasoning") ||
                (json.choices && json.choices[0]?.delta?.content && 
                Array.isArray(json.choices[0].delta.content) && 
                json.choices[0].delta.content[0]?.type === "reasoning")) {
              
              let newThinkingContent = "";
              
              if (json.thinking) {
                newThinkingContent = json.thinking;
              } else if (json.content && json.content[0]?.type === "reasoning") {
                newThinkingContent = json.content[0].summary?.[0]?.text || "";
              } else if (json.choices && json.choices[0]?.delta?.content && 
                        Array.isArray(json.choices[0].delta.content) && 
                        json.choices[0].delta.content[0]?.type === "reasoning") {
                newThinkingContent = json.choices[0].delta.content[0].summary?.[0]?.text || "";
              }
              
              if (newThinkingContent) {
                thinkingContent += newThinkingContent;
                
                const formattedThinking = this.formatThinkingText(newThinkingContent);
                
                if (formattedThinking.trim() !== "") {
                  const tokenEstimate = Math.round(newThinkingContent.length / 4);
                  this.totalThinkingTokens += tokenEstimate;
                  
                  const progress = this.estimateThinkingProgress();
                  
                  const thinkingObj: ThinkingContent = {
                    type: "thinking",
                    thinking: formattedThinking,
                    metadata: {
                      phase: this.thinkingPhase,
                      progress: progress,
                      tokens: tokenEstimate,
                      elapsed_ms: Date.now() - this.thinkingStartTime
                    }
                  };
                  
                  out.push(thinkingObj);
                }
              }
            }
            else if (json.type === "content_block_start" && json.content_block?.type === "thinking") {
              if (json.content_block.thinking) {
                const thinkingText = json.content_block.thinking;
                
                const formattedThinking = this.formatThinkingText(thinkingText);
                
                if (formattedThinking.trim() !== "") {
                  const tokenEstimate = Math.round(thinkingText.length / 4);
                  this.totalThinkingTokens += tokenEstimate;
                  
                  const progress = this.estimateThinkingProgress();
                  
                  const thinkingObj: ThinkingContent = {
                    type: "thinking",
                    thinking: formattedThinking,
                    metadata: {
                      phase: this.thinkingPhase,
                      progress: progress,
                      tokens: tokenEstimate,
                      elapsed_ms: Date.now() - this.thinkingStartTime
                    }
                  };
                  
                  out.push(thinkingObj);
                }
              }
            }
            else if (json.type === "content_block_delta" && json.delta?.type === "thinking_delta") {
              if (json.delta.thinking) {
                const thinkingDelta = json.delta.thinking;
                
                const formattedThinking = this.formatThinkingText(thinkingDelta);
                
                if (formattedThinking.trim() !== "") {
                  const tokenEstimate = Math.round(thinkingDelta.length / 4);
                  this.totalThinkingTokens += tokenEstimate;
                  
                  const progress = this.estimateThinkingProgress();
                  
                  const thinkingObj: ThinkingContent = {
                    type: "thinking",
                    thinking: formattedThinking,
                    metadata: {
                      phase: this.thinkingPhase,
                      progress: progress,
                      tokens: tokenEstimate,
                      elapsed_ms: Date.now() - this.thinkingStartTime
                    }
                  };
                  
                  out.push(thinkingObj);
                }
              }
            }
            else if (json.type === "content_block_stop" && json.content_block?.type === "thinking") {
              this.ensureThinkingComplete();
            }
            else if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
              const message: ChatMessage = {
                role: "assistant",
                content: json.delta.text || ""
              };
              out.push(message);
            }
            else if (json.choices && json.choices[0]?.delta?.content) {
              const message: ChatMessage = {
                role: "assistant",
                content: json.choices[0].delta.content
              };
              out.push(message);
            }
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
            else if (json.content && typeof json.content === "string") {
              const message: ChatMessage = {
                role: "assistant",
                content: json.content
              };
              out.push(message);
            }
            else if (json.content && Array.isArray(json.content) && json.content[0]?.text) {
              const message: ChatMessage = {
                role: "assistant",
                content: json.content[0].text
              };
              out.push(message);
            }
            else if (json.text) {
              const message: ChatMessage = {
                role: "assistant",
                content: json.text
              };
              out.push(message);
            }
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
      
      if (typeof (res.body as any).getReader === "function") {
        const reader = (res.body as any).getReader();
        
        const startTime = Date.now();
        let chunkCount = 0;
        
        const streamTimeout = this.getTimeoutFromConfig();
        let lastActivityTimestamp = Date.now();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            lastActivityTimestamp = Date.now();
            
            if (Date.now() - startTime > streamTimeout) {
              console.log("Stream timeout reached");
              this.ensureThinkingComplete();
              return;
            }
            
            if (done) {
              console.log("Stream reader done");
              this.ensureThinkingComplete();
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

            // 思考メッセージはスキップしてバッファに追加する
            // 通常のメッセージのみを返す
            for (const m of messages) {
              if (isThinkingMessage(m)) {
                // アクションは processLargeThinkingContent と formatThinkingText で処理済み
              } else {
                yield m as ChatMessage;
              }
            }
            
            if (end) {
              console.log("Stream end signal received");
              this.ensureThinkingComplete();
              
              const message: ChatMessage = {
                role: "assistant",
                content: ""
              };
              yield message;
              
              return;
            }
          }
        } catch (chunkError) {
          console.error("Error during stream processing:", chunkError);
          this.ensureThinkingComplete();
          
          if (Date.now() - lastActivityTimestamp > 10000) {
            // エラーメッセージを改善
            const errorMessage = "⚠️ ストリームが中断されました。部分的な応答を表示します:";
            updateThinking(errorMessage, "error", 1.0);
            
            // 再接続を試みる
            try {
              console.log("Attempting to reconnect and recover the conversation...");
              
              // 再接続用の省略されたメッセージ配列を作成
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
                stream: false
              };
              
              const reconnectUrl = this.getInvocationUrl();
              const reconnectBody = {
                ...this.convertArgs(recoveryOptions),
                messages: this.convertMessages(reconnectMessages),
                system: enhancedSystemMessage
              };
              
              if (toolsParameter) {
                reconnectBody.tools = toolsParameter;
                reconnectBody.tool_choice = options.toolChoice || "auto";
              }
              
              const reconnectOptions = {
                method: "POST",
                headers: this._getHeaders(),
                body: JSON.stringify(reconnectBody),
                timeout: timeout
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
            const message: ChatMessage = {
              role: "assistant",
              content: errorMessage + "\n\n" + 
                      (thinkingContent ? "[思考プロセス]\n" + thinkingContent.substring(0, 1000) + "..." : "取得できませんでした")
            };
            yield message;
            return;
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
        
        this.ensureThinkingComplete();
        return;
      }
      
      const startTime = Date.now();
      
      const streamTimeout = this.getTimeoutFromConfig();
      let lastActivityTimestamp = Date.now();
      
      try {
        for await (const chunk of res.body as any) {
          try {
            lastActivityTimestamp = Date.now();
            
            if (Date.now() - startTime > streamTimeout) {
              console.log("Stream timeout reached");
              this.ensureThinkingComplete();
              return;
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

            // 思考メッセージはスキップしてバッファに追加する
            // 通常のメッセージのみを返す
            for (const m of messages) {
              if (isThinkingMessage(m)) {
                // アクションは processLargeThinkingContent と formatThinkingText で処理済み
              } else {
                yield m as ChatMessage;
              }
            }
            
            if (done) {
              console.log("Stream end signal received");
              this.ensureThinkingComplete();
              
              const message: ChatMessage = {
                role: "assistant",
                content: ""
              };
              yield message;
              
              return;
            }
          } catch (e) {
            console.error("Error processing stream chunk:", e);
            if (Date.now() - lastActivityTimestamp > 10000) {
              this.ensureThinkingComplete();
              
              // エラーメッセージを改善
              const errorMessage = "⚠️ ストリームが中断されました。部分的な応答を表示します:";
              updateThinking(errorMessage, "error", 1.0);
              
              // 再接続を試みる
              try {
                console.log("Attempting to reconnect and recover the conversation...");
                
                // 再接続用の省略されたメッセージ配列を作成
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
                  stream: false
                };
                
                const reconnectUrl = this.getInvocationUrl();
                const reconnectBody = {
                  ...this.convertArgs(recoveryOptions),
                  messages: this.convertMessages(reconnectMessages),
                  system: enhancedSystemMessage
                };
                
                if (toolsParameter) {
                  reconnectBody.tools = toolsParameter;
                  reconnectBody.tool_choice = options.toolChoice || "auto";
                }
                
                const reconnectOptions = {
                  method: "POST",
                  headers: this._getHeaders(),
                  body: JSON.stringify(reconnectBody),
                  timeout: timeout
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
              const message: ChatMessage = {
                role: "assistant",
                content: errorMessage + "\n\n" + 
                        (thinkingContent ? "[思考プロセス]\n" + thinkingContent.substring(0, 1000) + "..." : "取得できませんでした")
              };
              yield message;
              return;
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
        
        this.ensureThinkingComplete();
      } catch (streamError) {
        console.error("Stream error:", streamError);
        this.ensureThinkingComplete();
        
        if (rawBuffer && rawBuffer.trim()) {
          try {
            const recoveredContent = this.tryRecoverContentFromBuffer(rawBuffer);
            if (recoveredContent) {
              // エラーメッセージを改善
              const errorMessage = "⚠️ ストリームが中断されました。部分的な応答を表示します:";
              updateThinking(errorMessage, "error", 1.0);
              
              const message: ChatMessage = {
                role: "assistant",
                content: errorMessage + "\n\n" + recoveredContent
              };
              yield message;
            }
          } catch (recoveryError) {
            console.error("Error recovering content:", recoveryError);
          }
        }
        
        throw streamError;
      }
    } catch (error) {
      console.error("_streamChat error:", error);
      this.ensureThinkingComplete();
      throw error;
    } finally {
      this.ensureThinkingComplete();
      this.isStreamActive = false;
      this.thinkingStarted = false;
      
      // バッファの片付け
      if (this.bufferTimeoutId) {
        clearTimeout(this.bufferTimeoutId);
        this.bufferTimeoutId = null;
      }
      
      this.thinkingContentBuffer = "";
      this.sentThinkingHashes.clear();
      this.sentCompleteSentences.clear();
    }
  }
}