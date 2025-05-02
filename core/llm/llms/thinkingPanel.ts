/**
 * This file provides a bridge between the Databricks LLM provider and the VS Code thinking panel.
 * It exposes a function to register the thinking panel and utilities to send thinking updates.
 */

// Conditional imports for VS Code API (only available in extension environment)
let vscode: any;
try {
  vscode = require('vscode');
} catch (e) {
  console.log("VS Code API not available, thinking panel features will be limited");
  // Create a mock version of vscode for environments without the real API
  vscode = {
    commands: {
      executeCommand: (command: string, ...args: any[]) => {
        console.log(`Mock executeCommand: ${command}`, args);
        return Promise.resolve();
      }
    }
  };
}

// 更新キューとスロットリング機構の追加
let thinkingQueue: {content: string, phase: string, progress: number}[] = [];
let isProcessingQueue = false;
let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 200; // 200msごとに更新（50msより長く設定）

// 思考完了状態を追跡するためのフラグ
let thinkingCompletedSent = false;
let thinkingActive = false;

/**
 * Registers the thinking panel with the VS Code extension
 * This is called from the VS Code extension's activation function
 */
export function registerThinkingPanel(context: any) {
  // This function is implemented in the VS Code extension
  if (vscode && vscode.commands) {
    try {
      vscode.commands.executeCommand('continue.registerThinkingPanel', context);
      console.log("Registered thinking panel with VS Code extension");
      // 思考状態をリセット
      thinkingCompletedSent = false;
      thinkingActive = false;
    } catch (e) {
      console.warn("Failed to register thinking panel:", e);
    }
  } else {
    console.log("VS Code API not available, thinking panel not registered");
  }
}

/**
 * キューに溜まった思考内容を処理する
 */
function processThinkingQueue() {
  if (isProcessingQueue || thinkingQueue.length === 0) return;
  
  isProcessingQueue = true;
  const now = Date.now();
  
  // 前回の更新から十分な時間が経過していない場合は遅延実行
  if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
    setTimeout(processThinkingQueue, UPDATE_THROTTLE_MS - (now - lastUpdateTime));
    isProcessingQueue = false;
    return;
  }
  
  // キューから最新の内容を取得し、残りをマージ
  const latest = thinkingQueue.pop();
  if (!latest) {
    isProcessingQueue = false;
    return;
  }
  
  // 残りのキューをクリア（最新の内容だけを使用）
  thinkingQueue = [];
  
  // 実際の更新処理
  if (vscode && vscode.commands) {
    try {
      // 思考処理がアクティブであることを示す
      thinkingActive = true;
      
      // ブロッキングを避けるため非同期で実行
      setTimeout(() => {
        vscode.commands.executeCommand('continue.appendThinkingChunk', latest.content, latest.phase, latest.progress);
        vscode.commands.executeCommand('continue.forceRefreshThinking', true);
        
        lastUpdateTime = Date.now();
        isProcessingQueue = false;
        
        // まだキューに項目がある場合は続けて処理
        if (thinkingQueue.length > 0) {
          processThinkingQueue();
        }
      }, 0);
    } catch (e) {
      console.warn("Failed to update thinking panel:", e);
      isProcessingQueue = false;
    }
  } else {
    isProcessingQueue = false;
  }
}

/**
 * Updates the thinking panel with new thinking content
 * @param content The thinking content to display
 * @param phase The current phase of thinking (e.g., "analyzing", "planning")
 * @param progress The progress value between 0 and 1
 */
export function updateThinking(content: string, phase: string, progress: number) {
  // 内容のバリデーション
  if (!content || content.trim() === "") {
    console.warn("空の思考コンテンツが送信されました。無視します。");
    return;
  }
  
  // 思考処理がアクティブであることを示す
  thinkingActive = true;
  
  // 思考完了フラグをリセット（新しい思考内容が来た）
  thinkingCompletedSent = false;
  
  // デバッグログを追加
  console.log(`思考更新: ${phase} - 進捗率: ${Math.round(progress * 100)}% - コンテンツ長: ${content.length}文字`);
  
  // 更新をキューに追加
  thinkingQueue.push({ content, phase, progress });
  
  // VSCode拡張機能に直接通知（バックアップメカニズムとして）
  if (vscode && vscode.commands) {
    try {
      vscode.commands.executeCommand('continue.appendThinkingChunk', content, phase, progress);
      console.log("VS Codeに直接思考更新を送信しました");
    } catch (e) {
      console.warn("VS Codeへの直接更新に失敗しました:", e);
    }
  }
  
  // 即座に処理開始（スロットリングはプロセス内で行われる）
  processThinkingQueue();
  
  console.log(`思考キューに追加: ${phase} - 進捗率: ${Math.round(progress * 100)}%`);
}

/**
 * Notifies the thinking panel that thinking has completed
 */
export function thinkingCompleted() {
  // 思考がアクティブでない場合は処理しない
  if (!thinkingActive) {
    console.log("思考処理がアクティブでないため、完了通知をスキップします");
    return;
  }
  
  // 重複した完了通知を防止
  if (thinkingCompletedSent) {
    console.log("思考プロセス完了通知は既に送信済みです");
    return;
  }
  
  // キューをクリア
  thinkingQueue = [];
  isProcessingQueue = false;
  
  console.log("思考プロセス完了 - 通知を送信します");
  
  if (vscode && vscode.commands) {
    try {
      // 思考完了通知を送信
      vscode.commands.executeCommand('continue.thinkingCompleted');
      console.log("思考プロセス完了通知が送信されました");
      
      // 状態フラグを更新
      thinkingCompletedSent = true;
      thinkingActive = false;
      
      // 確実にステータスバーの表示を更新するため、強制リフレッシュも実行
      setTimeout(() => {
        try {
          vscode.commands.executeCommand('continue.forceRefreshThinking', false);
        } catch (e) {
          console.warn("強制リフレッシュの実行に失敗しました:", e);
        }
      }, 100);
    } catch (e) {
      console.warn("思考完了の通知に失敗しました:", e);
      
      // エラーが発生しても、フラグは更新しておく
      thinkingCompletedSent = true;
      thinkingActive = false;
    }
  }
}