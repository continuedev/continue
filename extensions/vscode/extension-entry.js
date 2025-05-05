// 拡張機能のエントリーポイント - 拡張機能の初期化を管理
try {
  console.log('Loading Continue extension preload script');
  
  // MCP接続ヘルパーを読み込む
  try {
    console.log('Loading MCP connection helper...');
    require('./mcp-connection-helper');
    console.log('MCP connection helper loaded');
  } catch (mcpError) {
    console.error('Error loading MCP connection helper:', mcpError);
  }
  
  // Databricks APIパッチを読み込む
  try {
    console.log('Loading Databricks API patch...');
    require('./databricks-api-patch');
    console.log('Databricks API patch loaded');
  } catch (apiPatchError) {
    console.error('Error loading Databricks API patch:', apiPatchError);
  }
  
  // 思考パネルコマンドを読み込む
  try {
    console.log('Loading thinking panel commands...');
    require('./thinking-panel-commands');
    console.log('Thinking panel commands loaded');
  } catch (thinkingError) {
    console.error('Error loading thinking panel commands:', thinkingError);
  }
  
  // プリロードスクリプトを読み込む
  try {
    require('./preload');
  } catch (preloadError) {
    console.error('Error loading preload script:', preloadError);
  }
  
  // 本来の拡張機能を読み込む
  console.log('Loading main extension module');
  module.exports = require('./out/extension');
} catch (e) {
  console.error('Error in extension entry point:', e);
  // エラーが発生しても拡張機能は読み込む
  try {
    module.exports = require('./out/extension');
  } catch (mainError) {
    console.error('Failed to load main extension module:', mainError);
    // 最低限の機能を提供するスタブを返す
    module.exports = {
      activate: (context) => {
        console.log('Activating Continue extension stub');
        return {
          dispose: () => {}
        };
      },
      deactivate: () => {
        console.log('Deactivating Continue extension stub');
      }
    };
  }
}
