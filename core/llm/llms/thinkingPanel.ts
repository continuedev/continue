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

const registeredCommands = new Set<string>();
let thinkingPanel: any = null;
let thinkingQueue: {content: string, phase: string, progress: number}[] = [];
let isProcessingQueue = false;
let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 1000;
let thinkingCompletedSent = false;
let thinkingActive = false;
let thinkingReset = true;
const sentContentHashes = new Set<string>();
const sentContentHistory: string[] = [];
const MAX_CONTENT_HISTORY = 30;
const MAX_HASH_HISTORY = 150;
let isPanelInitializing = false;
const MAX_INIT_RETRY = 3;
let initRetryCount = 0;
let commandRegistrationRetries = 0;
const MAX_COMMAND_REGISTRATION_RETRIES = 5;
let lastRegistrationError: Error | null = null;

interface ThinkingPanelMessage {
  command: string;
  content?: string;
  [key: string]: any;
}

/**
 * HTMLタグをエスケープする関数
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
 * 思考フェーズに合わせてアイコンを返す
 */
function getPhaseIcon(phase: string): string {
  const lowerPhase = phase.toLowerCase();
  
  if (lowerPhase.includes('initial') || lowerPhase.includes('planning') || lowerPhase.includes('初期') || lowerPhase.includes('計画')) {
    return '🔍';
  } else if (lowerPhase.includes('analy') || lowerPhase.includes('考察') || lowerPhase.includes('分析')) {
    return '🧠';
  } else if (lowerPhase.includes('strateg') || lowerPhase.includes('戦略')) {
    return '🗺️';
  } else if (lowerPhase.includes('implement') || lowerPhase.includes('実装') || lowerPhase.includes('coding') || lowerPhase.includes('コーディング')) {
    return '⚙️';
  } else if (lowerPhase.includes('review') || lowerPhase.includes('レビュー') || lowerPhase.includes('確認')) {
    return '🔎';
  } else if (lowerPhase.includes('conclu') || lowerPhase.includes('結論') || lowerPhase.includes('まとめ')) {
    return '✅';
  } else if (lowerPhase.includes('error')) {
    return '⚠️';
  }
  
  return '🤔';
}

/**
 * フェーズ名をローカライズする
 */
function formatPhaseName(phase: string): string {
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
  
  if (phase in phaseMapping) {
    return phaseMapping[phase];
  }
  
  return phase.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * パスを正規化する関数 - core/util/paths.tsの改良版から引用
 */
function normalizePath(pathStr: string): string {
  if (!pathStr) return pathStr;
  
  // Windowsパスの場合の特別な処理
  if (process.platform === 'win32') {
    // 様々なパターンの二重ドライブレターを検出して修正
    const driveLetterPatterns = [
      /^([A-Za-z]:)[\\\/]+([A-Za-z]:)[\\\/]+/i,  // C:\C:\ パターン
      /^([A-Za-z]:)[\\\/]+[^\\\/]+[\\\/]+([A-Za-z]:)[\\\/]+/i,  // C:\dir\C:\ パターン
      /^([A-Za-z]:).*?[\\\/]+\1[\\\/]+/i,  // 末尾にドライブレターが現れるパターン C:\path\...\C:\
    ];
    
    // パターンを順に適用
    for (const pattern of driveLetterPatterns) {
      if (pattern.test(pathStr)) {
        pathStr = pathStr.replace(pattern, '$1\\');
      }
    }
    
    // 連続するパス区切り文字を単一に
    pathStr = pathStr.replace(/[\\\/]{2,}/g, '\\');
  }
  
  return pathStr;
}

/**
 * コマンドが既に登録されているかチェック - 強化版
 */
async function isCommandRegistered(commandName: string): Promise<boolean> {
  if (registeredCommands.has(commandName)) {
    return true;
  }
  
  if (!vscode || !vscode.commands) {
    return false;
  }
  
  try {
    const commands = await vscode.commands.getCommands(true);
    const exists = commands.includes(commandName);
    if (exists) {
      registeredCommands.add(commandName);
    }
    return exists;
  } catch (e) {
    console.error(`Error checking if command ${commandName} is registered:`, e);
    return false;
  }
}

/**
 * コマンドを安全に実行する - リトライ機能付き
 */
async function safeExecuteCommand(commandName: string, args: any[] = [], fallback?: () => void) {
  if (!vscode || !vscode.commands) {
    if (fallback) fallback();
    return;
  }
  
  try {
    // まずコマンドが存在するか確認
    const exists = await isCommandRegistered(commandName);
    if (exists) {
      try {
        await vscode.commands.executeCommand(commandName, ...args);
        return;
      } catch (e) {
        console.warn(`Error executing command ${commandName}:`, e);
        // コマンド実行エラー時はフォールバックを使用
        if (fallback) fallback();
      }
    } else {
      // コマンドが見つからない場合はフォールバックを使用
      console.warn(`Command ${commandName} not found, using fallback`);
      if (fallback) fallback();
    }
  } catch (e) {
    console.warn(`Error checking command existence ${commandName}:`, e);
    if (fallback) fallback();
  }
}

/**
 * リトライ機能付きのコマンド登録
 */
async function registerCommandWithRetry(
  context: any, 
  name: string, 
  callback: Function, 
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const isRegistered = await isCommandRegistered(name);
      if (!isRegistered) {
        const disposable = vscode.commands.registerCommand(name, callback);
        context.subscriptions.push(disposable);
        registeredCommands.add(name);
        console.log(`Registered command: ${name} (attempt ${attempt + 1})`);
        return true;
      } else {
        console.log(`Command ${name} already exists`);
        registeredCommands.add(name);
        return true;
      }
    } catch (e) {
      console.warn(`Failed to register command ${name}, attempt ${attempt + 1}/${maxRetries}: ${e}`);
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // バックオフタイマー
    }
  }
  console.error(`Failed to register command ${name} after ${maxRetries} attempts`);
  return false;
}

