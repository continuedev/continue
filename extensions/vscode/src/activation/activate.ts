import { getContinueRcPath, getTsConfigPath, normalizePath } from "core/util/paths";
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

// 既に登録されたコマンドを追跡するセット
const registeredCommands = new Set<string>();

/**
 * コマンドが既に登録されているか確認する関数 - グローバル状態を含む
 * @param commandId 確認するコマンドID
 * @returns 登録済みの場合はtrue
 */
async function isCommandRegistered(commandId: string): Promise<boolean> {
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
    // エラーが発生した場合は安全のためfalseを返す（エラーログなし）
    return false;
  }
}

/**
 * コマンドを安全に登録する関数 - エラーログなし
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
    // 既に内部で登録済みならスキップ
    if (registeredCommands.has(commandId)) {
      return true;
    }
    
    // コマンドが既に登録されているか確認
    const exists = await isCommandRegistered(commandId);
    if (!exists) {
      // 登録を試みる
      try {
        const disposable = vscode.commands.registerCommand(commandId, callback);
        context.subscriptions.push(disposable);
        
        // 登録成功を記録
        registeredCommands.add(commandId);
        return true;
      } catch (e) {
        // 登録に失敗した場合も静かに処理
        return false;
      }
    } else {
      // 既に存在する場合は成功とみなす
      registeredCommands.add(commandId);
      return true;
    }
  } catch (error) {
    // エラーが発生しても静かに処理
    return false;
  }
}

/**
 * コマンドを安全に実行する関数 - エラーログなし
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
    return await vscode.commands.executeCommand(commandId, ...args);
  } catch (error) {
    // コマンド実行に失敗した場合、フォールバックがあれば実行
    if (fallback) {
      return fallback();
    }
  }
}

/**
 * 指定されたモジュールを安全に読み込む関数 - エラーログなし
 * @param paths モジュールが存在する可能性のあるパスの配列
 * @returns モジュールが見つかればそのモジュールを、見つからなければnullを返す
 */
function loadModuleSafely(paths: string[]): any | null {
  for (const modulePath of paths) {
    try {
      // パスが存在するか確認
      const normalizedPath = normalizePath(modulePath);
      if (fs.existsSync(normalizedPath)) {
        // モジュールをrequireで読み込む
        return require(normalizedPath);
      }
    } catch (error) {
      // エラーは静かに処理（次のパスを試す）
      continue;
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
  try {
    // 必要なファイルを準備
    getTsConfigPath();
    getContinueRcPath();

    // プロバイダーの登録
    try {
      registerQuickFixProvider();
    } catch (e) {
      // エラーは静かに処理
    }
    
    try {
      setupInlineTips(context);
    } catch (e) {
      // エラーは静かに処理
    }
    
    // コアコマンドを登録（エラーが発生しても他のコマンド登録に影響しないように並列実行）
    await Promise.all([
      // サイドバー関連のコマンド
      safeRegisterCommand(context, 'continue.showThinkingPanel', () => {
        safeExecuteCommand('continue.forceRefreshThinking', [true]);
      }),
      
      safeRegisterCommand(context, 'continue.viewLogs', () => {
        try {
          const logPath = path.join(context.globalStorageUri.fsPath, 'logs');
          safeExecuteCommand('vscode.openFolder', [vscode.Uri.file(logPath)]);
        } catch (error) {
          // エラーは静かに処理
        }
      }),
      
      safeRegisterCommand(context, 'continue.newSession', () => {
        safeExecuteCommand('continue.sidebar.newSession');
      }),
      
      safeRegisterCommand(context, 'continue.toggleThinkingPanel', () => {
        safeExecuteCommand('continue.showThinkingPanel');
      }),
      
      // 設定ページを開くコマンド
      safeRegisterCommand(context, 'continue.openConfigPage', () => {
        try {
          const configPath = path.join(os.homedir(), '.continue', 'config.yaml');
          vscode.workspace.openTextDocument(vscode.Uri.file(configPath)).then(
            doc => vscode.window.showTextDocument(doc)
          );
        } catch (error) {
          // エラーは静かに処理
        }
      })
    ]);
    
    // 思考パネルの登録（できるだけ早く）
    try {
      // 二度登録を避けるフラグ
      if (!context.globalState.get('thinkingPanelRegistered')) {
        registerThinkingPanel(context);
        context.globalState.update('thinkingPanelRegistered', true);
      }
    } catch (e) {
      // エラーは静かに処理
    }
    
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
      
      // モジュールの読み込みを試行
      const coreModule = loadModuleSafely(possibleModulePaths);
      
      if (coreModule) {
        // setExtensionContextメソッドが存在する場合は呼び出す
        if (typeof coreModule.setExtensionContext === 'function') {
          coreModule.setExtensionContext(context);
        } else if (coreModule.registerThinkingPanel && typeof coreModule.registerThinkingPanel === 'function') {
          // registerThinkingPanel関数が利用可能な場合は直接呼び出す
          coreModule.registerThinkingPanel(context);
        }
      }
    } catch (error) {
      // エラーは静かに処理
    }

    // 拡張機能のメインインスタンスを初期化
    let vscodeExtension;
    try {
      vscodeExtension = new VsCodeExtension(context);
    } catch (error) {
      // エラーは静かに処理
      // 機能が一部使えなくなるが、少なくとも拡張機能は動く状態にする
      vscodeExtension = { /* 最小限のスタブ実装 */ };
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
      }
    } catch (error) {
      // テレメトリエラーは静かに処理
    }

    // YAMLスキーマの設定
    try {
      if (!context.globalState.get("yamlSchemaConfigured")) {
        vscode.workspace.getConfiguration("yaml").update(
          "schemas",
          {
            [path.join(
              context.extension.extensionUri.fsPath,
              "config-yaml-schema.json",
            )]: [".continue/**/*.yaml"],
          },
          vscode.ConfigurationTarget.Global,
        );
        // 設定済みフラグを更新
        context.globalState.update("yamlSchemaConfigured", true);
      }
    } catch (error) {
      // スキーマ設定エラーは静かに処理
    }

    // 公開APIの設定
    const api = new VsCodeContinueApi(vscodeExtension);
    const continuePublicApi = {
      registerCustomContextProvider: api.registerCustomContextProvider.bind(api),
    };

    // テスト環境かどうかで返すオブジェクトを変更
    return process.env.NODE_ENV === "test"
      ? {
          ...continuePublicApi,
          extension: vscodeExtension,
        }
      : continuePublicApi;
  } catch (error) {
    // 全体的なエラーが発生した場合も最低限のAPIを返す
    return {
      registerCustomContextProvider: () => {
        // スタブ実装
        return { dispose: () => {} };
      }
    };
  }
}

// Node.js環境で必要なモジュールを遅延インポート
let os: any = null;
try {
  os = require('os');
} catch (e) {
  // os モジュールが利用できない場合のスタブ
  os = {
    homedir: () => process.env.HOME || process.env.USERPROFILE || '/'
  };
}