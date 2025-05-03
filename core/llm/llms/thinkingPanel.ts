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

interface ThinkingPanelMessage {
  command: string;
  content?: string;
  [key: string]: any;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

function normalizePath(pathStr: string): string {
  if (!pathStr) return pathStr;
  
  // 二重ドライブレター問題を修正（C:\C:\ や C:\c:\ → C:\）
  const doubleDriverPattern = /^([A-Z]:)\\+([A-Za-z]:)\\+/i;
  if (doubleDriverPattern.test(pathStr)) {
    pathStr = pathStr.replace(doubleDriverPattern, '$1\\');
  }
  
  // 自分自身の二重ドライブも修正
  const selfDoubleDriverPattern = /^([A-Z]:)\\+\1\\+/i;
  if (selfDoubleDriverPattern.test(pathStr)) {
    pathStr = pathStr.replace(selfDoubleDriverPattern, '$1\\');
  }
  
  // 連続するバックスラッシュを単一に
  pathStr = pathStr.replace(/\\{2,}/g, '\\');
  
  return pathStr;
}

// コマンドが既に登録されているかチェック
async function isCommandRegistered(commandName: string): Promise<boolean> {
  if (registeredCommands.has(commandName)) {
    return true;
  }
  
  if (!vscode || !vscode.commands) {
    return false;
  }
  
  try {
    const commands = await vscode.commands.getCommands(true);
    return commands.includes(commandName);
  } catch (e) {
    console.error(`Error checking if command ${commandName} is registered:`, e);
    return false;
  }
}

function safeExecuteCommand(commandName: string, args: any[] = [], fallback?: () => void) {
  if (vscode && vscode.commands) {
    try {
      if (registeredCommands.has(commandName)) {
        vscode.commands.executeCommand(commandName, ...args);
      } else {
        vscode.commands.getCommands(true).then((availableCommands: string[]) => {
          if (availableCommands.includes(commandName)) {
            registeredCommands.add(commandName);
            vscode.commands.executeCommand(commandName, ...args);
          } else if (fallback) {
            fallback();
          }
        }).catch((err: any) => {
          if (fallback) {
            fallback();
          }
        });
      }
    } catch (e) {
      console.warn(`Error executing command ${commandName}:`, e);
      if (fallback) {
        fallback();
      }
    }
  } else if (fallback) {
    fallback();
  }
}

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
      
