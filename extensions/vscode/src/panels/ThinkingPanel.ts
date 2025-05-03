import * as vscode from 'vscode';
import { getNonce } from '../utilities/getNonce';

/**
 * ThinkingPanel provides a dedicated webview panel in VS Code for displaying
 * Claude's thinking process in real-time.
 */
export class ThinkingPanel {
  public static currentPanel: ThinkingPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _content: string = '';
  private _isThinking: boolean = false;
  private _thinkingPhase: string = 'initial';
  private _progress: number = 0;
  private _tokens: number = 0;
  private _startTime: number = 0;
  private _elapsedTime: number = 0;
  private _intervalId: NodeJS.Timeout | undefined;
  private _updatePending: boolean = false;
  private _lastUpdateTime: number = 0;
  private _updateThrottleMs: number = 100; // 更新間隔を短くして応答性を向上

  /**
   * Creates a new ThinkingPanel or shows an existing one.
   * @param extensionUri The URI of the extension
   * @param viewColumn The column to show the panel in
   * @param title The title of the panel
   * @returns The ThinkingPanel instance
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    viewColumn = vscode.ViewColumn.Two,
    title = 'Claude Thinking Process'
  ) {
    try {
      // If we already have a panel, show it
      if (ThinkingPanel.currentPanel) {
        try {
          ThinkingPanel.currentPanel._panel.reveal(viewColumn);
          return ThinkingPanel.currentPanel;
        } catch (e) {
          // パネル取得エラー時は新規作成（エラーは静かに処理）
          ThinkingPanel.currentPanel = undefined;
        }
      }

      // Otherwise, create a new panel
      try {
        const panel = vscode.window.createWebviewPanel(
          'claudeThinking',
          title,
          viewColumn,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
          }
        );

        ThinkingPanel.currentPanel = new ThinkingPanel(panel, extensionUri);
        return ThinkingPanel.currentPanel;
      } catch (error) {
        // パネル作成エラー時はnullを返す（エラーは静かに処理）
        return null;
      }
    } catch (error) {
      // 全体的なエラー時もnullを返す（エラーは静かに処理）
      return null;
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._startTime = Date.now();
    this._lastUpdateTime = Date.now();
    
    try {
      // Set the webview's initial HTML content
      this._updateWebview(extensionUri);

      // Start a timer to update elapsed time
      this._startTimer();

      // Listen for when the panel is disposed
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

      // Handle messages from the webview
      this._panel.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'clear':
              this.clear();
              return;
          }
        },
        null,
        this._disposables
      );
    } catch (error) {
      // 初期化エラーは静かに処理
    }
  }

  /**
   * Disposes of the panel and cleans up resources
   */
  public dispose() {
    try {
      ThinkingPanel.currentPanel = undefined;

      // Stop the timer
      if (this._intervalId) {
        clearInterval(this._intervalId);
        this._intervalId = undefined;
      }

      // Clean up our resources
      try {
        this._panel.dispose();
      } catch (e) {
        // パネル破棄エラーは静かに処理
      }

      // 残りのリソースをクリア
      while (this._disposables.length) {
        try {
          const x = this._disposables.pop();
          if (x) {
            x.dispose();
          }
        } catch (e) {
          // 破棄エラーは静かに処理
        }
      }
    } catch (error) {
      // 全体的なエラーは静かに処理
    }
  }

