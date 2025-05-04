// VSCode API初期化の安全な実装 - Node.js環境とブラウザ環境の区別を強化
let vscodeApi: any = undefined;

// Node.js環境かどうかの検出を強化
const isNode = typeof process !== 'undefined' && 
               typeof process.versions !== 'undefined' && 
               typeof process.versions.node !== 'undefined';

// ブラウザ環境の場合のみwindowオブジェクトを参照
if (!isNode) {
  try {
    if (typeof window !== 'undefined') {
      // windowオブジェクトを安全に参照
      const win = window as any;
      
      // vscodeオブジェクトが存在する場合はそれを使用
      if (win.vscode) {
        vscodeApi = win.vscode;
      } 
      // acquireVsCodeApi関数が存在する場合はそれを呼び出す
      else if (typeof win.acquireVsCodeApi === 'function') {
        try {
          // 直接name属性を変更せず、関数を実行結果を取得
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

// ログレベルの定義
export enum LogLevel {
  NONE = 0,     // ログを出力しない
  ERROR = 1,    // エラーのみ
  WARN = 2,     // 警告以上
  INFO = 3,     // 情報以上
  DEBUG = 4,    // デバッグ情報も含む
  TRACE = 5     // 詳細なトレース情報
}

// 現在のログレベル（環境変数から設定可能）
const currentLogLevel = 
  process.env.PATH_DEBUG_LEVEL ? 
  parseInt(process.env.PATH_DEBUG_LEVEL) : 
  (process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.WARN);

// ファイルログを有効にするかどうか
const enableFileLogging = process.env.NODE_ENV === 'development' && process.env.PATH_LOG_TO_FILE === '1';

// タイムスタンプを生成する関数
function getTimestamp(): string {
  return new Date().toISOString();
}

// 関数呼び出し階層を追跡するためのカウンター
let callDepth = 0;
const callStack: string[] = [];

/**
 * パスログをファイルに書き込む
 * @param message ログメッセージ
 */
function writeToPathLogFile(message: string): void {
  if (!enableFileLogging) return;
  
  try {
    // 環境変数でログファイルパスを指定可能
    const logsDir = process.env.PATH_LOG_DIR || getLogsDirPath();
    const logFilePath = path.join(logsDir, 'path_debug.log');
    
    // ディレクトリ存在確認
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // 追記
    fs.appendFileSync(logFilePath, message + '\n');
  } catch (e) {
    // ログ書き込みの失敗は静かに処理
    console.error(`Failed to write to path log file: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * 階層的なログ出力
 * @param level ログレベル
 * @param category カテゴリ
 * @param message メッセージ
 * @param data 追加データ
 */
function logPath(level: LogLevel, category: string, message: string, data?: any): void {
  if (level > currentLogLevel) return;
  
  const indent = ' '.repeat(callDepth * 2);
  const levelMarker = getLogLevelMarker(level);
  const timestamp = getTimestamp();
  
  const caller = getCaller();
  const callContext = caller ? ` [${caller}]` : '';
  
  const logMessage = `${levelMarker} ${timestamp}${callContext} ${indent}${category}: ${message}`;
  console.log(logMessage);
  
  // ファイルログ出力
  if (enableFileLogging) {
    writeToPathLogFile(logMessage);
  }
  
  if (data !== undefined) {
    const dataString = typeof data === 'object' ? 
                      JSON.stringify(data, null, 2) : 
                      String(data);
    
    const dataLogMessage = `${' '.repeat(levelMarker.length + 1 + timestamp.length + callContext.length)} ${indent}${dataString}`;
    console.log(dataLogMessage);
    
    // データもファイルログに出力
    if (enableFileLogging) {
      writeToPathLogFile(dataLogMessage);
    }
  }
}

/**
 * ログレベルに応じたマーカーを取得
 */
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

/**
 * 呼び出し元関数名を取得
 */
function getCaller(): string | null {
  try {
    const stack = new Error().stack || '';
    const stackLines = stack.split('\n').slice(3); // Error, getCaller, logPath を飛ばす
    
    for (const line of stackLines) {
      const match = line.match(/at\s+([^\s]+)\s+\(/);
      if (match && match[1] && !match[1].includes('__awaiter')) {
        return match[1];
      }
    }
  } catch (e) {}
  
  return null;
}

/**
 * 関数の実行を記録し、開始と終了をログに残す高階関数
 * @param name 関数名
 * @param fn 対象の関数
 * @returns ラップされた関数
 */
function withPathLogging<T extends (...args: any[]) => any>(
  name: string, 
  fn: T
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    callDepth++;
    callStack.push(name);
    
    logPath(LogLevel.DEBUG, 'CALL', `${name} started`, args.length > 0 ? args : undefined);
    
    try {
      const result = fn(...args);
      
      // Promiseの場合は特別処理
      if (result instanceof Promise) {
        return result
          .then(value => {
            logPath(LogLevel.DEBUG, 'RETURN', `${name} completed successfully`, value);
            callDepth--;
            callStack.pop();
            return value;
          })
          .catch(error => {
            logPath(LogLevel.ERROR, 'ERROR', `${name} failed: ${error.message}`, error);
            callDepth--;
            callStack.pop();
            throw error;
          }) as ReturnType<T>;
      }
      
      // 通常の戻り値
      logPath(LogLevel.DEBUG, 'RETURN', `${name} completed successfully`, result);
      callDepth--;
      callStack.pop();
      return result;
    } catch (error: any) {
      logPath(LogLevel.ERROR, 'ERROR', `${name} failed: ${error.message}`, error);
      callDepth--;
      callStack.pop();
      throw error;
    }
  };
}

/**
 * 環境情報の記録
 */
export function logPathLibraryState(): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const logsDir = getLogsDirPath();
  const pathLogFile = path.join(logsDir, 'path_debug.log');
  
  logPath(LogLevel.INFO, 'ENV', `Path library state:
    Delimiter: ${path.delimiter}
    Separator: ${path.sep}
    Process CWD: ${process.cwd()}
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

/**
 * パスの詳細分析
 * @param filePath 分析対象のパス
 * @param source 分析要求の発生源情報
 */
export function analyzePathIssue(filePath: string, source?: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  // 未定義パスの保護
  if (!filePath) {
    logPath(LogLevel.ERROR, 'ANALYSIS', `Cannot analyze undefined or null path (source: ${source || 'unknown'})`);
    return;
  }
  
  logPath(LogLevel.WARN, 'ANALYSIS', `Analyzing path: ${filePath}${source ? ` (source: ${source})` : ''}`);
  
  // コンポーネントに分解
  const components = filePath.split(/[\\\/]+/).filter(Boolean);
  logPath(LogLevel.INFO, 'ANALYSIS', `Path components (${components.length}):`, components);
  
  // ドライブレターの検出
  const driveLetters = components
    .filter(c => /^[A-Za-z]:$/.test(c) || /^[A-Za-z]:$/.test(c.substring(0, 2)))
    .map(c => c.substring(0, 2));
  
  logPath(
    driveLetters.length > 1 ? LogLevel.ERROR : LogLevel.INFO, 
    'ANALYSIS', 
    `Drive letters found: ${driveLetters.join(', ')} (count: ${driveLetters.length})`
  );
  
  // 問題パターンの分析
  const patterns = {
    doubleDrive: /^([A-Za-z]:[\\\/])[\\\/]*[A-Za-z]:[\\\/]/i,
    middleDrive: /([\\\/])([A-Za-z]):[\\\/]/,
    extraSeparators: /[\\\/]{2,}/,
    longPath: filePath.length > 260,
    mixedSeparators: filePath.includes('/') && filePath.includes('\\'),
    nonExistentPath: !fs.existsSync(filePath),
    parentDirTraversal: /[\\\/]\.\.[\\\/]/
  };
  
  const issues = Object.entries(patterns)
    .filter(([name, pattern]) => {
      if (typeof pattern === 'boolean') return pattern;
      return pattern.test(filePath);
    })
    .map(([name]) => name);
  
  if (issues.length > 0) {
    logPath(LogLevel.WARN, 'ANALYSIS', `🚨 Issues detected in path (${issues.length}):`, issues);
    
    // 問題ごとの分析と修正提案
    if (patterns.doubleDrive.test(filePath)) {
      const fixedPath = filePath.replace(patterns.doubleDrive, '$1');
      logPath(LogLevel.INFO, 'ANALYSIS', `🔧 Double drive letter pattern detected. Suggested fix:`, fixedPath);
    }
    
    if (patterns.middleDrive.test(filePath)) {
      const fixedPath = filePath.replace(/([\\\/])([A-Za-z]):[\\\/]/g, '$1');
      logPath(LogLevel.INFO, 'ANALYSIS', `🔧 Middle drive letter pattern detected. Suggested fix:`, fixedPath);
    }
    
    if (patterns.extraSeparators.test(filePath)) {
      const fixedPath = filePath.replace(/[\\\/]{2,}/g, path.sep);
      logPath(LogLevel.INFO, 'ANALYSIS', `🔧 Extra separators detected. Suggested fix:`, fixedPath);
    }
    
    if (patterns.longPath) {
      logPath(LogLevel.WARN, 'ANALYSIS', `⚠️ Path exceeds 260 characters (${filePath.length}). May cause issues on Windows.`);
    }
    
    if (patterns.mixedSeparators) {
      const fixedPath = filePath.replace(/\//g, path.sep);
      logPath(LogLevel.INFO, 'ANALYSIS', `🔧 Mixed separators detected. Suggested fix:`, fixedPath);
    }
    
    if (patterns.nonExistentPath) {
      logPath(LogLevel.WARN, 'ANALYSIS', `⚠️ Path does not exist on the filesystem.`);
      
      // 親ディレクトリが存在するか確認
      const dir = path.dirname(filePath);
      if (fs.existsSync(dir)) {
        logPath(LogLevel.INFO, 'ANALYSIS', `Parent directory exists: ${dir}`);
      } else {
        logPath(LogLevel.WARN, 'ANALYSIS', `Parent directory does not exist: ${dir}`);
      }
    }
    
    if (patterns.parentDirTraversal.test(filePath)) {
      const fixedPath = path.normalize(filePath);
      logPath(LogLevel.INFO, 'ANALYSIS', `🔧 Parent directory traversal detected. Suggested fix:`, fixedPath);
    }
    
    // 最終的な修正案
    const normalizedPath = normalizePath(filePath);
    if (normalizedPath !== filePath) {
      logPath(LogLevel.INFO, 'ANALYSIS', `✅ Normalized path:`, normalizedPath);
    }
  } else {
    logPath(LogLevel.INFO, 'ANALYSIS', `✅ No common path issues detected.`);
  }
  
  // パスの種類の判定
  const pathType = path.isAbsolute(filePath) ? 'absolute' : 'relative';
  logPath(LogLevel.INFO, 'ANALYSIS', `Path type: ${pathType}`);
  
  // 追加のプラットフォーム固有チェック
  if (process.platform === 'win32' && filePath.includes(':') && !filePath.match(/^[A-Za-z]:/)) {
    logPath(LogLevel.WARN, 'ANALYSIS', `⚠️ Windows path contains colon but doesn't start with a drive letter.`);
  }
}

/**
 * 強化された normalizePath 関数 - 二重ドライブレター問題を改善
 * @param p 正規化するパス
 * @returns 正規化されたパス
 */
export function normalizePath(p: string): string {
  // 未定義値の保護
  if (p === undefined || p === null) {
    console.warn("Attempt to normalize undefined or null path");
    return ''; // 空文字を返す（安全なデフォルト）
  }
  
  if (typeof p !== 'string') {
    console.warn(`Attempt to normalize non-string path: ${typeof p}`);
    try {
      p = String(p); // 文字列への変換を試みる
    } catch (e) {
      console.error(`Failed to convert path to string: ${e}`);
      return ''; // 変換失敗時は空文字を返す
    }
  }
  
  const originalPath = p;
  let modified = false;
  
  try {
    // Windowsパスの場合の特別な処理
    if (process.platform === 'win32') {
      // パスが長すぎる場合の保護（MAX_PATH = 260）
      const maxPathLength = 2048;
      if (p.length > maxPathLength) {
        p = p.substring(0, maxPathLength);
        modified = true;
        logPath(LogLevel.WARN, 'PATH', `Path truncated due to exceeding max length: ${p.length} > ${maxPathLength}`);
      }
      
      // ドライブレターの正規化: "c:" -> "C:"
      const pathBeforeDriveNormalization = p;
      p = p.replace(/^([a-z]):/, (_, drive) => drive.toUpperCase() + ":");
      if (pathBeforeDriveNormalization !== p) {
        modified = true;
        logPath(LogLevel.TRACE, 'PATH', `Drive letter normalized: ${pathBeforeDriveNormalization} -> ${p}`);
      }
      
      // 二重ドライブレターパターンをチェック
      const doubleLetterPattern = /^([A-Za-z]:[\\\/])[\\\/]*([A-Za-z]):[\\\/]/i;
      if (doubleLetterPattern.test(p)) {
        const pathBeforeDoubleDriveNormalization = p;
        // 先頭のドライブレターを保持して後続のドライブレターを削除
        p = p.replace(doubleLetterPattern, '$1');
        modified = true;
        logPath(LogLevel.WARN, 'PATH', `🚨 Double drive pattern fixed: ${pathBeforeDoubleDriveNormalization} -> ${p}`);
      }
      
      // 途中にドライブレターが出現するケースを修正
      const middleDrivePattern = /([\\\/])([A-Za-z]):[\\\/]/g;
      if (middleDrivePattern.test(p)) {
        const pathBeforeMiddleDriveNormalization = p;
        p = p.replace(middleDrivePattern, '$1');
        modified = true;
        logPath(LogLevel.WARN, 'PATH', `🚨 Middle drive letter removed: ${pathBeforeMiddleDriveNormalization} -> ${p}`);
      }
      
      // 連続するパス区切り文字を単一に
      const extraSepsPattern = /[\\\/]{2,}/g;
      if (extraSepsPattern.test(p)) {
        const pathBeforeSeparatorNormalization = p;
        p = p.replace(extraSepsPattern, '\\');
        modified = true;
        logPath(LogLevel.DEBUG, 'PATH', `Extra separators removed: ${pathBeforeSeparatorNormalization} -> ${p}`);
      }
      
      // 最終的な正規化
      const pathBeforeFinalNormalization = p;
      p = path.normalize(p);
      if (pathBeforeFinalNormalization !== p) {
        modified = true;
        logPath(LogLevel.TRACE, 'PATH', `Path normalized: ${pathBeforeFinalNormalization} -> ${p}`);
      }
    } else {
      // Windowsパス以外は通常の正規化
      const nonWindowsPath = p;
      p = path.normalize(p);
      if (nonWindowsPath !== p) {
        modified = true;
        logPath(LogLevel.TRACE, 'PATH', `Path normalized: ${nonWindowsPath} -> ${p}`);
      }
    }
    
    if (modified && process.env.NODE_ENV === 'development') {
      logPath(LogLevel.DEBUG, 'PATH', `Path normalized: ${originalPath} -> ${p}`);
    }
    
    return p;
  } catch (e) {
    // エラーは発生させず、元のパスを正規化して返す
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'PATH', `Path normalization error for '${originalPath}': ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      return path.normalize(p);
    } catch {
      return p;
    }
  }
}

/**
 * 安全にパスを結合する関数 - 未定義値の適切な処理を含む
 * @param basePath ベースパス
 * @param segments 結合するパスセグメント
 * @returns 結合された正規化パス
 */
export function safeJoinPath(basePath: string | undefined, ...segments: (string | undefined)[]): string {
  const source = getCaller() || 'safeJoinPath';
  
  // basePath と segments の null/undefined チェック
  if (basePath === undefined || basePath === null) {
    console.warn(`safeJoinPath called with undefined/null basePath from ${source}`);
    // エラー発生時は現在の作業ディレクトリをフォールバックとして使用
    basePath = process.cwd();
  }
  
  // 文字列に変換
  if (typeof basePath !== 'string') {
    try {
      basePath = String(basePath);
    } catch (e) {
      console.error(`Failed to convert basePath to string in safeJoinPath: ${e}`);
      basePath = process.cwd();
    }
  }
  
  // segments から未定義値を除外
  const validSegments: string[] = [];
  for (const segment of segments) {
    if (segment !== undefined && segment !== null) {
      try {
        // 文字列に変換
        const segmentStr = typeof segment === 'string' ? segment : String(segment);
        validSegments.push(segmentStr);
      } catch (e) {
        console.warn(`Failed to convert segment to string in safeJoinPath: ${e}`);
        // 無効なセグメントはスキップ
      }
    }
  }
  
  const operation = {
    basePath,
    segments: validSegments,
    result: '',
    source
  };
  
  try {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.TRACE, 'PATH', `safeJoinPath called from ${source} with base '${basePath}' and ${validSegments.length} segments`);
    }
    
    // 絶対パスで始まるセグメントがあるかチェック
    for (const segment of validSegments) {
      if (segment && path.isAbsolute(segment)) {
        // 絶対パスがある場合は、それ以前のパスを無視して正規化
        const result = normalizePath(segment);
        operation.result = result;
        
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.DEBUG, 'PATH', `Absolute path segment detected: '${segment}'. Ignoring base path.`);
        }
        return result;
      }
    }
    
    // 通常の結合を試み、正規化
    const joinedPath = path.join(basePath, ...validSegments);
    const result = normalizePath(joinedPath);
    operation.result = result;
    
    if (process.env.NODE_ENV === 'development') {
      const hasDoubleDrive = /[A-Za-z]:[\\\/].*[A-Za-z]:[\\\/]/i.test(result);
      if (hasDoubleDrive) {
        logPath(LogLevel.WARN, 'PATH', `🚨 Double drive detected after join: ${result}`, operation);
        analyzePathIssue(result, source);
      }
    }
    
    return result;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'PATH', `Path join error: ${e instanceof Error ? e.message : String(e)}`, operation);
    }
    
    // エラー発生時のフォールバック
    try {
      // 最初の有効なパスを返す
      for (const segment of [basePath, ...validSegments]) {
        if (segment && typeof segment === 'string') {
          const result = normalizePath(segment);
          operation.result = result;
          if (process.env.NODE_ENV === 'development') {
            logPath(LogLevel.WARN, 'PATH', `Using fallback path: ${result}`);
          }
          return result;
        }
      }
    } catch (fallbackError) {
      if (process.env.NODE_ENV === 'development') {
        logPath(LogLevel.ERROR, 'PATH', `Fallback path error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }
    
    // 最終的なフォールバック
    operation.result = basePath || '';
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.WARN, 'PATH', `Using last resort fallback path: ${operation.result}`);
    }
    return operation.result;
  }
}

/**
 * 安全にファイル読み込みを行う拡張関数
 * @param filepath 読み込むファイルのパス
 * @returns ファイルの内容か、エラー時はnull
 */
export function safeReadFile(filepath: string | undefined): string | null {
  // 未定義値のチェック
  if (filepath === undefined || filepath === null) {
    console.warn("safeReadFile called with undefined or null filepath");
    return null;
  }
  
  const operation = { filepath, normalizedPath: '', exists: false, result: null as string | null };
  
  try {
    // パスを正規化
    const normalizedPath = normalizePath(filepath);
    operation.normalizedPath = normalizedPath;
    
    // ファイル存在チェック
    const fileExists = fs.existsSync(normalizedPath);
    operation.exists = fileExists;
    
    if (fileExists) {
      // ファイル読み込み
      const content = fs.readFileSync(normalizedPath, 'utf8');
      operation.result = content;
      if (process.env.NODE_ENV === 'development') {
        logPath(LogLevel.DEBUG, 'FILE', `File read successfully: ${normalizedPath}`);
      }
      return content;
    } else {
      if (process.env.NODE_ENV === 'development') {
        logPath(LogLevel.DEBUG, 'FILE', `File not found: ${normalizedPath} (original: ${filepath})`);
      }
      return null;
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'FILE', `Error reading file ${filepath}: ${e instanceof Error ? e.message : String(e)}`, operation);
    }
    return null;
  }
}

/**
 * デバッグ環境用の設定ファイルパスを取得する関数
 * @param fileType 設定ファイルの種類
 * @returns 設定ファイルのパスまたはnull
 */
export function getDebugConfigPath(fileType: 'config' | 'mcpServer' = 'config'): string | null {
  // 開発モードかどうかを確認
  const isDevMode = process.env.NODE_ENV === 'development';
  
  if (!isDevMode) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.DEBUG, 'CONFIG', `Debug config not available in production mode`);
    }
    return null;
  }
  
  try {
    const cwdPath = process.cwd();
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.DEBUG, 'CONFIG', `Current working directory: ${cwdPath}`);
    }
    
    // safeJoinPathを使用して安全に結合
    const basePath = safeJoinPath(cwdPath, "extensions", ".continue-debug");
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.DEBUG, 'CONFIG', `Debug base path: ${basePath}`);
    }
    
    if (fileType === 'config') {
      const configPath = safeJoinPath(basePath, "config.yaml");
      const exists = fs.existsSync(configPath);
      if (process.env.NODE_ENV === 'development') {
        logPath(LogLevel.DEBUG, 'CONFIG', `Debug config path: ${configPath} (exists: ${exists})`);
      }
      
      if (exists) {
        return configPath;
      }
    } else if (fileType === 'mcpServer') {
      const mcpServerDir = safeJoinPath(basePath, "mcpServers");
      const dirExists = fs.existsSync(mcpServerDir);
      if (process.env.NODE_ENV === 'development') {
        logPath(LogLevel.DEBUG, 'CONFIG', `Debug MCP server dir: ${mcpServerDir} (exists: ${dirExists})`);
      }
      
      if (dirExists) {
        const databricksPath = safeJoinPath(mcpServerDir, "databricks.yaml");
        const fileExists = fs.existsSync(databricksPath);
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.DEBUG, 'CONFIG', `Debug databricks path: ${databricksPath} (exists: ${fileExists})`);
        }
        
        if (fileExists) {
          return databricksPath;
        }
        return mcpServerDir;
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.DEBUG, 'CONFIG', `No debug config found for type: ${fileType}`);
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'CONFIG', `Error getting debug config path: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  return null;
}

/**
 * 最初に見つかった利用可能なファイルを読み込む関数（改善版）
 * @param filepaths 検索するファイルパスの配列
 * @returns 見つかったファイル情報またはnull
 */
export function readFirstAvailableFile(filepaths: string[]): { path: string; content: string } | null {
  // 入力検証
  if (!filepaths || !Array.isArray(filepaths) || filepaths.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.WARN, 'FILE', `readFirstAvailableFile called with empty paths`);
    }
    return null;
  }
  
  if (process.env.NODE_ENV === 'development') {
    logPath(LogLevel.DEBUG, 'FILE', `readFirstAvailableFile called with ${filepaths.length} paths:`, filepaths);
  }
  
  const operation = { 
    inputPaths: filepaths,
    normalizedPaths: [] as string[],
    foundPath: '',
    tried: 0,
    result: null as { path: string; content: string } | null
  };
  
  try {
    // 各パスを正規化
    operation.normalizedPaths = filepaths.map((filepath, index) => {
      try {
        if (filepath === undefined || filepath === null) {
          console.warn(`readFirstAvailableFile received undefined or null path at index ${index}`);
          return '';
        }
        
        const normalized = normalizePath(filepath);
        
        if (process.env.NODE_ENV === 'development') {
          const hasDoubleDrive = /[A-Za-z]:[\\\/].*[A-Za-z]:[\\\/]/i.test(normalized);
          
          logPath(
            hasDoubleDrive ? LogLevel.WARN : LogLevel.DEBUG, 
            'FILE', 
            `Path ${index} normalized:${hasDoubleDrive ? ' 🚨' : ''}
            Original: ${filepath}
            Normalized: ${normalized}
            Has double drive: ${hasDoubleDrive ? 'YES!' : 'no'}`
          );
          
          if (hasDoubleDrive) {
            analyzePathIssue(normalized, 'readFirstAvailableFile');
          }
        }
        
        return normalized;
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.ERROR, 'FILE', `Error normalizing path ${filepath}: ${e instanceof Error ? e.message : String(e)}`);
        }
        return filepath;
      }
    });
    
    // 無効なパスを除去
    const validPaths = operation.normalizedPaths.filter(p => p && p.trim() !== '');
    
    // 正規化されたパスでファイル検索
    for (const filepath of validPaths) {
      operation.tried++;
      try {
        const exists = fs.existsSync(filepath);
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.DEBUG, 'FILE', `Checking path ${operation.tried}/${validPaths.length}: ${filepath} (exists: ${exists})`);
        }
        
        if (exists) {
          operation.foundPath = filepath;
          if (process.env.NODE_ENV === 'development') {
            logPath(LogLevel.INFO, 'FILE', `✅ Found file: ${filepath}`);
          }
          
          try {
            const content = fs.readFileSync(filepath, 'utf8');
            operation.result = { path: filepath, content };
            return operation.result;
          } catch (readError) {
            if (process.env.NODE_ENV === 'development') {
              logPath(LogLevel.ERROR, 'FILE', `Error reading found file ${filepath}: ${readError instanceof Error ? readError.message : String(readError)}`);
            }
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.ERROR, 'FILE', `Error checking file ${filepath}: ${e instanceof Error ? e.message : String(e)}`);
        }
        continue;
      }
    }
    
    // デバッグ用の設定ファイルも試す
    if (process.env.NODE_ENV === 'development') {
      try {
        const debugMcpPath = getDebugConfigPath('mcpServer');
        logPath(LogLevel.DEBUG, 'FILE', `Debug MCP path: ${debugMcpPath}`);
        
        if (debugMcpPath && fs.existsSync(debugMcpPath)) {
          logPath(LogLevel.DEBUG, 'FILE', `Debug MCP path exists`);
          
          try {
            const stats = fs.statSync(debugMcpPath);
            if (stats.isDirectory()) {
              const databricksPath = safeJoinPath(debugMcpPath, "databricks.yaml");
              logPath(LogLevel.DEBUG, 'FILE', `Checking databricks.yaml in MCP dir: ${databricksPath}`);
              
              const exists = fs.existsSync(databricksPath);
              if (exists) {
                logPath(LogLevel.INFO, 'FILE', `✅ Found databricks config file in debug directory`);
                const content = fs.readFileSync(databricksPath, 'utf8');
                operation.result = { path: databricksPath, content };
                return operation.result;
              } else {
                logPath(LogLevel.DEBUG, 'FILE', `Databricks config not found in debug directory`);
              }
            } else {
              logPath(LogLevel.DEBUG, 'FILE', `Debug MCP path is a file, reading directly`);
              const content = fs.readFileSync(debugMcpPath, 'utf8');
              operation.result = { path: debugMcpPath, content };
              return operation.result;
            }
          } catch (statError) {
            logPath(LogLevel.ERROR, 'FILE', `Error checking stats for ${debugMcpPath}: ${statError instanceof Error ? statError.message : String(statError)}`);
          }
        } else {
          logPath(LogLevel.DEBUG, 'FILE', `Debug MCP path not available or does not exist`);
        }
      } catch (e) {
        logPath(LogLevel.ERROR, 'FILE', `Error reading debug MCP config: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'FILE', `Error in readFirstAvailableFile: ${e instanceof Error ? e.message : String(e)}`, operation);
    }
  }
  
  if (process.env.NODE_ENV === 'development') {
    logPath(LogLevel.WARN, 'FILE', `❌ No files found after trying ${operation.tried} paths`);
  }
  return null;
}

