// 思考パネルコマンド登録スクリプト
console.log('Registering thinking panel commands...');

// ThinkingPanelクラスの参照を保持する変数
let thinkingPanel = null;

try {
  // VSCodeモジュールを取得
  const vscode = require('vscode');
  
  // デバッグログ用関数
  function debugLog(level, message, data) {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [THINKING-PANEL] ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  }
  
  // ThinkingPanelクラスを取得する関数
  function getOrCreateThinkingPanel() {
    try {
      // 既存のThinkingPanelがあれば利用
      if (thinkingPanel) {
        return thinkingPanel;
      }
      
      // 新しくThinkingPanelを作成
      debugLog('log', 'Creating new thinking panel...');
      
      // VS Codeのextensionコンテキストを取得
      const extension = vscode.extensions.getExtension('Continue.continue');
      if (!extension) {
        throw new Error('Could not find Continue extension');
      }
      
      // 拡張機能がアクティブでない場合は有効化
      if (!extension.isActive) {
        debugLog('log', 'Activating extension...');
        extension.activate().then(() => {
          debugLog('log', 'Extension activated successfully');
        }).catch(err => {
          debugLog('error', 'Failed to activate extension:', err);
        });
      }
      
      // ThinkingPanelを作成
      const panelTitle = 'Claude Thinking Process';
      const panel = vscode.window.createWebviewPanel(
        'claudeThinking',
        panelTitle,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(extension.extensionUri, 'media')]
        }
      );
      
      // パネル初期化
      thinkingPanel = {
        panel,
        content: '',
        isThinking: false,
        phase: 'initial',
        progress: 0,
        tokens: 0,
        startTime: Date.now(),
        
        // パネル破棄時の処理
        dispose: function() {
          try {
            this.panel.dispose();
            thinkingPanel = null;
          } catch (e) {
            debugLog('error', 'Error disposing panel:', e);
          }
        },
        
        // コンテンツをクリア
        clear: function() {
          this.content = '';
          this.isThinking = false;
          this.phase = 'initial';
          this.progress = 0;
          this.tokens = 0;
          this.startTime = Date.now();
          this.update();
        },
        
        // コンテンツを設定
        setContent: function(content) {
          this.content = content;
          this.update();
        },
        
        // コンテンツを追加
        appendContent: function(content) {
          this.content += content;
          this.update();
        },
        
        // 思考ステータスを更新
        updateStatus: function(isThinking, phase, progress, tokens) {
          this.isThinking = isThinking !== undefined ? isThinking : this.isThinking;
          this.phase = phase || this.phase;
          this.progress = progress !== undefined ? progress : this.progress;
          this.tokens = tokens !== undefined ? tokens : this.tokens;
          this.update();
        },
        
        // パネルを更新
        update: function() {
          try {
            const formattedContent = this.formatContent(this.content);
            const progressPercent = Math.round(this.progress * 100);
            const elapsedTime = this.formatElapsedTime(Date.now() - this.startTime);
            
            // パネルタイトルを更新
            this.panel.title = this.isThinking
              ? `Claude Thinking... ${progressPercent}%`
              : "Claude Thinking Process";
            
            // HTMLを生成して設定
            this.panel.webview.html = this.getHtml(formattedContent, progressPercent, elapsedTime);
          } catch (e) {
            debugLog('error', 'Error updating panel:', e);
          }
        },
        
        // 経過時間をフォーマット
        formatElapsedTime: function(ms) {
          const seconds = Math.floor(ms / 1000);
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        },
        
        // コンテンツをHTML用にフォーマット
        formatContent: function(text) {
          if (!text) return '';
          
          // HTMLエンティティをエスケープ
          text = text.replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
          
          // マークダウン要素をHTMLに変換
          text = text.replace(/```([a-z]*)(\r\n|\n)(([\s\S](?!```))*)(\r\n|\n)```/g, '<pre class="code-block"><code>$1\n$3</code></pre>');
          text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
          text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
          text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
          text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
          text = text.replace(/\n\n/g, '</p><p>');
          
          return `<p>${text}</p>`;
        },
        
        // WebView用HTML生成
        getHtml: function(formattedContent, progressPercent, elapsedTime) {
          const nonce = this.generateNonce();
          
          return `<!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'">
              <title>Claude Thinking Process</title>
              <style>
                  body {
                      font-family: var(--vscode-font-family);
                      font-size: var(--vscode-font-size);
                      color: var(--vscode-editor-foreground);
                      background-color: var(--vscode-editor-background);
                      padding: 20px;
                      line-height: 1.6;
                  }
                  .header {
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      margin-bottom: 16px;
                  }
                  .thinking-container {
                      background-color: var(--vscode-editor-inactiveSelectionBackground);
                      border-radius: 8px;
                      padding: 16px;
                      margin-bottom: 16px;
                      border-left: 4px solid var(--vscode-activityBarBadge-background);
                      overflow-wrap: break-word;
                      white-space: pre-wrap;
                  }
                  pre {
                      background-color: var(--vscode-textBlockQuote-background);
                      padding: 12px;
                      border-radius: 4px;
                      overflow-x: auto;
                  }
                  code {
                      font-family: var(--vscode-editor-font-family);
                      font-size: 14px;
                  }
                  .progress-container {
                      margin-top: 10px;
                      margin-bottom: 20px;
                  }
                  .progress-info {
                      display: flex;
                      justify-content: space-between;
                      margin-bottom: 4px;
                      font-size: 12px;
                      color: var(--vscode-descriptionForeground);
                  }
                  .progress-bar-container {
                      width: 100%;
                      height: 6px;
                      background-color: var(--vscode-progressBar-background);
                      border-radius: 3px;
                      overflow: hidden;
                  }
                  .progress-bar {
                      height: 100%;
                      background-color: var(--vscode-progressBar-foreground);
                      border-radius: 3px;
                      transition: width 0.3s;
                      width: ${progressPercent}%;
                  }
                  .progress-stats {
                      display: flex;
                      justify-content: space-between;
                      margin-top: 4px;
                      font-size: 12px;
                      color: var(--vscode-descriptionForeground);
                  }
                  .controls {
                      margin-top: 20px;
                      display: flex;
                      justify-content: flex-end;
                  }
                  button {
                      background-color: var(--vscode-button-background);
                      color: var(--vscode-button-foreground);
                      border: none;
                      padding: 6px 12px;
                      border-radius: 2px;
                      cursor: pointer;
                  }
                  button:hover {
                      background-color: var(--vscode-button-hoverBackground);
                  }
                  h1, h2, h3 {
                      color: var(--vscode-editor-foreground);
                      font-weight: 600;
                  }
                  h1 {
                      font-size: 1.6em;
                      border-bottom: 1px solid var(--vscode-panel-border);
                      padding-bottom: 10px;
                  }
                  h2 {
                      font-size: 1.4em;
                  }
                  h3 {
                      font-size: 1.2em;
                  }
                  .thinking-phase {
                      display: inline-block;
                      padding: 4px 8px;
                      border-radius: 4px;
                      font-size: 12px;
                      font-weight: 600;
                      background-color: var(--vscode-badge-background);
                      color: var(--vscode-badge-foreground);
                  }
                  .thinking-empty {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      color: var(--vscode-descriptionForeground);
                      height: 200px;
                      text-align: center;
                  }
                  .thinking-empty-icon {
                      font-size: 32px;
                      margin-bottom: 16px;
                  }
              </style>
          </head>
          <body>
              <div class="header">
                  <h1>Claude's Thinking Process</h1>
                  <span class="thinking-phase">${this.phase}</span>
              </div>
              
              ${this.isThinking ? `
              <div class="progress-container">
                  <div class="progress-info">
                      <span>Phase: ${this.phase}</span>
                      <span>${progressPercent}% complete</span>
                  </div>
                  <div class="progress-bar-container">
                      <div class="progress-bar"></div>
                  </div>
                  <div class="progress-stats">
                      <span>Tokens: ${this.tokens}</span>
                      <span>Time: ${elapsedTime}</span>
                  </div>
              </div>
              ` : ''}
              
              ${this.content ? `
                  <div class="thinking-container">
                      ${formattedContent || 'No thinking content yet.'}
                  </div>
              ` : `
                  <div class="thinking-empty">
                      <div class="thinking-empty-icon">🧠</div>
                      <p>No thinking content yet. Ask Claude a complex question to see its thinking process.</p>
                  </div>
              `}
              
              <div class="controls">
                  <button id="clearButton">Clear</button>
              </div>

              <script nonce="${nonce}">
                  try {
                      const vscode = acquireVsCodeApi();
                      document.getElementById('clearButton').addEventListener('click', () => {
                          vscode.postMessage({
                              command: 'clear'
                          });
                      });
                      
                      // Scroll to bottom on update
                      window.scrollTo(0, document.body.scrollHeight);
                  } catch (e) {
                      // エラーは静かに処理
                      console.log('Error in webview script');
                  }
              </script>
          </body>
          </html>`;
        },
        
        // nonce生成関数
        generateNonce: function() {
          let text = '';
          const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
          }
          return text;
        }
      };
      
      // パネル破棄時の処理
      panel.onDidDispose(() => {
        thinkingPanel = null;
      }, null, []);
      
      // メッセージ受信処理
      panel.webview.onDidReceiveMessage(message => {
        if (message.command === 'clear') {
          thinkingPanel.clear();
        }
      });
      
      return thinkingPanel;
    } catch (error) {
      debugLog('error', 'Error creating thinking panel:', error);
      return null;
    }
  }
  
  // コマンド登録関数
  async function registerThinkingPanelCommands() {
    try {
      // 全ての登録済みコマンドを取得
      const existingCommands = await vscode.commands.getCommands();
      
      // 思考パネル関連のコマンド定義
      const commands = [
        {
          id: 'continue.showThinkingPanel',
          handler: async () => {
            debugLog('log', 'Show thinking panel command executed');
            const panel = getOrCreateThinkingPanel();
            // パネルを表示
            if (panel && panel.panel) {
              panel.panel.reveal();
            }
            return true;
          }
        },
        {
          id: 'continue.toggleThinkingPanel',
          handler: async () => {
            debugLog('log', 'Toggle thinking panel command executed');
            const panel = getOrCreateThinkingPanel();
            // パネルが存在すれば破棄、存在しなければ作成
            if (panel && panel.panel) {
              panel.dispose();
            } else {
              const newPanel = getOrCreateThinkingPanel();
              if (newPanel && newPanel.panel) {
                newPanel.panel.reveal();
              }
            }
            return true;
          }
        },
        {
          id: 'continue.resetThinkingPanel',
          handler: async () => {
            debugLog('log', 'Reset thinking panel command executed');
            const panel = getOrCreateThinkingPanel();
            if (panel) {
              panel.clear();
            }
            return true;
          }
        },
        {
          id: 'continue.appendThinkingChunk',
          handler: async (chunk, phase, progress, tokens) => {
            debugLog('log', 'Append thinking chunk command executed', { chunkLength: chunk?.length, phase, progress });
            const panel = getOrCreateThinkingPanel();
            if (panel) {
              panel.appendContent(chunk || '');
              panel.updateStatus(true, phase, progress, tokens);
            }
            return true;
          }
        },
        {
          id: 'continue.forceRefreshThinking',
          handler: async (force) => {
            debugLog('log', 'Force refresh thinking command executed', { force });
            const panel = getOrCreateThinkingPanel();
            if (panel) {
              panel.update();
            } else if (force) {
              const newPanel = getOrCreateThinkingPanel();
              if (newPanel) {
                newPanel.panel.reveal();
              }
            }
            return true;
          }
        },
        {
          id: 'continue.thinkingCompleted',
          handler: async () => {
            debugLog('log', 'Thinking completed command executed');
            const panel = getOrCreateThinkingPanel();
            if (panel) {
              panel.updateStatus(false);
            }
            return true;
          }
        }
      ];
      
      // 各コマンドを登録
      for (const cmd of commands) {
        if (!existingCommands.includes(cmd.id)) {
          // コマンド登録
          const disposable = vscode.commands.registerCommand(cmd.id, cmd.handler);
          debugLog('log', `Command ${cmd.id} registered successfully`);
        } else {
          debugLog('log', `Command ${cmd.id} already exists, skipping registration`);
        }
      }
      
      // コマンド登録完了フラグを設定
      if (typeof global !== 'undefined') {
        global.__CONTINUE_THINKING_COMMANDS_REGISTERED = true;
      }
      
      debugLog('log', 'All thinking panel commands registered successfully');
      return true;
    } catch (error) {
      debugLog('error', 'Error registering thinking panel commands:', error);
      return false;
    }
  }
  
  // コマンドを登録
  registerThinkingPanelCommands().then(success => {
    if (success) {
      debugLog('log', 'Thinking panel commands registered');
    } else {
      debugLog('error', 'Failed to register thinking panel commands');
    }
  }).catch(err => {
    debugLog('error', 'Exception during command registration:', err);
  });
  
} catch (e) {
  console.error('Critical error in thinking panel commands:', e);
}
