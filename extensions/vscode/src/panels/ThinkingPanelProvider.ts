import * as vscode from 'vscode';

/**
 * ThinkingPanelProvider - Manages the UI panel for displaying Claude's thinking process
 * This panel shows real-time updates of Claude's thinking as it processes requests
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

  // Singleton pattern
  public static getInstance(context: vscode.ExtensionContext): ThinkingPanelProvider {
    if (!ThinkingPanelProvider.instance) {
      ThinkingPanelProvider.instance = new ThinkingPanelProvider(context);
    }
    return ThinkingPanelProvider.instance;
  }

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Create status bar item to show when thinking is in progress
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.text = "$(sync~spin) Claude is thinking...";
    this.statusBarItem.command = 'continue.showThinkingPanel';
    this.statusBarItem.tooltip = "Click to show Claude's thinking process";
    
    // Register commands early to ensure they're available
    this.registerCommands();
    
    // Setup interval for regular UI updates
    this.startUpdateInterval();
    
    // Log initialization
    console.log("ThinkingPanelProvider initialized");
  }

  // Register all commands needed by the thinking panel
  private registerCommands() {
    try {
      // Register commands before pushing to subscriptions
      const showThinkingCommand = vscode.commands.registerCommand('continue.showThinkingPanel', () => {
        this.createOrShowPanel();
      });
      
      const updateThinkingCommand = vscode.commands.registerCommand('continue.updateThinking', 
        (content: string, phase: string, progress: number) => {
          this.updateThinking(content, phase, progress);
      });
      
      const appendThinkingCommand = vscode.commands.registerCommand('continue.appendThinkingChunk', 
        (chunk: string, phase: string, progress: number) => {
          this.appendThinkingChunk(chunk, phase, progress);
      });
      
      const forceRefreshCommand = vscode.commands.registerCommand('continue.forceRefreshThinking', 
        (force: boolean) => {
          this.forceRefresh(force);
      });
      
      const thinkingCompletedCommand = vscode.commands.registerCommand('continue.thinkingCompleted', () => {
        this.thinkingCompleted();
      });
      
      const resetThinkingCommand = vscode.commands.registerCommand('continue.resetThinkingPanel', () => {
        this.resetThinkingPanel();
      });
      
      // 新規セッション用コマンドのフォールバック
      const newSessionCommand = vscode.commands.registerCommand('continue.newSession', () => {
        vscode.commands.executeCommand('continue.sidebar.newSession').catch(err => {
          console.error("Error executing new session command:", err);
          vscode.window.showErrorMessage("セッションの作成に失敗しました。続行するには、最初にサイドバーから新しいセッションを開始してください。");
        });
      });
      
      // ログ表示用コマンドのフォールバック
      const viewLogsCommand = vscode.commands.registerCommand('continue.viewLogs', () => {
        try {
          const logDirUri = vscode.Uri.joinPath(this.context.globalStorageUri, 'logs');
          vscode.commands.executeCommand('workbench.action.openFolder', logDirUri);
        } catch (error) {
          console.error("Error opening logs folder:", error);
          vscode.window.showErrorMessage(`ログフォルダを開けませんでした: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      
      // コンテキストにコマンドを追加
      this.context.subscriptions.push(
        showThinkingCommand,
        updateThinkingCommand,
        appendThinkingCommand,
        forceRefreshCommand,
        thinkingCompletedCommand,
        resetThinkingCommand,
        newSessionCommand,
        viewLogsCommand,
        this.statusBarItem
      );
      
      console.log("ThinkingPanel commands registered successfully");
    } catch (error) {
      console.error("Error registering ThinkingPanel commands:", error);
    }
  }

  // Reset thinking panel
  private resetThinkingPanel() {
    this.thinking = '';
    this.isThinking = false;
    this.thinkingPhase = "initial";
    this.progress = 0;
    this.statusBarItem.hide();
    
    if (this.panel) {
      this.updatePanel();
    }
    
    console.log("Thinking panel reset");
  }

  // Start an interval for regular UI updates
  private startUpdateInterval() {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Create new update interval - 100ms is more responsive than default
    this.updateInterval = setInterval(() => {
      if (this.pendingUpdates && this.panel) {
        this.updatePanel();
        this.pendingUpdates = false;
      }
    }, 100);
  }

  // Create or show the thinking panel
  private createOrShowPanel() {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    
    try {
      // Create a new webview panel
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
      
      // Initial HTML content
      this.updatePanel();
      
      // Handle panel disposal
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
      
      console.log("Thinking panel created and displayed");
    } catch (error) {
      console.error("Error creating thinking panel:", error);
      vscode.window.showErrorMessage(`Thinking panel could not be created: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Update the thinking content with new data
  public updateThinking(content: string, phase: string, progress: number) {
    // Show the status bar item when thinking starts
    this.isThinking = true;
    this.thinkingPhase = phase;
    this.progress = progress;
    this.thinking = content; // Replace content instead of appending
    this.statusBarItem.show();
    
    // Mark for update
    this.pendingUpdates = true;
    
    // Update the panel if it exists, or create it if auto-show is enabled
    if (this.panel) {
      this.updatePanel();
      this.pendingUpdates = false;
    }
    
    console.log(`Thinking updated: ${phase} - Progress: ${Math.round(progress * 100)}%`);
  }

  // Append a chunk to the thinking content
  public appendThinkingChunk(chunk: string, phase: string, progress: number) {
    this.isThinking = true;
    this.thinkingPhase = phase;
    this.progress = progress;
    this.thinking += chunk;
    this.statusBarItem.show();
    
    // Mark for update
    this.pendingUpdates = true;
    
    // Force immediate update for chunk
    if (this.panel) {
      this.updatePanel();
      this.pendingUpdates = false;
    }
    
    console.log(`Thinking chunk appended - Progress: ${Math.round(progress * 100)}%`);
  }

  // Force a refresh of the UI
  public forceRefresh(force: boolean) {
    if (this.panel) {
      this.updatePanel();
    } else if (force) {
      this.createOrShowPanel();
    }
  }

  // Mark thinking as completed
  public thinkingCompleted() {
    this.isThinking = false;
    this.statusBarItem.hide();
    
    // Force final update
    if (this.panel) {
      this.updatePanel();
    }
    
    console.log("Thinking process completed");
  }

  // Update the panel HTML
  private updatePanel() {
    if (!this.panel) return;
    
    try {
      this.panel.webview.html = this.getWebviewContent();
    } catch (error) {
      console.error("Error updating panel HTML:", error);
    }
  }

  // Format thinking for HTML display
  private formatThinkingForHtml(text: string): string {
    if (!text) return '';
    
    try {
      // Escape HTML entities
      text = text.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
      
      // Format code blocks
      text = text.replace(/```([a-z]*)\n([\s\S]*?)```/g, 
        '<pre class="code-block"><div class="code-header">$1</div><code>$2</code></pre>');
      
      // Format headings
      text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
      text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
      text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
      
      // Format bold and italic
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // Format paragraphs
      text = text.replace(/\n\n/g, '</p><p>');
      
      // Format lists
      text = text.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
      
      return `<p>${text}</p>`;
    } catch (error) {
      console.error("Error formatting thinking HTML:", error);
      return `<p>${text}</p>`;
    }
  }

  // Generate the HTML content for the webview
  private getWebviewContent(): string {
    try {
      // Convert thinking process to HTML
      const formattedThinking = this.formatThinkingForHtml(this.thinking);
      
      // Calculate progress percentage
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
              // Auto-scroll to bottom
              const thinkingContent = document.querySelector('.thinking-content');
              thinkingContent.scrollTop = thinkingContent.scrollHeight;
              
              // Force refresh when receiving message
              window.addEventListener('message', (event) => {
                  const message = event.data;
                  if (message.command === 'refresh') {
                      thinkingContent.scrollTop = thinkingContent.scrollHeight;
                  }
              });
              
              // VSCode API
              const vscode = acquireVsCodeApi();
          </script>
      </body>
      </html>`;
    } catch (error) {
      console.error("Error generating webview content:", error);
      return `<!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Error</title></head>
      <body><p>Error generating thinking panel content: ${error instanceof Error ? error.message : String(error)}</p></body>
      </html>`;
    }
  }
}

// Function to register the thinking panel with the extension
export function registerThinkingPanel(context: vscode.ExtensionContext) {
  if (!context) {
    console.error("Error: No valid extension context provided to registerThinkingPanel");
    return;
  }
  
  try {
    // Create the thinking panel provider and register all commands
    const provider = ThinkingPanelProvider.getInstance(context);
    console.log("Thinking panel registered with extension context");
    
    // Core ThinkingPanelをブリッジするためのコマンドを登録
    const bridgeCommands = [
      vscode.commands.registerCommand('continue.registerThinkingPanel', () => {
        // このコマンドはcore/llm/llms/thinkingPanel.tsからのインテグレーション用
        console.log("Bridge command 'registerThinkingPanel' executed");
      }),
    ];
    
    // コンテキストに登録
    context.subscriptions.push(...bridgeCommands);
    
    return provider;
  } catch (error) {
    console.error("Failed to register thinking panel:", error);
    vscode.window.showErrorMessage(`Thinking panel initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}