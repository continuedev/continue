let vscode: any;
try {
  vscode = require('vscode');
} catch (e) {
  vscode = {
    commands: {
      executeCommand: (command: string, ...args: any[]) => {
        return Promise.resolve();
      },
      registerCommand: (command: string, callback: Function) => {
        return { dispose: () => {} };
      },
      getCommands: () => Promise.resolve([])
    },
    window: {
      createWebviewPanel: () => ({
        webview: { html: '', onDidReceiveMessage: () => ({ dispose: () => {} }) },
        onDidDispose: () => ({ dispose: () => {} }),
        reveal: () => {},
        dispose: () => {}
      })
    }
  };
}

// コマンド登録状態の追跡
const registeredCommands = new Set<string>();

let thinkingPanel: any = null;
let thinkingQueue: {content: string, phase: string, progress: number}[] = [];
let isProcessingQueue = false;
let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 2000;

let thinkingCompletedSent = false;
let thinkingActive = false;
let thinkingReset = true;

const sentContentHashes = new Set<string>();
const sentContentHistory: string[] = [];
const MAX_CONTENT_HISTORY = 20;
const MAX_HASH_HISTORY = 100;

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

/**
 * 思考段階に応じたアイコンを返す関数
 * @param phase 思考フェーズ名
 * @returns 対応するアイコン（絵文字）
 */
function getPhaseIcon(phase: string): string {
  const lowerPhase = phase.toLowerCase();
  
  if (lowerPhase.includes('initial') || 
      lowerPhase.includes('planning') || 
      lowerPhase.includes('初期') || 
      lowerPhase.includes('計画')) {
    return '🔍';
  } else if (lowerPhase.includes('analy') || 
             lowerPhase.includes('考察') || 
             lowerPhase.includes('分析')) {
    return '🧠';
  } else if (lowerPhase.includes('strateg') || 
             lowerPhase.includes('戦略')) {
    return '🗺️';
  } else if (lowerPhase.includes('implement') || 
             lowerPhase.includes('実装') || 
             lowerPhase.includes('coding') || 
             lowerPhase.includes('コーディング')) {
    return '⚙️';
  } else if (lowerPhase.includes('review') || 
             lowerPhase.includes('レビュー') || 
             lowerPhase.includes('確認')) {
    return '🔎';
  } else if (lowerPhase.includes('conclu') || 
             lowerPhase.includes('結論') || 
             lowerPhase.includes('まとめ')) {
    return '✅';
  } else if (lowerPhase.includes('error')) {
    return '⚠️';
  }
  
  return '🤔';
}

/**
 * 思考段階に応じたCSSクラスを返す関数
 * @param phase 思考フェーズ名
 * @returns 対応するCSSクラス名
 */
function getPhaseClass(phase: string): string {
  const lowerPhase = phase.toLowerCase();
  
  if (lowerPhase.includes('initial') || 
      lowerPhase.includes('planning') || 
      lowerPhase.includes('初期') || 
      lowerPhase.includes('計画')) {
    return 'thinking-initial';
  } else if (lowerPhase.includes('analy') || 
             lowerPhase.includes('考察') || 
             lowerPhase.includes('分析')) {
    return 'thinking-analysis';
  } else if (lowerPhase.includes('strateg') || 
             lowerPhase.includes('戦略')) {
    return 'thinking-strategy';
  } else if (lowerPhase.includes('implement') || 
             lowerPhase.includes('実装') || 
             lowerPhase.includes('coding') || 
             lowerPhase.includes('コーディング')) {
    return 'thinking-implementation';
  } else if (lowerPhase.includes('review') || 
             lowerPhase.includes('レビュー') || 
             lowerPhase.includes('確認')) {
    return 'thinking-review';
  } else if (lowerPhase.includes('conclu') || 
             lowerPhase.includes('結論') || 
             lowerPhase.includes('まとめ')) {
    return 'thinking-conclusion';
  } else if (lowerPhase.includes('error')) {
    return 'thinking-error';
  }
  
  return 'thinking-default';
}

