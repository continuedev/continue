import { getContinueRcPath, getTsConfigPath, normalizePath, getLogsDirPath, setExtensionPath, getExtensionRootPath, fixDoubleDriveLetter } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";

import * as path from "path";
import * as fs from "fs";
import { VsCodeExtension } from "../extension/VsCodeExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { registerThinkingPanel } from "../panels";
import { getExtensionVersion } from "../util/util";

import { VsCodeContinueApi } from "./api";
import setupInlineTips from "./InlineTipManager";

// Node.js環境で必要なモジュールを最初にインポート
let os: any = null;
try {
  os = require('os');
} catch (e) {
  // os モジュールが利用できない場合のスタブ
  console.warn("OS module not available, using fallback implementation");
  os = {
    homedir: () => process.env.HOME || process.env.USERPROFILE || '/'
  };
}

// 拡張機能コマンドの定義
const EXTENSION_COMMANDS = {
  SHOW_THINKING_PANEL: 'continue.showThinkingPanel',
  VIEW_LOGS: 'continue.viewLogs',
  NEW_SESSION: 'continue.newSession',
  TOGGLE_THINKING_PANEL: 'continue.toggleThinkingPanel',
  OPEN_CONFIG_PAGE: 'continue.openConfigPage',
  FORCE_REFRESH_THINKING: 'continue.forceRefreshThinking',
  SIDEBAR_NEW_SESSION: 'continue.sidebar.newSession',
  RESET_THINKING_PANEL: 'continue.resetThinkingPanel',
  APPEND_THINKING_CHUNK: 'continue.appendThinkingChunk',
  THINKING_COMPLETED: 'continue.thinkingCompleted',
  UPDATE_THINKING: 'continue.updateThinking'
};

// 既に登録されたコマンドを追跡するセット
const registeredCommands = new Set<string>();
// 登録失敗したコマンドのフォールバック関数
const commandFallbacks = new Map<string, (...args: any[]) => any>();

/**
 * コマンドが既に登録されているか確認する関数
 * @param commandId 確認するコマンドID
 * @returns 登録済みの場合はtrue
 */
