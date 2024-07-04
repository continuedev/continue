import { ContinueConfig } from "core";
import * as vscode from "vscode";
import { VerticalDiffCodeLens } from "../../diff/verticalPerLine/manager";
import { DiffManager } from "../../diff/horizontal";
import * as providers from "./providers";
import {
  getQuickActionsConfig,
  quickActionsEnabledStatus,
} from "./providers/QuickActionsCodeLensProvider";

export let verticalPerLineCodeLensProvider: vscode.Disposable | undefined =
  undefined;
let diffsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let suggestionsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let configPyCodeLensDisposable: vscode.Disposable | undefined = undefined;
let tutorialCodeLensDisposable: vscode.Disposable | undefined = undefined;
let quickActionsCodeLensDisposable: vscode.Disposable | undefined = undefined;

const { registerCodeLensProvider } = vscode.languages;

export function registerAllCodeLensProviders(
  context: vscode.ExtensionContext,
  diffManager: DiffManager,
  editorToVerticalDiffCodeLens: Map<string, VerticalDiffCodeLens[]>,
  config: ContinueConfig,
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

  if (quickActionsCodeLensDisposable) {
    quickActionsCodeLensDisposable.dispose();
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

  diffsCodeLensDisposable = registerCodeLensProvider(
    "*",
    new providers.DiffViewerCodeLensProvider(diffManager),
  );

  configPyCodeLensDisposable = registerCodeLensProvider(
    "*",
    new providers.ConfigPyCodeLensProvider(),
  );

  tutorialCodeLensDisposable = registerCodeLensProvider(
    "*",
    new providers.TutorialCodeLensProvider(),
  );

  if (quickActionsEnabledStatus()) {
    const quickActionsConfig = getQuickActionsConfig(config);

    quickActionsCodeLensDisposable = registerCodeLensProvider(
      "*",
      new providers.QuickActionsCodeLensProvider(quickActionsConfig),
    );

    context.subscriptions.push(quickActionsCodeLensDisposable);
  }

  context.subscriptions.push(verticalPerLineCodeLensProvider);
  context.subscriptions.push(suggestionsCodeLensDisposable);
  context.subscriptions.push(diffsCodeLensDisposable);
  context.subscriptions.push(configPyCodeLensDisposable);
  context.subscriptions.push(tutorialCodeLensDisposable);

  return { verticalDiffCodeLens, quickActionsCodeLensDisposable };
}
