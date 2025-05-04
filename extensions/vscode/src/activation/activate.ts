import { getContinueRcPath, getTsConfigPath, normalizePath, getLogsDirPath } from "core/util/paths";
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
  SIDEBAR_NEW_SESSION: 'continue.sidebar.newSession'
};

// 既に登録されたコマンドを追跡するセット
const registeredCommands = new Set<string>();

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
    const exists = commands.includes(commandId);
    
    // 登録されていた場合は内部状態も更新
    if (exists) {
      registeredCommands.add(commandId);
    }
    
    return exists;
  } catch (error) {
    console.warn(`Error checking command registration for ${commandId}:`, error);
    return false;
  }
}

/**
 * コマンドを安全に登録する関数 - エラー耐性強化版
 * @param context 拡張機能のコンテキスト
 * @param commandId コマンドID
 * @param callback コマンドが実行されたときのコールバック
 */
async function safeRegisterCommand(
  context: vscode.ExtensionContext,
  commandId: string,
  callback: (...args: any[]) => any
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
    
    // コマンドが既に登録されているか確認
    const exists = await isCommandRegistered(commandId);
    if (!exists) {
      // 登録を試みる
      try {
        const disposable = vscode.commands.registerCommand(commandId, (...args) => {
          try {
            return callback(...args);
          } catch (callbackError) {
            console.error(`Error executing command ${commandId}:`, callbackError);
            // エラーがあってもユーザーに通知しない
            return null;
          }
        });
        context.subscriptions.push(disposable);
        
        // 登録成功を記録
        registeredCommands.add(commandId);
        console.log(`Command ${commandId} registered successfully`);
        return true;
      } catch (registrationError) {
        console.error(`Error registering command ${commandId}:`, registrationError);
        return false;
      }
    } else {
      // 既に存在する場合は成功とみなす
      registeredCommands.add(commandId);
      console.log(`Command ${commandId} already registered in VS Code`);
      return true;
    }
  } catch (error) {
    console.error(`Unexpected error registering command ${commandId}:`, error);
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
      return fallback ? fallback() : null;
    }
    
    // コマンドが登録されているか確認
    const exists = await isCommandRegistered(commandId);
    if (!exists) {
      console.warn(`Command ${commandId} not found, cannot execute`);
      return fallback ? fallback() : null;
    }
    
    return await vscode.commands.executeCommand(commandId, ...args);
  } catch (error) {
    console.error(`Error executing command ${commandId}:`, error);
    // コマンド実行に失敗した場合、フォールバックがあれば実行
    if (fallback) {
      try {
        return fallback();
      } catch (fallbackError) {
        console.error(`Error in fallback for command ${commandId}:`, fallbackError);
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
        normalizedPath = normalizePath(modulePath);
      } catch (normalizationError) {
        console.warn(`Error normalizing path ${modulePath}:`, normalizationError);
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
      console.warn(`Error loading module from ${modulePath}:`, error);
      continue;
    }
  }
  
  if (lastError) {
    console.error("All module loading attempts failed. Last error:", lastError);
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
      console.warn("Error initializing TsConfig path:", tsConfigError);
    }
    
    // ContinueRcを初期化
    try {
      getContinueRcPath();
    } catch (continueRcError) {
      console.warn("Error initializing ContinueRc path:", continueRcError);
    }
    
    // ログディレクトリを確保
    try {
      const logDir = getLogsDirPath();
      console.log(`Log directory initialized: ${logDir}`);
    } catch (logsError) {
      console.warn("Error initializing logs directory:", logsError);
    }
  } catch (error) {
    console.error("Unexpected error during path initialization:", error);
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
      if (fs.existsSync(p)) {
        return p;
      }
    } catch (e) {
      console.warn(`Error checking path existence: ${p}`, e);
    }
  }
  
  return null;
}

/**
 * 拡張機能のアクティベーション関数
 * @param context 拡張機能のコンテキスト
 * @returns 公開API
 */
