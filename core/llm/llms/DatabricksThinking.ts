// 環境チェックを改善 - Node.js環境かブラウザ環境かを適切に判定
// Node.js環境かどうかの検出を強化
const isNode = typeof process !== 'undefined' && 
               typeof process.versions !== 'undefined' && 
               typeof process.versions.node !== 'undefined';

// VSCode APIを安全に取得
let vscode: any = undefined;
if (!isNode) {
  try {
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.vscode) {
        vscode = win.vscode;
      } else if (typeof win.acquireVsCodeApi === 'function') {
        try {
          vscode = win.acquireVsCodeApi();
        } catch (apiError) {
          console.warn("Error calling acquireVsCodeApi:", apiError);
        }
      }
    }
  } catch (e) {
    console.warn("Error initializing VSCode API in browser environment:", e);
  }
}

import {
  ChatMessage,
  CompletionOptions,
} from "../../index";
import { ThinkingContent } from "./index";
import { updateThinking, thinkingCompleted } from './thinkingPanel';

/**
 * HTMLタグをエスケープする関数
 * @param text エスケープするテキスト
 * @returns エスケープされたテキスト
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ThinkingChatMessage型の定義を追加
type ThinkingChatMessage = ChatMessage & {
  finish_reason?: string;
  thinking_metadata?: {
    phase: string;
    progress: number;
    formatted_text?: string;
  };
  isThinking?: boolean;
};

// SSEパース結果の型定義
interface ParseSSEResult {
  done: boolean;
  messages: (ChatMessage | ThinkingContent)[];
  lastActivityTime: number;
  buffer?: string;
}

export default class DatabricksThinking {
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
  private maxRetryAttempts: number = 5;
  private backoffFactor: number = 1.5;
  private modelConfig: any = null;
  private activityTimeoutMs: number = 30000; // 30秒の非アクティブタイムアウト
  
  constructor(modelConfig: any) {
    this.modelConfig = modelConfig || {};
    this.useStepByStepThinking = 
      this.modelConfig?.defaultCompletionOptions?.stepByStepThinking === true;
  }
  
  /**
   * 指定されたモデル名がClaudeモデルかどうかを判定する静的メソッド
   * @param modelName モデル名
   * @returns Claudeモデルかどうか
   */
  public static isClaudeModel(modelName: string): boolean {
    return typeof modelName === 'string' && modelName.toLowerCase().includes("claude");
  }
  
  /**
   * 指定されたモデル名がClaude 3.7 Sonnetかどうかを判定する静的メソッド
   * @param modelName モデル名
   * @returns Claude 3.7 Sonnetかどうか
   */
  public static isClaudeSonnet37(modelName: string): boolean {
    if (!modelName || typeof modelName !== 'string') {
      return false;
    }
    
    const isClaudeModel = DatabricksThinking.isClaudeModel(modelName);
    return isClaudeModel && (
      modelName.toLowerCase().includes("claude-3-7") ||
      modelName.toLowerCase().includes("claude-3.7")
    );
  }
  
  /**
   * モデル設定の思考モード関連の初期化を行う静的メソッド
   * @param modelConfig モデル設定
   */
  public static initializeModelConfig(modelConfig: any): void {
    if (!modelConfig) {
      console.warn("Model config is null or undefined");
      return;
    }
    
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
  }
  
  /**
   * 思考テキストを整形し、HTMLタグを適切に処理する関数
   * @param text 思考テキスト
   * @returns 整形されたテキスト
   */
  private formatThinkingText(text: string): string {
    if (!text) return '';
    
    // HTMLタグをエスケープ
    text = escapeHtml(text);

    // 重複チェック - 既に送信済みの内容は処理しない
    const contentHash = this.hashThinkingContent(text);
    if (this.sentThinkingHashes.has(contentHash)) {
      return "";
    }
    
    this.sentThinkingHashes.add(contentHash);
    
    // Markdown形式の強調を追加（HTMLタグではなくプレーンテキスト）
    text = text.replace(/^(\d+)\.\s+(.+)$/gm, "$1. $2");
    text = text.replace(/^(Step \d+)[:：](.+)$/gm, "Step $1: $2");
    
    // ステップバイステップモードの場合の特別な処理
    if (this.useStepByStepThinking) {
      text = text.replace(/^(First|To start|Initially|Let me start by)(.+?)[:：]/gmi, "Initial Analysis:$2:");
      text = text.replace(/^(Next|Then|Moving on|After that|Subsequently)(.+?)[:：]/gmi, "Next Step:$2:");
      text = text.replace(/^(Finally|In conclusion|To conclude|Therefore|As a result)(.+?)[:：]/gmi, "Conclusion:$2:");
    }
    
    // フェーズと進捗状況の検出と更新
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
      // トークン数からの進捗推定
      const tokenEstimate = Math.round(text.length / 4);
      const progressIncrement = tokenEstimate / 16000 * 0.2;
      this.thinkingProgress = Math.min(0.95, this.thinkingProgress + progressIncrement);
    }
    
    // バッファに追加
    this.thinkingBuffer += text;
    
    // 思考コンテンツをバッファに追加し、必要に応じて送信
    this.thinkingContentBuffer += text;
    this.flushThinkingBufferIfReady();
    
    return text;
  }
  
  private hashThinkingContent(text: string): string {
    if (!text) return 'empty';
    return text.substring(0, 100);
  }
  
  private flushThinkingBufferIfReady() {
    // 既存のタイマーをクリア
    if (this.bufferTimeoutId) {
      clearTimeout(this.bufferTimeoutId);
      this.bufferTimeoutId = null;
    }
    
    // バッファの内容を送信するタイマーを設定
    this.bufferTimeoutId = setTimeout(() => {
      if (this.thinkingContentBuffer && this.thinkingContentBuffer.trim()) {
        // バッファの内容を送信
        updateThinking(this.thinkingContentBuffer, this.thinkingPhase, this.thinkingProgress);
        this.thinkingContentBuffer = "";
      }
      
      this.bufferTimeoutId = null;
    }, 250); // 送信間隔を短縮（500ms→250ms）
  }
  
  private hashSentence(sentence: string): string {
    if (!sentence) return 'empty';
    return sentence.substring(0, 100) + sentence.length.toString();
  }
  
  private estimateThinkingProgress(): number {
    // 経過時間に基づく進捗推定
    const elapsedMs = Date.now() - this.thinkingStartTime;
    const elapsedSec = elapsedMs / 1000;
    
    const timeProgress = Math.min(1.0, elapsedSec / 120);
    
    // トークン数に基づく進捗推定
    const tokenBudget = this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 16000;
    const tokenProgress = Math.min(1.0, this.totalThinkingTokens / tokenBudget);
    
    // 独自の進捗状況とのウェイト付き組み合わせ
    return Math.min(0.95, (timeProgress * 0.3) + (tokenProgress * 0.3) + (this.thinkingProgress * 0.4));
  }
  
  /**
   * LLMオプションを準備する関数
   * @param options ユーザーが指定したオプション
   * @returns 思考モードの設定と最終的なオプション
   */
  public prepareLLMOptions(options: CompletionOptions): { 
    isThinkingEnabled: boolean; 
    thinkingOptions: any; 
    finalOptions: any
  } {
    if (!options) {
      // オプションが未指定の場合はmodelプロパティを含む初期値を設定
      options = { 
        model: this.modelConfig?.model || "" // modelプロパティは必須なのでモデル設定から取得
      };
    } else if (!options.model) {
      // modelプロパティが存在しない場合は追加
      options.model = this.modelConfig?.model || "";
    }
    
    const isClaudeModel = DatabricksThinking.isClaudeModel(this.modelConfig?.model || "");
    const isThinkingEnabled = options.reasoning || 
                            (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    const thinkingBudget = options.reasoningBudgetTokens || 
                          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
                          16000;
    
    const isClaudeSonnet37 = DatabricksThinking.isClaudeSonnet37(this.modelConfig?.model || "");
    
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
      stop: options.stop?.filter(x => x && x.trim() !== "") ?? this.modelConfig?.defaultCompletionOptions?.stop ?? []
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
    const thinkingOptions = isThinkingEnabled ? {
      type: "enabled",
      budget_tokens: thinkingBudget
    } : null;
    
    if (this.initializeThinking(options) && thinkingOptions) {
      // Thinking設定をAPIリクエストに追加
      finalOptions.thinking = thinkingOptions;
    }
    
    return { isThinkingEnabled, thinkingOptions, finalOptions };
  }
  
  /**
   * 大量の思考コンテンツを処理する関数
   * @param content 思考コンテンツ
   * @param phase フェーズ
   * @param progress 進捗率
   */
  public processLargeThinkingContent(content: string, phase: string, progress: number) {
    if (!content) return;
    
    // バッファに追加して更新をスケジュール
    this.thinkingContentBuffer += content;
    this.flushThinkingBufferIfReady();
  }
  
  /**
   * 思考完了を確実に処理する関数
   */
  public ensureThinkingComplete() {
    // バッファの残りを処理
    if (this.thinkingContentBuffer && this.thinkingContentBuffer.trim()) {
      updateThinking(this.thinkingContentBuffer, this.thinkingPhase, 1.0);
      this.thinkingContentBuffer = "";
    }
    
    // タイマーをクリア
    if (this.bufferTimeoutId) {
      clearTimeout(this.bufferTimeoutId);
      this.bufferTimeoutId = null;
    }
    
    // 思考完了を通知
    if (!this.hasCompletedThinking && this.thinkingStarted) {
      thinkingCompleted();
      this.hasCompletedThinking = true;
      this.thinkingStarted = false;
    }
  }
  
  /**
   * システムメッセージを拡張する関数
   * @param options 補完オプション
   * @param originalSystemMessage 元のシステムメッセージ
   * @returns 拡張されたシステムメッセージ
   */
  public createEnhancedSystemMessage(
    options: CompletionOptions, 
    originalSystemMessage?: string
  ): string {
    let systemMessage = originalSystemMessage || "";
    
    const isClaudeModel = DatabricksThinking.isClaudeModel(this.modelConfig?.model || "");
    const isClaudeSonnet37 = DatabricksThinking.isClaudeSonnet37(this.modelConfig?.model || "");
    
    const enableThinking = options?.reasoning || 
      (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    const useStepByStepThinking = 
      options?.stepByStepThinking !== undefined ? 
      !!options.stepByStepThinking : 
      (this.modelConfig?.defaultCompletionOptions?.stepByStepThinking === true);
    
    // 思考モードが有効な場合、システムメッセージに指示を追加
    if (enableThinking) {
      if (useStepByStepThinking) {
        const stepByStepInstructions = `\n\nBefore answering, think step-by-step and explain your reasoning in detail. Please provide detailed, step-by-step reasoning before arriving at a conclusion.`;
        systemMessage += stepByStepInstructions;
      } else if (!isClaudeSonnet37) {
        const budgetTokens = options?.reasoningBudgetTokens || 
          this.modelConfig?.defaultCompletionOptions?.thinking?.budget_tokens || 
          16000;
        
        const thinkingInstructions = `\n\nI'd like you to solve this problem step-by-step, showing your reasoning process clearly. Take your time to think through this thoroughly before giving your final answer. Use up to ${budgetTokens} tokens to explore different approaches and ensure your solution is correct.`;
        systemMessage += thinkingInstructions;
      }
    }
    
    // ツールが指定されている場合、ツール使用の指示を追加
    if (options?.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      const agentInstructions = `\n\nWhen appropriate, use the provided tools to help solve the problem. These tools allow you to interact with the external environment to gather information or perform actions needed to complete the task.`;
      systemMessage += agentInstructions;
    }
    
    return systemMessage;
  }
  
  /**
   * ストリームイベントの思考内容を処理する関数
   * @param jsonData JSONデータ
   * @returns 処理された思考コンテンツ
   */
  public processStreamEventThinking(jsonData: any): ThinkingContent | null {
    if (!jsonData) return null;
    
    let thinkingContent = "";
    
    // 様々なフォーマットから思考内容を抽出
    if (jsonData.thinking) {
      thinkingContent = jsonData.thinking;
    } else if (jsonData.content && jsonData.content[0]?.type === "reasoning") {
      thinkingContent = jsonData.content[0].summary?.[0]?.text || "";
    } else if (jsonData.choices && jsonData.choices[0]?.delta?.content && 
              Array.isArray(jsonData.choices[0].delta.content) && 
              jsonData.choices[0].delta.content[0]?.type === "reasoning") {
      thinkingContent = jsonData.choices[0].delta.content[0].summary?.[0]?.text || "";
    } else if (jsonData.type === "content_block_start" && jsonData.content_block?.type === "thinking") {
      thinkingContent = jsonData.content_block.thinking || "";
    } else if (jsonData.type === "content_block_delta" && jsonData.delta?.type === "thinking_delta") {
      thinkingContent = jsonData.delta.thinking || "";
    }
    
    if (!thinkingContent) {
      return null;
    }
    
    // HTMLタグを適切に処理して思考内容を整形
    const formattedThinking = this.formatThinkingText(thinkingContent);
    
    if (!formattedThinking || formattedThinking.trim() === "") {
      return null;
    }
    
    const tokenEstimate = Math.round(thinkingContent.length / 4);
    this.totalThinkingTokens += tokenEstimate;
    
    const progress = this.estimateThinkingProgress();
    
    // 思考オブジェクトを作成して返す
    return {
      type: "thinking",
      thinking: formattedThinking,
      metadata: {
        phase: this.thinkingPhase,
        progress: progress,
        tokens: tokenEstimate,
        elapsed_ms: Date.now() - this.thinkingStartTime
      }
    };
  }
  
  /**
   * SSEパーサー関数 - ストリームデータからメッセージを抽出
   * @param buffer バッファ文字列
   * @param thinkingContent 思考内容バッファ
   * @returns パース結果
   */
  private parseSSE(
    buffer: string,
    thinkingContent: string,
  ): ParseSSEResult {
    if (!buffer) {
      return { done: false, messages: [], lastActivityTime: Date.now() };
    }
    
    const out: (ChatMessage | ThinkingContent)[] = [];
    let currentBuffer = buffer;
    
    // アクティビティ時間を更新
    const lastActivityTime = Date.now();
    
    const thinkingStartRegex = /^thinking:(.*)$/i;
    
    // 一行のみで完結するJSONの処理
    if (currentBuffer.trim() && !currentBuffer.includes("\n")) {
      try {
        const trimmedBuffer = currentBuffer.trim();
        const jsonStr = trimmedBuffer.startsWith("data:") ? 
                     trimmedBuffer.slice(trimmedBuffer.indexOf("{")) : 
                     trimmedBuffer;
        
        if (!jsonStr || !jsonStr.includes("{")) {
          return { done: false, messages: [], lastActivityTime: lastActivityTime };
        }
        
        const json = JSON.parse(jsonStr);
        
        // 完了シグナルの検出
        if (json.type === "message_stop" || 
            json.done === true || 
            (json.choices && json.choices[0]?.finish_reason === "stop")) {
            
          this.ensureThinkingComplete();
          return { done: true, messages: out, lastActivityTime };
        }
        
        // 完了メッセージの内容
        if (json.choices && json.choices[0]?.message?.content) {
          const message: ChatMessage = {
            role: "assistant",
            content: json.choices[0].message.content
          };
          out.push(message);
          
          this.ensureThinkingComplete();
          return { done: true, messages: out, lastActivityTime };
        }
        
        // ツール呼び出しの処理
        if (json.choices && json.choices[0]?.message?.tool_calls) {
          const toolCalls = json.choices[0].message.tool_calls;
          const message: ChatMessage = {
            role: "assistant",
            content: "",
            toolCalls: toolCalls.map((call: any) => ({
              id: call.id || `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              type: "function",
              function: {
                name: call.function.name,
                arguments: call.function.arguments
              }
            }))
          };
          out.push(message);
          
          this.ensureThinkingComplete();
          return { done: true, messages: out, lastActivityTime };
        }
        
        // 思考内容の処理
        const thinkingObj = this.processStreamEventThinking(json);
        if (thinkingObj) {
          out.push(thinkingObj);
          return { done: false, messages: out, lastActivityTime };
        }
      } catch (e) {
        console.warn("Error parsing single-line JSON:", e);
      }
    }
    
    // 複数行の処理
    let idx: number;
    while ((idx = currentBuffer.indexOf("\n")) !== -1) {
      const line = currentBuffer.slice(0, idx).trim();
      currentBuffer = currentBuffer.slice(idx + 1);
      
      if (!line) continue;
      
      // 特殊なデータ行の処理
      if (!line.startsWith("data:") && !line.startsWith("data: ")) {
        const thinkingMatch = line.match(thinkingStartRegex);
        if (thinkingMatch) {
          const thinkingContent = thinkingMatch[1].trim();
          
          // 思考内容を処理
          const thinkingObj = this.processStreamEventThinking({ thinking: thinkingContent });
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
        this.ensureThinkingComplete();
        return { done: true, messages: out, lastActivityTime };
      }
      
      try {
        // データが空か無効な場合はスキップ
        if (!data || !data.includes("{")) {
          continue;
        }
        
        const json = JSON.parse(data);
        
        // 完了シグナルのチェック
        if (json.type === "message_stop" || 
            json.done === true || 
            (json.choices && json.choices[0]?.finish_reason === "stop")) {
            
          this.ensureThinkingComplete();
          return { done: true, messages: out, lastActivityTime };
        }
        
        // 思考内容の処理
        const thinkingObj = this.processStreamEventThinking(json);
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
            toolCalls: json.choices[0].delta.tool_calls.map((call: any) => ({
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
            toolCalls: json.tool_calls.map((call: any) => ({
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
      } catch (e) {
        console.error("Error parsing SSE JSON:", e);
        continue;
      }
    }
    return { done: false, messages: out, lastActivityTime, buffer: currentBuffer };
  }
  
  /**
   * 思考機能を初期化する関数
   * @param options 補完オプション
   * @returns 思考が有効かどうか
   */
  public initializeThinking(options: CompletionOptions): boolean {
    const isClaudeModel = DatabricksThinking.isClaudeModel(this.modelConfig?.model || "");
    const isThinkingEnabled = options?.reasoning || 
                            (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    if (!isThinkingEnabled) {
      return false;
    }
    
    this.useStepByStepThinking = 
      options?.stepByStepThinking !== undefined ? 
      !!options.stepByStepThinking : 
      (this.modelConfig?.defaultCompletionOptions?.stepByStepThinking === true);
    
    // 思考機能の初期化
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
    
    // 初期メッセージを表示
    const startMessage = this.useStepByStepThinking ? 
      "Starting step-by-step thinking process...\n\n" : 
      "Starting a new thinking process...\n\n";
    
    updateThinking(startMessage, "initial", 0);
    
    return true;
  }
  
  /**
   * バッファからコンテンツを回復する試み
   * @param buffer バッファ
   * @returns 回復されたコンテンツ、または null
   */
  public tryRecoverContentFromBuffer(buffer: string): string | null {
    if (!buffer) return null;
    
    try {
      // Unicodeの問題を修正
      buffer = buffer.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\x00-\x7F]/g, match => {
        try { return match; } catch (e) { return ''; }
      });
    
      // JSONパターンを検索
      const jsonPattern = /{[\s\S]*?}/g;
      const jsonMatches = buffer.match(jsonPattern);
      
      if (!jsonMatches || jsonMatches.length === 0) {
        return null;
      }
      
      // 長い順にソート（最も多くの情報を含むものを優先）
      const sortedMatches = [...jsonMatches].sort((a, b) => b.length - a.length);
      
      // 各JSONをパースして有効なコンテンツを探す
      for (const match of sortedMatches) {
        try {
          const json = JSON.parse(match);
          
          // 様々なレスポンス形式をチェック
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
      
      // 直接テキストを探す
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
  
  /**
   * 思考プロセスのリセット
   */
  public resetThinking() {
    this.thinkingStarted = false;
    this.hasCompletedThinking = false;
    this.thinkingContentBuffer = "";
    this.sentThinkingHashes.clear();
    this.sentCompleteSentences.clear();
    
    // バッファの片付け
    if (this.bufferTimeoutId) {
      clearTimeout(this.bufferTimeoutId);
      this.bufferTimeoutId = null;
    }
  }
  
  /**
   * ストリーミングを処理する関数
   * @param res レスポンス
   * @param processChunk チャンク処理関数
   * @param fetchWithRetry リトライ付きフェッチ関数
   * @param invocationUrl 呼び出しURL
   * @param msgs メッセージ
   * @param options オプション
   * @param timeout タイムアウト
   * @param toolsParameter ツールパラメータ
   * @returns 処理されたメッセージのAsyncGenerator
   */
  public async *handleStreaming(
    res: Response,
    processChunk: (chunk: Uint8Array | Buffer) => string,
    fetchWithRetry: (url: string, options: any, retryCount?: number) => Promise<Response>,
    invocationUrl: string,
    msgs: ChatMessage[],
    options: CompletionOptions,
    timeout: number,
    toolsParameter: any
  ): AsyncGenerator<ChatMessage> {
    if (!res || !res.body) {
      console.error("Invalid response or response body");
      yield {
        role: "assistant",
        content: "⚠️ 無効なレスポンスを受信しました。"
      };
      return;
    }
    
    if (!processChunk || typeof processChunk !== 'function') {
      console.error("Invalid processChunk function");
      yield {
        role: "assistant",
        content: "⚠️ 内部エラー: チャンク処理関数が無効です。"
      };
      return;
    }
    
    if (!invocationUrl) {
      console.error("Invalid invocation URL");
      yield {
        role: "assistant",
        content: "⚠️ 内部エラー: 呼び出しURLが無効です。"
      };
      return;
    }
    
    // バッファと状態の初期化
    let buffer = "";
    let rawBuffer = "";
    let thinkingContent = "";
    let lastActivityTime = Date.now();
    
    // fetch APIのReader APIを使用する場合
    if (typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      
      const startTime = Date.now();
      let chunkCount = 0;
      
      const streamTimeout = timeout || 600000; // デフォルト10分
      
      try {
        let continueReading = true;
        
        while (continueReading) {
          // タイムアウトチェック
          if (Date.now() - startTime > streamTimeout) {
            console.log("Stream timeout reached");
            this.ensureThinkingComplete();
            return;
          }
          
          // 非アクティブチェック
          if (Date.now() - lastActivityTime > this.activityTimeoutMs) {
            console.log("Stream inactive timeout reached");
            
            // 接続状況を確認する小さなヘルスチェック
            try {
              // 非同期でチェックを実行
              const healthCheckUrl = invocationUrl.replace(/\/invocations$/, '/health');
              
              // タイムアウト付きフェッチを実装
              const healthCheckPromise = await fetchWithRetry(healthCheckUrl, {
                method: "GET"
              });
              
              if (!healthCheckPromise || !healthCheckPromise.ok) {
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
          let readResult: { done: boolean; value?: Uint8Array };
          try {
            readResult = await reader.read();
          } catch (readError) {
            console.error("Error reading from stream:", readError);
            throw new Error("Stream read error: " + (readError instanceof Error ? readError.message : String(readError)));
          }
          
          const { done, value } = readResult;
          
          // アクティビティタイムスタンプを更新
          lastActivityTime = Date.now();
          
          if (done) {
            console.log("Stream reader done");
            this.ensureThinkingComplete();
            break;
          }
          
          chunkCount++;
          
          if (!value) {
            console.warn("Empty chunk received");
            continue;
          }
          
          const decodedChunk = processChunk(value);
          rawBuffer += decodedChunk;
          
          if (!decodedChunk || decodedChunk.trim() === "") {
            continue;
          }
          
          const parseResult = this.parseSSE(buffer + decodedChunk, thinkingContent);
          if (parseResult.buffer) {
            buffer = parseResult.buffer;
          } else {
            buffer = "";
          }
          lastActivityTime = parseResult.lastActivityTime;
          const { done: end, messages } = parseResult;
          
          const isThinkingMessage = (msg: any): boolean => {
            if ('type' in msg && msg.type === 'thinking') {
              return true;
            }
            if ('isThinking' in msg && msg.isThinking) {
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
            this.ensureThinkingComplete();
            
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
        this.ensureThinkingComplete();
        
        if (Date.now() - lastActivityTime > 10000) {
          // 自動復旧試行
          console.log("Stream interruption detected. Attempting to recover the response...");
          
          // エラーメッセージを表示
          const errorMessage = "⚠️ ストリームが中断されました。応答の復旧を試みています...";
          updateThinking(errorMessage, "error", 0.9);
          
          // 再接続を試みる
          try {
            // 再接続用の短縮メッセージ配列を作成
            const reconnectMessages = msgs && Array.isArray(msgs) ? msgs.slice(-3) : []; // 最後の3つのメッセージのみを使用
            
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
              maxTokens: Math.min(options?.maxTokens || 4096, 1000)
            };
            
            // フォールバックシステムメッセージを使用
            const fallbackSystemMessage = "The user's request was interrupted. Please provide a brief, helpful response based on the latest messages.";
            
            const { isThinkingEnabled, thinkingOptions, finalOptions } = 
              this.prepareLLMOptions(recoveryOptions);
            
            const reconnectUrl = invocationUrl;
            
            // 変換関数（バックアップ）
            const convertMessages = (msgs: ChatMessage[]): any[] => {
              return msgs.map(m => ({
                role: m?.role === "user" ? "user" : "assistant",
                content: m?.content || ""
              }));
            };
            
            const reconnectBody = {
              ...finalOptions,
              messages: convertMessages(reconnectMessages),
              system: fallbackSystemMessage
            };
            
            // ツールを引き継ぐ
            if (toolsParameter) {
              reconnectBody.tools = toolsParameter;
              reconnectBody.tool_choice = options?.toolChoice || "auto";
            }
            
            const reconnectOptions = {
              method: "POST",
              body: JSON.stringify(reconnectBody),
              timeout: timeout / 2 // 通常の半分のタイムアウトで素早く応答を得る
            };
            
            // リトライ機能付きフェッチを使用
            const reconnectRes = await fetchWithRetry(reconnectUrl, reconnectOptions);
            
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
            const recoveredContent = this.tryRecoverContentFromBuffer(rawBuffer);
            
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
      
      if (buffer && buffer.trim()) {
        const { messages } = this.parseSSE(buffer, thinkingContent);
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
    
    // Node.jsスタイルのストリーム処理（for-await-of）
    const startTime = Date.now();
    
    const streamTimeout = timeout || 600000; // デフォルト10分
    
    try {
      for await (const chunk of res.body as any) {
        try {
          // アクティビティタイムスタンプを更新
          lastActivityTime = Date.now();
          
          // タイムアウトチェック
          if (Date.now() - startTime > streamTimeout) {
            console.log("Stream timeout reached");
            this.ensureThinkingComplete();
            return;
          }
          
          // 非アクティブチェック
          if (Date.now() - lastActivityTime > this.activityTimeoutMs) {
            console.log("Stream inactive timeout reached");
            throw new Error("Stream inactive for too long");
          }
          
          if (!chunk) {
            console.warn("Empty chunk received in Node.js stream");
            continue;
          }
          
          const decodedChunk = processChunk(chunk as Buffer);
          rawBuffer += decodedChunk;
          
          if (!decodedChunk || decodedChunk.trim() === "") {
            continue;
          }
          
          const parseResult = this.parseSSE(buffer + decodedChunk, thinkingContent);
          if (parseResult.buffer) {
            buffer = parseResult.buffer;
          } else {
            buffer = "";
          }
          lastActivityTime = parseResult.lastActivityTime;
          const { done: end, messages } = parseResult;
          
          const isThinkingMessage = (msg: any): boolean => {
            if ('type' in msg && msg.type === 'thinking') {
              return true;
            }
            if ('isThinking' in msg && msg.isThinking) {
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
          if (Date.now() - lastActivityTime > 10000) {
            this.ensureThinkingComplete();
            
            // 自動復旧試行
            console.log("Stream interruption detected. Attempting to recover the response...");
            
            // エラーメッセージを表示
            const errorMessage = "⚠️ ストリームが中断されました。応答の復旧を試みています...";
            updateThinking(errorMessage, "error", 0.9);
            
            // 再接続を試みる
            try {
              // 再接続用の短縮メッセージ配列を作成
              const reconnectMessages = msgs && Array.isArray(msgs) ? msgs.slice(-3) : []; // 最後の3つのメッセージのみを使用
              
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
                maxTokens: Math.min(options?.maxTokens || 4096, 1000)
              };
              
              // フォールバックシステムメッセージを使用
              const fallbackSystemMessage = "The user's request was interrupted. Please provide a brief, helpful response based on the latest messages.";
              
              const { isThinkingEnabled, thinkingOptions, finalOptions } = 
                this.prepareLLMOptions(recoveryOptions);
              
              const reconnectUrl = invocationUrl;
              
              // 変換関数（バックアップ）
              const convertMessages = (msgs: ChatMessage[]): any[] => {
                return msgs.map(m => ({
                  role: m?.role === "user" ? "user" : "assistant",
                  content: m?.content || ""
                }));
              };
              
              const reconnectBody = {
                ...finalOptions,
                messages: convertMessages(reconnectMessages),
                system: fallbackSystemMessage
              };
              
              if (toolsParameter) {
                reconnectBody.tools = toolsParameter;
                reconnectBody.tool_choice = options?.toolChoice || "auto";
              }
              
              const reconnectOptions = {
                method: "POST",
                body: JSON.stringify(reconnectBody),
                timeout: timeout / 2
              };
              
              // リトライ機能付きフェッチを使用
              const reconnectRes = await fetchWithRetry(reconnectUrl, reconnectOptions);
              
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
              const recoveredContent = this.tryRecoverContentFromBuffer(rawBuffer);
              
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
      
      if (buffer && buffer.trim()) {
        const { messages } = this.parseSSE(buffer, thinkingContent);
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
      
      // エラー時のコンテンツ復旧
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
  }
}