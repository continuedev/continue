import * as path from "path";
import * as fs from "fs";
import * as os from "os";

/**
 * 二重ドライブレターパターンを検出して修正する強化版関数
 * @param p 修正するパス文字列
 * @returns 修正されたパス文字列
 */
export function fixPath(p: string): string {
  if (!p || typeof p !== 'string') return p;
  
  // 入力パスが既に正しい形式なら早期リターン
  if (!/[A-Za-z]:[\\\/].*[A-Za-z]:/i.test(p)) {
    return p;
  }
  
  // デバッグ情報のために元のパスを保存
  const originalPath = p;
  
  // ステップ1: 最も基本的なC:\c:\パターンの修正
  // 例: C:\c:\path\to\file -> C:\path\to\file
  const basicPattern = /^([A-Za-z]:[\\\/]+)([a-z]:[\\\/]+)/i;
  if (basicPattern.test(p)) {
    p = p.replace(basicPattern, '$1');
  }
  
  // ステップ2: 文字列中に埋め込まれた別のドライブレターを検出して削除
  // 例: C:\path\to\D:\another\path -> C:\path\to\another\path
  p = p.replace(/([^A-Za-z])([A-Za-z]:[\\\/]+)/g, '$1');
  
  // ステップ3: 絶対パスの再検出
  // 文字列途中から始まる絶対パスが検出された場合、それを使用
  const absolutePathMatch = p.match(/[A-Za-z]:[\\\/].*/gi);
  if (absolutePathMatch && absolutePathMatch.length > 1) {
    // 最初の絶対パスを使用
    p = absolutePathMatch[0];
  }
  
  // ステップ4: 連続するスラッシュやバックスラッシュの正規化
  p = p.replace(/[\\\/]{2,}/g, '\\');
  
  // 変更があった場合のみログ出力
  if (p !== originalPath) {
    console.log(`パス修正 (fixPath): ${originalPath} → ${p}`);
  }
  
  return p;
}

/**
 * パスを適切に結合する強化版関数（絶対パスに対応）
 * @param base ベースパス
 * @param target 対象パス
 * @returns 結合されたパス
 */
export function resolveAndFixPath(base: string, target: string): string {
  if (!base || !target) return target || base || '';
  
  // まず両方のパスを修正
  const fixedBase = fixPath(base);
  const fixedTarget = fixPath(target);
  
  // targetが絶対パスの場合はそのまま返す
  if (path.isAbsolute(fixedTarget)) {
    return fixedTarget;
  }
  
  // パスを結合して返す
  const joinedPath = path.join(fixedBase, fixedTarget);
  
  // 二重ドライブレターを再チェック
  return fixPath(joinedPath);
}

/**
 * ユーザーのホームディレクトリを安全に取得する関数
 * @returns ホームディレクトリのパス
 */
export function getHomeDirSafe(): string {
  try {
    const homeDir = os.homedir();
    if (!homeDir) {
      return process.env.HOME || process.env.USERPROFILE || '/';
    }
    return homeDir;
  } catch (e) {
    console.error("Error getting home directory:", e);
    return process.env.HOME || process.env.USERPROFILE || '/';
  }
}

/**
 * manual-testing-sandboxのMCPパスを取得する強化版関数
 * @returns 正規化されたパス
 */
