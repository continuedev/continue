// プロキシ設定スクリプト
console.log('Setting up proxy configuration...');

try {
  // プロキシ設定
  const proxySettings = {
    HTTP_PROXY: "http://mp10asehu01-01.mbsd-gsp.com:8080",
    HTTPS_PROXY: "http://mp10asehu01-01.mbsd-gsp.com:8080",
    NO_PROXY: "localhost,127.0.0.1"
  };

  // 環境変数に設定
  if (typeof process !== 'undefined' && process.env) {
    Object.assign(process.env, proxySettings);
    console.log('Proxy environment variables set');
  }

  // Node.jsのグローバルAgentにプロキシを設定
  try {
    const http = require('http');
    const https = require('https');
    const HttpProxyAgent = require('http-proxy-agent');
    const HttpsProxyAgent = require('https-proxy-agent');
    
    // HTTP プロキシエージェントを作成
    const httpAgent = new HttpProxyAgent(proxySettings.HTTP_PROXY);
    // HTTPS プロキシエージェントを作成 
    const httpsAgent = new HttpsProxyAgent(proxySettings.HTTPS_PROXY);
    
    // グローバルエージェントを設定
    http.globalAgent = httpAgent;
    https.globalAgent = httpsAgent;
    
    console.log('Global HTTP/HTTPS agents configured with proxy');
  } catch (agentError) {
    console.warn('Failed to configure global agents:', agentError);
  }
  
  // fetchのプロキシ設定（Node-fetchまたはundiciの場合）
  try {
    const originalFetch = global.fetch;
    
    if (originalFetch) {
      global.fetch = async function(url, options) {
        // オプションがなければ作成
        options = options || {};
        
        // プロキシヘッダーを追加
        if (!options.headers) {
          options.headers = {};
        }
        
        options.headers['X-HTTP-Proxy'] = proxySettings.HTTP_PROXY;
        options.headers['X-HTTPS-Proxy'] = proxySettings.HTTPS_PROXY;
        
        // 元のfetchを呼び出す
        return originalFetch(url, options);
      };
      
      console.log('Fetch function patched with proxy support');
    }
  } catch (fetchError) {
    console.warn('Failed to patch fetch:', fetchError);
  }
  
  console.log('Proxy setup completed');
} catch (e) {
  console.error('Error in proxy setup:', e);
}
