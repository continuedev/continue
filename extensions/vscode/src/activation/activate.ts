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

/**
 * コマンドが既に登録されているか確認する関数
 * @param commandId 確認するコマンドID
 * @returns 登録済みの場合はtrue
 */
async function isCommandRegistered(commandId: string): Promise<boolean> {
  try {
    const commands = await vscode.commands.getCommands();
    return commands.includes(commandId);
  } catch (error) {
    console.error(`Error checking if command exists: ${error}`);
    return false;
  }
}

/**
 * コマンドを安全に登録する関数
 * @param context 拡張機能のコンテキスト
 * @param commandId コマンドID
 * @param callback コマンドが実行されたときのコールバック
 */
async function safeRegisterCommand(
  context: vscode.ExtensionContext,
  commandId: string,
  callback: (...args: any[]) => any
): Promise<void> {
  try {
    // コマンドが既に登録されているか確認
    const exists = await isCommandRegistered(commandId);
    if (!exists) {
      const disposable = vscode.commands.registerCommand(commandId, callback);
      context.subscriptions.push(disposable);
      console.log(`Registered command: ${commandId}`);
    } else {
      console.log(`Command ${commandId} already exists, skipping registration`);
    }
  } catch (error) {
    console.error(`Error registering command ${commandId}: ${error}`);
  }
}

/**
 * 指定されたモジュールを安全に読み込む関数
 * @param paths モジュールが存在する可能性のあるパスの配列
 * @returns モジュールが見つかればそのモジュールを、見つからなければnullを返す
 */
function loadModuleSafely(paths: string[]): any | null {
  for (const modulePath of paths) {
    try {
      // パスが存在するか確認
      const normalizedPath = normalizePath(modulePath);
      if (fs.existsSync(normalizedPath)) {
        console.log(`Module found at: ${normalizedPath}`);
        // モジュールをrequireで読み込む
        return require(normalizedPath);
      }
    } catch (error) {
      console.log(`Failed to load module from ${modulePath}:`, error);
    }
  }
  return null;
}

export async function activateExtension(context: vscode.ExtensionContext) {
  // Add necessary files
  getTsConfigPath();
  getContinueRcPath();

  // Register commands and providers
  registerQuickFixProvider();
  setupInlineTips(context);
  
  // Register core commands first to ensure they're available
  await Promise.all([
    // コマンドを安全に登録
    safeRegisterCommand(context, 'continue.showThinkingPanel', () => {
      try {
        vscode.commands.executeCommand('continue.forceRefreshThinking', true);
      } catch (error) {
        console.warn("Error showing thinking panel:", error);
      }
    }),
    
    safeRegisterCommand(context, 'continue.viewLogs', () => {
      try {
        const logPath = path.join(context.globalStorageUri.fsPath, 'logs');
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(logPath));
      } catch (error) {
        console.warn("Error viewing logs:", error);
        vscode.window.showErrorMessage(`Could not open logs: ${error.message}`);
      }
    }),
    
    safeRegisterCommand(context, 'continue.newSession', () => {
      try {
        // VsCodeExtension インスタンスから新しいセッションを開始
        vscode.commands.executeCommand('continue.sidebar.newSession');
      } catch (error) {
        console.warn("Error creating new session:", error);
        vscode.window.showErrorMessage(`Could not create new session: ${error.message}`);
      }
    }),
    
    // Thinking Panel関連のコマンドを登録
    safeRegisterCommand(context, 'continue.toggleThinkingPanel', () => {
      vscode.commands.executeCommand('continue.showThinkingPanel');
    })
  ]);
  
  // Register the thinking panel for Claude 3.7 Sonnet
  try {
    registerThinkingPanel(context);
    console.log("ThinkingPanelProvider initialized");
  } catch (error) {
    console.warn("Error initializing thinking panel provider:", error);
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
    
    console.log("Trying to load core module from various paths...");
    
    // モジュールの読み込みを試行
    const coreModule = loadModuleSafely(possibleModulePaths);
    
    if (coreModule) {
      // setExtensionContextメソッドが存在する場合は呼び出す
      if (typeof coreModule.setExtensionContext === 'function') {
        coreModule.setExtensionContext(context);
        console.log("Extension context registered for Claude Thinking Panel functionality");
      } else if (coreModule.registerThinkingPanel && typeof coreModule.registerThinkingPanel === 'function') {
        // registerThinkingPanel関数が利用可能な場合は直接呼び出す
        coreModule.registerThinkingPanel(context);
        console.log("Registered thinking panel through core module");
      } else {
        console.warn("setExtensionContext is not available in core module");
      }
    } else {
      console.warn("Could not load core module from any path");
    }
  } catch (error) {
    console.error("Failed to register extension context:", error);
  }

  const vscodeExtension = new VsCodeExtension(context);

  // Load Continue configuration
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

  // Only set the YAML schema configuration if it hasn't been set before
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
    // Mark that we've configured the YAML schema
    context.globalState.update("yamlSchemaConfigured", true);
  }

  const api = new VsCodeContinueApi(vscodeExtension);
  const continuePublicApi = {
    registerCustomContextProvider: api.registerCustomContextProvider.bind(api),
  };

  // 'export' public api-surface
  // or entire extension for testing
  return process.env.NODE_ENV === "test"
    ? {
        ...continuePublicApi,
        extension: vscodeExtension,
      }
    : continuePublicApi;
}