/**
 * フェーズ名を人間が読みやすい形式に変換する関数
 * @param phase 元のフェーズ名
 * @returns 整形されたフェーズ名
 */
function formatPhaseName(phase: string): string {
  // 日本語・英語のフェーズ名マッピング
  const phaseMapping: {[key: string]: string} = {
    'initial_analysis': '初期分析',
    'planning': '計画立案',
    'analyzing': '分析中',
    'strategizing': '戦略立案',
    'implementing': '実装中',
    'reviewing': 'レビュー中',
    'concluding': '結論導出',
    'initial': '初期分析',
    'error': 'エラー'
  };
  
  // マッピングに存在する場合はそれを使用
  if (phase in phaseMapping) {
    return phaseMapping[phase];
  }
  
  // 存在しない場合は整形して返す
  // アンダースコアをスペースに置換し、最初の文字を大文字に
  return phase.replace(/_/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * コマンドを安全に実行する関数
 * @param commandName 実行するコマンド名
 * @param args コマンドに渡す引数
 * @param fallback コマンドが存在しない場合の代替処理
 */
function safeExecuteCommand(commandName: string, args: any[] = [], fallback?: () => void) {
  if (vscode && vscode.commands) {
    try {
      // まずコマンドが登録されているか確認
      if (registeredCommands.has(commandName)) {
        vscode.commands.executeCommand(commandName, ...args);
      } else {
        // コマンドが利用可能かどうかを確認
        vscode.commands.getCommands(true).then((availableCommands: string[]) => {
          if (availableCommands.includes(commandName)) {
            registeredCommands.add(commandName);
            vscode.commands.executeCommand(commandName, ...args);
          } else if (fallback) {
            console.log(`Command ${commandName} not found, using alternative method`);
            fallback();
          }
        }).catch((err: any) => {
          console.error(`Error checking available commands: ${err}`);
          if (fallback) {
            fallback();
          }
        });
      }
    } catch (e) {
      console.error(`Error executing command ${commandName}:`, e);
      if (fallback) {
        fallback();
      }
    }
  } else if (fallback) {
    fallback();
  }
}

/**
 * 自前でThinkingPanelを初期化する代替関数
 */
function initializeThinkingPanelFallback() {
  if (!vscode || !vscode.window) {
    return;
  }
  
  try {
    // パネルが存在しない場合は作成
    if (!thinkingPanel) {
      thinkingPanel = vscode.window.createWebviewPanel(
        'continueThinkingPanel',
        'Continue Thinking',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      
      // パネルが閉じられたときの処理
      thinkingPanel.onDidDispose(() => {
        thinkingPanel = null;
      });
    }
    
    // 初期HTML設定
    thinkingPanel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Continue Thinking</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; 
            margin: 0; 
            padding: 10px; 
            line-height: 1.5;
          }
          .thinking-initial { border-left: 3px solid #007acc; padding-left: 10px; background-color: rgba(0, 122, 204, 0.05); margin-bottom: 10px; }
          .thinking-analysis { border-left: 3px solid #9966cc; padding-left: 10px; background-color: rgba(153, 102, 204, 0.05); margin-bottom: 10px; }
          .thinking-strategy { border-left: 3px solid #ff8c00; padding-left: 10px; background-color: rgba(255, 140, 0, 0.05); margin-bottom: 10px; }
          .thinking-implementation { border-left: 3px solid #0099cc; padding-left: 10px; background-color: rgba(0, 153, 204, 0.05); margin-bottom: 10px; }
          .thinking-review { border-left: 3px solid #ff6666; padding-left: 10px; background-color: rgba(255, 102, 102, 0.05); margin-bottom: 10px; }
          .thinking-conclusion { border-left: 3px solid #00aa00; padding-left: 10px; background-color: rgba(0, 170, 0, 0.05); margin-bottom: 10px; }
          .thinking-default { border-left: 3px solid #888888; padding-left: 10px; margin-bottom: 10px; }
          .thinking-error { border-left: 3px solid #ee0000; padding-left: 10px; background-color: rgba(238, 0, 0, 0.05); margin-bottom: 10px; }
          .thinking-section-header { font-weight: bold; margin-top: 10px; }
          .thinking-progress-bar { height: 4px; background-color: #eee; margin: 5px 0; }
          .thinking-progress-value { height: 100%; background-color: #007acc; transition: width 0.3s; }
          code { font-family: Menlo, Monaco, 'Courier New', monospace; font-size: 0.9em; }
          pre { background-color: rgba(0, 0, 0, 0.05); padding: 8px; border-radius: 3px; overflow: auto; }
        </style>
        <script>
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'appendContent') {
              const content = document.getElementById('thinking-content');
              content.innerHTML += message.content;
              window.scrollTo(0, document.body.scrollHeight);
            }
          });
        </script>
      </head>
      <body>
        <div id="thinking-content"></div>
      </body>
      </html>
    `;
    
    console.log("Thinking panel created with fallback method");
  } catch (e) {
    console.error("Error creating thinking panel with fallback method:", e);
  }
}

/**
 * パネルに思考コンテンツを追加する代替関数
 */
function appendThinkingContentFallback(content: string) {
  if (!thinkingPanel) {
    initializeThinkingPanelFallback();
  }
  
  if (thinkingPanel && thinkingPanel.webview) {
    try {
      // メッセージを送信してコンテンツを更新
      thinkingPanel.webview.postMessage({
        command: 'appendContent',
        content: content
      });
      
      // バックアップ方法: 直接HTMLを更新
      const currentHtml = thinkingPanel.webview.html;
      const contentDivIndex = currentHtml.indexOf('<div id="thinking-content">');
      if (contentDivIndex > -1) {
        const closingDivIndex = currentHtml.indexOf('</div>', contentDivIndex);
        if (closingDivIndex > -1) {
          const beforeContent = currentHtml.substring(0, contentDivIndex + '<div id="thinking-content">'.length);
          const existingContent = currentHtml.substring(
            contentDivIndex + '<div id="thinking-content">'.length, 
            closingDivIndex
          );
          const afterContent = currentHtml.substring(closingDivIndex);
          
          thinkingPanel.webview.html = beforeContent + existingContent + content + afterContent;
        }
      }
      
      // 表示を確実にするためのバックアップ: パネルを表示
      try {
        thinkingPanel.reveal();
      } catch (e) {
        console.error("Error revealing thinking panel:", e);
      }
    } catch (e) {
      console.error("Error updating thinking panel content:", e);
      // エラーが発生した場合はパネルを再作成
      try {
        if (thinkingPanel) {
          thinkingPanel.dispose();
        }
      } catch (disposeError) {}
      
      thinkingPanel = null;
      initializeThinkingPanelFallback();
      
      // 再作成したパネルにコンテンツを追加
      if (thinkingPanel && thinkingPanel.webview) {
        thinkingPanel.webview.html = thinkingPanel.webview.html.replace(
          '<div id="thinking-content"></div>',
          `<div id="thinking-content">${content}</div>`
        );
      }
    }
  }
}

/**
 * 思考パネルを登録する関数
 * @param context 拡張機能のコンテキスト
 */
export function registerThinkingPanel(context: any) {
  if (!vscode || !vscode.commands) {
    return;
  }
  
  try {
    // まず必要なコマンドを登録する
    if (context && context.subscriptions) {
      // resetThinkingPanelコマンド
      const resetCommand = vscode.commands.registerCommand('continue.resetThinkingPanel', () => {
        console.log("Thinking panel reset");
        resetThinkingState();
      });
      
      // appendThinkingChunkコマンド
      const appendCommand = vscode.commands.registerCommand('continue.appendThinkingChunk', 
        (content: string, phase: string, progress: number) => {
          console.log(`Thinking chunk appended - Progress: ${Math.round(progress * 100)}%`);
          if (thinkingPanel) {
            appendThinkingContentFallback(content);
          } else {
            initializeThinkingPanelFallback();
            appendThinkingContentFallback(content);
          }
      });
      
      // forceRefreshThinkingコマンド
      const refreshCommand = vscode.commands.registerCommand('continue.forceRefreshThinking', 
        (force: boolean) => {
          // パネルの表示を強制更新
          if (thinkingPanel) {
            try {
              thinkingPanel.reveal();
            } catch (e) {
              console.error("Error revealing thinking panel:", e);
              // エラーが発生した場合はパネルを再作成
              thinkingPanel = null;
              initializeThinkingPanelFallback();
            }
          } else {
            initializeThinkingPanelFallback();
          }
      });
      
      // thinkingCompletedコマンド
      const completedCommand = vscode.commands.registerCommand('continue.thinkingCompleted', () => {
        console.log("Thinking process completed");
        thinkingCompletedSent = true;
      });
      
      // コマンドをコンテキストに登録
      context.subscriptions.push(
        resetCommand,
        appendCommand,
        refreshCommand,
        completedCommand
      );
      
      // 登録済みコマンドを記録
      registeredCommands.add('continue.resetThinkingPanel');
      registeredCommands.add('continue.appendThinkingChunk');
      registeredCommands.add('continue.forceRefreshThinking');
      registeredCommands.add('continue.thinkingCompleted');
      
      console.log("Thinking panel commands registered with extension context");
    }
    
    // コマンド登録後にUI用のパネル自体を登録
    try {
      vscode.commands.executeCommand('continue.registerThinkingPanel', context);
    } catch (e) {
      console.error("Error registering thinking panel, using fallback:", e);
      // 既存のパネル登録が失敗した場合は代替処理
      initializeThinkingPanelFallback();
    }
    
    // カスタムCSSを登録
    try {
      vscode.commands.executeCommand('continue.setThinkingPanelStyles', `
        .thinking-initial { border-left: 3px solid #007acc; padding-left: 10px; background-color: rgba(0, 122, 204, 0.05); margin-bottom: 10px; }
        .thinking-analysis { border-left: 3px solid #9966cc; padding-left: 10px; background-color: rgba(153, 102, 204, 0.05); margin-bottom: 10px; }
        .thinking-strategy { border-left: 3px solid #ff8c00; padding-left: 10px; background-color: rgba(255, 140, 0, 0.05); margin-bottom: 10px; }
        .thinking-implementation { border-left: 3px solid #0099cc; padding-left: 10px; background-color: rgba(0, 153, 204, 0.05); margin-bottom: 10px; }
        .thinking-review { border-left: 3px solid #ff6666; padding-left: 10px; background-color: rgba(255, 102, 102, 0.05); margin-bottom: 10px; }
        .thinking-conclusion { border-left: 3px solid #00aa00; padding-left: 10px; background-color: rgba(0, 170, 0, 0.05); margin-bottom: 10px; }
        .thinking-default { border-left: 3px solid #888888; padding-left: 10px; margin-bottom: 10px; }
        .thinking-error { border-left: 3px solid #ee0000; padding-left: 10px; background-color: rgba(238, 0, 0, 0.05); margin-bottom: 10px; }
        .thinking-section-header { font-weight: bold; margin-top: 10px; }
        .thinking-progress-bar { height: 4px; background-color: #eee; margin: 5px 0; }
        .thinking-progress-value { height: 100%; background-color: #007acc; transition: width 0.3s; }
        code { font-family: Menlo, Monaco, 'Courier New', monospace; font-size: 0.9em; }
        pre { background-color: rgba(0, 0, 0, 0.05); padding: 8px; border-radius: 3px; overflow: auto; }
      `);
    } catch (e) {
      // スタイル設定でエラーが発生した場合は無視
      console.log("Could not set thinking panel styles, using defaults");
    }
    
    // 初期状態をリセット
    resetThinkingState();
  } catch (e) {
    console.error("Error in registerThinkingPanel:", e);
    // エラーが発生しても代替方法でパネルを初期化
    initializeThinkingPanelFallback();
  }
}

/**
 * 思考状態をリセットする関数
 */
function resetThinkingState() {
  thinkingCompletedSent = false;
  thinkingActive = false;
  thinkingReset = true;
  thinkingQueue = [];
  isProcessingQueue = false;
  sentContentHashes.clear();
  sentContentHistory.length = 0;
  
  // 安全にパネルリセットコマンドを実行
  safeExecuteCommand('continue.resetThinkingPanel', [], () => {
    // 代替処理: パネルを再初期化
    if (thinkingPanel) {
      try {
        thinkingPanel.dispose();
      } catch (e) {
        console.error("Error disposing thinking panel:", e);
      }
      thinkingPanel = null;
    }
    initializeThinkingPanelFallback();
  });
}

/**
 * コンテンツのハッシュを計算
 * @param content ハッシュ化するコンテンツ
 * @returns ハッシュ値
 */
function hashThinkingContent(content: string): string {
  return content.substring(0, 100) + content.length.toString();
}

/**
 * 大量のハッシュでメモリを圧迫しないように古いハッシュを削除
 */
function manageHashHistory() {
  if (sentContentHashes.size > MAX_HASH_HISTORY) {
    // 古いハッシュを削除（先頭から20%を削除）
    const toDelete = Math.floor(MAX_HASH_HISTORY * 0.2);
    let count = 0;
    for (const hash of sentContentHashes) {
      sentContentHashes.delete(hash);
      count++;
      if (count >= toDelete) break;
    }
  }
}

/**
 * 思考キューを処理する関数
 */
function processThinkingQueue() {
  if (isProcessingQueue || thinkingQueue.length === 0) return;
  
  isProcessingQueue = true;
  const now = Date.now();
  
  if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
    setTimeout(processThinkingQueue, UPDATE_THROTTLE_MS - (now - lastUpdateTime));
    isProcessingQueue = false;
    return;
  }
  
  // キューから最新のアイテムを取得
  const latest = thinkingQueue.pop();
  if (!latest) {
    isProcessingQueue = false;
    return;
  }
  
  // 残りのキューを結合
  let combinedContent = latest.content;
  while (thinkingQueue.length > 0) {
    const nextItem = thinkingQueue.pop();
    if (nextItem) {
      combinedContent += nextItem.content;
    }
  }
  thinkingQueue = [];
  
  // 重複チェック
  const contentHash = hashThinkingContent(combinedContent);
  if (sentContentHashes.has(contentHash)) {
    isProcessingQueue = false;
    return;
  }
  
  // 履歴と重複ハッシュを更新
  sentContentHashes.add(contentHash);
  sentContentHistory.push(combinedContent);
  if (sentContentHistory.length > MAX_CONTENT_HISTORY) {
    sentContentHistory.shift();
  }
  
  // ハッシュ履歴の管理
  manageHashHistory();
  
  // 思考内容をUIに送信
  thinkingActive = true;
      
  // 最初の更新の場合、パネルをリセット
  if (thinkingReset) {
    safeExecuteCommand('continue.resetThinkingPanel', [], () => {
      if (thinkingPanel) {
        try {
          thinkingPanel.dispose();
        } catch (e) {
          console.error("Error disposing thinking panel:", e);
        }
        thinkingPanel = null;
      }
      initializeThinkingPanelFallback();
    });
    thinkingReset = false;
  }
  
  setTimeout(() => {
    // コマンドを安全に実行
    safeExecuteCommand('continue.appendThinkingChunk', [combinedContent, latest.phase, latest.progress], () => {
      appendThinkingContentFallback(combinedContent);
    });
    
    safeExecuteCommand('continue.forceRefreshThinking', [true], () => {
      if (thinkingPanel) {
        try {
          thinkingPanel.reveal();
        } catch (e) {
          console.error("Error revealing thinking panel:", e);
        }
      } else {
        initializeThinkingPanelFallback();
      }
    });
    
    lastUpdateTime = Date.now();
    isProcessingQueue = false;
    
    if (thinkingQueue.length > 0) {
      processThinkingQueue();
    }
  }, 0);
}

/**
 * 思考内容を更新し、UIに表示する関数
 * @param content 思考内容のテキスト
 * @param phase 思考の段階（フェーズ）
 * @param progress 進捗度（0〜1の値）
 */
export function updateThinking(content: string, phase: string, progress: number) {
  if (!content || content.trim() === "") {
    return;
  }
  
  // 既に完了していた場合はリセット
  if (thinkingCompletedSent) {
    resetThinkingState();
  }
  
  thinkingActive = true;
  
  // HTMLタグをエスケープ（ここで一元的に処理）
  const safeContent = escapeHtml(content);
  
  // フェーズ名を整形
  const formattedPhaseName = formatPhaseName(phase);
  
  // アイコンを取得
  const phaseIcon = getPhaseIcon(phase);
  
  // 進捗率をパーセントで表示
  const progressPercent = Math.round(progress * 100);
  
  // 強化されたフェーズ表示を作成
  const enhancedPhase = `${phaseIcon} ${formattedPhaseName} (${progressPercent}%)`;
  
  // フェーズに対応するCSSクラスを取得
  const phaseClass = getPhaseClass(phase);
  
  // スタイル付きコンテンツを作成
  const styledContent = `
    <div class="${phaseClass}">
      <div class="thinking-progress-bar">
        <div class="thinking-progress-value" style="width: ${progressPercent}%"></div>
      </div>
      ${safeContent}
    </div>
  `;
  
  // 効率的な重複チェック
  const quickHash = content.substring(0, 50) + content.length.toString(); 
  if (sentContentHashes.has(quickHash)) {
    return;
  }
  
  thinkingQueue.push({ 
    content: styledContent, 
    phase: enhancedPhase, 
    progress 
  });
  
  processThinkingQueue();
}

/**
 * 思考プロセスが完了したことを通知する関数
 */
export function thinkingCompleted() {
  if (!thinkingActive || thinkingCompletedSent) {
    return;
  }
  
  // キューをクリア
  thinkingQueue = [];
  isProcessingQueue = false;
  
  // コマンドを安全に実行
  safeExecuteCommand('continue.thinkingCompleted', [], () => {
    thinkingCompletedSent = true;
    
    if (!thinkingPanel) {
      initializeThinkingPanelFallback();
    }
  });
  
  // 完了メッセージを表示
  const completionMessage = '<div class="thinking-conclusion" style="text-align: center; padding: 10px; margin-top: 10px;">' +
                           '✨ 思考プロセス完了 ✨' +
                           '</div>';
  
  safeExecuteCommand('continue.appendThinkingChunk', [completionMessage, '✅ 完了', 1.0], () => {
    appendThinkingContentFallback(completionMessage);
  });
  
  thinkingCompletedSent = true;
  
  // パネルの更新
  setTimeout(() => {
    safeExecuteCommand('continue.forceRefreshThinking', [false], () => {
      if (thinkingPanel) {
        try {
          thinkingPanel.reveal();
        } catch (e) {
          console.error("Error revealing thinking panel:", e);
          thinkingPanel = null;
          initializeThinkingPanelFallback();
          
          // 再作成したパネルに完了メッセージを追加
          appendThinkingContentFallback(completionMessage);
        }
      } else {
        initializeThinkingPanelFallback();
        appendThinkingContentFallback(completionMessage);
      }
    });
  }, 100);
}