export async function activateExtension(context: vscode.ExtensionContext) {
  console.log("Activating Continue extension...");
  
  try {
    // 必要なファイルを安全に準備
    safeInitializePaths();

    // プロバイダーの登録
    try {
      registerQuickFixProvider();
      console.log("QuickFix provider registered");
    } catch (quickFixError) {
      console.warn("Error registering QuickFix provider:", quickFixError);
    }
    
    try {
      setupInlineTips(context);
      console.log("Inline tips setup complete");
    } catch (inlineTipsError) {
      console.warn("Error setting up inline tips:", inlineTipsError);
    }
    
    // 思考パネルの登録（できるだけ早く）
    try {
      // 二度登録を避けるフラグ
      if (!context.globalState.get('thinkingPanelRegistered')) {
        registerThinkingPanel(context);
        context.globalState.update('thinkingPanelRegistered', true);
        console.log("Thinking panel registered");
      } else {
        console.log("Thinking panel already registered");
      }
    } catch (thinkingPanelError) {
      console.error("Error registering thinking panel:", thinkingPanelError);
      // エラーがあっても継続
    }
    
    // コアコマンドを登録（安全な方法で一つずつ登録）
    console.log("Registering core commands...");
    
    // サイドバー関連のコマンド - 個別に登録してエラーハンドリングを強化
    await safeRegisterCommand(context, EXTENSION_COMMANDS.SHOW_THINKING_PANEL, () => {
      return safeExecuteCommand(EXTENSION_COMMANDS.FORCE_REFRESH_THINKING, [true]);
    });
    
    // VIEW_LOGS コマンド - エラー耐性を強化
    await safeRegisterCommand(context, EXTENSION_COMMANDS.VIEW_LOGS, () => {
      try {
        console.log("VIEW_LOGS command executed");
        
        // .continueディレクトリのパスを取得
        let homeDir = '';
        try {
          homeDir = os.homedir();
        } catch (homeError) {
          console.warn("Error getting home directory:", homeError);
          homeDir = process.env.HOME || process.env.USERPROFILE || '/';
        }
        
        // ログパスを探索（複数の方法）
        const possibleLogPaths = [
          // 1. paths.tsのgetLogsDirPath()
          getLogsDirPath(), 
          
          // 2. コンテキストからの絶対パス
          path.join(context.globalStorageUri.fsPath, 'logs'),
          
          // 3. ユーザーのホームディレクトリベース
          path.join(homeDir, '.continue', 'logs'),
          
          // 4. 拡張機能のディレクトリを基準
          path.join(context.extensionPath, 'logs')
        ];
        
        // 存在する最初のパスを使用
        const logPath = getFirstExistingPath(possibleLogPaths);
        
        if (logPath) {
          console.log(`Opening logs at: ${logPath}`);
          return vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(logPath), {
            forceNewWindow: true
          });
        }
        
        // 見つからない場合はホームディレクトリ/.continue/logsを作成して開く
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
          console.error("Error creating fallback logs directory:", fallbackError);
          vscode.window.showErrorMessage(`Logs directory not found and could not be created. Please check your Continue installation.`);
        }
      } catch (error) {
        console.error("Error handling viewLogs command:", error);
        vscode.window.showErrorMessage(`Error opening logs directory: ${error.message}`);
      }
    });
    
    await safeRegisterCommand(context, EXTENSION_COMMANDS.NEW_SESSION, () => {
      return safeExecuteCommand(EXTENSION_COMMANDS.SIDEBAR_NEW_SESSION);
    });
    
    await safeRegisterCommand(context, EXTENSION_COMMANDS.TOGGLE_THINKING_PANEL, () => {
      return safeExecuteCommand(EXTENSION_COMMANDS.SHOW_THINKING_PANEL);
    });
    
    // 設定ページを開くコマンド - エラー耐性を強化
    await safeRegisterCommand(context, EXTENSION_COMMANDS.OPEN_CONFIG_PAGE, () => {
      try {
        // .continueディレクトリのパスを取得
        let homeDir = '';
        try {
          homeDir = os.homedir();
        } catch (homeError) {
          console.warn("Error getting home directory:", homeError);
          homeDir = process.env.HOME || process.env.USERPROFILE || '/';
        }
        
        // 設定ファイルパスを探索
        const possibleConfigPaths = [
          path.join(homeDir, '.continue', 'config.yaml'),
          path.join(context.globalStorageUri.fsPath, 'config.yaml'),
          path.join(context.extensionPath, '.continue', 'config.yaml')
        ];
        
        // 存在する最初のパスを使用
        const configPath = getFirstExistingPath(possibleConfigPaths);
        
        if (configPath) {
          console.log(`Opening config at: ${configPath}`);
          return vscode.workspace.openTextDocument(vscode.Uri.file(configPath))
            .then(doc => vscode.window.showTextDocument(doc));
        }
        
        // 見つからない場合はフォールバック
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
          console.error("Error creating fallback config file:", fallbackError);
          vscode.window.showErrorMessage(`Configuration file not found and could not be created. Please check your Continue installation.`);
        }
      } catch (error) {
        console.error("Error handling openConfigPage command:", error);
        vscode.window.showErrorMessage(`Error opening configuration file: ${error.message}`);
      }
    });
    
    console.log("Core commands registered");
    
    // コア系のモジュールからも利用できるように、コンテキストをグローバルに設定
    try {
      // より堅牢なモジュール読み込みパスの定義
      const extensionRootPath = normalizePath(context.extensionPath);
      const possibleModulePaths = [
        // JavaScriptビルド済みファイル
        path.join(extensionRootPath, 'out', 'core', 'llm', 'llms', 'index.js'),
        path.join(extensionRootPath, 'dist', 'core', 'llm', 'llms', 'index.js'),
        // 上位ディレクトリのビルド済みファイル
        path.join(extensionRootPath, '..', 'core', 'llm', 'llms', 'index.js'),
        path.join(extensionRootPath, '..', '..', 'core', 'llm', 'llms', 'index.js'),
        // TypeScriptソースファイル（直接読み込める場合）
        path.join(extensionRootPath, 'core', 'llm', 'llms', 'index.ts'),
        path.join(extensionRootPath, '..', 'core', 'llm', 'llms', 'index.ts'),
        // 個別のThinkingPanelモジュール
        path.join(extensionRootPath, 'out', 'core', 'llm', 'llms', 'thinkingPanel.js'),
        path.join(extensionRootPath, '..', 'core', 'llm', 'llms', 'thinkingPanel.js')
      ];
      
      console.log("Attempting to load core modules...");
      
      // モジュールの読み込みを試行
      const coreModule = loadModuleSafely(possibleModulePaths);
      
      if (coreModule) {
        console.log("Core module loaded successfully");
        
        // setExtensionContextメソッドが存在する場合は呼び出す
        if (typeof coreModule.setExtensionContext === 'function') {
          coreModule.setExtensionContext(context);
          console.log("Extension context set via setExtensionContext");
        } else if (coreModule.registerThinkingPanel && typeof coreModule.registerThinkingPanel === 'function') {
          // registerThinkingPanel関数が利用可能な場合は直接呼び出す
          coreModule.registerThinkingPanel(context);
          console.log("Thinking panel registered via core module");
        } else {
          console.log("Core module loaded but no compatible context methods found");
        }
      } else {
        console.warn("Failed to load core modules");
      }
    } catch (coreModuleError) {
      console.error("Error initializing core modules:", coreModuleError);
    }

    // 拡張機能のメインインスタンスを初期化
    console.log("Initializing VSCode extension instance...");
    let vscodeExtension;
    try {
      vscodeExtension = new VsCodeExtension(context);
      console.log("VSCode extension instance initialized successfully");
    } catch (extensionError) {
      console.error("Error initializing VSCode extension instance:", extensionError);
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
      console.warn("Error recording installation telemetry:", telemetryError);
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
      console.warn("Error configuring YAML schema:", schemaError);
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
    console.error("Critical error during extension activation:", error);
    
    // 全体的なエラーが発生した場合も最低限のAPIを返す
    return {
      registerCustomContextProvider: () => {
        console.log("Using emergency fallback for registerCustomContextProvider");
        return { dispose: () => {} };
      }
    };
  }
}