export function getManualTestingSandboxMcpPath(): string | null {
  try {
    // 可能性のあるパスを生成（より多くのケースに対応）
    const possiblePaths = [];
    
    // Windows環境では固定パスを最優先で試す
    if (process.platform === 'win32') {
      possiblePaths.push(
        'C:\\continue-databricks-claude-3-7-sonnet\\manual-testing-sandbox\\.continue\\mcpServers\\mcpServer.yaml',
        'C:\\continue-databricks-claude-3-7-sonnet\\manual-testing-sandbox\\.continue\\mcpServers\\databricks.yaml'
      );
    }
    
    // カレントディレクトリからの相対パスを試す
    try {
      const cwd = process.cwd();
      if (cwd) {
        // プロジェクトルートの可能性のある場所
        possiblePaths.push(
          path.join(cwd, "manual-testing-sandbox", ".continue", "mcpServers", "mcpServer.yaml"),
          path.join(cwd, "manual-testing-sandbox", ".continue", "mcpServers", "databricks.yaml"),
          path.join(cwd, "..", "manual-testing-sandbox", ".continue", "mcpServers", "mcpServer.yaml"),
          path.join(cwd, "..", "manual-testing-sandbox", ".continue", "mcpServers", "databricks.yaml")
        );
      }
    } catch (e) {
      console.warn("Error getting CWD:", e);
    }
    
    // __dirnameからの相対パスも試す
    try {
      if (typeof __dirname === 'string') {
        // __dirnameから上の階層に遡ってプロジェクトルートを見つける
        let dir = __dirname;
        for (let i = 0; i < 5; i++) { // 最大5階層まで上る
          const sandboxPath1 = path.join(dir, "manual-testing-sandbox", ".continue", "mcpServers", "mcpServer.yaml");
          const sandboxPath2 = path.join(dir, "manual-testing-sandbox", ".continue", "mcpServers", "databricks.yaml");
          possiblePaths.push(sandboxPath1, sandboxPath2);
          
          // 親ディレクトリに移動
          const parentDir = path.dirname(dir);
          if (parentDir === dir) break; // ルートに達した場合
          dir = parentDir;
        }
      }
    } catch (e) {
      console.warn("Error using __dirname:", e);
    }
    
    // デバッグログを出力
    console.log("Searching manual-testing-sandbox MCPServer paths:");
    
    // パスリストから重複を削除
    const uniquePaths = [...new Set(possiblePaths)];
    
    // 存在するパスを返す
    for (let i = 0; i < uniquePaths.length; i++) {
      const p = uniquePaths[i];
      
      // パスを修正（二重ドライブレター問題対策）
      const fixedPath = fixPath(p);
      
      try {
        const exists = fs.existsSync(fixedPath);
        console.log(`  ${i + 1}. ${fixedPath} - ${exists ? '存在します ✅' : '存在しません ❌'}`);
        
        if (exists) {
          return fixedPath;
        }
      } catch (e) {
        console.warn(`Error checking path ${fixedPath}:`, e);
      }
    }
    
    // ファイルが見つからない場合、ディレクトリの作成を試みる
    if (process.platform === 'win32') {
      try {
        // 固定パスでディレクトリとファイルを作成する
        const dirPath = 'C:\\continue-databricks-claude-3-7-sonnet\\manual-testing-sandbox\\.continue\\mcpServers';
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          console.log(`Created directory: ${dirPath}`);
        }
        
        const filePath = path.join(dirPath, 'mcpServer.yaml');
        if (!fs.existsSync(filePath)) {
          // 最小限のmcpServer.yaml内容を作成
          const minimalContent = `name: mcpServer
version: 0.0.1
schema: v1
mcpServers:
  - name: databricks
    command: python
    args:
      - "C:\\\\Users\\\\04870\\\\Desktop\\\\MCP-IF\\\\mcp-databricks-server\\\\main.py"
    env: {}
`;
          fs.writeFileSync(filePath, minimalContent);
          console.log(`Created file: ${filePath}`);
          return filePath;
        }
      } catch (e) {
        console.warn("Error creating MCP server directory/file:", e);
      }
    }
    
    return null;
  } catch (e) {
    console.error("Error getting manual testing sandbox MCP path:", e);
    return null;
  }
}

/**
 * デバッグ用のMCPパスを取得する強化版関数
 * @returns 正規化されたパス
 */