  /**
   * Clears the thinking content
   */
  public clear() {
    try {
      this._content = '';
      this._isThinking = false;
      this._thinkingPhase = 'initial';
      this._progress = 0;
      this._tokens = 0;
      this._startTime = Date.now();
      this._elapsedTime = 0;
      this._updateWebview(this._panel.webview.asWebviewUri(vscode.Uri.parse('/')).with({ scheme: 'vscode-resource' }).fsPath);
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * Set the thinking content and update the panel
   * @param content The thinking content to display
   */
  public setThinkingContent(content: string) {
    try {
      this._content = content;
      this._throttledUpdate();
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * Append thinking content to the existing content
   * @param content The thinking content to append
   */
  public appendThinkingContent(content: string) {
    try {
      this._content += content;
      this._throttledUpdate();
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * Update the thinking status and metadata
   * @param isThinking Whether Claude is currently thinking
   * @param phase The current thinking phase
   * @param progress The progress from 0 to 1
   * @param tokens The number of tokens used for thinking
   */
  public updateThinkingStatus(isThinking: boolean, phase?: string, progress?: number, tokens?: number) {
    try {
      this._isThinking = isThinking;
      
      if (phase) {
        this._thinkingPhase = phase;
      }
      
      if (progress !== undefined) {
        this._progress = progress;
      }
      
      if (tokens !== undefined) {
        this._tokens = tokens;
      }
      
      this._throttledUpdate();
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * 更新処理をスロットリングする
   */
  private _throttledUpdate() {
    const now = Date.now();
    if (!this._updatePending && now - this._lastUpdateTime > this._updateThrottleMs) {
      // すぐに更新
      this._lastUpdateTime = now;
      this._updateWebview(this._panel.webview.asWebviewUri(vscode.Uri.parse('/')).with({ scheme: 'vscode-resource' }).fsPath);
    } else if (!this._updatePending) {
      // 更新をスケジュール
      this._updatePending = true;
      setTimeout(() => {
        this._updatePending = false;
        this._lastUpdateTime = Date.now();
        this._updateWebview(this._panel.webview.asWebviewUri(vscode.Uri.parse('/')).with({ scheme: 'vscode-resource' }).fsPath);
      }, this._updateThrottleMs);
    }
  }

  /**
   * Start a timer to update the elapsed time
   */
  private _startTimer() {
    try {
      this._intervalId = setInterval(() => {
        this._elapsedTime = Date.now() - this._startTime;
        this._throttledUpdate();
      }, 1000);
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * Updates the webview content
   */
  private _updateWebview(extensionUri: vscode.Uri | string) {
    try {
      if (!this._panel) {
        return;
      }

      const webview = this._panel.webview;
      
      // Update the panel title to indicate thinking status
      this._panel.title = this._isThinking 
        ? `Claude Thinking... ${Math.round(this._progress * 100)}%` 
        : "Claude Thinking Process";
      
      // Get the HTML for the webview
      webview.html = this._getHtmlForWebview(webview, extensionUri);
    } catch (error) {
      // エラーは静かに処理
    }
  }

  /**
   * Format the elapsed time as mm:ss
   */
  private _formatElapsedTime(): string {
    try {
      const seconds = Math.floor(this._elapsedTime / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } catch (error) {
      // エラー時はデフォルト値を返す
      return "00:00";
    }
  }

  /**
   * Generate the HTML for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri | string) {
    try {
      // Create a nonce to whitelist specific scripts
      const nonce = getNonce();

      // Format the thinking content with markdown styling
      let formattedContent = '';
      try {
        formattedContent = this._content
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
          .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
          .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
          .replace(/^# (.*?)$/gm, '<h1>$1</h1>');
      } catch (e) {
        // フォーマットエラー時は元のコンテンツを使用
        formattedContent = this._content;
      }

      // Generate the progress indicator
      const progressWidth = Math.round(this._progress * 100);
      const progressIndicator = `
        <div class="progress-container">
          <div class="progress-info">
            <span>Phase: ${this._thinkingPhase}</span>
            <span>${progressWidth}% complete</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${progressWidth}%"></div>
          </div>
          <div class="progress-stats">
            <span>Tokens: ${this._tokens}</span>
            <span>Time: ${this._formatElapsedTime()}</span>
          </div>
        </div>
      `;

      return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
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
            <span class="thinking-phase">${this._thinkingPhase}</span>
          </div>
          
          ${this._isThinking ? progressIndicator : ''}
          
          ${this._content ? `
            <div class="thinking-container">
              <p>${formattedContent || 'No thinking content yet.'}</p>
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
    } catch (error) {
      // エラー時は最小限のHTMLを返す
      return `<!DOCTYPE html>
        <html>
        <head><title>Claude Thinking Panel</title></head>
        <body>
          <p>Thinking panel content is being updated...</p>
        </body>
        </html>`;
    }
  }
}