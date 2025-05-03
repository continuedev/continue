import { getContinueRcPath, getTsConfigPath } from "core/util/paths";
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
 * Tries to load a module from multiple possible paths
 * @param basePaths Array of base paths to try
 * @param modulePath Relative path to the module
 * @returns The module if found, or null if not found
 */
function tryLoadModule(basePaths: string[], modulePath: string): any | null {
  for (const basePath of basePaths) {
    try {
      const fullPath = path.join(basePath, modulePath);
      
      // パスが存在するか確認
      if (fs.existsSync(fullPath)) {
        console.log(`Module found at: ${fullPath}`);
        return require(fullPath);
      }
    } catch (e) {
      console.log(`Failed to load module from ${path.join(basePath, modulePath)}:`, e);
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
  // Register showThinkingPanel command explicitly
  context.subscriptions.push(
    vscode.commands.registerCommand('continue.showThinkingPanel', () => {
      try {
        vscode.commands.executeCommand('continue.forceRefreshThinking', true);
      } catch (error) {
        console.warn("Error showing thinking panel:", error);
      }
    }),
    
    vscode.commands.registerCommand('continue.viewLogs', () => {
      try {
        const logPath = path.join(context.globalStorageUri.fsPath, 'logs');
        vscode.commands.executeCommand('workbench.action.openFolder', vscode.Uri.file(logPath));
      } catch (error) {
        console.warn("Error viewing logs:", error);
        vscode.window.showErrorMessage(`Could not open logs: ${error.message}`);
      }
    }),
    
    vscode.commands.registerCommand('continue.newSession', () => {
      try {
        // VsCodeExtension インスタンスから新しいセッションを開始
        vscode.commands.executeCommand('continue.sidebar.newSession');
      } catch (error) {
        console.warn("Error creating new session:", error);
        vscode.window.showErrorMessage(`Could not create new session: ${error.message}`);
      }
    })
  );
  
  // Register the thinking panel for Claude 3.7 Sonnet
  registerThinkingPanel(context);
  
  // コア系のモジュールからも利用できるように、コンテキストをグローバルに設定
  try {
    // 複数の可能性のあるパスを定義
    const possibleBasePaths = [
      context.extensionPath,                         // 通常のパス
      path.resolve(context.extensionPath, '..'),     // 1レベル上
      path.resolve(context.extensionPath, '..', '..'), // 2レベル上
      path.resolve(context.extensionPath, '..', '..', '..') // 3レベル上
    ];
    
    // 複数の可能性のあるモジュールパスを定義
    const possibleModulePaths = [
      path.join('core', 'llm', 'llms', 'index.js'),
      path.join('extensions', 'vscode', 'core', 'llm', 'llms', 'index.js'),
      path.join('core', 'llm', 'llms', 'index.ts'),
      path.join('extensions', 'vscode', 'core', 'llm', 'llms', 'index.ts')
    ];
    
    console.log("Trying to load core module from various paths...");
    
    // すべての可能性のある組み合わせを試す
    let coreModule = null;
    for (const modulePath of possibleModulePaths) {
      coreModule = tryLoadModule(possibleBasePaths, modulePath);
      if (coreModule) {
        console.log(`Successfully loaded core module from ${modulePath}`);
        break;
      }
    }
    
    if (!coreModule) {
      // 最後の手段として、直接ソースディレクトリからみる
      const directSourcePath = path.resolve(context.extensionPath, '..', '..', 'core', 'llm', 'llms', 'Databricks.js');
      if (fs.existsSync(directSourcePath)) {
        console.log(`Using direct source path: ${directSourcePath}`);
        coreModule = require(directSourcePath);
      }
    }
    
    if (coreModule && typeof coreModule.setExtensionContext === 'function') {
      coreModule.setExtensionContext(context);
      console.log("Databricks extension context registered for Claude Thinking Panel functionality");
    } else {
      console.warn("setExtensionContext is not available in core module");
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

  // Register additional command for toggling the thinking panel
  context.subscriptions.push(
    vscode.commands.registerCommand('continue.toggleThinkingPanel', () => {
      vscode.commands.executeCommand('continue.showThinkingPanel');
    })
  );

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