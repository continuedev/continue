// 環境チェックを改善 - window/globalThis参照の安全性強化
let vscodeApi: any = undefined;
const isNode = typeof process !== 'undefined' && 
               typeof process.versions !== 'undefined' && 
               typeof process.versions.node !== 'undefined';

if (!isNode) {
  try {
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.vscode) {
        vscodeApi = win.vscode;
      } 
      else if (typeof win.acquireVsCodeApi === 'function') {
        try {
          vscodeApi = win.acquireVsCodeApi();
        } catch (apiError) {
          console.warn("Error calling acquireVsCodeApi:", apiError);
        }
      }
    }
  } catch (e) {
    console.warn("Error initializing VSCode API in browser environment:", e);
  }
}

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as YAML from "yaml";

import { ConfigYaml, DevEventName } from "@continuedev/config-yaml";
import * as JSONC from "comment-json";
import dotenv from "dotenv";

import { IdeType, SerializedContinueConfig } from "../";
import { defaultConfig, defaultConfigJetBrains } from "../config/default";
import Types from "../config/types";

dotenv.config();

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

// モジュール変数
let cachedExtensionPath: string | null = null;

// 拡張機能のパスを設定する関数
export function setExtensionPath(extensionPath: string): void {
  if (!extensionPath) {
    console.warn("Attempted to set empty extension path");
    return;
  }
  
  try {
    // パスの妥当性を確認
    if (!fs.existsSync(extensionPath)) {
      console.warn(`Extension path does not exist: ${extensionPath}`);
    }
    
    // キャッシュを更新
    cachedExtensionPath = extensionPath;
    console.log(`Extension path set to: ${cachedExtensionPath}`);
  } catch (error) {
    console.error(`Error setting extension path: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 拡張機能のルートパスを取得する関数（process.cwd()の代替）
export function getExtensionRootPath(): string {
  // キャッシュがあればそれを使用
  if (cachedExtensionPath) {
    return cachedExtensionPath;
  }
  
  try {
    // 現在のファイルのディレクトリ名から推測（TypeScript/JavaScriptでよく使われる方法）
    let extensionRoot = __dirname;
    
    // core/utilから親ディレクトリに遡る
    // __dirnameが"core/util"を含む場合、その部分までのパスを取得
    const coreUtilMatch = extensionRoot.match(/(.*)[\/\\]core[\/\\]util/);
    if (coreUtilMatch && coreUtilMatch[1]) {
      extensionRoot = coreUtilMatch[1];
      return extensionRoot;
    }
    
    // 拡張機能のルートパスを他の方法で取得（例: 環境変数）
    const envPath = process.env.EXTENSION_ROOT_PATH;
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }
    
    // プロジェクトルートを検索（package.jsonが存在するディレクトリ）
    let currentDir = extensionRoot;
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // 上記の方法で見つからない場合はprocess.cwd()を使用
    console.warn("Could not determine extension root path, falling back to process.cwd()");
    return process.cwd();
  } catch (error) {
    console.error(`Error getting extension root path: ${error instanceof Error ? error.message : String(error)}`);
    return process.cwd();
  }
}

const currentLogLevel = 
  process.env.PATH_DEBUG_LEVEL ? 
  parseInt(process.env.PATH_DEBUG_LEVEL) : 
  (process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.WARN);

const enableFileLogging = process.env.NODE_ENV === 'development' && process.env.PATH_LOG_TO_FILE === '1';
let callDepth = 0;
const callStack: string[] = [];

function getTimestamp(): string {
  return new Date().toISOString();
}

function writeToPathLogFile(message: string): void {
  if (!enableFileLogging) return;
  
  try {
    const logsDir = process.env.PATH_LOG_DIR || (() => {
      const dir = path.join(os.homedir(), ".continue", "logs");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    })();
    
    const logFilePath = path.join(logsDir, 'path_debug.log');
    fs.appendFileSync(logFilePath, message + '\n');
  } catch (e) {
    console.error(`Failed to write to path log file: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function getLogLevelMarker(level: LogLevel): string {
  switch (level) {
    case LogLevel.ERROR: return '🔴';
    case LogLevel.WARN: return '🟠';
    case LogLevel.INFO: return '🔵';
    case LogLevel.DEBUG: return '🟢';
    case LogLevel.TRACE: return '⚪';
    default: return '  ';
  }
}

function getCaller(): string | null {
  try {
    const stack = new Error().stack || '';
    const stackLines = stack.split('\n').slice(3);
    
    for (const line of stackLines) {
      const match = line.match(/at\s+([^\s]+)\s+\(/);
      if (match && match[1] && !match[1].includes('__awaiter')) {
        return match[1];
      }
    }
  } catch (e) {}
  
  return null;
}

function logPath(level: LogLevel, category: string, message: string, data?: any): void {
  if (level > currentLogLevel) return;
  
  const indent = ' '.repeat(callDepth * 2);
  const levelMarker = getLogLevelMarker(level);
  const timestamp = getTimestamp();
  const caller = getCaller();
  const callContext = caller ? ` [${caller}]` : '';
  
  const logMessage = `${levelMarker} ${timestamp}${callContext} ${indent}${category}: ${message}`;
  console.log(logMessage);
  
  if (enableFileLogging) {
    writeToPathLogFile(logMessage);
  }
  
  if (data !== undefined) {
    const dataString = typeof data === 'object' ? 
                      JSON.stringify(data, null, 2) : 
                      String(data);
    
    const dataLogMessage = `${' '.repeat(levelMarker.length + 1 + timestamp.length + callContext.length)} ${indent}${dataString}`;
    console.log(dataLogMessage);
    
    if (enableFileLogging) {
      writeToPathLogFile(dataLogMessage);
    }
  }
}

/**
 * 二重ドライブレターパターンを検出して修正する強化版関数
 * ステップバイステップで処理を行い、様々なパターンに対応
 * @param p 修正するパス文字列
 * @returns 修正されたパス文字列
 */
export function fixDoubleDriveLetter(p: string): string {
  // 無効な入力をチェック
  if (!p || typeof p !== 'string') return p;
  
  // Windows環境でのみ処理
  if (process.platform !== 'win32') return p;
  
  // 入力パスが既に正しい形式なら早期リターン
  if (!/[A-Za-z]:[\\\/].*[A-Za-z]:/i.test(p)) {
    return p;
  }
  
  // 元のパスを保存（デバッグ用）
  const originalPath = p;
  
  try {
    // パターン1: C:\C:\path または C:\c:\path - 最も一般的な二重ドライブレターパターン
    const pattern1 = /^([A-Za-z]):[\\\/]+([A-Za-z]):[\\\/]+/i;
    if (pattern1.test(p)) {
      p = p.replace(pattern1, (match, drive1, drive2) => {
        // 最初のドライブレターを保持
        return `${drive1.toUpperCase()}:\\`;
      });
    }
    
    // パターン2: 途中にドライブレターが混入 - C:\path\to\D:\another\path
    const pattern2 = /([^A-Za-z])([A-Za-z]):[\\\/]+/g;
    p = p.replace(pattern2, (match, prefix, drive) => {
      return prefix; // ドライブレター部分を削除し、区切り文字のみ残す
    });
    
    // 絶対パスの再検出（C:\が複数ある場合）
    const absolutePaths = p.match(/[A-Za-z]:[\\\/][^:]+/g);
    if (absolutePaths && absolutePaths.length > 1) {
      // 最初の絶対パスを使用
      p = absolutePaths[0];
    }
    
    // ドライブレターを大文字に統一
    p = p.replace(/^([a-z]):/i, (match, drive) => {
      return drive.toUpperCase() + ':';
    });
    
    // 連続するスラッシュやバックスラッシュを単一に正規化
    p = p.replace(/[\\\/]{2,}/g, '\\');
    
    // パス変更をログに出力（デバッグモードのみ）
    if (p !== originalPath && process.env.NODE_ENV === 'development') {
      console.log(`パス修正: "${originalPath}" → "${p}"`);
    }
    
    return p;
  } catch (e) {
    console.warn(`Error in fixDoubleDriveLetter: ${e}`);
    return originalPath; // エラー時は元のパスを返す
  }
}

// 主要な関数: パス正規化
export function normalizePath(p: string): string {
  if (p === undefined || p === null) {
    console.warn("Attempt to normalize undefined or null path");
    return getExtensionRootPath();
  }
  
  if (typeof p !== 'string') {
    try {
      p = String(p);
    } catch (e) {
      return getExtensionRootPath();
    }
  }
  
  try {
    if (process.platform === 'win32') {
      if (!p.trim()) return getExtensionRootPath();
      
      // 二重ドライブレターパターンを修正
      p = fixDoubleDriveLetter(p);
      
      // ドライブレターの正規化（小文字→大文字）
      p = p.replace(/^([a-z]):/, (_, drive) => drive.toUpperCase() + ":");
      
      // 連続するパス区切り文字を単一に
      p = p.replace(/[\\\/]{2,}/g, path.sep);
    }
    
    // 最終的な正規化
    return path.normalize(p);
  } catch (e) {
    try {
      return path.normalize(p);
    } catch {
      return p || getExtensionRootPath();
    }
  }
}

/**
 * 安全なパス結合（絶対パスと相対パスの混在に対応）
 * @param basePath ベースパス
 * @param segments 追加のパスセグメント
 * @returns 結合されたパス
 */
export function safeJoinPath(basePath: string | undefined, ...segments: (string | undefined)[]): string {
  if (basePath === undefined || basePath === null) {
    basePath = getExtensionRootPath();
  }
  
  if (typeof basePath !== 'string') {
    try {
      basePath = String(basePath);
    } catch (e) {
      basePath = getExtensionRootPath();
    }
  }
  
  // まず入力パスの二重ドライブレターを修正
  try {
    basePath = fixDoubleDriveLetter(basePath);
  } catch (e) {}
  
  const validSegments: string[] = [];
  for (const segment of segments) {
    if (segment !== undefined && segment !== null) {
      try {
        const segmentStr = typeof segment === 'string' ? segment : String(segment);
        // 各セグメントの二重ドライブレターも修正
        const fixedSegment = fixDoubleDriveLetter(segmentStr);
        validSegments.push(fixedSegment);
      } catch (e) {
        // 無効なセグメントはスキップ
      }
    }
  }
  
  try {
    // ベースパスが空の場合
    if (!basePath || !basePath.trim()) {
      basePath = getExtensionRootPath();
    }
    
    // 絶対パスの処理向上
    // Windowsパスでかつ絶対パスの結合の場合
    if (process.platform === 'win32') {
      // ベースパスが絶対パスかどうか
      const isBaseAbsolute = /^[A-Za-z]:[\\\/]/i.test(basePath);
      
      // セグメントの中に絶対パスがあるかチェック
      let hasAbsoluteSegment = false;
      let firstAbsoluteSegment = '';
      
      for (const segment of validSegments) {
        if (/^[A-Za-z]:[\\\/]/i.test(segment)) {
          hasAbsoluteSegment = true;
          firstAbsoluteSegment = segment;
          break;
        }
      }
      
      // 絶対パス同士の結合の場合、最初の絶対パスを基準にする
      if (isBaseAbsolute && hasAbsoluteSegment) {
        // 開発環境では警告を出力
        if (process.env.NODE_ENV === 'development') {
          console.warn(`絶対パス同士の結合を検出: ${basePath} + ${firstAbsoluteSegment}`);
        }
        
        // 絶対パスセグメントを使用
        return normalizePath(firstAbsoluteSegment);
      }
    }
    
    // 絶対パスのセグメントがあるか確認
    for (const segment of validSegments) {
      if (segment && path.isAbsolute(segment)) {
        // セグメントが絶対パスの場合、それを使用
        return normalizePath(segment);
      }
    }
    
    // 通常の結合と正規化
    const joinedPath = path.join(basePath, ...validSegments);
    
    // 結合後のパスも再度二重ドライブレターパターンをチェック
    const finalPath = fixDoubleDriveLetter(joinedPath);
    return normalizePath(finalPath);
  } catch (e) {
    // フォールバック: 最初の有効なパスを返す
    for (const segment of [basePath, ...validSegments]) {
      if (segment && typeof segment === 'string' && segment.trim()) {
        return normalizePath(segment);
      }
    }
    return normalizePath(basePath || getExtensionRootPath());
  }
}

// ファイル安全読み込み
export function safeReadFile(filepath: string | undefined): string | null {
  if (filepath === undefined || filepath === null) {
    return null;
  }
  
  try {
    // パスの二重ドライブレターを修正
    filepath = fixDoubleDriveLetter(filepath);
    const normalizedPath = normalizePath(filepath);
    
    if (fs.existsSync(normalizedPath)) {
      return fs.readFileSync(normalizedPath, 'utf8');
    }
    return null;
  } catch (e) {
    console.error(`Error reading file: ${filepath}`, e);
    return null;
  }
}

/**
 * デバッグ設定パス取得の強化版
 * 二重ドライブレター問題を防ぎ、オプションパターンも検索対象に含める
 */
export function getDebugConfigPath(fileType: 'config' | 'mcpServer' = 'config'): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  try {
    // 特定の直接パスをまず確認（最も確実な方法）
    const cwd = process.cwd();
    console.log(`Current working directory: ${cwd}`);
    
    // 明示的なパス指定がある場合はそれを使用
    const explicitPathEnv = process.env.DEBUG_CONFIG_PATH;
    if (explicitPathEnv) {
      const explicitPath = normalizePath(fixDoubleDriveLetter(explicitPathEnv));
      if (fs.existsSync(explicitPath)) {
        console.log(`Using explicitly defined debug config path: ${explicitPath}`);
        return explicitPath;
      }
    }
    
    // プロジェクトルートを検出
    let projectRoot = '';
    try {
      const extensionRootPath = getExtensionRootPath();
      
      // __dirnameからcoreの位置を検出し、プロジェクトルートを見つける
      const coreMatch = __dirname.match(/(.*?)[\\\/]core[\\\/].*/i);
      if (coreMatch && coreMatch[1]) {
        projectRoot = normalizePath(coreMatch[1]);
      } else {
        projectRoot = normalizePath(extensionRootPath);
      }
      
      console.log(`Detected project root: ${projectRoot}`);
    } catch (e) {
      console.warn(`Error detecting project root: ${e}`);
      projectRoot = cwd;
    }
    
    // 明示的なパス探索順序を定義（優先度順）
    const searchPaths = [];
    
    // 特定の固定パスを最優先で追加（Windows環境向け）
    if (process.platform === 'win32') {
      if (fileType === 'config') {
        searchPaths.push(
          normalizePath('C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\config.yaml'),
          normalizePath('C:\\continue-databricks-claude-3-7-sonnet\\manual-testing-sandbox\\.continue\\config.yaml')
        );
      } else {
        searchPaths.push(
          normalizePath('C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\mcpServers\\databricks.yaml'),
          normalizePath('C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\mcpServers\\mcpServer.yaml'),
          normalizePath('C:\\continue-databricks-claude-3-7-sonnet\\manual-testing-sandbox\\.continue\\mcpServers\\databricks.yaml'),
          normalizePath('C:\\continue-databricks-claude-3-7-sonnet\\manual-testing-sandbox\\.continue\\mcpServers\\mcpServer.yaml')
        );
      }
    }
    
    // 0. extensionsフォルダ直下の.continue-debugディレクトリ (最優先)
    try {
      if (fileType === 'config') {
        searchPaths.push(normalizePath(path.join(projectRoot, "extensions", ".continue-debug", "config.yaml")));
      } else {
        searchPaths.push(normalizePath(path.join(projectRoot, "extensions", ".continue-debug", "mcpServers", "databricks.yaml")));
        searchPaths.push(normalizePath(path.join(projectRoot, "extensions", ".continue-debug", "mcpServers", "mcpServer.yaml")));
      }
    } catch (e) {
      console.warn(`Error adding extensions debug path: ${e}`);
    }
    
    // 1. manual-testing-sandboxディレクトリ
    try {
      if (fileType === 'config') {
        searchPaths.push(normalizePath(path.join(projectRoot, "manual-testing-sandbox", ".continue", "config.yaml")));
      } else {
        searchPaths.push(normalizePath(path.join(projectRoot, "manual-testing-sandbox", ".continue", "mcpServers", "databricks.yaml")));
        searchPaths.push(normalizePath(path.join(projectRoot, "manual-testing-sandbox", ".continue", "mcpServers", "mcpServer.yaml")));
      }
    } catch (e) {
      console.warn(`Error adding manual testing path: ${e}`);
    }
    
    // 2. プロジェクトルート直下の.continue-debugディレクトリ
    if (fileType === 'config') {
      searchPaths.push(normalizePath(path.join(projectRoot, ".continue-debug", "config.yaml")));
    } else {
      searchPaths.push(normalizePath(path.join(projectRoot, ".continue-debug", "mcpServers", "databricks.yaml")));
      searchPaths.push(normalizePath(path.join(projectRoot, ".continue-debug", "mcpServers", "mcpServer.yaml")));
    }
    
    // 3. 拡張機能直下の.continue-debugディレクトリ
    try {
      const extensionVscodePath = normalizePath(path.join(projectRoot, "extensions", "vscode"));
      if (fs.existsSync(extensionVscodePath)) {
        if (fileType === 'config') {
          searchPaths.push(normalizePath(path.join(extensionVscodePath, ".continue-debug", "config.yaml")));
        } else {
          searchPaths.push(normalizePath(path.join(extensionVscodePath, ".continue-debug", "mcpServers", "databricks.yaml")));
          searchPaths.push(normalizePath(path.join(extensionVscodePath, ".continue-debug", "mcpServers", "mcpServer.yaml")));
        }
      }
    } catch (e) {
      console.warn(`Error adding extension vscode path: ${e}`);
    }
    
    // 4. VSCode拡張機能直下の.continueフォルダ
    try {
      if (fileType === 'config') {
        searchPaths.push(normalizePath(path.join(projectRoot, "extensions", "vscode", ".continue", "config.yaml")));
      } else {
        searchPaths.push(normalizePath(path.join(projectRoot, "extensions", "vscode", ".continue", "mcpServers", "databricks.yaml")));
        searchPaths.push(normalizePath(path.join(projectRoot, "extensions", "vscode", ".continue", "mcpServers", "mcpServer.yaml")));
      }
    } catch (e) {
      console.warn(`Error adding extension vscode .continue path: ${e}`);
    }
    
    // 5. カレントディレクトリに直接.continueフォルダがある場合も確認
    try {
      if (fileType === 'config') {
        searchPaths.push(normalizePath(path.join(cwd, ".continue", "config.yaml")));
        searchPaths.push(normalizePath(path.join(cwd, ".continue-debug", "config.yaml")));
      } else {
        searchPaths.push(normalizePath(path.join(cwd, ".continue", "mcpServers", "databricks.yaml")));
        searchPaths.push(normalizePath(path.join(cwd, ".continue", "mcpServers", "mcpServer.yaml")));
        searchPaths.push(normalizePath(path.join(cwd, ".continue-debug", "mcpServers", "databricks.yaml")));
        searchPaths.push(normalizePath(path.join(cwd, ".continue-debug", "mcpServers", "mcpServer.yaml")));
      }
    } catch (e) {
      console.warn(`Error adding cwd paths: ${e}`);
    }
    
    console.log("デバッグ設定パスの候補:");
    // 各候補パスを順番に試す
    for (const configPath of searchPaths) {
      try {
        // 二重ドライブレター問題を修正と正規化
        const fixedPath = fixDoubleDriveLetter(configPath);
        const normalizedPath = normalizePath(fixedPath);
        
        console.log(`  候補パス: ${normalizedPath} - ${fs.existsSync(normalizedPath) ? '存在します ✅' : '存在しません ❌'}`);
        
        // パスの妥当性を検証
        if (normalizedPath && fs.existsSync(normalizedPath)) {
          console.log(`デバッグ${fileType}パス見つかりました: ${normalizedPath}`);
          return normalizedPath;
        }
      } catch (pathError) {
        console.warn(`Error checking path ${configPath}:`, pathError);
        continue;
      }
    }
    
    // 既存のパスが見つからなかった場合
    console.log(`有効なデバッグ${fileType}パスが見つかりませんでした`);
    
    // ユーザーホームの.continueディレクトリを確認
    try {
      const homeConfigPath = path.resolve(os.homedir(), ".continue");
      
      if (fileType === 'config') {
        const userConfigPath = path.join(homeConfigPath, "config.yaml");
        if (fs.existsSync(userConfigPath)) {
          console.log(`ユーザーホームのconfig.yamlを使用: ${userConfigPath}`);
          return userConfigPath;
        }
      } else {
        const userDatabricksPath = path.join(homeConfigPath, "mcpServers", "databricks.yaml");
        if (fs.existsSync(userDatabricksPath)) {
          console.log(`ユーザーホームのdatabricks.yamlを使用: ${userDatabricksPath}`);
          return userDatabricksPath;
        }
        
        const userMcpPath = path.join(homeConfigPath, "mcpServers", "mcpServer.yaml");
        if (fs.existsSync(userMcpPath)) {
          console.log(`ユーザーホームのmcpServer.yamlを使用: ${userMcpPath}`);
          return userMcpPath;
        }
        
        const userMcpDir = path.join(homeConfigPath, "mcpServers");
        if (fs.existsSync(userMcpDir)) {
          console.log(`ユーザーホームのmcpServersディレクトリを使用: ${userMcpDir}`);
          return userMcpDir;
        }
      }
    } catch (homeError) {
      console.warn(`Error checking home config:`, homeError);
    }
  } catch (e) {
    console.error(`Error getting debug ${fileType} path:`, e);
  }
  
  return null;
}

/**
 * 最初に見つかったファイルを読み込む（強化版）
 */
export function readFirstAvailableFile(filepaths: string[]): { path: string; content: string } | null {
  if (!filepaths || !Array.isArray(filepaths) || filepaths.length === 0) {
    return null;
  }
  
  try {
    // 各パスを正規化
    const normalizedPaths = filepaths.map((filepath) => {
      if (filepath === undefined || filepath === null) {
        return '';
      }
      
      // 二重ドライブレターパターンを修正
      const fixedPath = fixDoubleDriveLetter(filepath);
      const normalizedPath = normalizePath(fixedPath);
      
      // 開発モードでは変換過程をログ出力
      if (process.env.NODE_ENV === 'development' && filepath !== normalizedPath) {
        console.log(`パス正規化: "${filepath}" → "${normalizedPath}"`);
      }
      
      return normalizedPath;
    }).filter(p => p && p.trim() !== '');
    
    // パスの妥当性をログ出力
    if (process.env.NODE_ENV === 'development') {
      console.log("検索対象のパス:");
      normalizedPaths.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p}`);
      });
    }
    
    // 正規化されたパスでファイル検索
    for (const filepath of normalizedPaths) {
      try {
        if (fs.existsSync(filepath)) {
          const content = fs.readFileSync(filepath, 'utf8');
          console.log(`ファイル読み込み成功: ${filepath}`);
          return { path: filepath, content };
        }
      } catch (e) {
        console.warn(`Error reading file ${filepath}:`, e);
        continue;
      }
    }
    
    // デバッグ用の設定ファイルも試す
    if (process.env.NODE_ENV === 'development') {
      const debugMcpPath = getDebugConfigPath('mcpServer');
      if (debugMcpPath && fs.existsSync(debugMcpPath)) {
        try {
          const stats = fs.statSync(debugMcpPath);
          if (stats.isDirectory()) {
            // ディレクトリの場合、databricks.yaml と mcpServer.yaml を明示的にチェック
            const databricksPath = path.join(debugMcpPath, "databricks.yaml");
            const normalizedDatabricksPath = normalizePath(databricksPath);
            
            if (fs.existsSync(normalizedDatabricksPath)) {
              const content = fs.readFileSync(normalizedDatabricksPath, 'utf8');
              console.log(`ファイル読み込み成功: ${normalizedDatabricksPath}`);
              return { path: normalizedDatabricksPath, content };
            }
            
            const mcpServerPath = path.join(debugMcpPath, "mcpServer.yaml");
            const normalizedMcpServerPath = normalizePath(mcpServerPath);
            
            if (fs.existsSync(normalizedMcpServerPath)) {
              const content = fs.readFileSync(normalizedMcpServerPath, 'utf8');
              console.log(`ファイル読み込み成功: ${normalizedMcpServerPath}`);
              return { path: normalizedMcpServerPath, content };
            } else {
              console.warn(`mcpServer.yamlファイルが見つかりません: ${normalizedMcpServerPath}`);
              
              // manual-testing-sandbox内を明示的に確認
              try {
                const extensionRoot = getExtensionRootPath();
                
                const manualSandboxDbPath = path.resolve(extensionRoot, "..", "manual-testing-sandbox", ".continue", "mcpServers", "databricks.yaml");
                const normalizedSandboxDbPath = normalizePath(fixDoubleDriveLetter(manualSandboxDbPath));
                
                if (fs.existsSync(normalizedSandboxDbPath)) {
                  const content = fs.readFileSync(normalizedSandboxDbPath, 'utf8');
                  console.log(`manual-testing-sandboxからファイル読み込み成功: ${normalizedSandboxDbPath}`);
                  return { path: normalizedSandboxDbPath, content };
                }
                
                const manualSandboxMcpPath = path.resolve(extensionRoot, "..", "manual-testing-sandbox", ".continue", "mcpServers", "mcpServer.yaml");
                const normalizedSandboxMcpPath = normalizePath(fixDoubleDriveLetter(manualSandboxMcpPath));
                
                if (fs.existsSync(normalizedSandboxMcpPath)) {
                  const content = fs.readFileSync(normalizedSandboxMcpPath, 'utf8');
                  console.log(`manual-testing-sandboxからファイル読み込み成功: ${normalizedSandboxMcpPath}`);
                  return { path: normalizedSandboxMcpPath, content };
                }
              } catch (sandboxError) {
                console.warn(`Error checking manual-testing-sandbox path:`, sandboxError);
              }
            }
          } else {
            const content = fs.readFileSync(debugMcpPath, 'utf8');
            console.log(`ファイル読み込み成功: ${debugMcpPath}`);
            return { path: debugMcpPath, content };
          }
        } catch (e) {
          // エラー時はnullを返す
          console.warn(`Error accessing debug MCP path:`, e);
        }
      } else {
        // debugMcpPathが見つからない場合、manual-testing-sandboxを直接確認
        try {
          const extensionRoot = getExtensionRootPath();
          const projectRoot = extensionRoot.replace(/[\\\/]extensions[\\\/].*$/, '');
          
          // 特定の固定パスを確認 (Windows固有)
          if (process.platform === 'win32') {
            const fixedSandboxDbPath = 'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\mcpServers\\databricks.yaml';
            if (fs.existsSync(fixedSandboxDbPath)) {
              const content = fs.readFileSync(fixedSandboxDbPath, 'utf8');
              console.log(`固定パスからファイル読み込み成功: ${fixedSandboxDbPath}`);
              return { path: fixedSandboxDbPath, content };
            }
            
            const fixedSandboxMcpPath = 'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\mcpServers\\mcpServer.yaml';
            if (fs.existsSync(fixedSandboxMcpPath)) {
              const content = fs.readFileSync(fixedSandboxMcpPath, 'utf8');
              console.log(`固定パスからファイル読み込み成功: ${fixedSandboxMcpPath}`);
              return { path: fixedSandboxMcpPath, content };
            }
          }
          
          // extensions/.continue-debug ディレクトリを優先
          const extensionsDbPath = path.resolve(projectRoot, "extensions", ".continue-debug", "mcpServers", "databricks.yaml");
          const normalizedExtensionsDbPath = normalizePath(fixDoubleDriveLetter(extensionsDbPath));
          
          console.log(`extensions/.continue-debugパスを確認: ${normalizedExtensionsDbPath}`);
          
          if (fs.existsSync(normalizedExtensionsDbPath)) {
            const content = fs.readFileSync(normalizedExtensionsDbPath, 'utf8');
            console.log(`extensions/.continue-debugからファイル読み込み成功: ${normalizedExtensionsDbPath}`);
            return { path: normalizedExtensionsDbPath, content };
          }
          
          const extensionsMcpPath = path.resolve(projectRoot, "extensions", ".continue-debug", "mcpServers", "mcpServer.yaml");
          const normalizedExtensionsMcpPath = normalizePath(fixDoubleDriveLetter(extensionsMcpPath));
          
          if (fs.existsSync(normalizedExtensionsMcpPath)) {
            const content = fs.readFileSync(normalizedExtensionsMcpPath, 'utf8');
            console.log(`extensions/.continue-debugからファイル読み込み成功: ${normalizedExtensionsMcpPath}`);
            return { path: normalizedExtensionsMcpPath, content };
          }
          
          // manual-testing-sandboxも確認
          const manualDbPath = path.resolve(projectRoot, "manual-testing-sandbox", ".continue", "mcpServers", "databricks.yaml");
          const normalizedManualDbPath = normalizePath(fixDoubleDriveLetter(manualDbPath));
          
          if (fs.existsSync(normalizedManualDbPath)) {
            const content = fs.readFileSync(normalizedManualDbPath, 'utf8');
            console.log(`manual-testing-sandboxからファイル読み込み成功: ${normalizedManualDbPath}`);
            return { path: normalizedManualDbPath, content };
          }
          
          const manualMcpPath = path.resolve(projectRoot, "manual-testing-sandbox", ".continue", "mcpServers", "mcpServer.yaml");
          const normalizedManualMcpPath = normalizePath(fixDoubleDriveLetter(manualMcpPath));
          
          if (fs.existsSync(normalizedManualMcpPath)) {
            const content = fs.readFileSync(normalizedManualMcpPath, 'utf8');
            console.log(`manual-testing-sandboxからファイル読み込み成功: ${normalizedManualMcpPath}`);
            return { path: normalizedManualMcpPath, content };
          }
        } catch (sandboxError) {
          console.warn(`Error accessing paths:`, sandboxError);
        }
      }
    }
  } catch (e) {
    // エラー時はnullを返す
    console.error("Error finding available file:", e);
  }
  
  return null;
}

// 環境情報の記録
export function logPathLibraryState(): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  let logsDir = '';
  try {
    logsDir = path.join(os.homedir(), ".continue", "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (e) {}
  
  const pathLogFile = path.join(logsDir, 'path_debug.log');
  
  logPath(LogLevel.INFO, 'ENV', `Path library state:
    Delimiter: ${path.delimiter}
    Separator: ${path.sep}
    Process CWD: ${process.cwd()}
    Extension Root: ${getExtensionRootPath()} 
    Home directory: ${os.homedir()}
    Platform: ${process.platform}
    Architecture: ${process.arch}
    Node.js version: ${process.version}
    NODE_ENV: ${process.env.NODE_ENV || 'not set'}
    PATH_DEBUG_LEVEL: ${currentLogLevel} (${LogLevel[currentLogLevel]})
    File logging: ${enableFileLogging ? 'Enabled' : 'Disabled'}
    Log file: ${enableFileLogging ? pathLogFile : 'N/A'}
    Call stack: ${callStack.join(' -> ') || 'empty'}
  `);
}

// グローバルパス定義
const CONTINUE_GLOBAL_DIR = (() => {
  const configPath = process.env.CONTINUE_GLOBAL_DIR;
  if (configPath) {
    return path.isAbsolute(configPath)
      ? configPath
      : path.resolve(getExtensionRootPath(), configPath);
  }
  
  try {
    return path.join(os.homedir(), ".continue");
  } catch (e) {
    return path.join(getExtensionRootPath(), ".continue");
  }
})();

export const DEFAULT_CONFIG_TS_CONTENTS = `export function modifyConfig(config: Config): Config {
  return config;
}`;

// グローバルディレクトリパス取得関数
export function getContinueGlobalPath(): string {
  // 未定義・空の場合のハンドリング
  if (!CONTINUE_GLOBAL_DIR) {
    try {
      return path.join(os.homedir(), ".continue");
    } catch (e) {
      return path.join(getExtensionRootPath(), ".continue");
    }
  }
  
  const continuePath = normalizePath(CONTINUE_GLOBAL_DIR);
  if (!continuePath || continuePath.trim() === '') {
    try {
      return path.join(os.homedir(), ".continue");
    } catch (e) {
      return path.join(getExtensionRootPath(), ".continue");
    }
  }
  
  try {
    if (!fs.existsSync(continuePath)) {
      fs.mkdirSync(continuePath, { recursive: true });
    }
  } catch (e) {}
  
  return continuePath;
}

// 各種パス取得関数
export function getChromiumPath(): string {
  return normalizePath(safeJoinPath(getContinueUtilsPath(), ".chromium-browser-snapshots"));
}

export function getContinueUtilsPath(): string {
  const utilsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), ".utils"));
  try {
    if (!fs.existsSync(utilsPath)) {
      fs.mkdirSync(utilsPath, { recursive: true });
    }
  } catch (e) {}
  return utilsPath;
}

export function getGlobalContinueIgnorePath(): string {
  const continueIgnorePath = normalizePath(safeJoinPath(getContinueGlobalPath(), ".continueignore"));
  try {
    if (!fs.existsSync(continueIgnorePath)) {
      fs.writeFileSync(continueIgnorePath, "");
    }
  } catch (e) {}
  return continueIgnorePath;
}

// MCPサーバー関連のパス関数を追加
/**
 * MCPサーバー設定ディレクトリのパスを取得する
 * デバッグモードか通常モードに応じて適切なパスを返す
 */
export function getMcpServersFolderPath(): string {
  // まずデバッグモードの場合はデバッグ用のパスを優先
  if (process.env.NODE_ENV === 'development') {
    try {
      // デバッグ設定パスからMCPサーバー設定を探す
      const debugMcpPath = getDebugConfigPath('mcpServer');
      if (debugMcpPath) {
        const stats = fs.statSync(debugMcpPath);
        if (stats.isDirectory()) {
          console.log(`デバッグMCPサーバーディレクトリを使用: ${debugMcpPath}`);
          return debugMcpPath;
        } else {
          // ファイルの場合は親ディレクトリを取得
          const mcpDir = path.dirname(debugMcpPath);
          console.log(`デバッグMCPサーバーディレクトリを使用: ${mcpDir}`);
          return mcpDir;
        }
      }
      
      // 明示的なパスを優先的に確認
      const fixedPaths = [
        // 固定パス（Windows環境向け）
        'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\mcpServers',
        'C:\\continue-databricks-claude-3-7-sonnet\\manual-testing-sandbox\\.continue\\mcpServers',
        // プロジェクトルート相対パス
        path.join(getExtensionRootPath(), "..", "extensions", ".continue-debug", "mcpServers"),
        path.join(getExtensionRootPath(), "..", "manual-testing-sandbox", ".continue", "mcpServers"),
        // VSCode拡張直下
        path.join(getExtensionRootPath(), "extensions", "vscode", ".continue-debug", "mcpServers"),
        path.join(getExtensionRootPath(), "extensions", ".continue-debug", "mcpServers")
      ];
      
      for (const fixedPath of fixedPaths) {
        const normalizedPath = normalizePath(fixDoubleDriveLetter(fixedPath));
        if (fs.existsSync(normalizedPath)) {
          console.log(`既存のMCPサーバーディレクトリを使用: ${normalizedPath}`);
          return normalizedPath;
        }
      }
      
      // 既存のディレクトリが見つからない場合は作成
      // 優先度の高いディレクトリを選択
      const debugConfigDir = path.join(getExtensionRootPath(), "..", "extensions", ".continue-debug");
      if (fs.existsSync(debugConfigDir)) {
        const mcpServersPath = path.join(debugConfigDir, "mcpServers");
        if (!fs.existsSync(mcpServersPath)) {
          fs.mkdirSync(mcpServersPath, { recursive: true });
          console.log(`新規MCPサーバーディレクトリを作成: ${mcpServersPath}`);
        }
        return normalizePath(mcpServersPath);
      }
    } catch (e) {
      console.warn(`Error getting debug MCP servers path: ${e}`);
    }
  }
  
  // 通常モードまたはデバッグパスが見つからなかった場合はグローバルパスを使用
  const mcpServersPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "mcpServers"));
  try {
    if (!fs.existsSync(mcpServersPath)) {
      fs.mkdirSync(mcpServersPath, { recursive: true });
      console.log(`グローバルMCPサーバーディレクトリを作成: ${mcpServersPath}`);
    }
  } catch (e) {
    console.warn(`Error creating MCP servers directory: ${e}`);
  }
  
  return mcpServersPath;
}

/**
 * 特定のMCPサーバー設定ファイルのパスを取得する
 * @param serverName サーバー名（例: "databricks", "mcpServer"）
 */
export function getMcpServerConfigPath(serverName: string): string {
  return normalizePath(safeJoinPath(getMcpServersFolderPath(), `${serverName}.yaml`));
}

/**
 * MCPサーバー設定ファイルを初期化する
 * 存在しない場合は基本的な設定ファイルを作成
 */
export function initializeMcpServerConfigs(): void {
  try {
    const mcpServersPath = getMcpServersFolderPath();
    
    // mcpServer.yaml の初期化
    const mcpServerPath = normalizePath(safeJoinPath(mcpServersPath, "mcpServer.yaml"));
    if (!fs.existsSync(mcpServerPath)) {
      const defaultMcpConfig = {
        version: "1.0",
        enabled: true,
        servers: [
          {
            name: "databricks",
            type: "databricks",
            config: "databricks.yaml"
          }
        ]
      };
      
      fs.writeFileSync(mcpServerPath, YAML.stringify(defaultMcpConfig));
      console.log(`MCPサーバー設定ファイルを作成: ${mcpServerPath}`);
    }
    
    // databricks.yaml の初期化
    const databricksPath = normalizePath(safeJoinPath(mcpServersPath, "databricks.yaml"));
    if (!fs.existsSync(databricksPath)) {
      const defaultDatabricksConfig = {
        version: "1.0",
        enabled: true,
        endpoint: "databricks-claude-3-7-sonnet",
        api: {
          url: "https://adb-1981899174914086.6.azuredatabricks.net/serving-endpoints/databricks-claude-3-7-sonnet/invocations",
          token: process.env.DATABRICKS_TOKEN || ""
        }
      };
      
      fs.writeFileSync(databricksPath, YAML.stringify(defaultDatabricksConfig));
      console.log(`Databricks設定ファイルを作成: ${databricksPath}`);
    }
  } catch (e) {
    console.error(`Error initializing MCP server configs: ${e}`);
  }
}

// 思考パネル関連のログディレクトリ
export function getThinkingLogsPath(): string {
  const thinkingLogsPath = normalizePath(safeJoinPath(getLogsDirPath(), "thinking"));
  try {
    if (!fs.existsSync(thinkingLogsPath)) {
      fs.mkdirSync(thinkingLogsPath, { recursive: true });
    }
  } catch (e) {}
  
  return thinkingLogsPath;
}

export function getThinkingLogFilePath(sessionId: string): string {
  return normalizePath(safeJoinPath(getThinkingLogsPath(), `${sessionId}.log`));
}

export function getSessionsFolderPath(): string {
  const sessionsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "sessions"));
  try {
    if (!fs.existsSync(sessionsPath)) {
      fs.mkdirSync(sessionsPath, { recursive: true });
    }
  } catch (e) {}
  return sessionsPath;
}

export function getIndexFolderPath(): string {
  const indexPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "index"));
  try {
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(indexPath, { recursive: true });
    }
  } catch (e) {}
  return indexPath;
}

export function getGlobalContextFilePath(): string {
  return normalizePath(safeJoinPath(getIndexFolderPath(), "globalContext.json"));
}

export function getSharedConfigFilePath(): string {
  return normalizePath(safeJoinPath(getContinueGlobalPath(), "sharedConfig.json"));
}

export function getSessionFilePath(sessionId: string): string {
  return normalizePath(safeJoinPath(getSessionsFolderPath(), `${sessionId}.json`));
}

export function getSessionsListPath(): string {
  const filepath = normalizePath(safeJoinPath(getSessionsFolderPath(), "sessions.json"));
  try {
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, JSON.stringify([]));
    }
  } catch (e) {}
  return filepath;
}

export function getConfigJsonPath(): string {
  return normalizePath(safeJoinPath(getContinueGlobalPath(), "config.json"));
}

// 設定ファイルパス取得（デバッグモード考慮）
export function getConfigYamlPath(ideType?: IdeType): string {
  try {
    const debugConfigPath = getDebugConfigPath('config');
    if (debugConfigPath && fs.existsSync(debugConfigPath)) {
      return normalizePath(debugConfigPath);
    }
    
    const p = normalizePath(safeJoinPath(getContinueGlobalPath(), "config.yaml"));
    try {
      if (!fs.existsSync(p) && !fs.existsSync(getConfigJsonPath())) {
        const continueDir = getContinueGlobalPath();
        if (!fs.existsSync(continueDir)) {
          fs.mkdirSync(continueDir, { recursive: true });
        }
        
        if (ideType === "jetbrains") {
          fs.writeFileSync(p, YAML.stringify(defaultConfigJetBrains));
        } else {
          fs.writeFileSync(p, YAML.stringify(defaultConfig));
        }
      }
    } catch (writeError) {}
    
    return p;
  } catch (e) {
    return safeJoinPath(getContinueGlobalPath(), "config.yaml");
  }
}

export function getPrimaryConfigFilePath(): string {
  const configYamlPath = getConfigYamlPath();
  if (fs.existsSync(configYamlPath)) {
    return configYamlPath;
  }
  return getConfigJsonPath();
}

export function getConfigTsPath(): string {
  const p = normalizePath(safeJoinPath(getContinueGlobalPath(), "config.ts"));
  try {
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, DEFAULT_CONFIG_TS_CONTENTS);
    }

    const typesPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "types"));
    if (!fs.existsSync(typesPath)) {
      fs.mkdirSync(typesPath, { recursive: true });
    }
    
    const corePath = normalizePath(safeJoinPath(typesPath, "core"));
    if (!fs.existsSync(corePath)) {
      fs.mkdirSync(corePath, { recursive: true });
    }
    
    const packageJsonPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "package.json"));
    if (!fs.existsSync(packageJsonPath)) {
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify({
          name: "continue-config",
          version: "1.0.0",
          description: "My Continue Configuration",
          main: "config.js",
        }),
      );
    }

    fs.writeFileSync(safeJoinPath(corePath, "index.d.ts"), Types);
  } catch (e) {}
  
  return p;
}

export function getConfigJsPath(): string {
  return normalizePath(safeJoinPath(getContinueGlobalPath(), "out", "config.js"));
}

export function getTsConfigPath(): string {
  const tsConfigPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "tsconfig.json"));
  try {
    if (!fs.existsSync(tsConfigPath)) {
      fs.writeFileSync(
        tsConfigPath,
        JSON.stringify(
          {
            compilerOptions: {
              target: "ESNext",
              useDefineForClassFields: true,
              lib: ["DOM", "DOM.Iterable", "ESNext"],
              allowJs: true,
              skipLibCheck: true,
              esModuleInterop: false,
              allowSyntheticDefaultImports: true,
              strict: true,
              forceConsistentCasingInFileNames: true,
              module: "System",
              moduleResolution: "Node",
              noEmit: false,
              noEmitOnError: false,
              outFile: "./out/config.js",
              typeRoots: ["./node_modules/@types", "./types"],
            },
            include: ["./config.ts"],
          },
          null,
          2,
        ),
      );
    }
  } catch (e) {}
  
  return tsConfigPath;
}

export function getContinueRcPath(): string {
  const continuercPath = normalizePath(safeJoinPath(getContinueGlobalPath(), ".continuerc.json"));
  try {
    if (!fs.existsSync(continuercPath)) {
      fs.writeFileSync(
        continuercPath,
        JSON.stringify(
          {
            disableIndexing: true,
          },
          null,
          2,
        ),
      );
    }
  } catch (e) {}
  
  return continuercPath;
}

function getDevDataPath(): string {
  const sPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "dev_data"));
  try {
    if (!fs.existsSync(sPath)) {
      fs.mkdirSync(sPath, { recursive: true });
    }
  } catch (e) {}
  
  return sPath;
}

export function getDevDataSqlitePath(): string {
  return normalizePath(safeJoinPath(getDevDataPath(), "devdata.sqlite"));
}

export function getDevDataFilePath(
  eventName: DevEventName,
  schema: string,
): string {
  const versionPath = normalizePath(safeJoinPath(getDevDataPath(), schema));
  try {
    if (!fs.existsSync(versionPath)) {
      fs.mkdirSync(versionPath, { recursive: true });
    }
  } catch (e) {}
  
  return normalizePath(safeJoinPath(versionPath, `${String(eventName)}.jsonl`));
}

function editConfigJson(
  callback: (config: SerializedContinueConfig) => SerializedContinueConfig,
): void {
  try {
    const configJsonPath = getConfigJsonPath();
    if (!fs.existsSync(configJsonPath)) {
      return;
    }
    
    const config = fs.readFileSync(configJsonPath, "utf8");
    let configJson = JSONC.parse(config);
    if (typeof configJson === "object" && configJson !== null) {
      configJson = callback(configJson as any) as any;
      fs.writeFileSync(configJsonPath, JSONC.stringify(configJson, null, 2));
    }
  } catch (e) {}
}

function editConfigYaml(callback: (config: ConfigYaml) => ConfigYaml): void {
  try {
    const configYamlPath = getConfigYamlPath();
    if (!fs.existsSync(configYamlPath)) {
      return;
    }
    
    const config = fs.readFileSync(configYamlPath, "utf8");
    let configYaml = YAML.parse(config);
    if (typeof configYaml === "object" && configYaml !== null) {
      configYaml = callback(configYaml as any) as any;
      fs.writeFileSync(configYamlPath, YAML.stringify(configYaml));
    }
  } catch (e) {}
}

export function editConfigFile(
  configJsonCallback: (
    config: SerializedContinueConfig,
  ) => SerializedContinueConfig,
  configYamlCallback: (config: ConfigYaml) => ConfigYaml,
): void {
  try {
    if (fs.existsSync(getConfigYamlPath())) {
      editConfigYaml(configYamlCallback);
    } else if (fs.existsSync(getConfigJsonPath())) {
      editConfigJson(configJsonCallback);
    }
  } catch (e) {}
}

function getMigrationsFolderPath(): string {
  const migrationsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), ".migrations"));
  try {
    if (!fs.existsSync(migrationsPath)) {
      fs.mkdirSync(migrationsPath, { recursive: true });
    }
  } catch (e) {}
  
  return migrationsPath;
}

export async function migrate(
  id: string,
  callback: () => void | Promise<void>,
  onAlreadyComplete?: () => void,
) {
  if (process.env.NODE_ENV === "test") {
    return await Promise.resolve(callback());
  }

  try {
    const migrationsPath = getMigrationsFolderPath();
    const migrationPath = normalizePath(safeJoinPath(migrationsPath, id));

    if (!fs.existsSync(migrationPath)) {
      try {
        fs.writeFileSync(migrationPath, "");
        await Promise.resolve(callback());
      } catch (e) {}
    } else if (onAlreadyComplete) {
      onAlreadyComplete();
    }
  } catch (e) {}
}

export function getIndexSqlitePath(): string {
  return normalizePath(safeJoinPath(getIndexFolderPath(), "index.sqlite"));
}

export function getLanceDbPath(): string {
  return normalizePath(safeJoinPath(getIndexFolderPath(), "lancedb"));
}

export function getTabAutocompleteCacheSqlitePath(): string {
  return normalizePath(safeJoinPath(getIndexFolderPath(), "autocompleteCache.sqlite"));
}

export function getDocsSqlitePath(): string {
  return normalizePath(safeJoinPath(getIndexFolderPath(), "docs.sqlite"));
}

export function getRemoteConfigsFolderPath(): string {
  const dir = normalizePath(safeJoinPath(getContinueGlobalPath(), ".configs"));
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {}
  
  return dir;
}

export function getPathToRemoteConfig(remoteConfigServerUrl: string): string {
  let url: URL | undefined = undefined;
  try {
    url =
      typeof remoteConfigServerUrl !== "string" || remoteConfigServerUrl === ""
        ? undefined
        : new URL(remoteConfigServerUrl);
  } catch (e) {}
  
  const dir = normalizePath(safeJoinPath(getRemoteConfigsFolderPath(), url?.hostname ?? "None"));
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {}
  
  return dir;
}

export function getConfigJsonPathForRemote(
  remoteConfigServerUrl: string,
): string {
  return normalizePath(safeJoinPath(getPathToRemoteConfig(remoteConfigServerUrl), "config.json"));
}

export function getConfigJsPathForRemote(
  remoteConfigServerUrl: string,
): string {
  return normalizePath(safeJoinPath(getPathToRemoteConfig(remoteConfigServerUrl), "config.js"));
}

export function getContinueDotEnv(): { [key: string]: string } {
  const filepath = normalizePath(safeJoinPath(getContinueGlobalPath(), ".env"));
  if (fs.existsSync(filepath)) {
    try {
      return dotenv.parse(fs.readFileSync(filepath));
    } catch (e) {
      return {};
    }
  }
  return {};
}

export function getLogsDirPath(): string {
  // 発生箇所: ログディレクトリが作成されていない問題
  // 改善: ログディレクトリを確実に作成
  let logsPath = '';
  try {
    // 設定済みのグローバルパスを使用
    logsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "logs"));
    
    // フォールバックパスを定義
    const fallbackPaths = [];
    
    // 明示的な固定パスをフォールバックとして追加（特にWindowsの場合）
    if (process.platform === 'win32') {
      fallbackPaths.push(
        'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\logs',
        path.join(process.cwd(), 'extensions', '.continue-debug', 'logs')
      );
    }
    
    // 通常のパス
    fallbackPaths.push(
      path.join(os.homedir(), '.continue', 'logs'),
      path.join(getExtensionRootPath(), 'logs'),
      path.join(getExtensionRootPath(), '.continue-debug', 'logs')
    );
    
    // ディレクトリ作成テスト
    let created = false;
    
    // まず指定されたlogsPathを試行
    try {
      if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath, { recursive: true });
        created = true;
        console.log(`メインログディレクトリ作成: ${logsPath}`);
      } else {
        created = true;
      }
    } catch (mainDirError) {
      console.warn(`メインログディレクトリ作成に失敗: ${mainDirError}`);
    }
    
    // メインパスの作成が失敗した場合、フォールバックを試行
    if (!created) {
      for (const fallbackPath of fallbackPaths) {
        try {
          const normalizedPath = normalizePath(fallbackPath);
          if (!fs.existsSync(normalizedPath)) {
            fs.mkdirSync(normalizedPath, { recursive: true });
            console.log(`フォールバックログディレクトリ作成: ${normalizedPath}`);
            logsPath = normalizedPath;
            created = true;
            break;
          } else {
            logsPath = normalizedPath;
            created = true;
            break;
          }
        } catch (fallbackError) {
          console.warn(`フォールバックログディレクトリ作成に失敗: ${fallbackError}`);
          continue;
        }
      }
    }
    
    // すべての試行が失敗した場合の最終フォールバック
    if (!created) {
      try {
        const tmpPath = path.join(os.tmpdir(), 'continue-logs');
        fs.mkdirSync(tmpPath, { recursive: true });
        console.log(`一時ログディレクトリ作成: ${tmpPath}`);
        logsPath = tmpPath;
      } catch (tmpError) {
        console.error(`一時ログディレクトリ作成に失敗: ${tmpError}`);
      }
    }
  } catch (e) {
    console.error(`ログディレクトリパス取得エラー: ${e instanceof Error ? e.message : String(e)}`);
    
    // 最後の手段としてカレントディレクトリにログディレクトリを作成
    try {
      const cwdLogsPath = path.join(process.cwd(), 'logs');
      fs.mkdirSync(cwdLogsPath, { recursive: true });
      logsPath = cwdLogsPath;
    } catch (finalError) {
      console.error(`最終フォールバックログディレクトリ作成に失敗: ${finalError}`);
    }
  }
  
  return logsPath;
}

export function getCoreLogsPath(): string {
  return normalizePath(safeJoinPath(getLogsDirPath(), "core.log"));
}

export function getPromptLogsPath(): string {
  return normalizePath(safeJoinPath(getLogsDirPath(), "prompt.log"));
}

export function getPathDebugLogsPath(): string {
  return normalizePath(safeJoinPath(getLogsDirPath(), "path_debug.log"));
}

export function getGlobalFolderWithName(name: string): string {
  return normalizePath(safeJoinPath(getContinueGlobalPath(), name));
}

export function getGlobalPromptsPath(): string {
  return getGlobalFolderWithName("prompts");
}

export function getGlobalAssistantsPath(): string {
  return getGlobalFolderWithName("assistants");
}

export function readAllGlobalPromptFiles(
  folderPath: string = getGlobalPromptsPath(),
): { path: string; content: string }[] {
  try {
    if (!fs.existsSync(folderPath)) {
      return [];
    }
    
    const files = fs.readdirSync(folderPath);
    const promptFiles: { path: string; content: string }[] = [];
    
    for (const file of files) {
      try {
        const filepath = normalizePath(safeJoinPath(folderPath, file));
        const stats = fs.statSync(filepath);

        if (stats.isDirectory()) {
          const nestedPromptFiles = readAllGlobalPromptFiles(filepath);
          promptFiles.push(...nestedPromptFiles);
        } else if (file.endsWith(".prompt")) {
          const content = fs.readFileSync(filepath, "utf8");
          promptFiles.push({ path: filepath, content });
        }
      } catch (e) {
        continue;
      }
    }

    return promptFiles;
  } catch (e) {
    return [];
  }
}

export function getRepoMapFilePath(): string {
  return normalizePath(safeJoinPath(getContinueUtilsPath(), "repo_map.txt"));
}

export function getEsbuildBinaryPath(): string {
  return normalizePath(safeJoinPath(getContinueUtilsPath(), "esbuild"));
}

export function migrateV1DevDataFiles() {
  try {
    const devDataPath = getDevDataPath();
    
    function moveToV1FolderIfExists(
      oldFileName: string,
      newFileName: DevEventName,
    ) {
      try {
        const oldFilePath = normalizePath(safeJoinPath(devDataPath, `${oldFileName}.jsonl`));
        if (fs.existsSync(oldFilePath)) {
          const newFilePath = getDevDataFilePath(newFileName, "0.1.0");
          if (!fs.existsSync(newFilePath)) {
            fs.copyFileSync(oldFilePath, newFilePath);
            fs.unlinkSync(oldFilePath);
          }
        }
      } catch (e) {}
    }
    
    moveToV1FolderIfExists("tokens_generated", "tokensGenerated");
    moveToV1FolderIfExists("chat", "chatFeedback");
    moveToV1FolderIfExists("quickEdit", "quickEdit");
    moveToV1FolderIfExists("autocomplete", "autocomplete");
  } catch (e) {}
}

export function getLocalEnvironmentDotFilePath(): string {
  return normalizePath(safeJoinPath(getContinueGlobalPath(), ".local"));
}

export function getStagingEnvironmentDotFilePath(): string {
  return normalizePath(safeJoinPath(getContinueGlobalPath(), ".staging"));
}

export function getDiffsDirectoryPath(): string {
  const diffsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), ".diffs"));
  
  try {
    if (!fs.existsSync(diffsPath)) {
      fs.mkdirSync(diffsPath, {
        recursive: true,
      });
    }
  } catch (e) {}
  
  return diffsPath;
}