export function getDebugMcpPath(): string | null {
  try {
    // 可能性のあるパスを生成（より多くのケースに対応）
    const possiblePaths = [];
    
    // Windows環境では固定パスを最優先で試す
    if (process.platform === 'win32') {
      possiblePaths.push(
        'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\mcpServers\\mcpServer.yaml',
        'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\mcpServers\\databricks.yaml'
      );
    }
    
    // カレントディレクトリからの相対パスを試す
    try {
      const cwd = process.cwd();
      if (cwd) {
        possiblePaths.push(
          path.join(cwd, "extensions", ".continue-debug", "mcpServers", "mcpServer.yaml"),
          path.join(cwd, "extensions", ".continue-debug", "mcpServers", "databricks.yaml")
        );
      }
    } catch (e) {
      console.warn("Error getting CWD:", e);
    }
    
    // __dirnameからの相対パスも試す
    try {
      if (typeof __dirname === 'string') {
        let dir = __dirname;
        for (let i = 0; i < 5; i++) { // 最大5階層まで上る
          possiblePaths.push(
            path.join(dir, "extensions", ".continue-debug", "mcpServers", "mcpServer.yaml"),
            path.join(dir, "extensions", ".continue-debug", "mcpServers", "databricks.yaml"),
            path.join(dir, ".continue-debug", "mcpServers", "mcpServer.yaml"),
            path.join(dir, ".continue-debug", "mcpServers", "databricks.yaml")
          );
          
          // 親ディレクトリに移動
          const parentDir = path.dirname(dir);
          if (parentDir === dir) break; // ルートに達した場合
          dir = parentDir;
        }
      }
    } catch (e) {
      console.warn("Error using __dirname:", e);
    }
    
    // デバッグログを出力
    console.log("Searching debug MCPServer paths:");
    
    // パスリストから重複を削除
    const uniquePaths = [...new Set(possiblePaths)];
    
    // 存在するパスを返す
    for (let i = 0; i < uniquePaths.length; i++) {
      const p = uniquePaths[i];
      
      // パスを修正（二重ドライブレター問題対策）
      const fixedPath = fixPath(p);
      
      try {
        const exists = fs.existsSync(fixedPath);
        console.log(`  ${i + 1}. ${fixedPath} - ${exists ? '存在します ✅' : '存在しません ❌'}`);
        
        if (exists) {
          return fixedPath;
        }
      } catch (e) {
        console.warn(`Error checking path ${fixedPath}:`, e);
      }
    }
    
    // ファイルが見つからない場合、ディレクトリの作成を試みる
    if (process.platform === 'win32') {
      try {
        // 固定パスでディレクトリとファイルを作成する
        const dirPath = 'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\mcpServers';
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          console.log(`Created directory: ${dirPath}`);
        }
        
        const filePath = path.join(dirPath, 'mcpServer.yaml');
        if (!fs.existsSync(filePath)) {
          // 最小限のmcpServer.yaml内容を作成
          const minimalContent = `name: mcpServer
version: 0.0.1
schema: v1
mcpServers:
  - name: databricks
    command: python
    args:
      - "C:\\\\Users\\\\04870\\\\Desktop\\\\MCP-IF\\\\mcp-databricks-server\\\\main.py"
    env: {}
`;
          fs.writeFileSync(filePath, minimalContent);
          console.log(`Created file: ${filePath}`);
          return filePath;
        }
      } catch (e) {
        console.warn("Error creating MCP server directory/file:", e);
      }
    }
    
    return null;
  } catch (e) {
    console.error("Error getting debug MCP path:", e);
    return null;
  }
}

/**
 * VS Code拡張機能のルートパスを取得する強化版関数
 * @returns 拡張機能のルートパス
 */
export function getExtensionRootPathSafe(): string {
  try {
    // __dirnameを使用して現在のファイルの場所から拡張機能のルートを推測
    const currentFilePath = __filename;
    const currentDir = path.dirname(currentFilePath);
    
    // core/utilからの相対位置に基づいて親ディレクトリを特定
    const parts = currentDir.split(path.sep);
    const coreIndex = parts.indexOf('core');
    if (coreIndex !== -1) {
      return parts.slice(0, coreIndex).join(path.sep);
    }
    
    // フォールバック: プロセスの作業ディレクトリを使用
    return process.cwd();
  } catch (e) {
    console.error("Error getting extension root path:", e);
    return process.cwd();
  }
}