/**
 * 思考パネルの初期化（フォールバック版）
 */
function initializeThinkingPanelFallback(): boolean {
  if (isPanelInitializing) {
    return false;
  }

  isPanelInitializing = true;
  
  try {
    if (!vscode || !vscode.window) {
      isPanelInitializing = false;
      return false;
    }
    
    if (!thinkingPanel) {
      try {
        thinkingPanel = vscode.window.createWebviewPanel(
          'continueThinkingPanel',
          'Continue Thinking',
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
            retainContextWhenHidden: true
          }
        );
        
        thinkingPanel.onDidDispose(() => {
          thinkingPanel = null;
        });
        
        thinkingPanel.webview.onDidReceiveMessage((message: ThinkingPanelMessage) => {
          if (message.command === 'ready') {
            console.log('Thinking panel webview is ready');
          }
        });
      } catch (e) {
        console.error("Error creating thinking panel:", e);
        isPanelInitializing = false;
        return false;
      }
    }
    
    // パネルHTMLの設定
    try {
      thinkingPanel.webview.html = getThinkingPanelHtml();
    } catch (e) {
      console.error("Error setting thinking panel HTML:", e);
      isPanelInitializing = false;
      return false;
    }
    
    isPanelInitializing = false;
    initRetryCount = 0;
    return true;
  } catch (e) {
    console.error("Error initializing thinking panel:", e);
    if (initRetryCount < MAX_INIT_RETRY) {
      initRetryCount++;
      setTimeout(() => {
        isPanelInitializing = false;
        initializeThinkingPanelFallback();
      }, 1000);
      return false;
    }
    
    isPanelInitializing = false;
    return false;
  }
}

/**
 * 思考パネルのHTML取得
 */