// 起動時に環境情報を記録
if (process.env.NODE_ENV === 'development') {
  logPathLibraryState();
}

const CONTINUE_GLOBAL_DIR = (() => {
  const configPath = process.env.CONTINUE_GLOBAL_DIR;
  if (configPath) {
    // Convert relative path to absolute paths based on current working directory
    return path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);
  }
  return path.join(os.homedir(), ".continue");
})();

export const DEFAULT_CONFIG_TS_CONTENTS = `export function modifyConfig(config: Config): Config {
  return config;
}`;

export function getChromiumPath(): string {
  return normalizePath(safeJoinPath(getContinueUtilsPath(), ".chromium-browser-snapshots"));
}

export function getContinueUtilsPath(): string {
  const utilsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), ".utils"));
  // ディレクトリ存在確認
  try {
    if (!fs.existsSync(utilsPath)) {
      fs.mkdirSync(utilsPath, { recursive: true });
    }
  } catch (e) {
    console.warn(`Error creating utils directory: ${e}`);
  }
  return utilsPath;
}

export function getGlobalContinueIgnorePath(): string {
  const continueIgnorePath = normalizePath(safeJoinPath(
    getContinueGlobalPath(),
    ".continueignore",
  ));
  try {
    if (!fs.existsSync(continueIgnorePath)) {
      fs.writeFileSync(continueIgnorePath, "");
    }
  } catch (e) {
    console.warn(`Error creating continueignore file: ${e}`);
  }
  return continueIgnorePath;
}

