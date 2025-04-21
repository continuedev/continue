import { ContinueConfig } from "core";
import * as vscode from "vscode";

import { VerticalDiffCodeLens } from "../../diff/vertical/manager";

import * as providers from "./providers";
import {
  getQuickActionsConfig,
  quickActionsEnabledStatus,
  subscribeToVSCodeQuickActionsSettings,
} from "./providers/QuickActionsCodeLensProvider";

const { registerCodeLensProvider } = vscode.languages;

export let verticalPerLineCodeLensProvider: vscode.Disposable | undefined =
  undefined;
let diffsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let suggestionsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let configPyCodeLensDisposable: vscode.Disposable | undefined = undefined;
let tutorialCodeLensDisposable: vscode.Disposable | undefined = undefined;
let quickActionsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let downloadYamlExtensionCodeLensDisposable: vscode.Disposable | undefined =
  undefined;

/**
 * Registers the Quick Actions CodeLens provider if Quick Actions are enabled.
 *
 * This function checks if Quick Actions are enabled in the VSCode workspace settings,
 * and if so, it registers a new QuickActionsCodeLensProvider. If the user has custom
 * actions defined in their config, it initiaizes the provider with these actions.
 *
 * If a previous provider was registered, it is disposed of before the new one is created.
 *
 * @param config - The Continue configuration object
 * @param context - The VS Code extension context
 */
function registerQuickActionsProvider(
  config: ContinueConfig,
  context: vscode.ExtensionContext,
) {
  if (quickActionsCodeLensDisposable) {
    quickActionsCodeLensDisposable.dispose();
  }

  if (quickActionsEnabledStatus()) {
    const quickActionsConfig = getQuickActionsConfig(config);

    quickActionsCodeLensDisposable = registerCodeLensProvider(
      "*",
      new providers.QuickActionsCodeLensProvider(quickActionsConfig),
    );

    context.subscriptions.push(quickActionsCodeLensDisposable);
  }
}

/**
 * Registers all CodeLens providers for the Continue extension.
 *
 * This function disposes of any existing CodeLens providers and registers new ones for:
 * - Vertical per-line diffs
 * - Suggestions
 * - Diff viewer
 * - Config.py
 * - Tutorial
 * - Quick Actions
 *
 * It also sets up a subscription to VS Code Quick Actions settings changes.
 *
 * @param context - The VS Code extension context
 * @param editorToVerticalDiffCodeLens - A Map of editor IDs to VerticalDiffCodeLens arrays
 * @param config - The Continue configuration object
 *
 * @returns An object containing the verticalDiffCodeLens provider
 */
export function registerAllCodeLensProviders(
  context: vscode.ExtensionContext,
  editorToVerticalDiffCodeLens: Map<string, VerticalDiffCodeLens[]>,
  config: ContinueConfig | undefined,
) {
  if (verticalPerLineCodeLensProvider) {
    verticalPerLineCodeLensProvider.dispose();
  }

  if (suggestionsCodeLensDisposable) {
    suggestionsCodeLensDisposable.dispose();
  }

  if (diffsCodeLensDisposable) {
    diffsCodeLensDisposable.dispose();
  }

  if (configPyCodeLensDisposable) {
    configPyCodeLensDisposable.dispose();
  }

  if (tutorialCodeLensDisposable) {
    tutorialCodeLensDisposable.dispose();
  }

  if (downloadYamlExtensionCodeLensDisposable) {
    downloadYamlExtensionCodeLensDisposable.dispose();
  }

  const verticalDiffCodeLens = new providers.VerticalPerLineCodeLensProvider(
    editorToVerticalDiffCodeLens,
  );

  verticalPerLineCodeLensProvider = registerCodeLensProvider(
    "*",
    verticalDiffCodeLens,
  );

  suggestionsCodeLensDisposable = registerCodeLensProvider(
    "*",
    new providers.SuggestionsCodeLensProvider(),
  );

  downloadYamlExtensionCodeLensDisposable = registerCodeLensProvider(
    "yaml",
    new providers.DownloadYamlExtensionCodeLensProvider(),
  );

  if (config) {
    registerQuickActionsProvider(config, context);

    subscribeToVSCodeQuickActionsSettings(() =>
      registerQuickActionsProvider(config, context),
    );
  }

  context.subscriptions.push(verticalPerLineCodeLensProvider);
  context.subscriptions.push(suggestionsCodeLensDisposable);

  return { verticalDiffCodeLens };
}