function getThinkingPanelHtml(): string {
  return `
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
          font-size: 14px;
          white-space: pre-wrap;
        }
        
        .thinking-panel {
          border-left: 3px solid #007acc;
          padding: 10px;
          margin-bottom: 16px;
          background-color: rgba(0, 122, 204, 0.05);
        }
        
        .thinking-header {
          font-weight: bold;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
        }
        
        .thinking-progress-bar {
          height: 4px;
          background-color: #eee;
          margin-bottom: 10px;
          border-radius: 2px;
          overflow: hidden;
        }
        
        .thinking-progress-value {
          height: 100%;
          background-color: #007acc;
          transition: width 0.3s;
        }
        
        .thinking-text {
          margin-top: 8px;
          white-space: pre-wrap;
        }
        
        .thinking-complete {
          text-align: center;
          padding: 10px;
          margin-top: 10px;
          border-radius: 4px;
          background-color: rgba(0, 170, 0, 0.05);
          font-weight: bold;
        }
        
        .fade-in { 
          animation: fadeIn 0.3s ease-in-out; 
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      </style>
      <script>
        // 内部でHTMLエスケープする
        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }
        
        // 表示前にHTMLとして解釈せずにテキストとして表示する
        function renderAsPlainText(content) {
          if (typeof content !== 'string') {
            return '';
          }
          return escapeHtml(content);
        }
        
        // 画面が準備できたことを通知
        function notifyReady() {
          try {
            const vscode = acquireVsCodeApi();
            vscode.postMessage({ command: 'ready' });
          } catch (e) {
            console.error('Error acquiring VS Code API:', e);
          }
        }
        
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'appendContent') {
            const content = document.getElementById('thinking-content');
            const newElement = document.createElement('div');
            newElement.className = 'fade-in';
            
            // HTMLとして解釈するのではなく、テキストコンテンツとして設定
            if (message.content && message.content.includes('<div class="thinking-complete">')) {
              // 完了メッセージは特別な形式で表示
              newElement.innerHTML = message.content;
            } else if (message.raw === true && message.content) {
              // 生のHTMLとして表示する場合（プログレスバーなど）
              newElement.innerHTML = message.content;
            } else {
              // 通常のテキストとして表示（HTMLタグをエスケープ）
              const textDiv = document.createElement('div');
              textDiv.textContent = message.text || '';
              
              // フェーズ名とアイコンを設定
              const phaseName = message.phase || '思考中...';
              const progressValue = message.progress || 0;
              
              // プログレスバーのHTMLを作成
              const progressHTML = 
                '<div class="thinking-header">' + phaseName + '</div>' +
                '<div class="thinking-progress-bar">' +
                  '<div class="thinking-progress-value" style="width: ' + progressValue + '%;"></div>' +
                '</div>' +
                '<div class="thinking-text">' + textDiv.innerHTML + '</div>';
              
              // 思考パネルで囲む
              newElement.innerHTML = '<div class="thinking-panel">' + progressHTML + '</div>';
            }
            
            content.appendChild(newElement);
            window.scrollTo(0, document.body.scrollHeight);
          }
        });
        
        // ページ読み込み時と追加時に準備完了通知
        window.addEventListener('load', notifyReady);
        
        // 5秒ごとに再通知（VSCodeとの接続が確実になるよう）
        setInterval(notifyReady, 5000);
      </script>
    </head>
    <body>
      <div id="thinking-content"></div>
    </body>
    </html>
  `;
}

/**
 * 思考コンテンツを追加（フォールバック版）
 */
function appendThinkingContentFallback(content: string, phase?: string, progress?: number): boolean {
  if (!thinkingPanel) {
    if (!initializeThinkingPanelFallback()) {
      console.warn('Failed to initialize thinking panel for content:', content.substring(0, 50) + '...');
      return false;
    }
  }
  
  try {
    if (thinkingPanel && thinkingPanel.webview) {
      if (content.includes('思考プロセス完了')) {
        // 完了メッセージは特別な形式で表示
        thinkingPanel.webview.postMessage({
          command: 'appendContent',
          content: `<div class="thinking-complete">✨ 思考プロセス完了 ✨</div>`,
          raw: true
        });
      } else {
        // 通常のテキストとして表示（HTMLタグをエスケープ）
        thinkingPanel.webview.postMessage({
          command: 'appendContent',
          text: content,
          phase: formatPhaseName(phase || '思考中...'),
          progress: progress ? Math.round(progress * 100) : 0
        });
      }
      
      try {
        thinkingPanel.reveal();
      } catch (e) {
        console.warn('Error revealing thinking panel:', e);
      }
      
      return true;
    }
  } catch (e) {
    console.error('Error appending content to thinking panel:', e);
    
    // エラー発生時はパネルをリセット
    try {
      if (thinkingPanel) {
        thinkingPanel.dispose();
      }
    } catch (disposeError) {
      console.error('Error disposing thinking panel:', disposeError);
    }
    
    thinkingPanel = null;
    
    // 再初期化を試みる
    if (initializeThinkingPanelFallback()) {
      console.log('Thinking panel re-initialized after error');
      setTimeout(() => {
        appendThinkingContentFallback(content, phase, progress);
      }, 500);
      return true;
    }
  }
  
  return false;
}

/**
 * 思考パネルを登録する拡張版関数
 */