export function getContinueGlobalPath(): string {
  // This is ~/.continue on mac/linux
  const continuePath = normalizePath(CONTINUE_GLOBAL_DIR);
  try {
    if (!fs.existsSync(continuePath)) {
      fs.mkdirSync(continuePath, { recursive: true });
    }
  } catch (e) {
    console.warn(`Error creating continue global directory: ${e}`);
  }
  return continuePath;
}

export function getSessionsFolderPath(): string {
  const sessionsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "sessions"));
  try {
    if (!fs.existsSync(sessionsPath)) {
      fs.mkdirSync(sessionsPath, { recursive: true });
    }
  } catch (e) {
    console.warn(`Error creating sessions directory: ${e}`);
  }
  return sessionsPath;
}

export function getIndexFolderPath(): string {
  const indexPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "index"));
  try {
    if (!fs.existsSync(indexPath)) {
      fs.mkdirSync(indexPath, { recursive: true });
    }
  } catch (e) {
    console.warn(`Error creating index directory: ${e}`);
  }
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
  } catch (e) {
    console.warn(`Error creating sessions list file: ${e}`);
  }
  return filepath;
}

export function getConfigJsonPath(): string {
  return normalizePath(safeJoinPath(getContinueGlobalPath(), "config.json"));
}

/**
 * デバッグモードを考慮した設定ファイルパス取得
 * @param ideType IDE種別
 * @returns 設定ファイルのパス
 */
