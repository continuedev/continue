import { ContinueConfig, QuickActionConfig } from "core";
import * as vscode from "vscode";
import {
  CONTINUE_WORKSPACE_KEY,
  getContinueWorkspaceConfig,
} from "../../../util/workspaceConfig";
import { isTutorialFile } from "./TutorialCodeLensProvider";
import { Telemetry } from "core/util/posthog";

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
   * Right now, we only allow functions, methods and classes
   * to keep things simple.
   */
  static quickActionSymbolKinds = [
    vscode.SymbolKind.Function,
    vscode.SymbolKind.Method,
    vscode.SymbolKind.Class,
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

  getDefaultCommands(range: vscode.Range): vscode.Command[] {
    const explain: vscode.Command = {
      command: "continue.defaultQuickActionExplain",
      title: "Explain",
      arguments: [range],
    };

    const comment: vscode.Command = {
      command: "continue.defaultQuickActionDocstring",
      title: "Docstring",
      arguments: [range],
    };

    return [explain, comment];
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

    const symbols = await vscode.commands.executeCommand<
      Array<vscode.DocumentSymbol> | undefined
    >("vscode.executeDocumentSymbolProvider", document.uri);

    if (!symbols) {
      return [];
    }

    const filteredSmybols = symbols?.filter((def) =>
      QuickActionsCodeLensProvider.quickActionSymbolKinds.includes(def.kind),
    );

    return filteredSmybols.flatMap(({ range }) => {
      const commands: vscode.Command[] = !!this.customQuickActionsConfig
        ? this.getCustomCommands(range, this.customQuickActionsConfig)
        : this.getDefaultCommands(range);

      return commands.map((command) => new vscode.CodeLens(range, command));
    });
  }
}
