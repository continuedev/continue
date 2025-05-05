// Continue拡張機能のメインプリロードスクリプト
try {
  console.log('Loading Continue extension preload script');
  
  // Node.js環境でのみ実行
  if (typeof process === 'undefined' || 
      typeof process.versions === 'undefined' || 
      typeof process.versions.node === 'undefined') {
    console.log('Not in Node.js environment, skipping preload');
    return;
  }
  
  // パスモジュールを取得
  const pathModule = require('path');
  const fsModule = require('fs');
  
  // オリジナルの関数を保存
  const originalJoin = pathModule.join;
  const originalResolve = pathModule.resolve;
  const originalReadFile = fsModule.readFileSync;
  
  // 二重ドライブレターを修正する関数
  function fixDoubleDriveLetter(p) {
    if (!p || typeof p !== 'string' || process.platform !== 'win32') return p;
    
    try {
      // C:\C:\ パターンを検出して修正
      if (/^([A-Za-z]):[\\\/]+\1:[\\\/]/i.test(p)) {
        const fixed = p.replace(/^([A-Za-z]):[\\\/]+\1:[\\\/]/i, (_, drive) => 
          `${drive.toUpperCase()}:\\`);
        console.log(`Path fixed: "${p}" -> "${fixed}"`);
        return fixed;
      }
      
      // その他の二重ドライブレターパターン
      if (/^([A-Za-z]):[\\\/]+([A-Za-z]):[\\\/]/i.test(p)) {
        const fixed = p.replace(/^([A-Za-z]):[\\\/]+([A-Za-z]):[\\\/]/i, (_, drive1) => 
          `${drive1.toUpperCase()}:\\`);
        console.log(`Path fixed: "${p}" -> "${fixed}"`);
        return fixed;
      }
    } catch (e) {
      console.error('Error fixing path:', e);
    }
    
    return p;
  }
  
  // path.joinをオーバーライド
  pathModule.join = function() {
    const result = originalJoin.apply(this, arguments);
    return fixDoubleDriveLetter(result);
  };
  
  // path.resolveをオーバーライド
  pathModule.resolve = function() {
    const result = originalResolve.apply(this, arguments);
    return fixDoubleDriveLetter(result);
  };
  
  // fs.readFileSyncをオーバーライド
  fsModule.readFileSync = function(path, options) {
    const fixedPath = fixDoubleDriveLetter(path);
    return originalReadFile.call(this, fixedPath, options);
  };
  
  // 各パッチスクリプトを読み込み
  const extensionPath = __dirname;
  
  // プロキシ設定
  try {
    require('./proxy-setup.js');
  } catch (proxyError) {
    console.warn('Failed to load proxy setup:', proxyError);
  }
  
  // Databricks API パッチ
  try {
    require('./databricks-api-patch.js');
  } catch (apiError) {
    console.warn('Failed to load Databricks API patch:', apiError);
  }
  
  // 思考パネルコマンド
  try {
    require('./thinking-panel-commands.js');
  } catch (thinkingError) {
    console.warn('Failed to load thinking panel commands:', thinkingError);
  }
  
  // グローバル環境に処理済みのフラグを設定
  if (typeof global !== 'undefined') {
    global.__CONTINUE_PRELOAD_APPLIED = true;
    global.__CONTINUE_PATH_FIXED = true;
    global.__CONTINUE_API_PATCHED = true;
    global.__CONTINUE_THINKING_COMMANDS_REGISTERED = true;
  }
  
  console.log('Continue extension preload completed successfully');
} catch (e) {
  console.error('Error in Continue extension preload:', e);
}
