import { ContinueConfig, ExperimentalConfig } from "core";
import * as vscode from "vscode";
import {
  CONTINUE_WORKSPACE_KEY,
  getContinueWorkspaceConfig,
} from "../../../util/workspaceConfig";

export const ENABLE_QUICK_ACTIONS_KEY = "enableQuickActions";

export function getQuickActionsConfig(config: ContinueConfig) {
  return config.experimental?.quickActions;
}

/**
 * Subscribes to changes in the VSCode Quick Actions settings.
 *
 * This function sets up a listener for configuration changes in VSCode.
 * When a change occurs that affects the Quick Actions settings
 * (specifically the 'enableQuickActions' setting under the Continue workspace),
 * it triggers the provided listener function.
 *
 * @param listener - A function to be called when the Quick Actions settings change.
 */
export function subscribeToVSCodeQuickActionsSettings(listener: Function) {
  vscode.workspace.onDidChangeConfiguration((e) => {
    const configKey = `${CONTINUE_WORKSPACE_KEY}.${ENABLE_QUICK_ACTIONS_KEY}`;

    if (e.affectsConfiguration(configKey)) {
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
 * A CodeLensProvider for Quick Actions in VSCode.
 *
 * This class provides code lenses for Quick Actions, which can be either custom or default actions.
 * It supports actions for functions and classes, and can be configured with custom quick action settings.
 *
 * The provider offers the following functionality:
 * - Filtering symbols to only include functions and classes
 * - Generating custom commands based on provided configurations
 * - Providing default "Explain" and "Docstring" commands
 * - Creating CodeLens objects for each command at the appropriate document ranges
 */
export class QuickActionsCodeLensProvider implements vscode.CodeLensProvider {
  /**
   * Symbol kinds for Quick Actions.
   *
   * Defines which code elements are eligible for Quick Actions:
   * - Functions
   * - Classes
   *
   * Used to filter symbols when providing Quick Actions.
   */
  static quickActionSymbolKinds = [
    vscode.SymbolKind.Function,
    vscode.SymbolKind.Class,
  ];

  customQuickActionsConfig?: ExperimentalConfig["quickActions"];

  constructor(customQuickActionsConfigs?: ExperimentalConfig["quickActions"]) {
    if (customQuickActionsConfigs) {
      this.customQuickActionsConfig = customQuickActionsConfigs;
    }
  }

  getCustomCommands(
    code: string,
    range: vscode.Range,
    quickActionConfigs: NonNullable<ExperimentalConfig["quickActions"]>,
  ): vscode.Command[] {
    return quickActionConfigs.map(({ title, prompt, sendToChat }) => {
      return sendToChat
        ? {
            title,
            command: "continue.customQuickActionSendToChat",
            arguments: [prompt, code],
          }
        : {
            title,
            command: "continue.customQuickActionStreamInlineEdit",
            arguments: [prompt, range],
          };
    });
  }

  getDefaultCommands(code: string, range: vscode.Range): vscode.Command[] {
    const explain: vscode.Command = {
      command: "continue.defaultQuickActionExplain",
      title: "Explain",
      arguments: [code],
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
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return [];
    }

    const symbols = await vscode.commands.executeCommand<
      Array<vscode.DocumentSymbol>
    >("vscode.executeDocumentSymbolProvider", document.uri);

    const filteredSmybols = symbols?.filter((def) =>
      QuickActionsCodeLensProvider.quickActionSymbolKinds.includes(def.kind),
    );

    return filteredSmybols.flatMap(({ range }) => {
      const code = editor.document.getText(range);

      const commands: vscode.Command[] = !!this.customQuickActionsConfig
        ? this.getCustomCommands(code, range, this.customQuickActionsConfig)
        : this.getDefaultCommands(code, range);

      return commands.map((command) => new vscode.CodeLens(range, command));
    });
  }
}
