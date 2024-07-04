import { ContinueConfig, ExperimentalConfig } from "core";
import * as vscode from "vscode";

export function getQuickActionsConfig(config: ContinueConfig) {
  return config.experimental?.quickActions;
}

export function toggleQuickActions() {
  const curStatus = quickActionsEnabledStatus();

  vscode.workspace
    .getConfiguration("continue")
    .update("enableQuickActions", curStatus);
}

export function quickActionsEnabledStatus() {
  return vscode.workspace
    .getConfiguration("continue")
    .get<boolean>("enableQuickActions");
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
      command: "continue.quickActionExplain",
      title: "Explain",
      arguments: [code],
    };

    const comment: vscode.Command = {
      command: "continue.quickActionComment",
      title: "Comment",
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
