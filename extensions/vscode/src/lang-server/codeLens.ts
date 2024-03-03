import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { DIFF_DIRECTORY, DiffManager } from "../diff/horizontal";
import { VerticalDiffCodeLens } from "../diff/verticalPerLine/manager";
import { editorSuggestionsLocked, editorToSuggestions } from "../suggestions";
import { getMetaKeyLabel } from "../util/util";
import { getExtensionUri } from "../util/vscode";

class VerticalPerLineCodeLensProvider implements vscode.CodeLensProvider {
  constructor(
    private readonly editorToVerticalDiffCodeLens: Map<
      string,
      VerticalDiffCodeLens[]
    >,
  ) {}

  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const filepath = document.uri.fsPath;
    const blocks = this.editorToVerticalDiffCodeLens.get(filepath);
    if (!blocks) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const start = new vscode.Position(block.start, 0);
      const range = new vscode.Range(
        start,
        start.translate(block.numGreen + block.numRed),
      );
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Accept",
          command: "continue.acceptVerticalDiffBlock",
          arguments: [filepath, i],
        }),
        new vscode.CodeLens(range, {
          title: "Reject",
          command: "continue.rejectVerticalDiffBlock",
          arguments: [filepath, i],
        }),
      );
      if (codeLenses.length === 2) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `(${getMetaKeyLabel()}⇧↩/${getMetaKeyLabel()}⇧⌫ to accept/reject all, ${getMetaKeyLabel()}I to retry)`,
            command: "",
          }),
        );
      }
    }

    return codeLenses;
  }
}

class SuggestionsCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const suggestions = editorToSuggestions.get(document.uri.toString());
    if (!suggestions) {
      return [];
    }
    const locked = editorSuggestionsLocked.get(document.uri.fsPath.toString());

    const codeLenses: vscode.CodeLens[] = [];
    for (const suggestion of suggestions) {
      const range = new vscode.Range(
        suggestion.oldRange.start,
        suggestion.newRange.end,
      );
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "Accept",
          command: "continue.acceptSuggestion",
          arguments: [suggestion],
        }),
        new vscode.CodeLens(range, {
          title: "Reject",
          command: "continue.rejectSuggestion",
          arguments: [suggestion],
        }),
      );
      if (codeLenses.length === 2) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `(${getMetaKeyLabel()}⇧↩/${getMetaKeyLabel()}⇧⌫ to accept/reject all)`,
            command: "",
          }),
        );
      }
    }

    return codeLenses;
  }
}

class DiffViewerCodeLensProvider implements vscode.CodeLensProvider {
  diffManager: DiffManager;

  constructor(diffManager: DiffManager) {
    this.diffManager = diffManager;
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (path.dirname(document.uri.fsPath) === DIFF_DIRECTORY) {
      const codeLenses: vscode.CodeLens[] = [];
      let range = new vscode.Range(0, 0, 1, 0);
      const diffInfo = this.diffManager.diffAtNewFilepath(document.uri.fsPath);
      if (diffInfo) {
        range = diffInfo.range;
      }
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `Accept All ✅ (${getMetaKeyLabel()}⇧↩)`,
          command: "continue.acceptDiff",
          arguments: [document.uri.fsPath],
        }),
        new vscode.CodeLens(range, {
          title: `Reject All ❌ (${getMetaKeyLabel()}⇧⌫)`,
          command: "continue.rejectDiff",
          arguments: [document.uri.fsPath],
        }),
        // new vscode.CodeLens(range, {
        //   title: `Further Edit ✏️ (${getMetaKeyLabel()}⇧M)`,
        //   command: "continue.focusContinueInputWithEdit",
        // })
      );
      return codeLenses;
    } else {
      return [];
    }
  }
}

class ConfigPyCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    if (
      !document.uri.fsPath.endsWith(".continue/config.json") &&
      !document.uri.fsPath.endsWith(".continue\\config.json")
    ) {
      return codeLenses;
    }

    const lines = document.getText().split(os.EOL);
    let lineOfModels = lines.findIndex((line) => line.includes('"models": ['));

    if (lineOfModels >= 0) {
      const range = new vscode.Range(lineOfModels, 0, lineOfModels + 1, 0);
      // codeLenses.push(
      //   new vscode.CodeLens(range, {
      //     title: `+ Add a Model`,
      //     command: "continue.addModel",
      //   })
      // );
    }

    const lineOfSystemMessage = lines.findIndex((line) =>
      line.includes("ContinueConfig("),
    );

    if (lineOfSystemMessage >= 0) {
      const range = new vscode.Range(
        lineOfSystemMessage,
        0,
        lineOfSystemMessage + 1,
        0,
      );
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `✏️ Edit in UI`,
          command: "continue.openSettingsUI",
        }),
      );
    }

    return codeLenses;
  }
}

interface TutorialCodeLensItems {
  lineIncludes: string;
  commands: vscode.Command[];
}
const actions: TutorialCodeLensItems[] = [
  {
    lineIncludes: "Step 2: Use the keyboard shortcut cmd/ctrl + M",
    commands: [
      {
        title: `Do it for me`,
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
    lineIncludes: 'Step 3: Type "<your edit request>" and press Enter',
    commands: [
      {
        title: `"/edit make this more efficient"`,
        command: "continue.sendMainUserInput",
        arguments: ["/edit make this more efficient"],
      },
      {
        title: `"/edit write comments for this function"`,
        command: "continue.sendMainUserInput",
        arguments: ["/edit write comments for this function"],
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
          "python " +
            path.join(getExtensionUri().fsPath, "continue_tutorial.py") +
            "\n",
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
];

class TutorialCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    _: vscode.CancellationToken,
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    if (!document.uri.fsPath.endsWith("continue_tutorial.py")) {
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

    // Folding of the tutorial
    const regionLines = lines
      .map((line, i) => [line, i])
      .filter(([line, i]) => (line as string).startsWith("# region "))
      .map(([line, i]) => i);
    for (const lineOfRegion of regionLines as number[]) {
      const range = new vscode.Range(lineOfRegion, 0, lineOfRegion + 1, 0);

      const linesToFold = regionLines
        .filter((i) => lineOfRegion !== i)
        .flatMap((i) => {
          return [i, (i as number) + 1];
        });
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `Begin Section`,
          command: "continue.foldAndUnfold",
          arguments: [linesToFold, [lineOfRegion, lineOfRegion + 1]],
        }),
      );
    }

    return codeLenses;
  }
}

let verticalPerLineCodeLensProvider: vscode.Disposable | undefined = undefined;
let diffsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let suggestionsCodeLensDisposable: vscode.Disposable | undefined = undefined;
let configPyCodeLensDisposable: vscode.Disposable | undefined = undefined;
let tutorialCodeLensDisposable: vscode.Disposable | undefined = undefined;

export function registerAllCodeLensProviders(
  context: vscode.ExtensionContext,
  diffManager: DiffManager,
  editorToVerticalDiffCodeLens: Map<string, VerticalDiffCodeLens[]>,
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

  verticalPerLineCodeLensProvider = vscode.languages.registerCodeLensProvider(
    "*",
    new VerticalPerLineCodeLensProvider(editorToVerticalDiffCodeLens),
  );
  suggestionsCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new SuggestionsCodeLensProvider(),
  );
  diffsCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new DiffViewerCodeLensProvider(diffManager),
  );
  configPyCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new ConfigPyCodeLensProvider(),
  );
  tutorialCodeLensDisposable = vscode.languages.registerCodeLensProvider(
    "*",
    new TutorialCodeLensProvider(),
  );
  context.subscriptions.push(verticalPerLineCodeLensProvider);
  context.subscriptions.push(suggestionsCodeLensDisposable);
  context.subscriptions.push(diffsCodeLensDisposable);
  context.subscriptions.push(configPyCodeLensDisposable);
  context.subscriptions.push(tutorialCodeLensDisposable);
}