export function registerThinkingPanel(context: any) {
  // 既に登録済みかチェック（前回の登録が処理中の場合は終了）
  if (context.registeredThinkingPanel) {
    console.log('Thinking panel already registered with this context, skipping');
    return;
  }
  
  // VSCode API が使えない場合は終了
  if (!vscode || !vscode.commands) {
    console.log('VSCode API not available for registerThinkingPanel');
    return;
  }
  
  try {
    // 登録済みとマーク
    context.registeredThinkingPanel = true;
    
    // すべてのコマンドが登録されるまで待機
    Promise.all([
      registerCommandWithRetry(context, 'continue.resetThinkingPanel', () => {
        resetThinkingState();
      }, MAX_COMMAND_REGISTRATION_RETRIES),
      
      registerCommandWithRetry(context, 'continue.appendThinkingChunk', 
        (content: string, phase: string, progress: number) => {
          if (thinkingPanel) {
            appendThinkingContentFallback(content, phase, progress);
          } else {
            initializeThinkingPanelFallback();
            appendThinkingContentFallback(content, phase, progress);
          }
      }, MAX_COMMAND_REGISTRATION_RETRIES),
      
      registerCommandWithRetry(context, 'continue.forceRefreshThinking', 
        (force: boolean) => {
          if (thinkingPanel) {
            try {
              thinkingPanel.reveal();
            } catch (e) {
              console.warn('Error revealing thinking panel:', e);
              thinkingPanel = null;
              initializeThinkingPanelFallback();
            }
          } else {
            initializeThinkingPanelFallback();
          }
      }, MAX_COMMAND_REGISTRATION_RETRIES),
      
      registerCommandWithRetry(context, 'continue.thinkingCompleted', () => {
        thinkingCompletedSent = true;
      }, MAX_COMMAND_REGISTRATION_RETRIES)
    ]).then((results) => {
      const allRegistered = results.every(r => r === true);
      if (allRegistered) {
        console.log('ThinkingPanel commands registered successfully');
      } else {
        console.warn('Some ThinkingPanel commands failed to register:', results);
      }
      
      // パネルを初期化
      initializeThinkingPanelFallback();
    }).catch((error) => {
      lastRegistrationError = error;
      commandRegistrationRetries++;
      
      console.error('Error registering ThinkingPanel commands:', error);
      
      // 登録に失敗してもパネルは初期化
      initializeThinkingPanelFallback();
      
      // リトライの制限を超えた場合は警告
      if (commandRegistrationRetries >= MAX_COMMAND_REGISTRATION_RETRIES) {
        console.warn(`Failed to register thinking panel commands after ${MAX_COMMAND_REGISTRATION_RETRIES} attempts. Using fallback mechanism.`);
      } else {
        // リトライ
        setTimeout(() => {
          context.registeredThinkingPanel = false;
          registerThinkingPanel(context);
        }, 1000 * commandRegistrationRetries); // リトライごとに待機時間を増やす
      }
    });
    
    // 状態をリセット
    resetThinkingState();
    console.log('Thinking panel registration started with extension context');
  } catch (e) {
    console.error('Error in registerThinkingPanel:', e);
    initializeThinkingPanelFallback();
  }
}

/**
 * 思考状態をリセットする
 */
function resetThinkingState() {
  thinkingCompletedSent = false;
  thinkingActive = false;
  thinkingReset = true;
  thinkingQueue = [];
  isProcessingQueue = false;
  sentContentHashes.clear();
  sentContentHistory.length = 0;
  
  // コマンドが使えれば使う、そうでなければフォールバック
  safeExecuteCommand('continue.resetThinkingPanel', [], () => {
    if (thinkingPanel) {
      try {
        thinkingPanel.dispose();
      } catch (e) {
        console.warn('Error disposing thinking panel:', e);
      }
      thinkingPanel = null;
    }
    initializeThinkingPanelFallback();
  });
}

/**
 * 思考コンテンツのハッシュを生成
 */
function hashThinkingContent(content: string): string {
  return content.substring(0, 100) + content.length.toString();
}

/**
 * ハッシュ履歴を管理（古いエントリを削除）
 */