export function getConfigYamlPath(ideType?: IdeType): string {
  try {
    // デバッグ用設定ファイルがあれば優先（開発モード時）
    const debugConfigPath = getDebugConfigPath('config');
    if (debugConfigPath && fs.existsSync(debugConfigPath)) {
      if (process.env.NODE_ENV === 'development') {
        logPath(LogLevel.INFO, 'CONFIG', `Using debug config path: ${debugConfigPath}`);
      }
      return normalizePath(debugConfigPath);
    }
    
    // 通常の設定ファイルパス
    const p = normalizePath(safeJoinPath(getContinueGlobalPath(), "config.yaml"));
    try {
      if (!fs.existsSync(p) && !fs.existsSync(getConfigJsonPath())) {
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.INFO, 'CONFIG', `Creating default config for IDE type: ${ideType || 'default'}`);
        }
        
        // 必要なディレクトリが存在するか確認
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
    } catch (writeError) {
      console.warn(`Error writing default config: ${writeError}`);
    }
    
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.DEBUG, 'CONFIG', `Using config path: ${p}`);
    }
    return p;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'CONFIG', `Error getting config YAML path: ${e instanceof Error ? e.message : String(e)}`);
    }
    // エラーが発生した場合はデフォルトパスを返す
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
  } catch (e) {
    console.warn(`Error creating config.ts: ${e}`);
  }
  
  return p;
}

