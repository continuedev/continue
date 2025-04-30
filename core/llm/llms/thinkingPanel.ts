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
  // 更新をキューに追加
  thinkingQueue.push({ content, phase, progress });
  
  // 即座に処理開始（スロットリングはプロセス内で行われる）
  processThinkingQueue();
  
  console.log(`Thinking queued: ${phase} - Progress: ${Math.round(progress * 100)}%`);
}

/**
 * Notifies the thinking panel that thinking has completed
 */
export function thinkingCompleted() {
  // キューをクリア
  thinkingQueue = [];
  isProcessingQueue = false;
  
  if (vscode && vscode.commands) {
    try {
      vscode.commands.executeCommand('continue.thinkingCompleted');
      console.log("Thinking process completed notification sent");
    } catch (e) {
      console.warn("Failed to signal thinking completion:", e);
    }
  }
}