function manageHashHistory() {
  if (sentContentHashes.size > MAX_HASH_HISTORY) {
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
 * 思考キューを処理する
 */
function processThinkingQueue() {
  if (isProcessingQueue || thinkingQueue.length === 0) return;
  
  isProcessingQueue = true;
  const now = Date.now();
  
  // スロットリングを適用
  if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
    setTimeout(processThinkingQueue, UPDATE_THROTTLE_MS - (now - lastUpdateTime));
    isProcessingQueue = false;
    return;
  }
  
  // 最新アイテムを取得
  const latest = thinkingQueue.pop();
  if (!latest) {
    isProcessingQueue = false;
    return;
  }
  
  // 複数の更新をバッチ処理
  let combinedContent = latest.content;
  let highestProgress = latest.progress;
  let lastPhase = latest.phase;
  
  while (thinkingQueue.length > 0) {
    const nextItem = thinkingQueue.pop();
    if (nextItem) {
      combinedContent += nextItem.content;
      if (nextItem.progress > highestProgress) {
        highestProgress = nextItem.progress;
      }
      lastPhase = nextItem.phase;
    }
  }
  thinkingQueue = [];
  
  // 重複チェック
  const contentHash = hashThinkingContent(combinedContent);
  if (sentContentHashes.has(contentHash)) {
    isProcessingQueue = false;
    return;
  }
  
  // 履歴に追加
  sentContentHashes.add(contentHash);
  sentContentHistory.push(combinedContent);
  if (sentContentHistory.length > MAX_CONTENT_HISTORY) {
    sentContentHistory.shift();
  }
  
  manageHashHistory();
  
  thinkingActive = true;
  
  // リセットが必要な場合は実行
  if (thinkingReset) {
    safeExecuteCommand('continue.resetThinkingPanel', [], () => {
      if (thinkingPanel) {
        try {
          thinkingPanel.dispose();
        } catch (e) { }
        thinkingPanel = null;
      }
      initializeThinkingPanelFallback();
    });
    thinkingReset = false;
  }
  
  // コンテンツを追加
  setTimeout(() => {
    // vscode.commands.executeCommand が失敗した場合のフォールバック
    safeExecuteCommand('continue.appendThinkingChunk', [combinedContent, lastPhase, highestProgress], () => {
      appendThinkingContentFallback(combinedContent, lastPhase, highestProgress);
    });
    
    // パネルを表示
    safeExecuteCommand('continue.forceRefreshThinking', [true], () => {
      if (thinkingPanel) {
        try {
          thinkingPanel.reveal();
        } catch (e) { }
      } else {
        initializeThinkingPanelFallback();
      }
    });
    
    lastUpdateTime = Date.now();
    isProcessingQueue = false;
    
    // キューに残りがあれば継続処理
    if (thinkingQueue.length > 0) {
      processThinkingQueue();
    }
  }, 0);
}

/**
 * 思考内容を更新する
 */
export function updateThinking(content: string, phase: string, progress: number) {
  if (!content || content.trim() === "") {
    return;
  }
  
  // 思考完了後の新しい入力は状態をリセット
  if (thinkingCompletedSent) {
    resetThinkingState();
  }
  
  thinkingActive = true;
  
  // 重複チェック（簡易版）
  const quickHash = content.substring(0, 50) + content.length.toString(); 
  if (sentContentHashes.has(quickHash)) {
    return;
  }
  
  // 生のコンテンツをキューに追加（HTMLタグをエスケープするのはWebビューのスクリプトで行う）
  thinkingQueue.push({ 
    content: content, 
    phase: phase, 
    progress: progress 
  });
  
  processThinkingQueue();
}

/**
 * 思考完了を通知する
 */
export function thinkingCompleted() {
  if (!thinkingActive || thinkingCompletedSent) {
    return;
  }
  
  // キューをクリア
  thinkingQueue = [];
  isProcessingQueue = false;
  
  // 完了フラグを設定
  safeExecuteCommand('continue.thinkingCompleted', [], () => {
    thinkingCompletedSent = true;
    
    if (!thinkingPanel) {
      initializeThinkingPanelFallback();
    }
  });
  
  // 完了メッセージを表示
  safeExecuteCommand('continue.appendThinkingChunk', ["✨ 思考プロセス完了 ✨", '✅ 完了', 1.0], () => {
    appendThinkingContentFallback("✨ 思考プロセス完了 ✨", '✅ 完了', 1.0);
  });
  
  thinkingCompletedSent = true;
  
  // パネルを表示
  setTimeout(() => {
    safeExecuteCommand('continue.forceRefreshThinking', [false], () => {
      if (thinkingPanel) {
        try {
          thinkingPanel.reveal();
        } catch (e) {
          console.warn('Error revealing thinking panel:', e);
          thinkingPanel = null;
          initializeThinkingPanelFallback();
          appendThinkingContentFallback("✨ 思考プロセス完了 ✨", '✅ 完了', 1.0);
        }
      } else {
        initializeThinkingPanelFallback();
        appendThinkingContentFallback("✨ 思考プロセス完了 ✨", '✅ 完了', 1.0);
      }
    });
  }, 100);
}