// Databricks API パッチスクリプト
console.log('Setting up Databricks API patch...');

try {
  // オリジナルのfetchを記録
  const originalFetch = global.fetch;

  // デバッグログを強化
  const debugLog = (level, message, data) => {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [DATABRICKS-PATCH] ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  };

  // fetchをオーバーライド
  global.fetch = async function(url, options) {
    // Databricks APIエンドポイントかどうか確認
    if (url && url.toString().includes('databricks') && url.toString().includes('invocations')) {
      debugLog('log', `Intercepting Databricks API request to ${url}`);
      
      try {
        // リクエストボディを取得
        let body = options?.body;
        let originalBody = null;
        
        if (body) {
          // JSON文字列の場合はパース
          if (typeof body === 'string') {
            try {
              originalBody = body; // オリジナルボディを保存
              body = JSON.parse(body);
              debugLog('debug', 'Original request body:', body);
            } catch (e) {
              debugLog('warn', "Failed to parse request body as JSON:", e);
              // パースに失敗した場合、元のfetchを呼び出す
              return originalFetch(url, options);
            }
          }
          
          // メッセージ配列があるか確認
          if (body && body.messages) {
            // 各メッセージを確認
            let hasModifications = false;
            
            // 各メッセージにcontentプロパティがあるか確認
            const fixedMessages = body.messages.map(msg => {
              let msgModified = false;
              let fixedMsg = { ...msg };
              
              // roleとcontentが必要
              if (!fixedMsg.role) {
                fixedMsg.role = "user";
                msgModified = true;
                debugLog('debug', 'Added missing role to message');
              }
              
              // contentの検証と修正
              if (!fixedMsg.content) {
                // contentが完全に欠けている場合
                fixedMsg.content = [
                  {
                    type: "text",
                    text: "何かお手伝いできることはありますか？このメッセージは自動的に生成されました。"
                  }
                ];
                msgModified = true;
                debugLog('debug', 'Added missing content to message');
              } else if (Array.isArray(fixedMsg.content)) {
                // contentが配列の場合
                if (fixedMsg.content.length === 0) {
                  // 空の配列の場合
                  fixedMsg.content = [
                    {
                      type: "text",
                      text: "何かお手伝いできることはありますか？"
                    }
                  ];
                  msgModified = true;
                  debugLog('debug', 'Replaced empty content array');
                } else {
                  // 配列内の各要素を検証
                  const validContent = fixedMsg.content.filter(item => {
                    return item && item.type === 'text' && item.text && item.text.trim() !== '';
                  });
                  
                  if (validContent.length === 0) {
                    // 有効なコンテンツがない場合
                    fixedMsg.content = [
                      {
                        type: "text",
                        text: "何かお手伝いできることはありますか？このメッセージは自動的に生成されました。"
                      }
                    ];
                    msgModified = true;
                    debugLog('debug', 'Replaced invalid content array items');
                  } else if (validContent.length !== fixedMsg.content.length) {
                    // 一部の無効なアイテムがあった場合
                    fixedMsg.content = validContent;
                    msgModified = true;
                    debugLog('debug', 'Filtered out invalid content array items');
                  }
                }
              } else if (typeof fixedMsg.content === 'string') {
                // contentが文字列の場合（古い形式）
                if (fixedMsg.content.trim() === '') {
                  // 空の文字列の場合
                  fixedMsg.content = [
                    {
                      type: "text",
                      text: "何かお手伝いできることはありますか？"
                    }
                  ];
                } else {
                  // 非空の文字列の場合、新しい形式に変換
                  fixedMsg.content = [
                    {
                      type: "text",
                      text: fixedMsg.content
                    }
                  ];
                }
                msgModified = true;
                debugLog('debug', 'Converted string content to array format');
              }
              
              if (msgModified) {
                hasModifications = true;
              }
              
              return fixedMsg;
            });
            
            // 送信するメッセージ配列は少なくとも1つ必要
            if (fixedMessages.length === 0) {
              fixedMessages.push({
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "何かお手伝いできることはありますか？このメッセージは自動的に生成されました。"
                  }
                ]
              });
              hasModifications = true;
              debugLog('debug', 'Added default message to empty messages array');
            }
            
            // 修正したメッセージで置き換え
            body.messages = fixedMessages;
            
            // 思考モードのパラメータを修正
            // max_tokens_to_sample をチェックして設定
            if (!body.max_tokens_to_sample || body.max_tokens_to_sample < 1000) {
              body.max_tokens_to_sample = 4096; // デフォルト値を設定
              hasModifications = true;
              debugLog('debug', 'Set default max_tokens_to_sample');
            }
            
            // 思考モードの設定
            if (body.thinking !== false) {
              const previousThinking = body.thinking;
              
              // 思考モードのパラメータを正しいフォーマットに設定
              body.antml = body.antml || {};
              body.antml.thinking = {
                enabled: true,
                max_tokens: 16000
              };
              
              // 古い思考モードのパラメータは削除
              if (body.thinking) {
                delete body.thinking;
              }
              
              hasModifications = true;
              debugLog('debug', 'Updated thinking mode parameters', {
                previous: previousThinking,
                current: body.antml.thinking
              });
            }
            
            // 修正が行われた場合のみ、ボディを更新
            if (hasModifications) {
              // 修正したボディをオプションに戻す
              options.body = JSON.stringify(body);
              debugLog('debug', 'Modified request body:', {
                originalKeys: originalBody ? Object.keys(JSON.parse(originalBody)) : [],
                modifiedKeys: Object.keys(body),
                messagesCount: body.messages.length
              });
            }
          }
        }
      } catch (e) {
        debugLog('error', "Error in Databricks API patch:", e);
      }
    }
    
    // 元のfetchを呼び出す
    try {
      return await originalFetch(url, options);
    } catch (error) {
      debugLog('error', `Fetch error for ${url}:`, error);
      throw error; // エラーを再スロー
    }
  };
  
  // MCP接続を改善するためのパッチも追加
  if (typeof global.WebSocket !== 'undefined') {
    const OriginalWebSocket = global.WebSocket;
    
    // WebSocketをオーバーライド
    global.WebSocket = function(url, protocols) {
      debugLog('log', `Creating WebSocket connection to: ${url}`);
      
      const ws = new OriginalWebSocket(url, protocols);
      
      // イベントハンドラを拡張
      const originalOnOpen = ws.onopen;
      ws.onopen = function(event) {
        debugLog('log', 'WebSocket connection opened');
        if (originalOnOpen) originalOnOpen.call(ws, event);
      };
      
      const originalOnClose = ws.onclose;
      ws.onclose = function(event) {
        debugLog('log', `WebSocket connection closed: code=${event.code}, reason=${event.reason}`);
        if (originalOnClose) originalOnClose.call(ws, event);
      };
      
      const originalOnError = ws.onerror;
      ws.onerror = function(event) {
        debugLog('error', 'WebSocket error:', event);
        if (originalOnError) originalOnError.call(ws, event);
      };
      
      return ws;
    };
    
    // プロトタイプとコンストラクタを元のものに合わせる
    global.WebSocket.prototype = OriginalWebSocket.prototype;
    global.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    global.WebSocket.OPEN = OriginalWebSocket.OPEN;
    global.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    global.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
    
    debugLog('log', 'WebSocket patch installed');
  }
  
  debugLog('log', 'Databricks API patch installed successfully');
} catch (e) {
  console.error('Critical error in Databricks API patch:', e);
}
