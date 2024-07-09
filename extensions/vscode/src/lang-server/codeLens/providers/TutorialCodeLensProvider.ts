import * as os from "node:os";
import path from "path";
import * as vscode from "vscode";
import { getPlatform } from "../../../util/util";
import { getExtensionUri } from "../../../util/vscode";

interface TutorialCodeLensItems {
  lineIncludes: string;
  commands: vscode.Command[];
}

const TUTORIAL_FILE_NAME = "continue_tutorial.py";

const cmdCtrl = getPlatform() === "mac" ? "Cmd" : "Ctrl";

const actions: TutorialCodeLensItems[] = [
  {
    lineIncludes: `Step 2: Use the keyboard shortcut [${cmdCtrl}+L]`,
    commands: [
      {
        title: `${cmdCtrl}+L`,
        command: "continue.focusContinueInput",
      },
    ],
  },
  {
    lineIncludes: "Step 3: Ask a question",
    commands: [
      {
        title: `"what does this code do?"`,
        command: "continue.sendMainUserInput",
        arguments: ["what does this code do?"],
      },
      {
        title: `"what is an alternative to this?"`,
        command: "continue.sendMainUserInput",
        arguments: ["what is an alternative to this?"],
      },
    ],
  },
  {
    lineIncludes: `Step 2: Use the keyboard shortcut [${cmdCtrl}+I] to edit`,
    commands: [
      {
        title: `${cmdCtrl}+I`,
        command: "continue.quickEdit",
        arguments: ["Add comments"],
      },
    ],
  },
  {
    lineIncludes: "Step 1: Run this Python file",
    commands: [
      {
        title: "Run the file",
        command: "continue.sendToTerminal",
        arguments: [
          `python ${path.join(
            getExtensionUri().fsPath,
            "continue_tutorial.py",
          )}\n`,
        ],
      },
    ],
  },
  {
    lineIncludes: "Step 2: Use the keyboard shortcut cmd/ctrl + shift + R",
    commands: [
      {
        title: "Debug the error",
        command: "continue.debugTerminal",
      },
    ],
  },
  {
    lineIncludes: `Step 2: Use the keyboard shortcut [${cmdCtrl}+Shift+R]`,
    commands: [
      {
        title: `${cmdCtrl}+Shift+R`,
        command: "continue.debugTerminal",
      },
    ],
  },
];

export function isTutorialFile(uri: vscode.Uri) {
  return uri.fsPath.endsWith(TUTORIAL_FILE_NAME);
}

export class TutorialCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    if (!isTutorialFile(document.uri)) {
      return codeLenses;
    }

    const lines = document.getText().split(os.EOL);

    for (const action of actions) {
      const lineOfAction = lines.findIndex((line) =>
        line.includes(action.lineIncludes),
      );

      if (lineOfAction >= 0) {
        const range = new vscode.Range(lineOfAction, 0, lineOfAction + 1, 0);
        for (const command of action.commands) {
          codeLenses.push(new vscode.CodeLens(range, command));
        }
      }
    }

    const lineOf11 = lines.findIndex((line) =>
      line.includes("Step 1: Highlight the function below"),
    );
    if (lineOf11 >= 0) {
      const range = new vscode.Range(lineOf11, 0, lineOf11 + 1, 0);
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Highlight the function",
          command: "continue.selectRange",
          arguments: [lineOf11 + 3, lineOf11 + 11],
        }),
      );
    }
    const lineOf21 = lines.findIndex((line) =>
      line.includes("Step 1: Highlight this code"),
    );
    if (lineOf21 >= 0) {
      const range = new vscode.Range(lineOf21, 0, lineOf21 + 1, 0);
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Highlight the function",
          command: "continue.selectRange",
          arguments: [lineOf21 + 3, lineOf21 + 14],
        }),
      );
    }

    return codeLenses;
  }
}
