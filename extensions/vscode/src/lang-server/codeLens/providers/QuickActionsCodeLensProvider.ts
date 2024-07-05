import { ContinueConfig, ExperimentalConfig } from "core";
import * as vscode from "vscode";
import {
  CONTINUE_WORKSPACE_KEY,
  continueWorkspaceConfig,
} from "../../../util/workspaceConfig";

export const ENABLE_QUICK_ACTIONS_KEY = "enableQuickActions";

export function getQuickActionsConfig(config: ContinueConfig) {
  return config.experimental?.quickActions;
}

export function subscribeToQuickActionsSettings(
  disposable?: vscode.Disposable,
) {
  vscode.workspace.onDidChangeConfiguration((e) => {
    const configKey = `${CONTINUE_WORKSPACE_KEY}.${ENABLE_QUICK_ACTIONS_KEY}`;

    if (e.affectsConfiguration(configKey) && !quickActionsEnabledStatus()) {
      debugger;
      disposable?.dispose();
    }
  });
}

export function toggleQuickActions() {
  const curStatus = quickActionsEnabledStatus();

  continueWorkspaceConfig.update(ENABLE_QUICK_ACTIONS_KEY, curStatus);
}

export function quickActionsEnabledStatus() {
  return continueWorkspaceConfig.get<boolean>(ENABLE_QUICK_ACTIONS_KEY);
}

export class QuickActionsCodeLensProvider implements vscode.CodeLensProvider {
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
