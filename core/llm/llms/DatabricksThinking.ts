let vscode: any = undefined;
try {
  if (typeof window !== 'undefined' && (window as any).vscode) {
    vscode = (window as any).vscode;
  } else if (typeof window !== 'undefined' && 'acquireVsCodeApi' in window) {
    vscode = (window as any).acquireVsCodeApi();
  }
} catch (e) {}

import {
  ChatMessage,
  CompletionOptions,
} from "../../index";
import { ThinkingContent } from "./index";
import { updateThinking, thinkingCompleted } from './thinkingPanel';

const isNode = typeof process !== 'undefined' && 
               typeof process.versions !== 'undefined' && 
               typeof process.versions.node !== 'undefined';

/**
 * HTMLタグをエスケープする関数
 * @param text エスケープするテキスト
 * @returns エスケープされたテキスト
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  
  constructor(modelConfig: any) {
    this.modelConfig = modelConfig;
    this.useStepByStepThinking = 
      this.modelConfig?.defaultCompletionOptions?.stepByStepThinking === true;
  }
  
  /**
   * 思考テキストを整形し、HTMLタグを適切に処理する関数
   * @param text 思考テキスト
   * @returns 整形されたテキスト
   */
  private formatThinkingText(text: string): string {
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
    return text.substring(0, 100);
  }
  
  private flushThinkingBufferIfReady() {
    // 既存のタイマーをクリア
    if (this.bufferTimeoutId) {
      clearTimeout(this.bufferTimeoutId);
    }
    
    // バッファの内容を送信するタイマーを設定
    this.bufferTimeoutId = setTimeout(() => {
      if (this.thinkingContentBuffer.trim()) {
        // バッファの内容を送信
        updateThinking(this.thinkingContentBuffer, this.thinkingPhase, this.thinkingProgress);
        this.thinkingContentBuffer = "";
      }
      
      this.bufferTimeoutId = null;
    }, 250); // 送信間隔を短縮（500ms→250ms）
  }
  
  private hashSentence(sentence: string): string {
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
   * 大量の思考コンテンツを処理する関数
   * @param content 思考コンテンツ
   * @param phase フェーズ
   * @param progress 進捗率
   */
  public processLargeThinkingContent(content: string, phase: string, progress: number) {
    // バッファに追加して更新をスケジュール
    this.thinkingContentBuffer += content;
    this.flushThinkingBufferIfReady();
  }
  
  /**
   * 思考完了を確実に処理する関数
   */
  public ensureThinkingComplete() {
    // バッファの残りを処理
    if (this.thinkingContentBuffer.trim()) {
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
   * ストリームイベントの思考内容を処理する関数
   * @param jsonData JSONデータ
   * @returns 処理された思考コンテンツ
   */
  public processStreamEventThinking(jsonData: any): ThinkingContent | null {
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
    
    if (formattedThinking.trim() === "") {
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
   * 思考機能を初期化する関数
   * @param options 補完オプション
   * @returns 思考が有効かどうか
   */
  public initializeThinking(options: CompletionOptions): boolean {
    const isClaudeModel = (this.modelConfig?.model || "").toLowerCase().includes("claude");
    const isThinkingEnabled = options.reasoning || 
                            (this.modelConfig?.defaultCompletionOptions?.thinking?.type === "enabled");
    
    if (!isThinkingEnabled) {
      return false;
    }
    
    this.useStepByStepThinking = 
      options.stepByStepThinking !== undefined ? 
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
}