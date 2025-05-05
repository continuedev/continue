// MCP接続ヘルパーモジュール
console.log('Loading MCP connection helper...');

try {
  // WebSocketのオーバーライドが既に適用されているかチェック
  if (global.__MCP_CONNECTION_HELPER_LOADED) {
    console.log('MCP connection helper already loaded, skipping');
    return;
  }

  // デバッグログ用関数
  const debugLog = (level, message, data) => {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [MCP-CONNECTION] ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  };

  // WebSocketプロキシの設定
  if (typeof global.WebSocket !== 'undefined') {
    debugLog('log', 'Setting up WebSocket proxy for MCP connection...');
    
    // オリジナルのWebSocketクラスを保存
    const OriginalWebSocket = global.WebSocket;
    
    // 接続リトライ用のユーティリティ関数
    const connectWithRetry = async (url, protocols, options = {}) => {
      const { maxRetries = 3, retryDelay = 1000 } = options;
      let lastError = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          debugLog('log', `Connection attempt ${attempt}/${maxRetries} to ${url}`);
          
          return new Promise((resolve, reject) => {
            try {
              const ws = new OriginalWebSocket(url, protocols);
              
              // 接続成功ハンドラ
              ws.onopen = (event) => {
                debugLog('log', `WebSocket connected successfully on attempt ${attempt}`);
                resolve(ws);
              };
              
              // エラーハンドラ
              ws.onerror = (event) => {
                lastError = new Error(`WebSocket error on attempt ${attempt}`);
                debugLog('error', lastError.message);
                reject(lastError);
              };
            } catch (err) {
              lastError = err;
              debugLog('error', `Error creating WebSocket on attempt ${attempt}:`, err);
              reject(err);
            }
          });
        } catch (err) {
          lastError = err;
          
          if (attempt < maxRetries) {
            debugLog('log', `Retrying connection in ${retryDelay}ms...`);
            
            // 次の試行前に待機
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
      
      // 全ての試行が失敗した場合
      throw lastError || new Error(`Failed to connect after ${maxRetries} attempts`);
    };
    
    // 拡張したWebSocketクラス
    class EnhancedWebSocket extends OriginalWebSocket {
      constructor(url, protocols) {
        // URLがMCPエンドポイントを含む場合は拡張機能を適用
        const isMcpUrl = typeof url === 'string' && url.includes('mcp');
        
        if (isMcpUrl) {
          debugLog('log', `Creating enhanced WebSocket connection to MCP: ${url}`);
          
          // プロトコルに_v2を強制的に追加
          if (protocols) {
            if (Array.isArray(protocols) && !protocols.includes('_v2')) {
              protocols.push('_v2');
            } else if (typeof protocols === 'string' && protocols !== '_v2') {
              protocols = [protocols, '_v2'];
            }
          } else {
            protocols = ['_v2'];
          }
          
          debugLog('log', `Using protocols:`, protocols);
        }
        
        // 親クラスのコンストラクタを呼び出し
        super(url, protocols);
        
        // 追加のプロパティやメソッドを設定
        if (isMcpUrl) {
          // 再接続機能
          this._reconnectAttempts = 0;
          this._maxReconnectAttempts = 3;
          this._reconnectDelay = 1000;
          this._url = url;
          this._protocols = protocols;
          
          // 元のイベントハンドラを保存
          const originalOnClose = this.onclose;
          
          // クローズイベントを拡張
          this.onclose = (event) => {
            debugLog('log', `WebSocket closed with code ${event.code}, reason: ${event.reason}`);
            
            // 予期しないクローズでかつ最大再接続試行回数以下の場合は再接続
            if (event.code !== 1000 && this._reconnectAttempts < this._maxReconnectAttempts) {
              this._reconnectAttempts++;
              
              debugLog('log', `Attempting to reconnect (${this._reconnectAttempts}/${this._maxReconnectAttempts}) in ${this._reconnectDelay}ms...`);
              
              setTimeout(() => {
                try {
                  // 再接続を試みる
                  const newWs = new OriginalWebSocket(this._url, this._protocols);
                  
                  // プロパティーを新しい接続にコピー
                  for (const prop in this) {
                    if (prop !== 'close' && prop !== 'send' && 
                        prop !== 'onopen' && prop !== 'onclose' && 
                        prop !== 'onerror' && prop !== 'onmessage') {
                      newWs[prop] = this[prop];
                    }
                  }
                  
                  // イベントハンドラを新しい接続にコピー
                  if (this.onopen) newWs.onopen = this.onopen;
                  if (this.onmessage) newWs.onmessage = this.onmessage;
                  if (this.onerror) newWs.onerror = this.onerror;
                  if (this.onclose) newWs.onclose = this.onclose;
                  
                  debugLog('log', 'Reconnection attempt initiated');
                } catch (e) {
                  debugLog('error', 'Reconnection failed:', e);
                  
                  // 元のクローズハンドラを呼び出し
                  if (originalOnClose) {
                    originalOnClose.call(this, event);
                  }
                }
              }, this._reconnectDelay);
            } else {
              // 元のクローズハンドラを呼び出し
              if (originalOnClose) {
                originalOnClose.call(this, event);
              }
            }
          };
          
          // 接続成功時のカスタムハンドラ
          const originalOnOpen = this.onopen;
          this.onopen = (event) => {
            debugLog('log', 'WebSocket connection established successfully');
            
            // 再接続カウンターをリセット
            this._reconnectAttempts = 0;
            
            // MCP固有の初期化メッセージを送信
            try {
              const initMessage = JSON.stringify({
                type: 'init',
                version: '2',
                capabilities: {
                  streaming: true,
                  thinking: true
                }
              });
              
              // 初期化メッセージをキューに入れて次のティックで送信
              setTimeout(() => {
                try {
                  this.send(initMessage);
                  debugLog('log', 'Sent initialization message to MCP server');
                } catch (e) {
                  debugLog('error', 'Failed to send initialization message:', e);
                }
              }, 100);
            } catch (e) {
              debugLog('error', 'Error preparing initialization message:', e);
            }
            
            // 元のオープンハンドラを呼び出し
            if (originalOnOpen) {
              originalOnOpen.call(this, event);
            }
          };
        }
      }
    }
    
    // グローバルのWebSocketをオーバーライド
    global.WebSocket = EnhancedWebSocket;
    
    // プロトタイプとプロパティを元のクラスに合わせる
    Object.defineProperties(EnhancedWebSocket, {
      CONNECTING: { value: OriginalWebSocket.CONNECTING },
      OPEN: { value: OriginalWebSocket.OPEN },
      CLOSING: { value: OriginalWebSocket.CLOSING },
      CLOSED: { value: OriginalWebSocket.CLOSED }
    });
    
    debugLog('log', 'MCP WebSocket connection helper installed successfully');
  } else {
    debugLog('warn', 'WebSocket is not defined in this environment, MCP connection helper not installed');
  }
  
  // フラグを設定して二重ロードを防止
  global.__MCP_CONNECTION_HELPER_LOADED = true;
  
  debugLog('log', 'MCP connection helper loaded successfully');
} catch (e) {
  console.error('Error loading MCP connection helper:', e);
}