export function getConfigJsPath(): string {
  // Do not create automatically
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
  } catch (e) {
    console.warn(`Error creating tsconfig.json: ${e}`);
  }
  
  return tsConfigPath;
}

export function getContinueRcPath(): string {
  // Disable indexing of the config folder to prevent infinite loops
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
  } catch (e) {
    console.warn(`Error creating continuerc file: ${e}`);
  }
  
  return continuercPath;
}

function getDevDataPath(): string {
  const sPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "dev_data"));
  try {
    if (!fs.existsSync(sPath)) {
      fs.mkdirSync(sPath, { recursive: true });
    }
  } catch (e) {
    console.warn(`Error creating dev_data directory: ${e}`);
  }
  
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
  } catch (e) {
    console.warn(`Error creating version directory: ${e}`);
  }
  
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
    // Check if it's an object
    if (typeof configJson === "object" && configJson !== null) {
      configJson = callback(configJson as any) as any;
      fs.writeFileSync(configJsonPath, JSONC.stringify(configJson, null, 2));
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'CONFIG', `Error editing config JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function editConfigYaml(callback: (config: ConfigYaml) => ConfigYaml): void {
  try {
    const configYamlPath = getConfigYamlPath();
    if (!fs.existsSync(configYamlPath)) {
      return;
    }
    
    const config = fs.readFileSync(configYamlPath, "utf8");
    let configYaml = YAML.parse(config);
    // Check if it's an object
    if (typeof configYaml === "object" && configYaml !== null) {
      configYaml = callback(configYaml as any) as any;
      fs.writeFileSync(configYamlPath, YAML.stringify(configYaml));
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'CONFIG', `Error editing config YAML: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
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
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'CONFIG', `Error editing config file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function getMigrationsFolderPath(): string {
  const migrationsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), ".migrations"));
  try {
    if (!fs.existsSync(migrationsPath)) {
      fs.mkdirSync(migrationsPath, { recursive: true });
    }
  } catch (e) {
    console.warn(`Error creating migrations directory: ${e}`);
  }
  
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
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.ERROR, 'MIGRATE', `Error during migration ${id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else if (onAlreadyComplete) {
      onAlreadyComplete();
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'MIGRATE', `Error in migrate function for ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
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
  } catch (e) {
    console.warn(`Error creating remote configs directory: ${e}`);
  }
  
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
  } catch (e) {
    console.warn(`Error creating remote config directory: ${e}`);
  }
  
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
      if (process.env.NODE_ENV === 'development') {
        logPath(LogLevel.ERROR, 'CONFIG', `Error parsing .env file: ${e instanceof Error ? e.message : String(e)}`);
      }
      return {};
    }
  }
  return {};
}

export function getLogsDirPath(): string {
  const logsPath = normalizePath(safeJoinPath(getContinueGlobalPath(), "logs"));
  try {
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }
  } catch (e) {
    console.warn(`Error creating logs directory: ${e}`);
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
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.ERROR, 'FILE', `Error reading prompt file ${file}: ${e instanceof Error ? e.message : String(e)}`);
        }
        continue;
      }
    }

    return promptFiles;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'FILE', `Error reading global prompt files: ${e instanceof Error ? e.message : String(e)}`);
    }
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
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          logPath(LogLevel.ERROR, 'MIGRATE', `Error migrating ${oldFileName} to ${newFileName}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    
    moveToV1FolderIfExists("tokens_generated", "tokensGenerated");
    moveToV1FolderIfExists("chat", "chatFeedback");
    moveToV1FolderIfExists("quickEdit", "quickEdit");
    moveToV1FolderIfExists("autocomplete", "autocomplete");
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'MIGRATE', `Error migrating V1 dev data files: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
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
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      logPath(LogLevel.ERROR, 'FILE', `Error creating diffs directory: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  return diffsPath;
}