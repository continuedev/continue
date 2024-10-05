import * as os from "node:os";
import path from "path";
import * as vscode from "vscode";
import { getPlatform } from "../../../util/util";
import { getExtensionUri } from "../../../util/vscode";
import { QuickEditShowParams } from "../../../quickEdit/QuickEditQuickPick";

interface TutorialCodeLensItems {
  lineIncludes: string;
  commands: vscode.Command[];
}

const TUTORIAL_FILE_NAME = "pearai_tutorial.py";

const cmdCtrl = getPlatform() === "mac" ? "Cmd" : "Ctrl";

const actions: TutorialCodeLensItems[] = [
  {
    lineIncludes: `Step 2: Use the keyboard shortcut [${cmdCtrl}+L]`,
    commands: [
      {
        title: `${cmdCtrl}+L`,
        command: "pearai.focusContinueInput",
      },
    ],
  },
  {
    lineIncludes: "Step 3: Ask a question",
    commands: [
      {
        title: `"what does this code do?"`,
        command: "pearai.sendMainUserInput",
        arguments: ["what does this code do?"],
      },
      {
        title: `"what is an alternative to this?"`,
        command: "pearai.sendMainUserInput",
        arguments: ["what is an alternative to this?"],
      },
    ],
  },
  {
    lineIncludes: `Step 2: Use the keyboard shortcut [${cmdCtrl}+I] to edit`,
    commands: [
      {
        title: `${cmdCtrl}+I`,
        command: "pearai.quickEdit",
        arguments: [{ initialPrompt: "Add comments" } as QuickEditShowParams],
      },
    ],
  },
  {
    lineIncludes: "Step 1: Run this Python file",
    commands: [
      {
        title: "Run the file",
        command: "pearai.sendToTerminal",
        arguments: [
          `python ${path.join(
            getExtensionUri().fsPath,
            "pearai_tutorial.py",
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
        command: "pearai.debugTerminal",
      },
    ],
  },
  {
    lineIncludes: `Step 2: Use the keyboard shortcut [${cmdCtrl}+Shift+R]`,
    commands: [
      {
        title: `${cmdCtrl}+Shift+R`,
        command: "pearai.debugTerminal",
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

    const lineOf10 = lines.findIndex((line) =>
      line.includes("Step 1: Highlight the function below"),
    );
    if (lineOf10 >= 0) {
      const range = new vscode.Range(lineOf10, 0, lineOf10 + 1, 0);
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Highlight the function",
          command: "pearai.selectRange",
          arguments: [lineOf10 + 1, lineOf10 + 8],
        }),
      );
    }
    const lineOf30 = lines.findIndex((line) =>
      line.includes("Step 1: Highlight this code"),
    );
    if (lineOf30 >= 0) {
      const range = new vscode.Range(lineOf30, 0, lineOf30 + 1, 0);
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Highlight the function",
          command: "pearai.selectRange",
          arguments: [lineOf30 + 1, lineOf30 + 12],
        }),
      );
    }

    // Folding of the tutorial
    // const regionLines = lines
    //   .map((line, i) => [line, i])
    //   .filter(([line, i]) => (line as string).startsWith("# region "))
    //   .map(([line, i]) => i);
    // for (const lineOfRegion of regionLines as number[]) {
    //   const range = new vscode.Range(lineOfRegion, 0, lineOfRegion + 1, 0);

    //   const linesToFold = regionLines
    //     .filter((i) => lineOfRegion !== i)
    //     .flatMap((i) => {
    //       return [i, (i as number) + 1];
    //     });
    //   codeLenses.push(
    //     new vscode.CodeLens(range, {
    //       title: `Begin Section`,
    //       command: "pearai.foldAndUnfold",
    //       arguments: [linesToFold, [lineOfRegion, lineOfRegion + 1]],
    //     }),
    //   );
    // }

    return codeLenses;
  }
}
