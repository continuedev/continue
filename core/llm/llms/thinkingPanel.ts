// 環境検出を改善 - window/globalThis参照の安全性強化
const isNode = typeof process !== 'undefined' && 
              typeof process.versions !== 'undefined' && 
              typeof process.versions.node !== 'undefined';

// ブラウザ環境検出の安全実装
const isBrowser = !isNode && typeof globalThis !== 'undefined' && 
                (typeof globalThis.window !== 'undefined' || 
                typeof globalThis.document !== 'undefined');

// VSCode API初期化の安全な実装 - 環境別に最適化
let vscode: any;

if (isNode) {
  try {
    // Node.js環境でのrequire (importで置き換えない)
    vscode = require('vscode');
    console.log("VSCode API loaded in Node.js environment");
  } catch (e) {
    console.warn("Error loading vscode module in Node.js environment:", e);
    // エラー詳細をログ
    if (e instanceof Error) {
      console.warn(`  Name: ${e.name}, Message: ${e.message}`);
      if (e.stack) console.warn(`  Stack: ${e.stack.split('\n')[0]}`);
    }
  }
} else if (isBrowser) {
  try {
    // ブラウザ環境での安全なアクセス
    const context = globalThis as any;
    
    if (typeof context.acquireVsCodeApi === 'function') {
      try {
        vscode = context.acquireVsCodeApi();
        console.log("VSCode API acquired via acquireVsCodeApi");
      } catch (apiError) {
        console.warn("Error calling acquireVsCodeApi:", apiError);
      }
    } else if (typeof context.vscode !== 'undefined') {
      vscode = context.vscode;
      console.log("VSCode API accessed via globalThis.vscode");
    } 
  } catch (e) {
    console.warn("Error initializing VSCode API in browser environment:", e);
  }
}

// VSCode APIが利用できない場合のスタブ実装
if (!vscode) {
  console.log("Creating VSCode API stub implementation");
  vscode = {
    commands: {
      executeCommand: (command: string, ...args: any[]) => {
        console.log(`[STUB] Executing command: ${command}`);
        return Promise.resolve();
      },
      registerCommand: (command: string, callback: Function) => {
        console.log(`[STUB] Registering command: ${command}`);
        return { dispose: () => {} };
      },
      getCommands: () => {
        console.log(`[STUB] Getting commands`);
        return Promise.resolve([]);
      }
    },
    window: {
      createWebviewPanel: () => {
        console.log(`[STUB] Creating webview panel`);
        return {
          webview: { 
            html: '', 
            onDidReceiveMessage: () => ({ dispose: () => {} }),
            postMessage: (msg: any) => console.log(`[STUB] Posting message: ${JSON.stringify(msg).substring(0, 100)}...`)
          },
          onDidDispose: () => ({ dispose: () => {} }),
          reveal: () => {},
          dispose: () => {}
        };
      },
      showInformationMessage: (msg: string) => {
        console.log(`[STUB INFO] ${msg}`);
      },
      showErrorMessage: (msg: string) => {
        console.error(`[STUB ERROR] ${msg}`);
      }
    },
    Uri: {
      file: (path: string) => ({ fsPath: path })
    }
  };
}

// グローバル共有変数とステート
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
// グローバル状態で登録済みコマンドを管理（重複登録防止）
const globalRegisteredCommands = new Set<string>();
// グローバルフラグを追加（登録済みかどうかを追跡）
let isThinkingPanelRegistered = false;
// 拡張機能コンテキストへの参照
let extensionContext: any = null;

// コマンド名の定数定義 - 明示的なコマンド名プレフィックスを確保
const COMMAND_PREFIX = 'continue';
const COMMANDS = {
  RESET_THINKING_PANEL: `${COMMAND_PREFIX}.resetThinkingPanel`,
  APPEND_THINKING_CHUNK: `${COMMAND_PREFIX}.appendThinkingChunk`,
  FORCE_REFRESH_THINKING: `${COMMAND_PREFIX}.forceRefreshThinking`,
  THINKING_COMPLETED: `${COMMAND_PREFIX}.thinkingCompleted`,
  SHOW_THINKING_PANEL: `${COMMAND_PREFIX}.showThinkingPanel`,
  VIEW_LOGS: `${COMMAND_PREFIX}.viewLogs`,
  OPEN_CONFIG_PAGE: `${COMMAND_PREFIX}.openConfigPage`, // 不足していたコマンドを追加
  UPDATE_THINKING: `${COMMAND_PREFIX}.updateThinking`,
  NEW_SESSION: `${COMMAND_PREFIX}.newSession`,
  TOGGLE_THINKING_PANEL: `${COMMAND_PREFIX}.toggleThinkingPanel`
};