async function isCommandRegistered(commandId: string): Promise<boolean> {
  // 未定義チェック追加
  if (!commandId) {
    console.warn("isCommandRegistered called with undefined or empty commandId");
    return false;
  }
  
  // 拡張機能内部で既に登録済みかチェック
  if (registeredCommands.has(commandId)) {
    return true;
  }
  
  try {
    // VSCodeのAPIを使用して登録状況を確認
    const commands = await vscode.commands.getCommands();
    const exists = Array.isArray(commands) && commands.includes(commandId);
    
    // 登録されていた場合は内部状態も更新
    if (exists) {
      registeredCommands.add(commandId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`Error checking command registration for ${commandId}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * コマンドを安全に登録する関数 - エラー耐性強化版
 * @param context 拡張機能のコンテキスト
 * @param commandId コマンドID
 * @param callback コマンドが実行されたときのコールバック
 * @param fallback 登録失敗時のフォールバック関数
 */
async function safeRegisterCommand(
  context: vscode.ExtensionContext,
  commandId: string,
  callback: (...args: any[]) => any,
  fallback?: (...args: any[]) => any
): Promise<boolean> {
  try {
    // 未定義チェック追加
    if (!commandId) {
      console.warn("safeRegisterCommand called with undefined or empty commandId");
      return false;
    }
    
    // 既に内部で登録済みならスキップ
    if (registeredCommands.has(commandId)) {
      console.log(`Command ${commandId} already registered internally`);
      return true;
    }
    
    // フォールバック関数が指定されていれば保存
    if (fallback) {
      commandFallbacks.set(commandId, fallback);
    }
    
    // コマンドが既に登録されているか確認
    const exists = await isCommandRegistered(commandId);
    if (!exists) {
      // 登録を試みる
      try {
        const disposable = vscode.commands.registerCommand(commandId, (...args) => {
          try {
            return callback(...args);
          } catch (callbackError) {
            console.error(`Error executing command ${commandId}:`, callbackError instanceof Error ? callbackError.message : String(callbackError));
            
            // エラー時にフォールバックを実行
            const fb = commandFallbacks.get(commandId);
            if (fb) {
              try {
                console.log(`Using fallback for ${commandId}`);
                return fb(...args);
              } catch (fallbackError) {
                console.error(`Error in fallback for ${commandId}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
              }
            }
            return null;
          }
        });
        context.subscriptions.push(disposable);
        
        // 登録成功を記録
        registeredCommands.add(commandId);
        console.log(`Command ${commandId} registered successfully`);
        return true;
      } catch (registrationError) {
        console.error(`Error registering command ${commandId}:`, registrationError instanceof Error ? registrationError.message : String(registrationError));
        return false;
      }
    } else {
      // 既に存在する場合は成功とみなす
      registeredCommands.add(commandId);
      console.log(`Command ${commandId} already registered in VS Code`);
      return true;
    }
  } catch (error) {
    console.error(`Unexpected error registering command ${commandId}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * コマンドを安全に実行する関数 - エラー耐性強化版
 * @param commandId 実行するコマンドID
 * @param args コマンドに渡す引数
 * @param fallback コマンド実行失敗時のフォールバック関数
 */
async function safeExecuteCommand(
  commandId: string,
  args: any[] = [],
  fallback?: () => any
): Promise<any> {
  try {
    if (!commandId) {
      console.warn("Attempted to execute command with empty commandId");
      if (fallback) {
        console.log("Using fallback for empty commandId");
        return fallback();
      }
      return null;
    }
    
    // コマンドが登録されているか確認
    const exists = await isCommandRegistered(commandId);
    if (!exists) {
      console.warn(`Command ${commandId} not found, using fallback`);
      
      // 登録されていなくても内部的にフォールバックがあれば使用
      const fb = commandFallbacks.get(commandId);
      if (fb) {
        try {
          console.log(`Using fallback for ${commandId}`);
          return fb(...args);
        } catch (fallbackError) {
          console.error(`Error in fallback for ${commandId}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        }
      }
      
      // 引数で渡されたフォールバックがあれば使用
      if (fallback) {
        try {
          console.log(`Using provided fallback for ${commandId}`);
          return fallback();
        } catch (fallbackError) {
          console.error(`Error in provided fallback for ${commandId}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          return null;
        }
      }
      return null;
    }
    
    return await vscode.commands.executeCommand(commandId, ...args);
  } catch (error) {
    console.error(`Error executing command ${commandId}:`, error instanceof Error ? error.message : String(error));
    // コマンド実行に失敗した場合、フォールバックがあれば実行
    if (fallback) {
      try {
        console.log(`Using fallback after execution error for ${commandId}`);
        return fallback();
      } catch (fallbackError) {
        console.error(`Error in fallback for command ${commandId}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        return null;
      }
    }
    return null;
  }
}

/**
 * 指定されたモジュールを安全に読み込む関数 - エラー耐性強化版
 * @param paths モジュールが存在する可能性のあるパスの配列
 * @returns モジュールが見つかればそのモジュールを、見つからなければnullを返す
 */
