import * as vscode from 'vscode';

/**
 * ThinkingPanelProvider - 思考プロセス表示用UIパネルの管理
 * このパネルはClaudeの思考プロセスをリアルタイムで表示します
 */
export class ThinkingPanelProvider {
  private static instance: ThinkingPanelProvider;
  private panel: vscode.WebviewPanel | undefined;
  private thinking: string = '';
  private isThinking: boolean = false;
  private statusBarItem: vscode.StatusBarItem;
  private thinkingPhase: string = "initial";
  private progress: number = 0;
  private context: vscode.ExtensionContext;
  private updateInterval: NodeJS.Timeout | null = null;
  private pendingUpdates: boolean = false;
  private registeredCommands = new Set<string>();
  private disposed: boolean = false;
  // 静的フラグをprivateからpublicに変更
  public static thinkingPanelRegistered: boolean = false;

  /**
   * シングルトンパターンによるインスタンス取得
   */
  public static getInstance(context: vscode.ExtensionContext): ThinkingPanelProvider {
    if (!ThinkingPanelProvider.instance) {
      ThinkingPanelProvider.instance = new ThinkingPanelProvider(context);
    }
    return ThinkingPanelProvider.instance;
  }

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    try {
      // ステータスバーアイテムの作成
      this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      this.statusBarItem.text = "$(sync~spin) Claude is thinking...";
      this.statusBarItem.command = 'continue.showThinkingPanel';
      this.statusBarItem.tooltip = "Click to show Claude's thinking process";
      
      // コマンドの登録
      this.registerCommands();
      
      // 定期更新用のインターバルをセットアップ
      this.startUpdateInterval();
    } catch (error) {
      // 初期化エラーは静かに処理（エラーログなし）
      this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    }
  }

  /**
   * コマンドが登録済みかどうかを確認
   */
  private async isCommandRegistered(commandId: string): Promise<boolean> {
    if (this.registeredCommands.has(commandId)) {
      return true;
    }
    
    try {
      const commands = await vscode.commands.getCommands();
      const exists = commands.includes(commandId);
      if (exists) {
        this.registeredCommands.add(commandId);
      }
      return exists;
    } catch (e) {
      return false;
    }
  }

  /**
   * コマンドを安全に登録する
   */
  private async safeRegisterCommand(
    commandId: string, 
    callback: (...args: any[]) => any
  ): Promise<boolean> {
    try {
      // 既に登録済みならスキップ
      if (this.registeredCommands.has(commandId)) {
        console.log(`Command ${commandId} already registered internally`);
        return true;
      }
      
      const exists = await this.isCommandRegistered(commandId);
      if (!exists) {
        try {
          const disposable = vscode.commands.registerCommand(commandId, callback);
          this.context.subscriptions.push(disposable);
          this.registeredCommands.add(commandId);
          console.log(`Command ${commandId} registered successfully`);
          return true;
        } catch (e) {
          console.error(`Error registering command ${commandId}:`, e);
          return false;
        }
      } else {
        // 既に存在する場合は記録のみ
        this.registeredCommands.add(commandId);
        console.log(`Command ${commandId} already registered in VS Code`);
        return true;
      }
    } catch (e) {
      console.error(`Unexpected error registering command ${commandId}:`, e);
      return false;
    }
  }

  /**
   * 思考パネル関連のコマンドを登録
   */
  private async registerCommands() {
    try {
      // 各コマンドを安全に登録
      await Promise.all([
        this.safeRegisterCommand('continue.showThinkingPanel', () => {
          this.createOrShowPanel();
        }),
        
        this.safeRegisterCommand('continue.updateThinking', 
          (content: string, phase: string, progress: number) => {
            this.updateThinking(content, phase, progress);
        }),
        
        this.safeRegisterCommand('continue.appendThinkingChunk', 
          (chunk: string, phase: string, progress: number) => {
            this.appendThinkingChunk(chunk, phase, progress);
        }),
        
        this.safeRegisterCommand('continue.forceRefreshThinking', 
          (force: boolean) => {
            this.forceRefresh(force);
        }),
        
        this.safeRegisterCommand('continue.thinkingCompleted', () => {
          this.thinkingCompleted();
        }),
        
        this.safeRegisterCommand('continue.resetThinkingPanel', () => {
          this.resetThinkingPanel();
        })
      ]);
      
      // ステータスバーアイテムも登録
      this.context.subscriptions.push(this.statusBarItem);
    } catch (error) {
      // エラーは静かに処理
      console.error("Error registering thinking panel commands:", error);
    }
  }

  /**
   * 思考パネルをリセット
   */
  private resetThinkingPanel() {
    try {
      this.thinking = '';
      this.isThinking = false;
      this.thinkingPhase = "initial";
      this.progress = 0;
      this.statusBarItem.hide();
      
      if (this.panel) {
        this.updatePanel();
      }
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * UIの定期更新用インターバルを開始
   */
  private startUpdateInterval() {
    try {
      // 既存のインターバルをクリア
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
      
      // 新しいインターバルを100msで作成（よりレスポンシブに）
      this.updateInterval = setInterval(() => {
        if (this.pendingUpdates && this.panel && !this.disposed) {
          this.updatePanel();
          this.pendingUpdates = false;
        }
      }, 100);
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * 思考パネルを作成または表示
   */
  private createOrShowPanel() {
    try {
      if (this.panel) {
        this.panel.reveal();
        return;
      }
      
      // 新しいwebviewパネルを作成
      this.panel = vscode.window.createWebviewPanel(
        'claudeThinking',
        "Claude's Thinking Process",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, 'media')
          ]
        }
      );
      
      // 初期HTML設定
      this.updatePanel();
      
      // パネル破棄時の処理
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    } catch (error) {
      // エラーは静かに処理
      console.error("Error creating thinking panel:", error);
    }
  }

  /**
   * 思考内容を更新
   */
  public updateThinking(content: string, phase: string, progress: number) {
    try {
      if (this.disposed) return;
      
      // ステータスバーアイテムを表示
      this.isThinking = true;
      this.thinkingPhase = phase;
      this.progress = progress;
      this.thinking = content; // 内容を置き換え
      this.statusBarItem.show();
      
      // 更新をマーク
      this.pendingUpdates = true;
      
      // パネルが存在すれば更新
      if (this.panel) {
        this.updatePanel();
        this.pendingUpdates = false;
      }
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * 思考内容に新しいチャンクを追加
   */
  public appendThinkingChunk(chunk: string, phase: string, progress: number) {
    try {
      if (this.disposed) return;
      
      this.isThinking = true;
      this.thinkingPhase = phase;
      this.progress = progress;
      this.thinking += chunk;
      this.statusBarItem.show();
      
      // 更新をマーク
      this.pendingUpdates = true;
      
      // チャンク追加時は即時更新
      if (this.panel) {
        this.updatePanel();
        this.pendingUpdates = false;
      }
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * UIを強制的に更新
   */
  public forceRefresh(force: boolean) {
    try {
      if (this.disposed) return;
      
      if (this.panel) {
        this.updatePanel();
      } else if (force) {
        this.createOrShowPanel();
      }
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * 思考終了を設定
   */
  public thinkingCompleted() {
    try {
      if (this.disposed) return;
      
      this.isThinking = false;
      this.statusBarItem.hide();
      
      // 最終更新を強制
      if (this.panel) {
        this.updatePanel();
      }
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * パネルHTMLを更新
   */
  private updatePanel() {
    try {
      if (!this.panel || this.disposed) return;
      
      this.panel.webview.html = this.getWebviewContent();
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * HTML表示用に思考内容をフォーマット
   */
  private formatThinkingForHtml(text: string): string {
    if (!text) return '';
    
    try {
      // HTMLエンティティをエスケープ
      text = text.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
      
      // コードブロックをフォーマット
      text = text.replace(/```([a-z]*)\n([\s\S]*?)```/g, 
        '<pre class="code-block"><div class="code-header">$1</div><code>$2</code></pre>');
      
      // 見出しをフォーマット
      text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
      text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
      text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
      
      // 太字と斜体をフォーマット
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // 段落をフォーマット
      text = text.replace(/\n\n/g, '</p><p>');
      
      // リストをフォーマット
      text = text.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
      
      return `<p>${text}</p>`;
    } catch (error) {
      // エラーが発生した場合は通常テキストとして表示
      return `<p>${text}</p>`;
    }
  }

  /**
   * Webview用のHTML生成
   */
  private getWebviewContent(): string {
    try {
      // 思考プロセスをHTMLに変換
      const formattedThinking = this.formatThinkingForHtml(this.thinking);
      
      // 進捗率の計算
      const progressPercent = Math.round(this.progress * 100);
      
      return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Claude's Thinking Process</title>
          <style>
              body {
                  font-family: var(--vscode-editor-font-family);
                  padding: 20px;
                  color: var(--vscode-editor-foreground);
                  font-size: var(--vscode-editor-font-size);
                  line-height: 1.6;
              }
              h1 {
                  color: var(--vscode-editorWidget-foreground);
                  font-size: 1.5em;
                  margin-bottom: 1em;
                  border-bottom: 1px solid var(--vscode-editorWidget-border);
                  padding-bottom: 0.5em;
              }
              .thinking-content {
                  white-space: pre-wrap;
                  margin-top: 20px;
                  overflow-y: auto;
                  max-height: calc(100vh - 200px);
              }
              .progress-container {
                  margin: 15px 0;
                  display: ${this.isThinking ? 'block' : 'none'};
              }
              .progress-info {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 5px;
              }
              .progress-bar-container {
                  width: 100%;
                  height: 6px;
                  background-color: var(--vscode-editor-inactiveSelectionBackground);
                  border-radius: 3px;
              }
              .progress-bar {
                  height: 100%;
                  background-color: var(--vscode-progressBar-background);
                  width: ${progressPercent}%;
                  border-radius: 3px;
                  transition: width 0.3s ease-in-out;
              }
              .phase-indicator {
                  text-transform: capitalize;
                  font-weight: 500;
              }
              .code-block {
                  background-color: var(--vscode-editor-background);
                  border-radius: 5px;
                  margin: 1em 0;
                  overflow: auto;
              }
              .code-header {
                  background-color: rgba(0,0,0,0.1);
                  padding: 5px 10px;
                  font-family: monospace;
                  font-size: 0.9em;
              }
              code {
                  display: block;
                  padding: 10px;
                  font-family: monospace;
                  white-space: pre-wrap;
              }
              p {
                  margin-bottom: 1em;
              }
              li {
                  margin-left: 1em;
              }
              h1, h2, h3 {
                  margin-top: 1.5em;
                  margin-bottom: 0.5em;
              }
              strong {
                  font-weight: 600;
                  color: var(--vscode-editor-foreground);
              }
              em {
                  font-style: italic;
              }
              .status-message {
                  font-style: italic;
                  margin-top: 10px;
                  color: var(--vscode-editorHint-foreground);
              }
          </style>
      </head>
      <body>
          <h1>Claude's Thinking Process</h1>
          <div class="progress-container">
              <div class="progress-info">
                  <div class="phase-indicator">${this.thinkingPhase} phase</div>
                  <div class="progress-percentage">${progressPercent}%</div>
              </div>
              <div class="progress-bar-container">
                  <div class="progress-bar"></div>
              </div>
              <p class="status-message">Claude is actively thinking...</p>
          </div>
          <div class="thinking-content">
              ${formattedThinking || 'Waiting for Claude to start thinking...'}
          </div>
          <script>
              try {
                  // 自動スクロールを最下部に
                  const thinkingContent = document.querySelector('.thinking-content');
                  thinkingContent.scrollTop = thinkingContent.scrollHeight;
                  
                  // メッセージ受信時に強制更新
                  window.addEventListener('message', (event) => {
                      try {
                          const message = event.data;
                          if (message.command === 'refresh') {
                              thinkingContent.scrollTop = thinkingContent.scrollHeight;
                          }
                      } catch (e) {
                          // エラーは静かに処理
                      }
                  });
                  
                  // VSCode API
                  const vscode = acquireVsCodeApi();
                  
                  // Webviewの準備完了を親に通知
                  vscode.postMessage({ command: 'webviewReady' });
              } catch (e) {
                  // エラーは静かに処理
              }
          </script>
      </body>
      </html>`;
    } catch (error) {
      // エラー時はシンプルな内容を返す
      return `<!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Claude Thinking</title></head>
      <body><p>Thinking content is being updated...</p></body>
      </html>`;
    }
  }

  /**
   * リソース解放用の破棄メソッド
   */
  public dispose() {
    try {
      this.disposed = true;
      
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      if (this.panel) {
        this.panel.dispose();
        this.panel = undefined;
      }
      
      this.statusBarItem.dispose();
      
      ThinkingPanelProvider.instance = undefined as any;
      ThinkingPanelProvider.thinkingPanelRegistered = false;
    } catch (error) {
      // エラーは静かに処理
    }
  }
  
  /**
   * 重複設定を避けるためのクラスメソッド
   */
  public static isRegistered(): boolean {
    return ThinkingPanelProvider.thinkingPanelRegistered;
  }
}

/**
 * 思考パネルを拡張機能に登録する関数
 */
export function registerThinkingPanel(context: vscode.ExtensionContext) {
  try {
    if (!context) {
      console.warn("No valid context provided for thinking panel registration");
      return null;
    }
    
    // 重複登録を避ける
    if (ThinkingPanelProvider.isRegistered()) {
      console.log("Thinking panel already registered, returning existing instance");
      return ThinkingPanelProvider.getInstance(context);
    }
    
    // グローバル状態をチェック
    const isRegistered = context.globalState.get('thinkingPanelRegistered');
    if (isRegistered) {
      console.log("Thinking panel registered according to global state");
      ThinkingPanelProvider.thinkingPanelRegistered = true;
      return ThinkingPanelProvider.getInstance(context);
    }
    
    // 新規登録の場合はマーク
    console.log("Registering thinking panel for the first time");
    ThinkingPanelProvider.thinkingPanelRegistered = true;
    
    // 思考パネルプロバイダを作成してコマンドを登録
    const provider = ThinkingPanelProvider.getInstance(context);
    
    // 登録済みとマーク
    context.globalState.update('thinkingPanelRegistered', true);
    
    return provider;
  } catch (error) {
    // エラーは詳細にログ
    console.error("Error registering thinking panel:", error);
    if (error instanceof Error) {
      console.error(`  Name: ${error.name}`);
      console.error(`  Message: ${error.message}`);
      if (error.stack) console.error(`  Stack: ${error.stack}`);
    }
    return null;
  }
}