      try {
        thinkingPanel.webview.onDidReceiveMessage((message: ThinkingPanelMessage) => {
        });
      } catch (e) { }
    }
    
    thinkingPanel.webview.html = getThinkingPanelHtml();
    
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
        
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'appendContent') {
            const content = document.getElementById('thinking-content');
            const newElement = document.createElement('div');
            newElement.className = 'fade-in';
            
            // HTMLとして解釈するのではなく、テキストコンテンツとして設定
            if (message.content.includes('<div class="thinking-complete">')) {
              // 完了メッセージは特別な形式で表示
              newElement.innerHTML = message.content;
            } else if (message.raw === true) {
              // 生のHTMLとして表示する場合（プログレスバーなど）
              newElement.innerHTML = message.content;
            } else {
              // 通常のテキストとして表示（HTMLタグをエスケープ）
              const textDiv = document.createElement('div');
              textDiv.textContent = message.text || '';
              
              // プログレスバーのHTMLを作成
              const progressHTML = 
                '<div class="thinking-header">' + (message.phase || '思考中...') + '</div>' +
                '<div class="thinking-progress-bar">' +
                  '<div class="thinking-progress-value" style="width: ' + (message.progress || 0) + '%;"></div>' +
                '</div>' +
                '<div class="thinking-text">' + textDiv.innerHTML + '</div>';
              
              // 思考パネルで囲む
              newElement.innerHTML = '<div class="thinking-panel">' + progressHTML + '</div>';
            }
            
            content.appendChild(newElement);
            window.scrollTo(0, document.body.scrollHeight);
            
            if (content.children.length === 1) {
              const vscode = acquireVsCodeApi();
              vscode.postMessage({ command: 'ready' });
            }
          }
        });
        
        window.addEventListener('load', () => {
          try {
            const vscode = acquireVsCodeApi();
            vscode.postMessage({ command: 'ready' });
          } catch (e) { }
        });
      </script>
    </head>
    <body>
      <div id="thinking-content"></div>
    </body>
    </html>
  `;
}

function appendThinkingContentFallback(content: string, phase?: string, progress?: number): boolean {
  if (!thinkingPanel) {
    if (!initializeThinkingPanelFallback()) {
      return false;
    }
  }
  
  if (thinkingPanel && thinkingPanel.webview) {
    try {
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
          phase: phase,
          progress: progress ? Math.round(progress * 100) : 0
        });
      }
      
      try {
        thinkingPanel.reveal();
      } catch (e) { }
      
      return true;
    } catch (e) {
      try {
        if (thinkingPanel) {
          thinkingPanel.dispose();
        }
      } catch (disposeError) {}
      
      thinkingPanel = null;
      
      if (initializeThinkingPanelFallback()) {
        appendThinkingContentFallback(content, phase, progress);
        return true;
      }
    }
  }
  
  return false;
}

export function registerThinkingPanel(context: any) {
  if (!vscode || !vscode.commands) {
    console.log('VSCode API not available for registerThinkingPanel');
    return;
  }
  
  try {
    // コマンドを登録する前に、既に存在するかチェック
    const registerCommand = async (name: string, callback: (...args: any[]) => any) => {
      const isRegistered = await isCommandRegistered(name);
      if (!isRegistered) {
        const disposable = vscode.commands.registerCommand(name, callback);
        context.subscriptions.push(disposable);
        registeredCommands.add(name);
        console.log(`Registered command: ${name}`);
        return true;
      } else {
        console.log(`Command ${name} already exists, skipping registration`);
        registeredCommands.add(name);
        return false;
      }
    };
    
    if (context && context.subscriptions) {
      // コマンド登録を非同期で行い、重複を防止
      Promise.all([
        registerCommand('continue.resetThinkingPanel', () => {
          resetThinkingState();
        }),
        
        registerCommand('continue.appendThinkingChunk', 
          (content: string, phase: string, progress: number) => {
            if (thinkingPanel) {
              appendThinkingContentFallback(content, phase, progress);
            } else {
              initializeThinkingPanelFallback();
              appendThinkingContentFallback(content, phase, progress);
            }
        }),
        
        registerCommand('continue.forceRefreshThinking', 
          (force: boolean) => {
            if (thinkingPanel) {
              try {
                thinkingPanel.reveal();
              } catch (e) {
                thinkingPanel = null;
                initializeThinkingPanelFallback();
              }
            } else {
              initializeThinkingPanelFallback();
            }
        }),
        
        registerCommand('continue.thinkingCompleted', () => {
          thinkingCompletedSent = true;
        })
      ]).then(() => {
        console.log('ThinkingPanel commands registered successfully');
      }).catch((error) => {
        console.error('Error registering ThinkingPanel commands:', error);
        initializeThinkingPanelFallback();
      });
    }
    
    try {
      vscode.commands.executeCommand('continue.registerThinkingPanel', context);
    } catch (e) {
      console.log('Thinking panel already registered, initializing fallback panel');
      initializeThinkingPanelFallback();
    }
    
    resetThinkingState();
    console.log('Thinking panel registered with extension context');
  } catch (e) {
    console.error('Error in registerThinkingPanel:', e);
    initializeThinkingPanelFallback();
  }
}

function resetThinkingState() {
  thinkingCompletedSent = false;
  thinkingActive = false;
  thinkingReset = true;
  thinkingQueue = [];
  isProcessingQueue = false;
  sentContentHashes.clear();
  sentContentHistory.length = 0;
  
  safeExecuteCommand('continue.resetThinkingPanel', [], () => {
    if (thinkingPanel) {
      try {
        thinkingPanel.dispose();
      } catch (e) { }
      thinkingPanel = null;
    }
    initializeThinkingPanelFallback();
  });
}

function hashThinkingContent(content: string): string {
  return content.substring(0, 100) + content.length.toString();
}

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

function processThinkingQueue() {
  if (isProcessingQueue || thinkingQueue.length === 0) return;
  
  isProcessingQueue = true;
  const now = Date.now();
  
  if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
    setTimeout(processThinkingQueue, UPDATE_THROTTLE_MS - (now - lastUpdateTime));
    isProcessingQueue = false;
    return;
  }
  
  const latest = thinkingQueue.pop();
  if (!latest) {
    isProcessingQueue = false;
    return;
  }
  
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
  
  const contentHash = hashThinkingContent(combinedContent);
  if (sentContentHashes.has(contentHash)) {
    isProcessingQueue = false;
    return;
  }
  
  sentContentHashes.add(contentHash);
  sentContentHistory.push(combinedContent);
  if (sentContentHistory.length > MAX_CONTENT_HISTORY) {
    sentContentHistory.shift();
  }
  
  manageHashHistory();
  
  thinkingActive = true;
  
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
  
  setTimeout(() => {
    safeExecuteCommand('continue.appendThinkingChunk', [combinedContent, lastPhase, highestProgress], () => {
      appendThinkingContentFallback(combinedContent, lastPhase, highestProgress);
    });
    
    // コマンドが存在するかチェックしてから実行
    isCommandRegistered('continue.forceRefreshThinking').then(exists => {
      if (exists) {
        vscode.commands.executeCommand('continue.forceRefreshThinking', true);
      } else {
        if (thinkingPanel) {
          try {
            thinkingPanel.reveal();
          } catch (e) { }
        } else {
          initializeThinkingPanelFallback();
        }
      }
    }).catch(() => {
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
    
    if (thinkingQueue.length > 0) {
      processThinkingQueue();
    }
  }, 0);
}

export function updateThinking(content: string, phase: string, progress: number) {
  if (!content || content.trim() === "") {
    return;
  }
  
  if (thinkingCompletedSent) {
    resetThinkingState();
  }
  
  thinkingActive = true;
  
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

export function thinkingCompleted() {
  if (!thinkingActive || thinkingCompletedSent) {
    return;
  }
  
  thinkingQueue = [];
  isProcessingQueue = false;
  
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
  
  setTimeout(() => {
    // コマンドが存在するかチェックしてから実行
    isCommandRegistered('continue.forceRefreshThinking').then(exists => {
      if (exists) {
        vscode.commands.executeCommand('continue.forceRefreshThinking', false);
      } else {
        if (thinkingPanel) {
          try {
            thinkingPanel.reveal();
          } catch (e) {
            thinkingPanel = null;
            initializeThinkingPanelFallback();
            appendThinkingContentFallback("✨ 思考プロセス完了 ✨", '✅ 完了', 1.0);
          }
        } else {
          initializeThinkingPanelFallback();
          appendThinkingContentFallback("✨ 思考プロセス完了 ✨", '✅ 完了', 1.0);
        }
      }
    }).catch(() => {
      if (thinkingPanel) {
        try {
          thinkingPanel.reveal();
        } catch (e) {
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