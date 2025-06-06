import { ContinueConfig, QuickActionConfig } from "core";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";

import { QuickEditShowParams } from "../../../quickEdit/QuickEditQuickPick";
import { isTutorialFile } from "../../../util/tutorial";
import {
  CONTINUE_WORKSPACE_KEY,
  getContinueWorkspaceConfig,
} from "../../../util/workspaceConfig";

export const ENABLE_QUICK_ACTIONS_KEY = "enableQuickActions";

export function getQuickActionsConfig(config: ContinueConfig) {
  return config.experimental?.quickActions;
}

export function subscribeToVSCodeQuickActionsSettings(listener: Function) {
  vscode.workspace.onDidChangeConfiguration((e) => {
    const configKey = `${CONTINUE_WORKSPACE_KEY}.${ENABLE_QUICK_ACTIONS_KEY}`;

    if (e.affectsConfiguration(configKey)) {
      Telemetry.capture("VSCode Quick Actions Settings Changed", {
        enabled: quickActionsEnabledStatus(),
      });

      listener();
    }
  });
}

export function toggleQuickActions() {
  const curStatus = quickActionsEnabledStatus();

  getContinueWorkspaceConfig().update(ENABLE_QUICK_ACTIONS_KEY, curStatus);
}

export function quickActionsEnabledStatus() {
  return getContinueWorkspaceConfig().get<boolean>(ENABLE_QUICK_ACTIONS_KEY);
}

/**
 * A CodeLensProvider for Quick Actions.
 *
 * This class provides code lenses for Quick Actions, which can be either custom or default actions.
 * It supports actions for functions and classes, and can be configured with custom quick action settings.
 */
export class QuickActionsCodeLensProvider implements vscode.CodeLensProvider {
  /**
   * Defines which code elements are eligible for Quick Actions.
   *
   * Right now, we only allow functions, methods, constructors
   * and classes to keep things simple.
   */
  quickActionSymbolKinds = [
    vscode.SymbolKind.Function,
    vscode.SymbolKind.Method,
    vscode.SymbolKind.Class,
    vscode.SymbolKind.Constructor,
  ];

  constructor(private customQuickActionsConfigs?: QuickActionConfig[]) {}

  getCustomCommands(
    range: vscode.Range,
    quickActionConfigs: QuickActionConfig[],
  ): vscode.Command[] {
    return quickActionConfigs.map(({ title, prompt, sendToChat }) => {
      return sendToChat
        ? {
            title,
            command: "continue.customQuickActionSendToChat",
            arguments: [prompt, range],
          }
        : {
            title,
            command: "continue.customQuickActionStreamInlineEdit",
            arguments: [prompt, range],
          };
    });
  }

  getDefaultCommand(range: vscode.Range): vscode.Command[] {
    const quickEdit: vscode.Command = {
      command: "continue.defaultQuickAction",
      title: "Continue",
      arguments: [{ range } as QuickEditShowParams],
    };

    return [quickEdit];
  }

  /**
   * Get all top-level symbols and their immediate children.
   * We do not recurse through all children to avoid noise.
   */
  async getTopLevelAndChildrenSymbols(uri: vscode.Uri) {
    const topLevelSymbols = await vscode.commands.executeCommand<
      Array<vscode.DocumentSymbol> | undefined
    >("vscode.executeDocumentSymbolProvider", uri);

    if (!topLevelSymbols) {
      return [];
    }

    const childrenSymbols = topLevelSymbols.flatMap(
      (symbol) => symbol.children,
    );

    const symbols = [...topLevelSymbols, ...childrenSymbols];

    const filteredSmybols = symbols?.filter(
      (symbol) =>
        this.quickActionSymbolKinds.includes(symbol.kind) &&
        !symbol.range.isSingleLine,
    );

    return filteredSmybols;
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
  ): Promise<vscode.CodeLens[]> {
    // The tutorial file already has a lot of Code Lenses
    // so we don't want to add more to it.
    if (isTutorialFile(document.uri)) {
      return [];
    }

    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return [];
    }

    const symbols = await this.getTopLevelAndChildrenSymbols(document.uri);

    return symbols.flatMap(({ range }) => {
      const commands: vscode.Command[] = !!this.customQuickActionsConfigs
        ? this.getCustomCommands(range, this.customQuickActionsConfigs)
        : this.getDefaultCommand(range);

      return commands.map((command) => new vscode.CodeLens(range, command));
    });
  }
}