interface ThinkingPanelMessage {
  command: string;
  content?: string;
  [key: string]: any;
}

/**
 * HTMLタグをエスケープする関数
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

/**
 * 思考フェーズに合わせてアイコンを返す
 */
function getPhaseIcon(phase: string): string {
  if (!phase) return '🤔';
  
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
  if (!phase) return '思考中...';
  
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
 * パスを正規化する関数 - エラー処理を強化
 */
function normalizePath(pathStr: string): string {
  // 最初にundefinedと空文字のチェック
  if (pathStr === undefined || pathStr === null) {
    console.warn("normalizePath received undefined or null path");
    return ''; // 空文字を返す（安全なデフォルト）
  }
  
  if (typeof pathStr !== 'string') {
    console.warn(`normalizePath received non-string input: ${typeof pathStr}`);
    try {
      // 強制的に文字列に変換を試みる
      pathStr = String(pathStr);
    } catch (e) {
      console.error(`Failed to convert path to string: ${e}`);
      return ''; // 変換失敗時は空文字を返す
    }
  }
  
  if (pathStr.trim() === "") {
    return pathStr; // 空文字はそのまま返す
  }
  
  try {
    // Node.js環境チェック (process参照前に安全確認)
    const isNodeEnv = typeof process !== 'undefined' && process && typeof process.platform === 'string';
    
    // Windowsパスの場合の特別な処理
    if (isNodeEnv && process.platform === 'win32') {
      // 二重ドライブレターパターンを検出して修正（より多くのケースに対応）
      const driveLetterPatterns = [
        /^([A-Za-z]:)[\/\\]+([A-Za-z]:)[\/\\]+/i,  // C:\C:\ パターン
        /^([A-Za-z]:)[\/\\]+[^\/\\]+[\/\\]+([A-Za-z]:)[\/\\]+/i,  // C:\dir\C:\ パターン
        /^([A-Za-z]:).*?[\/\\]+\1[\/\\]+/i,  // C:\path\...\C:\ パターン
        /^([A-Za-z]:)[\/\\]+[cC]:[\/\\]/i,  // C:\c:\ パターン
        /^([A-Za-z]:)[\/\\]+[A-Za-z]:[\/\\]/i  // 任意の二重ドライブレターパターン
      ];
      
      // パスが長すぎる場合の保護
      const maxPathLength = 2048;
      if (pathStr.length > maxPathLength) {
        console.warn(`Path exceeds maximum length (${pathStr.length} > ${maxPathLength}), truncating`);
        pathStr = pathStr.substring(0, maxPathLength);
      }
      
      // 見つかったドライブレター
      let foundDriveLetter: string | null = null;
      
      // ドライブレターの検出
      const driveLetterMatch = pathStr.match(/^([A-Za-z]:)/i);
      if (driveLetterMatch) {
        foundDriveLetter = driveLetterMatch[1];
      }
      
      // ドライブレターが見つかった場合
      if (foundDriveLetter) {
        // パターンを順に適用
        for (const pattern of driveLetterPatterns) {
          if (pattern.test(pathStr)) {
            // 最初のドライブレターのみを保持し、残りのパスを修正
            const pathParts = pathStr.split(foundDriveLetter);
            if (pathParts.length > 1) {
              // 残りのパスから他のドライブレターを削除
              let remainingPath = pathParts[1];
              remainingPath = remainingPath.replace(/^[\/\\]+[A-Za-z]:[\/\\]+/i, '\\');
              remainingPath = remainingPath.replace(/[\/\\]{2,}/g, '\\');
              pathStr = foundDriveLetter + remainingPath;
            }
            break;
          }
        }
      }
      
      // 連続するパス区切り文字を単一に
      pathStr = pathStr.replace(/[\/\\]{2,}/g, '\\');
    } else if (pathStr.indexOf('/') !== -1) {
      // Unix/Macパスの処理
      pathStr = pathStr.replace(/\/+/g, '/');
    }
    
    return pathStr;
  } catch (e) {
    console.warn(`Path normalization error: ${e}`);
    if (e instanceof Error && e.stack) {
      console.warn(`Stack: ${e.stack.split('\n')[0]}`);
    }
    return pathStr; // エラー時は元のパスを返す
  }
}

/**
 * コマンドが既に登録されているかチェック - 強化版
 */
async function isCommandRegistered(commandName: string): Promise<boolean> {
  if (!commandName) {
    return false;
  }
  
  // グローバル状態でチェック
  if (globalRegisteredCommands.has(commandName)) {
    return true;
  }
  
  // モジュールレベルの状態でチェック
  if (registeredCommands.has(commandName)) {
    return true;
  }
  
  if (!vscode || !vscode.commands || typeof vscode.commands.getCommands !== 'function') {
    return false;
  }
  
  try {
    // VSCodeのAPIを使用してコマンドの存在を確認
    const commands = await vscode.commands.getCommands(true);
    const exists = Array.isArray(commands) && commands.includes(commandName);
    
    // 存在する場合は両方の状態に追加
    if (exists) {
      registeredCommands.add(commandName);
      globalRegisteredCommands.add(commandName);
    }
    
    return exists;
  } catch (e) {
    console.warn(`Error checking command registration: ${e}`);
    return false;
  }
}

/**
 * コマンドを安全に実行する - 強化版
 */
async function safeExecuteCommand(commandName: string, args: any[] = [], fallback?: () => void) {
  if (!commandName) {
    console.warn("Attempted to execute command with empty commandId");
    if (fallback) fallback();
    return;
  }
  
  if (!vscode || !vscode.commands || typeof vscode.commands.executeCommand !== 'function') {
    console.warn("VSCode API not available for command execution");
    if (fallback) fallback();
    return;
  }
  
  try {
    // コマンドの存在確認
    const exists = await isCommandRegistered(commandName);
    
    if (exists) {
      try {
        // コマンド実行
        await vscode.commands.executeCommand(commandName, ...(args || []));
        return;
      } catch (e) {
        console.warn(`Command execution error for ${commandName}: ${e}`);
        if (fallback) fallback();
      }
    } else {
      console.warn(`Command ${commandName} not found, using fallback`);
      if (fallback) fallback();
    }
  } catch (e) {
    console.warn(`Error in safeExecuteCommand for ${commandName}: ${e}`);
    if (fallback) fallback();
  }
}

/**
 * 拡張機能コンテキストを設定する関数
 * @param context VSCode拡張機能コンテキスト
 */
export function setExtensionContext(context: any): void {
  if (!context) {
    console.warn("setExtensionContext called with undefined or null context");
    return;
  }
  
  console.log("Extension context set in thinkingPanel.ts");
  extensionContext = context;
  
  // コンテキストが設定されたら思考パネルを登録
  if (!isThinkingPanelRegistered) {
    // コンテキストに既に登録済みフラグがある場合はスキップ
    const isAlreadyRegistered = context.globalState && context.globalState.get ? 
                              context.globalState.get('thinkingPanelCommandsRegistered') : 
                              false;
    
    if (isAlreadyRegistered) {
      console.log("Thinking panel already registered according to extension context");
      isThinkingPanelRegistered = true;
    } else {
      try {
        registerThinkingPanel(extensionContext);
      } catch (e) {
        console.warn("Error registering thinking panel:", e);
      }
    }
  }
}

/**
 * 拡張機能コンテキストを取得する関数
 * @returns 拡張機能コンテキスト
 */
export function getExtensionContext(): any {
  return extensionContext;
}

/**
 * 耐障害性の高いコマンド登録関数 - 重複チェック強化版
 */
async function registerCommandSafely(
  context: any, 
  name: string, 
  callback: Function
): Promise<boolean> {
  if (!name || !callback) {
    console.warn(`Invalid command registration parameters: name=${name}, callback=${callback ? 'defined' : 'undefined'}`);
    return false;
  }
  
  // コンテキストの検証と修正
  if (!context) {
    console.warn("Null context provided to registerCommandSafely, creating temporary context");
    context = { subscriptions: [] };
  } else if (!context.subscriptions) {
    console.warn("Context without subscriptions array, adding array");
    context.subscriptions = [];
  }
  
  // コンテキスト状態確認（安全処理）
  const hasGlobalState = !!(context && context.globalState && typeof context.globalState.get === 'function');
  
  // コンテキストに登録済みフラグがある場合はスキップ
  if (hasGlobalState && context.globalState.get('thinkingPanelCommandsRegistered')) {
    console.log(`Skipping command registration for ${name} - already registered according to global state`);
    
    // 登録済みとして記録
    registeredCommands.add(name);
    globalRegisteredCommands.add(name);
    
    return true;  // 既に登録済みなら成功とみなす
  }
  
  // 既に登録済みかチェック
  if (globalRegisteredCommands.has(name) || registeredCommands.has(name)) {
    console.log(`Command ${name} already registered in local state`);
    return true;  // 既に登録済みなら成功とみなす
  }
  
  try {
    if (!vscode || !vscode.commands || typeof vscode.commands.registerCommand !== 'function') {
      console.warn("VSCode API not available for command registration");
      return false;
    }
    
    // VSCodeのAPIを使用してコマンドの存在を確認（安全バージョン）
    let commands: string[] = [];
    let exists = false;
    
    try {
      commands = await vscode.commands.getCommands(true);
      exists = Array.isArray(commands) && commands.includes(name);
    } catch (getCommandsError) {
      console.warn(`Error getting commands: ${getCommandsError}`);
      // エラー時は存在しないと仮定して続行
      exists = false;
    }
    
    // 既に存在する場合は登録スキップ
    if (exists) {
      // 登録済みとして記録
      registeredCommands.add(name);
      globalRegisteredCommands.add(name);
      console.log(`Command ${name} already exists in VS Code`);
      return true;
    }
    
    // 存在しない場合は新規登録
    try {
      const disposable = vscode.commands.registerCommand(name, (...args: any[]) => {
        try {
          return callback(...args);
        } catch (callbackError) {
          console.error(`Error in command ${name} callback:`, callbackError);
          return null;
        }
      });
      
      // subscriptionsに追加
      if (context && Array.isArray(context.subscriptions)) {
        context.subscriptions.push(disposable);
      }
      
      // 登録成功を記録
      registeredCommands.add(name);
      globalRegisteredCommands.add(name);
      
      console.log(`Successfully registered command: ${name}`);
      return true;
    } catch (registerError) {
      console.warn(`Failed to register command ${name}: ${registerError}`);
      return false;
    }
  } catch (e) {
    console.warn(`Error checking command existence for ${name}: ${e}`);
    
    // エラーが発生しても登録を再試行（フェイルセーフ）
    try {
      // まずコマンドの存在を再確認（より単純な方法で）
      const exists = await isCommandRegistered(name);
      if (exists) {
        console.log(`Command ${name} already exists despite error`);
        registeredCommands.add(name);
        globalRegisteredCommands.add(name);
        return true;
      }
      
      // 存在しない場合は新規登録を試みる
      const disposable = vscode.commands.registerCommand(name, (...args: any[]) => {
        try {
          return callback(...args);
        } catch (callbackError) {
          console.error(`Error in command ${name} callback:`, callbackError);
          return null;
        }
      });
      
      // subscriptionsに追加
      if (context && Array.isArray(context.subscriptions)) {
        context.subscriptions.push(disposable);
      }
      
      // 登録成功を記録
      registeredCommands.add(name);
      globalRegisteredCommands.add(name);
      
      console.log(`Registered command despite error: ${name}`);
      return true;
    } catch (registerError) {
      console.warn(`Final attempt to register ${name} failed: ${registerError}`);
      return false;
    }
  }
}

/**
 * 思考パネルの初期化（改良版）
 */
function initializeThinkingPanel(): boolean {
  if (isPanelInitializing) {
    console.log("Thinking panel initialization already in progress");
    return false;
  }

  isPanelInitializing = true;
  console.log("Initializing thinking panel...");
  
  try {
    if (!vscode || !vscode.window || typeof vscode.window.createWebviewPanel !== 'function') {
      console.warn("VSCode API not available for panel initialization");
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
        
        console.log("Thinking panel created");
        
        thinkingPanel.onDidDispose(() => {
          console.log("Thinking panel disposed");
          thinkingPanel = null;
        });
        
        thinkingPanel.webview.onDidReceiveMessage((message: ThinkingPanelMessage) => {
          if (message && message.command === 'ready') {
            console.log("Thinking panel webview ready");
          }
        });
      } catch (e) {
        console.warn(`Error creating thinking panel: ${e}`);
        isPanelInitializing = false;
        return false;
      }
    }
    
    // パネルHTMLの設定
    try {
      if (thinkingPanel && thinkingPanel.webview) {
        thinkingPanel.webview.html = getThinkingPanelHtml();
        console.log("Thinking panel HTML set");
      }
    } catch (e) {
      console.warn(`Error setting panel HTML: ${e}`);
      isPanelInitializing = false;
      return false;
    }
    
    isPanelInitializing = false;
    initRetryCount = 0;
    return true;
  } catch (e) {
    console.warn(`Unexpected error in panel initialization: ${e}`);
    
    // 全体的な初期化失敗時の再試行
    if (initRetryCount < MAX_INIT_RETRY) {
      initRetryCount++;
      console.log(`Retrying panel initialization (${initRetryCount}/${MAX_INIT_RETRY})`);
      
      setTimeout(() => {
        isPanelInitializing = false;
        initializeThinkingPanel();
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
        // VSCode APIの安全な初期化
        const vscodeApi = (() => {
          try {
            // ブラウザ環境でのみ実行
            if (typeof acquireVsCodeApi === 'function') {
              return acquireVsCodeApi();
            }
            // 利用不可の場合はスタブAPIを返す
            return {
              postMessage: (msg) => { console.log("STUB postMessage:", msg); }
            };
          } catch (e) {
            console.warn("Error acquiring VS Code API:", e);
            // スタブAPIを返す
            return {
              postMessage: (msg) => { console.log("STUB postMessage:", msg); }
            };
          }
        })();
        
        // 内部でHTMLエスケープする
        function escapeHtml(text) {
          if (!text) return '';
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
            vscodeApi.postMessage({ command: 'ready' });
          } catch (e) {
            console.warn("Error sending ready message:", e);
          }
        }
        
        if (typeof globalThis !== 'undefined' && globalThis) {
          const win = globalThis;
          if (win.addEventListener) {
            win.addEventListener('message', event => {
              try {
                if (!event || !event.data) return;
                
                const message = event.data;
                if (message.command === 'appendContent') {
                  const content = document.getElementById('thinking-content');
                  if (!content) return;
                  
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
                  if (typeof win.scrollTo === 'function') {
                    win.scrollTo(0, document.body.scrollHeight);
                  }
                }
              } catch (e) {
                console.warn("Error processing message:", e);
              }
            });
            
            // DOMContentLoadedイベントを追加
            if (typeof document !== 'undefined' && document) {
              document.addEventListener('DOMContentLoaded', notifyReady);
            }
            
            // ページ読み込み時と追加時に準備完了通知
            win.addEventListener('load', notifyReady);
          }
        }
        
        // 即時実行も追加
        notifyReady();
      </script>
    </head>
    <body>
      <div id="thinking-content"></div>
    </body>
    </html>
  `;
}

/**
 * 思考コンテンツを追加（改良版）
 */
function appendThinkingContent(content: string, phase?: string, progress?: number): boolean {
  if (!content) {
    console.warn("Empty content provided to appendThinkingContent");
    return false;
  }
  
  // パネルの初期化を確認
  if (!thinkingPanel) {
    console.log("Thinking panel not initialized, initializing now");
    if (!initializeThinkingPanel()) {
      console.warn("Failed to initialize thinking panel");
      return false;
    }
  }
  
  try {
    if (thinkingPanel && thinkingPanel.webview) {
      if (content.includes('思考プロセス完了')) {
        // 完了メッセージは特別な形式で表示
        console.log("Sending completion message to thinking panel");
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
          progress: progress !== undefined ? Math.round(progress * 100) : 0
        });
      }
      
      try {
        thinkingPanel.reveal();
      } catch (e) {
        console.warn(`Error revealing thinking panel: ${e}`);
      }
      
      return true;
    }
  } catch (e) {
    console.warn(`Error appending thinking content: ${e}`);
    
    // エラー発生時はパネルを再初期化
    try {
      if (thinkingPanel) {
        thinkingPanel.dispose();
      }
    } catch (disposeError) {
      console.warn(`Error disposing thinking panel: ${disposeError}`);
    }
    
    thinkingPanel = null;
    
    // 再初期化を試みる
    if (initializeThinkingPanel()) {
      console.log("Re-initialized thinking panel, retrying content append");
      setTimeout(() => {
        appendThinkingContent(content, phase, progress);
      }, 500);
      return true;
    }
  }
  
  return false;
}

/**
 * 思考パネルを登録する拡張版関数 - 重複防止強化版
 */
export function registerThinkingPanel(context: any) {
  console.log("Registering thinking panel...");
  
  // コンテキストの検証
  if (!context) {
    console.warn("No context provided for thinking panel registration");
    // コンテキストがなくても続行するためのダミーコンテキストを作成
    context = { subscriptions: [] };
  } else if (!context.subscriptions) {
    console.warn("Context without subscriptions array provided");
    context.subscriptions = [];
  }
  
  // 登録済みフラグをチェック（コンテキスト経由）
  const hasGlobalState = !!(context && context.globalState && typeof context.globalState.get === 'function');
  const alreadyRegistered = hasGlobalState ? context.globalState.get('thinkingPanelCommandsRegistered') : false;
  
  if (alreadyRegistered) {
    console.log("Thinking panel already registered according to global state");
    isThinkingPanelRegistered = true;
    
    // パネルだけ初期化する
    try {
      initializeThinkingPanel();
    } catch (e) {
      console.warn(`Error initializing thinking panel: ${e}`);
    }
    
    return thinkingPanel;
  }
  
  // グローバル登録確認
  if (isThinkingPanelRegistered) {
    console.log("Thinking panel already registered globally");
    return thinkingPanel;
  }
  
  // 拡張機能コンテキストを保存
  extensionContext = context;
  
  // VSCode API が使えない場合は警告してスタブ化
  if (!vscode || !vscode.commands) {
    console.warn("VSCode API not available for thinking panel registration");
    // スタブAPI初期化を確認
    if (!vscode) {
      console.warn("VSCode API not available, using stub implementation");
    }
  }
  
  try {
    // 各種登録済みフラグを設定
    isThinkingPanelRegistered = true;
    
    // VSCode APIの機能チェック
    const hasCommands = !!(vscode && vscode.commands);
    const hasWindow = !!(vscode && vscode.window);
    console.log(`VSCode API status - Commands: ${hasCommands}, Window: ${hasWindow}`);
    
    // 必要なコマンドを登録（各コマンドの重複登録チェック付き）
    Promise.all([
      registerCommandSafely(context, COMMANDS.RESET_THINKING_PANEL, () => {
        console.log("Resetting thinking state");
        resetThinkingState();
      }),
      
      registerCommandSafely(context, COMMANDS.APPEND_THINKING_CHUNK, 
        (content: string, phase: string, progress: number) => {
          console.log(`Appending thinking chunk: ${phase} (${Math.round((progress || 0) * 100)}%)`);
          if (thinkingPanel) {
            appendThinkingContent(content, phase, progress);
          } else {
            initializeThinkingPanel();
            appendThinkingContent(content, phase, progress);
          }
      }),
      
      registerCommandSafely(context, COMMANDS.FORCE_REFRESH_THINKING, 
        (force: boolean) => {
          console.log("Forcing refresh of thinking panel");
          if (thinkingPanel) {
            try {
              thinkingPanel.reveal();
            } catch (e) {
              console.warn(`Error revealing thinking panel: ${e}`);
              thinkingPanel = null;
              initializeThinkingPanel();
            }
          } else {
            initializeThinkingPanel();
          }
      }),
      
      registerCommandSafely(context, COMMANDS.THINKING_COMPLETED, () => {
        console.log("Thinking completed command called");
        thinkingCompletedSent = true;
      }),
      
      // UPDATE_THINKING コマンドも登録 - 不足していたため追加
      registerCommandSafely(context, COMMANDS.UPDATE_THINKING, 
        (content: string, phase: string, progress: number) => {
          console.log(`Update thinking command called: ${phase} (${Math.round((progress || 0) * 100)}%)`);
          updateThinking(content, phase, progress);
      }),
      
      // 表示コマンドの明示的登録
      registerCommandSafely(context, COMMANDS.SHOW_THINKING_PANEL, () => {
        console.log("Show thinking panel command called");
        if (thinkingPanel) {
          try {
            thinkingPanel.reveal();
          } catch (e) {
            console.warn(`Error revealing thinking panel: ${e}`);
            thinkingPanel = null;
            initializeThinkingPanel();
          }
        } else {
          initializeThinkingPanel();
        }
      }),
      
      // VIEW_LOGSコマンド登録の追加
      registerCommandSafely(context, COMMANDS.VIEW_LOGS, () => {
        console.log("View logs command called");
        // ログディレクトリを取得
        let logDir;
        
        // Node.js環境の場合
        if (isNode) {
          try {
            const os = require('os');
            const path = require('path');
            logDir = path.join(os.homedir(), '.continue', 'logs');
            
            // ディレクトリ作成
            try {
              const fs = require('fs');
              if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
              }
            } catch (e) {
              console.warn(`Error creating logs directory: ${e}`);
            }
            
            // VSCodeでフォルダを開く
            if (vscode && vscode.commands && vscode.commands.executeCommand) {
              vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(logDir), {
                forceNewWindow: true
              });
            }
          } catch (e) {
            console.warn(`Error in view logs command: ${e}`);
          }
        } else {
          // ブラウザ環境ではサポート外
          console.log("Log viewing is not supported in browser environment");
        }
      }),
      
      // openConfigPageコマンドの登録
      registerCommandSafely(context, COMMANDS.OPEN_CONFIG_PAGE, () => {
        console.log("Open config page command called");
        
        // Node.js環境の場合
        if (isNode) {
          try {
            const os = require('os');
            const path = require('path');
            const configPath = path.join(os.homedir(), '.continue', 'config.yaml');
            
            // ディレクトリ作成
            try {
              const fs = require('fs');
              const configDir = path.dirname(configPath);
              if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
              }
              
              // 空のYAMLファイルを作成
              if (!fs.existsSync(configPath)) {
                fs.writeFileSync(configPath, '# Continue Configuration\n\n');
              }
            } catch (e) {
              console.warn(`Error creating config file: ${e}`);
            }
            
            // VSCodeでファイルを開く
            if (vscode && vscode.commands && vscode.commands.executeCommand) {
              vscode.commands.executeCommand('vscode.open', vscode.Uri.file(configPath));
            }
          } catch (e) {
            console.warn(`Error in open config page command: ${e}`);
          }
        } else {
          // ブラウザ環境ではサポート外
          console.log("Config editing is not supported in browser environment");
        }
      }),

      // NEW_SESSION コマンドの登録
      registerCommandSafely(context, COMMANDS.NEW_SESSION, () => {
        console.log("New session command called");
        if (vscode && vscode.commands && vscode.commands.executeCommand) {
          vscode.commands.executeCommand('continue.sidebar.newSession');
        }
      }),

      // TOGGLE_THINKING_PANEL コマンドの登録
      registerCommandSafely(context, COMMANDS.TOGGLE_THINKING_PANEL, () => {
        console.log("Toggle thinking panel command called");
        if (thinkingPanel) {
          try {
            thinkingPanel.reveal();
          } catch (e) {
            console.warn(`Error revealing thinking panel: ${e}`);
            thinkingPanel = null;
            initializeThinkingPanel();
          }
        } else {
          initializeThinkingPanel();
        }
      })
    ]).then(() => {
      console.log("All thinking panel commands registered successfully");
      
      // コンテキストに登録済みフラグを設定（安全に）
      if (hasGlobalState && typeof context.globalState.update === 'function') {
        try {
          context.globalState.update('thinkingPanelCommandsRegistered', true);
          console.log("Thinking panel registered flag set in global state");
        } catch (e) {
          console.warn(`Error updating global state: ${e}`);
        }
      }
      
      // パネルを初期化
      initializeThinkingPanel();
    }).catch((error) => {
      console.warn(`Error registering thinking panel commands: ${error}`);
      // エラーが発生しても初期化を続行
      initializeThinkingPanel();
    });
    
    // 状態をリセット
    resetThinkingState();
    console.log("Thinking panel registration complete");
    
    return thinkingPanel;
  } catch (e) {
    console.warn(`Unexpected error in thinking panel registration: ${e}`);
    // エラーが発生しても初期化を続行
    initializeThinkingPanel();
    return thinkingPanel;
  }
}

/**
 * 思考状態をリセットする
 */
function resetThinkingState() {
  console.log("Resetting thinking state");
  thinkingCompletedSent = false;
  thinkingActive = false;
  thinkingReset = true;
  thinkingQueue = [];
  isProcessingQueue = false;
  sentContentHashes.clear();
  sentContentHistory.length = 0;
  
  // コマンドが使えれば使う、そうでなければフォールバック
  safeExecuteCommand(COMMANDS.RESET_THINKING_PANEL, [], () => {
    console.log("Using fallback for reset thinking panel");
    if (thinkingPanel) {
      try {
        thinkingPanel.dispose();
      } catch (e) {
        console.warn(`Error disposing thinking panel: ${e}`);
      }
      thinkingPanel = null;
    }
    initializeThinkingPanel();
  });
}

/**
 * 思考コンテンツのハッシュを生成
 */
function hashThinkingContent(content: string): string {
  if (!content) return 'empty';
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
  let combinedContent = latest.content || '';
  let highestProgress = latest.progress || 0;
  let lastPhase = latest.phase || '思考中...';
  
  while (thinkingQueue.length > 0) {
    const nextItem = thinkingQueue.pop();
    if (nextItem) {
      combinedContent += nextItem.content || '';
      if ((nextItem.progress || 0) > highestProgress) {
        highestProgress = nextItem.progress || 0;
      }
      lastPhase = nextItem.phase || lastPhase;
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
    safeExecuteCommand(COMMANDS.RESET_THINKING_PANEL, [], () => {
      console.log("Using fallback for reset thinking panel");
      if (thinkingPanel) {
        try {
          thinkingPanel.dispose();
        } catch (e) { 
          console.warn(`Error disposing thinking panel: ${e}`);
        }
        thinkingPanel = null;
      }
      initializeThinkingPanel();
    });
    thinkingReset = false;
  }
  
  // コンテンツを追加
  setTimeout(() => {
    // vscode.commands.executeCommand が失敗した場合のフォールバック
    safeExecuteCommand(COMMANDS.APPEND_THINKING_CHUNK, [combinedContent, lastPhase, highestProgress], () => {
      console.log("Using fallback for append thinking chunk");
      appendThinkingContent(combinedContent, lastPhase, highestProgress);
    });
    
    // パネルを表示
    safeExecuteCommand(COMMANDS.FORCE_REFRESH_THINKING, [true], () => {
      console.log("Using fallback for force refresh thinking");
      if (thinkingPanel) {
        try {
          thinkingPanel.reveal();
        } catch (e) {
          console.warn(`Error revealing thinking panel: ${e}`);
          thinkingPanel = null;
          initializeThinkingPanel();
        }
      } else {
        initializeThinkingPanel();
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
  const quickHash = (content || '').substring(0, 50) + (content || '').length.toString(); 
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
  
  console.log("Thinking process completed");
  
  // キューをクリア
  thinkingQueue = [];
  isProcessingQueue = false;
  
  // 完了フラグを設定
  safeExecuteCommand(COMMANDS.THINKING_COMPLETED, [], () => {
    console.log("Using fallback for thinking completed");
    thinkingCompletedSent = true;
    
    if (!thinkingPanel) {
      initializeThinkingPanel();
    }
  });
  
  // 完了メッセージを表示
  safeExecuteCommand(COMMANDS.APPEND_THINKING_CHUNK, ["✨ 思考プロセス完了 ✨", '✅ 完了', 1.0], () => {
    console.log("Using fallback for append thinking chunk (completion)");
    appendThinkingContent("✨ 思考プロセス完了 ✨", '✅ 完了', 1.0);
  });
  
  thinkingCompletedSent = true;
  
  // パネルを表示
  setTimeout(() => {
    safeExecuteCommand(COMMANDS.FORCE_REFRESH_THINKING, [false], () => {
      console.log("Using fallback for force refresh thinking (completion)");
      if (thinkingPanel) {
        try {
          thinkingPanel.reveal();
        } catch (e) {
          console.warn(`Error revealing thinking panel: ${e}`);
          thinkingPanel = null;
          initializeThinkingPanel();
          appendThinkingContent("✨ 思考プロセス完了 ✨", '✅ 完了', 1.0);
        }
      } else {
        initializeThinkingPanel();
        appendThinkingContent("✨ 思考プロセス完了 ✨", '✅ 完了', 1.0);
      }
    });
  }, 100);
}