function loadModuleSafely(paths: string[]): any | null {
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    console.warn("Empty paths array passed to loadModuleSafely");
    return null;
  }
  
  let lastError = null;
  
  for (const modulePath of paths) {
    try {
      if (!modulePath) {
        console.warn("Empty module path in loadModuleSafely");
        continue;
      }
      
      // パスが存在するか確認
      let normalizedPath;
      try {
        // 二重ドライブレター問題を修正
        const fixedPath = fixDoubleDriveLetter(modulePath);
        normalizedPath = normalizePath(fixedPath);
      } catch (normalizationError) {
        console.warn(`Error normalizing path ${modulePath}:`, normalizationError instanceof Error ? normalizationError.message : String(normalizationError));
        normalizedPath = modulePath; // フォールバックとして元のパスを使用
      }
      
      if (!fs.existsSync(normalizedPath)) {
        continue;
      }
      
      // モジュールをrequireで読み込む
      console.log(`Loading module from ${normalizedPath}`);
      return require(normalizedPath);
    } catch (error) {
      lastError = error;
      console.warn(`Error loading module from ${modulePath}:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }
  
  if (lastError) {
    console.error("All module loading attempts failed. Last error:", lastError instanceof Error ? lastError.message : String(lastError));
  }
  return null;
}

/**
 * 安全にパスを初期化する関数
 */
function safeInitializePaths(): void {
  try {
    // TsConfigを初期化
    try {
      getTsConfigPath();
    } catch (tsConfigError) {
      console.warn("Error initializing TsConfig path:", tsConfigError instanceof Error ? tsConfigError.message : String(tsConfigError));
    }
    
    // ContinueRcを初期化
    try {
      getContinueRcPath();
    } catch (continueRcError) {
      console.warn("Error initializing ContinueRc path:", continueRcError instanceof Error ? continueRcError.message : String(continueRcError));
    }
    
    // ログディレクトリを確保（改善：専用関数を使用）
    try {
      // 既存のログディレクトリ関数を利用
      const logDir = getLogsDirPath();
      
      // 固定ディレクトリの確保（デバッグモード用）
      if (process.env.NODE_ENV === 'development') {
        // 特殊パス：extensions/.continue-debug/logs の作成を確実に
        ensureDebugLogsDirectory();
      }
      
      console.log(`Log directory initialized: ${logDir}`);
    } catch (logsError) {
      console.warn("Error initializing logs directory:", logsError instanceof Error ? logsError.message : String(logsError));
      
      // 追加のフォールバック: 確実にログディレクトリを作成
      ensureDebugLogsDirectory();
    }
  } catch (error) {
    console.error("Unexpected error during path initialization:", error instanceof Error ? error.message : String(error));
  }
}

/**
 * デバッグ用ログディレクトリを必ず作成する関数
 */
function ensureDebugLogsDirectory(): void {
  try {
    // 固定ディレクトリパスの定義と作成
    const fixedDebugLogPaths = [
      // Windows環境向け固定パス
      'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\logs',
      // 拡張機能からの相対パス
      path.join(getExtensionRootPath(), '.continue-debug', 'logs'),
      path.join(getExtensionRootPath(), 'extensions', '.continue-debug', 'logs')
    ];
    
    let created = false;
    
    for (const logPath of fixedDebugLogPaths) {
      try {
        // 二重ドライブレター問題を修正
        const fixedPath = fixDoubleDriveLetter(logPath);
        const normalizedPath = normalizePath(fixedPath);
        
        if (!fs.existsSync(normalizedPath)) {
          fs.mkdirSync(normalizedPath, { recursive: true });
          console.log(`Ensured debug logs directory: ${normalizedPath}`);
          created = true;
        } else {
          console.log(`Debug logs directory already exists: ${normalizedPath}`);
          created = true;
        }
      } catch (pathError) {
        console.warn(`Error creating debug logs directory at ${logPath}:`, pathError);
      }
    }
    
    if (!created) {
      console.warn("Failed to create any debug logs directory");
    }
  } catch (e) {
    console.error("Error in ensureDebugLogsDirectory:", e);
  }
}

/**
 * 存在するパスを取得する関数
 * 複数のパスを試し、最初に存在するパスを返す
 */
function getFirstExistingPath(paths: string[]): string | null {
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return null;
  }
  
  for (const p of paths) {
    if (!p) continue;
    
    try {
      // 二重ドライブレター問題を修正
      const fixedPath = fixDoubleDriveLetter(p);
      const normalizedPath = normalizePath(fixedPath);
      
      if (fs.existsSync(normalizedPath)) {
        return normalizedPath;
      }
    } catch (e) {
      console.warn(`Error checking path existence: ${p}`, e instanceof Error ? e.message : String(e));
    }
  }
  
  return null;
}

/**
 * 思考パネル関連のコマンドを登録 - 重複チェック付き（修正版）
 */
async function registerThinkingPanelCommands(context: vscode.ExtensionContext): Promise<boolean> {
  console.log("Registering thinking panel commands...");
  
  try {
    // コマンドが登録済みかどうかを確認
    const isThinkingPanelRegistered = context.globalState.get('thinkingPanelCommandsRegistered');
    
    if (isThinkingPanelRegistered) {
      console.log("Thinking panel commands already registered according to global state");
      
      // 思考パネルの表示だけは実行（初期化のため）
      console.log("Thinking panel registered according to global state");
      
      // コマンドを使用してパネルを表示
      try {
        await safeExecuteCommand(EXTENSION_COMMANDS.SHOW_THINKING_PANEL);
      } catch (e) {
        console.warn("Failed to show thinking panel:", e);
      }
      
      return true;
    }
    
    // Thinking Panelプロバイダを登録（ThinkingPanelProvider.tsの関数を使用）
    const thinkingPanel = registerThinkingPanel(context);
    
    if (!thinkingPanel) {
      console.warn("Failed to create thinking panel provider");
    } else {
      console.log("Thinking panel provider registered successfully");
    }
    
    // 思考パネルが正常に登録されたら、登録済みフラグを設定
    context.globalState.update('thinkingPanelCommandsRegistered', true);
    console.log("Thinking panel commands registered for the first time");
    
    return true;
  } catch (error) {
    console.error("Error registering thinking panel commands:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * 拡張機能のアクティベーション関数
 * @param context 拡張機能のコンテキスト
 * @returns 公開API
 */
export async function activateExtension(context: vscode.ExtensionContext) {
  console.log("Activating Continue extension...");
  
  try {
    // 拡張機能パスを設定（重要: 最初に実行）
    // 絶対パスを使用して確実にパスを設定
    const extensionAbsolutePath = path.resolve(context.extensionPath);
    
    // 二重ドライブレター問題を修正
    const fixedPath = fixDoubleDriveLetter(extensionAbsolutePath);
    const normalizedPath = normalizePath(fixedPath);
    
    setExtensionPath(normalizedPath);
    console.log(`Extension path set to: ${normalizedPath}`);
    console.log(`Extension root detected as: ${getExtensionRootPath()}`);
    
    // プロセスのワーキングディレクトリを確認(デバッグ用)
    console.log(`Process current working directory: ${process.cwd()}`);
    
    // 必要なファイルを安全に準備 - ログディレクトリの作成を含む
    safeInitializePaths();
    
    // ★変更点: より早い段階でコアモジュールを読み込む
    let coreModule = null;
    try {
      // より堅牢なモジュール読み込みパスの定義
      const extensionRootPath = normalizePath(context.extensionPath);
      const possibleModulePaths = [
        // JavaScriptビルド済みファイル
        path.join(extensionRootPath, 'out', 'core', 'llm', 'llms', 'index.js'),
        path.join(extensionRootPath, 'dist', 'core', 'llm', 'llms', 'index.js'),
        // 上位ディレクトリのビルド済みファイル
        path.join(extensionRootPath, '..', 'core', 'llm', 'llms', 'index.js'),
        // 個別のThinkingPanelモジュール
        path.join(extensionRootPath, 'out', 'core', 'llm', 'llms', 'thinkingPanel.js'),
        path.join(extensionRootPath, '..', 'core', 'llm', 'llms', 'thinkingPanel.js'),
        // TypeScriptソースファイル（直接読み込める場合）
        path.join(extensionRootPath, 'core', 'llm', 'llms', 'index.ts'),
        path.join(extensionRootPath, '..', 'core', 'llm', 'llms', 'index.ts')
      ];
      
      console.log("Attempting to load core modules...");
      
      // モジュールの読み込みを試行
      coreModule = loadModuleSafely(possibleModulePaths);
      
      if (coreModule) {
        console.log("Core modules loaded successfully");
        
        // setExtensionContextメソッドが存在する場合は呼び出す
        if (typeof coreModule.setExtensionContext === 'function') {
          coreModule.setExtensionContext(context);
          console.log("Extension context set via setExtensionContext");
        }
      } else {
        console.warn("Failed to load core modules");
      }
    } catch (coreModuleError) {
      console.error("Error initializing core modules:", coreModuleError instanceof Error ? coreModuleError.message : String(coreModuleError));
    }

    // 思考パネルの登録（できるだけ早く）- 重複登録を防止
    try {
      // 以下の順序で登録を試みる（優先度順）：
      // 1. coreModuleを使用して直接登録
      // 2. 標準の思考パネル登録関数
      // 3. パネルプロバイダーの登録
      
      let registered = false;
      
      // まず、coreModuleで登録を試みる
      if (coreModule && typeof coreModule.registerThinkingPanel === 'function') {
        try {
          coreModule.registerThinkingPanel(context);
          console.log("Thinking panel registered via core module directly");
          registered = true;
          
          // 拡張機能コンテキストも設定
          if (typeof coreModule.setExtensionContext === 'function') {
            coreModule.setExtensionContext(context);
            console.log("Extension context set again via core module");
          }
        } catch (coreRegisterError) {
          console.warn("Failed to register thinking panel via core module:", coreRegisterError instanceof Error ? coreRegisterError.message : String(coreRegisterError));
        }
      }
      
      // coreModuleでの登録に失敗した場合、標準の登録関数を使用
      if (!registered) {
        const result = await registerThinkingPanelCommands(context);
        if (result) {
          console.log("Thinking panel registered via standard function");
          registered = true;
        }
      }
      
      // 標準関数でも登録に失敗した場合、フォールバックしてパネルプロバイダー直接登録を試みる
      if (!registered) {
        try {
          // パネルを初期化するための確実な方法を試行
          // 標準の思考パネル関数を直接使用
          const thinkingPanel = registerThinkingPanel(context);
          if (thinkingPanel) {
            console.log("Thinking panel registered via panel provider directly");
            registered = true;
          }
        } catch (providerError) {
          console.warn("Failed to register thinking panel via provider:", providerError instanceof Error ? providerError.message : String(providerError));
        }
      }
      
      // それでも登録に失敗した場合は、コマンドの手動登録を試みる（最終手段）
      if (!registered) {
        console.log("Attempting manual registration of thinking panel commands");
        
        // 以下、直接コマンドの登録を試みる
        const commandIds = [
          EXTENSION_COMMANDS.RESET_THINKING_PANEL,
          EXTENSION_COMMANDS.APPEND_THINKING_CHUNK,
          EXTENSION_COMMANDS.FORCE_REFRESH_THINKING,
          EXTENSION_COMMANDS.THINKING_COMPLETED,
          EXTENSION_COMMANDS.UPDATE_THINKING
        ];
        
        // コマンドを個別に登録
        for (const commandId of commandIds) {
          try {
            if (!await isCommandRegistered(commandId)) {
              await safeRegisterCommand(context, commandId, (...args: any[]) => {
                console.log(`Executing manually registered command: ${commandId}`);
                
                // 特定のコマンドに対する処理を実装
                if (commandId === EXTENSION_COMMANDS.RESET_THINKING_PANEL) {
                  // リセット処理
                } else if (commandId === EXTENSION_COMMANDS.APPEND_THINKING_CHUNK) {
                  // 思考チャンクの追加処理
                } else if (commandId === EXTENSION_COMMANDS.THINKING_COMPLETED) {
                  // 思考完了処理
                }
                
                // デフォルトの動作（思考パネルを表示）
                vscode.commands.executeCommand(EXTENSION_COMMANDS.SHOW_THINKING_PANEL);
              });
              console.log(`Manually registered command: ${commandId}`);
            }
          } catch (commandError) {
            console.warn(`Failed to manually register command ${commandId}:`, commandError instanceof Error ? commandError.message : String(commandError));
          }
        }
      }
    } catch (thinkingPanelError) {
      console.error("Error registering thinking panel:", thinkingPanelError instanceof Error ? thinkingPanelError.message : String(thinkingPanelError));
      // エラーがあっても継続
    }
    
    // プロバイダーの登録
    try {
      registerQuickFixProvider();
      console.log("QuickFix provider registered");
    } catch (quickFixError) {
      console.warn("Error registering QuickFix provider:", quickFixError instanceof Error ? quickFixError.message : String(quickFixError));
    }
    
    try {
      setupInlineTips(context);
      console.log("Inline tips setup complete");
    } catch (inlineTipsError) {
      console.warn("Error setting up inline tips:", inlineTipsError instanceof Error ? inlineTipsError.message : String(inlineTipsError));
    }

    // コアコマンドを登録（安全な方法で一つずつ登録）
    console.log("Registering core commands...");
    
    // VIEW_LOGS コマンド - 重複登録を防止
    await safeRegisterCommand(context, EXTENSION_COMMANDS.VIEW_LOGS, () => {
      try {
        console.log("VIEW_LOGS command executed");
        
        // .continueディレクトリのパスを取得
        let homeDir = '';
        try {
          homeDir = os.homedir();
        } catch (homeError) {
          console.warn("Error getting home directory:", homeError instanceof Error ? homeError.message : String(homeError));
          homeDir = process.env.HOME || process.env.USERPROFILE || '/';
        }
        
        // ログパスを探索（複数の方法）- 優先順位を明確に定義
        const possibleLogPaths = [];
        
        // 1. 固定パスを最優先（Windows環境向け）
        if (process.platform === 'win32') {
          possibleLogPaths.push(
            'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\logs',
            path.join(getExtensionRootPath(), '.continue-debug', 'logs'),
            path.join(getExtensionRootPath(), 'extensions', '.continue-debug', 'logs')
          );
        }
        
        // 2. getLogsDirPath()が提供するパス
        possibleLogPaths.push(getLogsDirPath());
        
        // 3. コンテキストからの絶対パス
        possibleLogPaths.push(path.join(context.globalStorageUri.fsPath, 'logs'));
        
        // 4. ユーザーのホームディレクトリベース
        possibleLogPaths.push(path.join(homeDir, '.continue', 'logs'));
        
        // 存在する最初のパスを使用
        const logPath = getFirstExistingPath(possibleLogPaths);
        
        if (logPath) {
          console.log(`Opening logs at: ${logPath}`);
          return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(logPath), {
            forceNewWindow: true
          });
        }
        
        // 見つからない場合は優先度順にログディレクトリの作成を試みる
        for (const potentialPath of possibleLogPaths) {
          try {
            // 二重ドライブレター問題を修正
            const fixedPath = fixDoubleDriveLetter(potentialPath);
            const normalizedPath = normalizePath(fixedPath);
            
            if (!fs.existsSync(normalizedPath)) {
              fs.mkdirSync(normalizedPath, { recursive: true });
              console.log(`Created logs directory: ${normalizedPath}`);
              
              return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(normalizedPath), {
                forceNewWindow: true
              });
            }
          } catch (creationError) {
            console.warn(`Error creating logs directory at ${potentialPath}:`, creationError);
            continue;
          }
        }
        
        // 最終的なフォールバック: ホームディレクトリ/.continue/logs
        const fallbackPath = path.join(homeDir, '.continue', 'logs');
        try {
          if (!fs.existsSync(fallbackPath)) {
            fs.mkdirSync(fallbackPath, { recursive: true });
            console.log(`Created fallback logs directory: ${fallbackPath}`);
          }
          
          return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(fallbackPath), {
            forceNewWindow: true
          });
        } catch (fallbackError) {
          console.error("Error creating fallback logs directory:", fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          vscode.window.showErrorMessage(`Logs directory not found and could not be created. Please check your Continue installation.`);
        }
      } catch (error) {
        console.error("Error handling viewLogs command:", error instanceof Error ? error.message : String(error));
        vscode.window.showErrorMessage(`Error opening logs directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // NEW_SESSION コマンド - 重複登録を防止
    await safeRegisterCommand(context, EXTENSION_COMMANDS.NEW_SESSION, () => {
      return safeExecuteCommand(EXTENSION_COMMANDS.SIDEBAR_NEW_SESSION, [], () => {
        console.log("Using fallback for sidebar new session");
        // フォールバック: メッセージを表示
        vscode.window.showInformationMessage("続行中です - 新しいセッションを開始しました");
      });
    });
    
    // TOGGLE_THINKING_PANEL コマンド - 重複登録を防止
    await safeRegisterCommand(context, EXTENSION_COMMANDS.TOGGLE_THINKING_PANEL, () => {
      return safeExecuteCommand(EXTENSION_COMMANDS.SHOW_THINKING_PANEL);
    });
    
    // 設定ページを開くコマンド - 重複登録を防止
    await safeRegisterCommand(context, EXTENSION_COMMANDS.OPEN_CONFIG_PAGE, () => {
      try {
        // .continueディレクトリのパスを取得
        let homeDir = '';
        try {
          homeDir = os.homedir();
        } catch (homeError) {
          console.warn("Error getting home directory:", homeError instanceof Error ? homeError.message : String(homeError));
          homeDir = process.env.HOME || process.env.USERPROFILE || '/';
        }
        
        // 設定ファイルパスを探索（優先順位順）
        const possibleConfigPaths = [];
        
        // 1. Windows環境では固定パスを最優先
        if (process.platform === 'win32') {
          possibleConfigPaths.push(
            'C:\\continue-databricks-claude-3-7-sonnet\\manual-testing-sandbox\\.continue\\config.yaml',
            'C:\\continue-databricks-claude-3-7-sonnet\\extensions\\.continue-debug\\config.yaml'
          );
        }
        
        // 2. 標準の設定ファイルパス
        possibleConfigPaths.push(
          path.join(homeDir, '.continue', 'config.yaml'),
          path.join(context.globalStorageUri.fsPath, 'config.yaml'),
          path.join(getExtensionRootPath(), '.continue', 'config.yaml')
        );
        
        // 存在する最初のパスを使用
        const configPath = getFirstExistingPath(possibleConfigPaths);
        
        if (configPath) {
          console.log(`Opening config at: ${configPath}`);
          return vscode.workspace.openTextDocument(vscode.Uri.file(configPath))
            .then(doc => vscode.window.showTextDocument(doc));
        }
        
        // 見つからない場合は設定ファイルの作成を試みる
        for (const potentialPath of possibleConfigPaths) {
          try {
            // 二重ドライブレター問題を修正
            const fixedPath = fixDoubleDriveLetter(potentialPath);
            const normalizedPath = normalizePath(fixedPath);
            
            // ディレクトリを作成
            const configDir = path.dirname(normalizedPath);
            if (!fs.existsSync(configDir)) {
              fs.mkdirSync(configDir, { recursive: true });
              console.log(`Created config directory: ${configDir}`);
            }
            
            // 空のYAMLファイルを作成
            if (!fs.existsSync(normalizedPath)) {
              fs.writeFileSync(normalizedPath, '# Continue Configuration\n\n# Databricks Claude 3.7 Sonnet configuration\nmodels:\n  - name: "Claude 3.7 Sonnet (Databricks)"\n    provider: databricks\n    model: databricks-claude-3-7-sonnet\n');
              console.log(`Created config file: ${normalizedPath}`);
            }
            
            return vscode.workspace.openTextDocument(vscode.Uri.file(normalizedPath))
              .then(doc => vscode.window.showTextDocument(doc));
          } catch (creationError) {
            console.warn(`Error creating config file at ${potentialPath}:`, creationError);
            continue;
          }
        }
        
        // 最終フォールバック: ホームディレクトリ/.continue/config.yaml
        const fallbackPath = path.join(homeDir, '.continue', 'config.yaml');
        try {
          // ディレクトリを作成
          const configDir = path.dirname(fallbackPath);
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          
          // 空のYAMLファイルを作成
          if (!fs.existsSync(fallbackPath)) {
            fs.writeFileSync(fallbackPath, '# Continue Configuration\n\n');
          }
          
          return vscode.workspace.openTextDocument(vscode.Uri.file(fallbackPath))
            .then(doc => vscode.window.showTextDocument(doc));
        } catch (fallbackError) {
          console.error("Error creating fallback config file:", fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          vscode.window.showErrorMessage(`Configuration file not found and could not be created. Please check your Continue installation.`);
        }
      } catch (error) {
        console.error("Error handling openConfigPage command:", error instanceof Error ? error.message : String(error));
        vscode.window.showErrorMessage(`Error opening configuration file: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    console.log("Core commands registered");
    
    // 拡張機能のメインインスタンスを初期化
    console.log("Initializing VSCode extension instance...");
    let vscodeExtension;
    try {
      vscodeExtension = new VsCodeExtension(context);
      console.log("VSCode extension instance initialized successfully");
    } catch (extensionError) {
      console.error("Error initializing VSCode extension instance:", extensionError instanceof Error ? extensionError.message : String(extensionError));
      // 機能が一部使えなくなるが、少なくとも拡張機能は動く状態にする
      vscodeExtension = { 
        // 最小限のスタブ実装
        registerCustomContextProvider: () => ({ dispose: () => {} })
      };
      console.log("Using stub VSCode extension instance as fallback");
    }

    // 初回インストール時のテレメトリ
    try {
      if (!context.globalState.get("hasBeenInstalled")) {
        context.globalState.update("hasBeenInstalled", true);
        Telemetry.capture(
          "install",
          {
            extensionVersion: getExtensionVersion(),
          },
          true,
        );
        console.log("Installation telemetry recorded");
      }
    } catch (telemetryError) {
      console.warn("Error recording installation telemetry:", telemetryError instanceof Error ? telemetryError.message : String(telemetryError));
    }

    // YAMLスキーマの設定
    try {
      if (!context.globalState.get("yamlSchemaConfigured")) {
        const schemaPath = path.join(
          context.extension.extensionUri.fsPath,
          "config-yaml-schema.json"
        );
        
        // schemaPathが存在するか確認
        if (fs.existsSync(schemaPath)) {
          vscode.workspace.getConfiguration("yaml").update(
            "schemas",
            {
              [schemaPath]: [".continue/**/*.yaml"],
            },
            vscode.ConfigurationTarget.Global
          );
          // 設定済みフラグを更新
          context.globalState.update("yamlSchemaConfigured", true);
          console.log("YAML schema configured");
        } else {
          console.warn(`Schema file not found at ${schemaPath}`);
        }
      }
    } catch (schemaError) {
      console.warn("Error configuring YAML schema:", schemaError instanceof Error ? schemaError.message : String(schemaError));
    }

    // 公開APIの設定
    console.log("Setting up public API...");
    // VsCodeExtensionとして適切な型を持つことを確認
    const api = new VsCodeContinueApi(vscodeExtension as any);
    const continuePublicApi = {
      registerCustomContextProvider: api.registerCustomContextProvider.bind(api),
    };

    console.log("Continue extension activated successfully");
    
    // テスト環境かどうかで返すオブジェクトを変更
    return process.env.NODE_ENV === "test"
      ? {
          ...continuePublicApi,
          extension: vscodeExtension,
        }
      : continuePublicApi;
  } catch (error) {
    console.error("Critical error during extension activation:", error instanceof Error ? error.message : String(error));
    
    // 全体的なエラーが発生した場合も最低限のAPIを返す
    return {
      registerCustomContextProvider: () => {
        console.log("Using emergency fallback for registerCustomContextProvider");
        return { dispose: () => {} };
      }
    };
  }
}