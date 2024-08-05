import { ContinueConfig, QuickActionConfig } from "core";
import * as vscode from "vscode";
import {
  CONTINUE_WORKSPACE_KEY,
  getContinueWorkspaceConfig,
} from "../../../util/workspaceConfig";
import { isTutorialFile } from "./TutorialCodeLensProvider";
import { Telemetry } from "core/util/posthog";
import { QuickEditShowParams } from "../../../quickEdit/QuickEditQuickPick";

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

  customQuickActionsConfig?: QuickActionConfig[];

  constructor(customQuickActionsConfigs?: QuickActionConfig[]) {
    if (customQuickActionsConfigs) {
      this.customQuickActionsConfig = customQuickActionsConfigs;
    }
  }

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

  getSymbolsFrom(symbol: vscode.DocumentSymbol): vscode.DocumentSymbol[] {
    if (symbol.children.length === 0) {
      return [symbol];
    }

    const symbols: vscode.DocumentSymbol[] = [];

    symbols.push(symbol);

    for (const children of symbol.children) {
      if (children.children.length === 0) {
        symbols.push(children);
      } else {
        symbols.push(...this.getSymbolsFrom(children));
      }
    }
    return symbols;
  }

  async getAllSymbols(uri: vscode.Uri) {
    const docSymbols = await vscode.commands.executeCommand<
      Array<vscode.DocumentSymbol> | undefined
    >("vscode.executeDocumentSymbolProvider", uri);

    if (!docSymbols) {
      return [];
    }

    const symbols = docSymbols.flatMap((symbol) => this.getSymbolsFrom(symbol));

    const filteredSmybols = symbols?.filter((def) =>
      this.quickActionSymbolKinds.includes(def.kind),
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

    const symbols = await this.getAllSymbols(document.uri);

    return symbols.flatMap(({ range }) => {
      const commands: vscode.Command[] = !!this.customQuickActionsConfig
        ? this.getCustomCommands(range, this.customQuickActionsConfig)
        : this.getDefaultCommand(range);

      return commands.map((command) => new vscode.CodeLens(range, command));
    });
  }
}
