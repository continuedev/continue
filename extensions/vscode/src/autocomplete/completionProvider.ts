import { CompletionProvider } from "core/autocomplete/CompletionProvider";
import {
  type AutocompleteInput,
  type AutocompleteOutcome,
} from "core/autocomplete/util/types";
import { ConfigHandler } from "core/config/ConfigHandler";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
const Diff = require("diff");

import { showFreeTrialLoginMessage } from "../util/messages";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

import { getDefinitionsFromLsp } from "./lsp";
import { RecentlyEditedTracker } from "./recentlyEdited";
import {
  StatusBarStatus,
  getStatusBarStatus,
  setupStatusBar,
  stopStatusBarLoading,
} from "./statusBar";

import type { IDE } from "core";
import type { TabAutocompleteModel } from "../util/loadAutocompleteModel";

interface DiffType {
  count: number;
  added: boolean;
  removed: boolean;
  value: string;
}

interface VsCodeCompletionInput {
  document: vscode.TextDocument;
  position: vscode.Position;
  context: vscode.InlineCompletionContext;
}

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private onError(e: any) {
    const options = ["Documentation"];
    if (e.message.includes("https://ollama.ai")) {
      options.push("Download Ollama");
    }

    if (e.message.includes("Please sign in with GitHub")) {
      showFreeTrialLoginMessage(
        e.message,
        this.configHandler.reloadConfig.bind(this.configHandler),
        () => {
          void this.webviewProtocol.request("openOnboardingCard", undefined);
        },
      );
      return;
    }
    vscode.window.showErrorMessage(e.message, ...options).then((val) => {
      if (val === "Documentation") {
        vscode.env.openExternal(
          vscode.Uri.parse(
            "https://docs.continue.dev/features/tab-autocomplete",
          ),
        );
      } else if (val === "Download Ollama") {
        vscode.env.openExternal(vscode.Uri.parse("https://ollama.ai/download"));
      }
    });
  }

  private completionProvider: CompletionProvider;
  private recentlyEditedTracker = new RecentlyEditedTracker();

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly tabAutocompleteModel: TabAutocompleteModel,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
  ) {
    this.completionProvider = new CompletionProvider(
      this.configHandler,
      this.ide,
      this.tabAutocompleteModel.get.bind(this.tabAutocompleteModel),
      this.onError.bind(this),
      getDefinitionsFromLsp,
    );

    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.fsPath === this._lastShownCompletion?.filepath) {
        // console.log("updating completion");
      }
    });
  }

  _lastShownCompletion: AutocompleteOutcome | undefined;

  _lastVsCodeCompletionInput: VsCodeCompletionInput | undefined;

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    const enableTabAutocomplete =
      getStatusBarStatus() === StatusBarStatus.Enabled;
    if (token.isCancellationRequested || !enableTabAutocomplete) {
      return null;
    }

    if (document.uri.scheme === "vscode-scm") {
      return null;
    }

    // Don't autocomplete with multi-cursor
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.selections.length > 1) {
      return null;
    }

    // If the text at the range isn't a prefix of the intellisense text,
    // no completion will be displayed, regardless of what we return
    if (
      context.selectedCompletionInfo &&
      !context.selectedCompletionInfo.text.startsWith(
        document.getText(context.selectedCompletionInfo.range),
      )
    ) {
      return null;
    }

    let injectDetails: string | undefined = undefined;
    // Here we could use the details from the intellisense dropdown
    // and place them just above the line being typed but because
    // we don't have control over the formatting of the details and
    // they could be especially long, not doing this for now
    // if (context.selectedCompletionInfo) {
    //   const results: any = await vscode.commands.executeCommand(
    //     "vscode.executeCompletionItemProvider",
    //     document.uri,
    //     position,
    //     null,
    //     1,
    //   );
    //   if (results?.items) {
    //     injectDetails = results.items?.[0]?.detail;
    //     // const label = results?.items?.[0].label;
    //     // const workspaceSymbols = (
    //     //   (await vscode.commands.executeCommand(
    //     //     "vscode.executeWorkspaceSymbolProvider",
    //     //     label,
    //     //   )) as any
    //     // ).filter((symbol: any) => symbol.name === label);
    //     // console.log(label, "=>", workspaceSymbols);
    //   }
    // }

    // The first time intellisense dropdown shows up, and the first choice is selected,
    // we should not consider this. Only once user explicitly moves down the list
    const newVsCodeInput = {
      context,
      document,
      position,
    };
    const selectedCompletionInfo = context.selectedCompletionInfo;
    this._lastVsCodeCompletionInput = newVsCodeInput;

    try {
      const abortController = new AbortController();
      const signal = abortController.signal;
      token.onCancellationRequested(() => abortController.abort());

      // Handle notebook cells
      const pos = {
        line: position.line,
        character: position.character,
      };
      let manuallyPassFileContents: string | undefined = undefined;
      if (document.uri.scheme === "vscode-notebook-cell") {
        const notebook = vscode.workspace.notebookDocuments.find((notebook) =>
          notebook
            .getCells()
            .some((cell) => cell.document.uri === document.uri),
        );
        if (notebook) {
          const cells = notebook.getCells();
          manuallyPassFileContents = cells
            .map((cell) => {
              const text = cell.document.getText();
              if (cell.kind === vscode.NotebookCellKind.Markup) {
                return `"""${text}"""`;
              } else {
                return text;
              }
            })
            .join("\n\n");
          for (const cell of cells) {
            if (cell.document.uri === document.uri) {
              break;
            } else {
              pos.line += cell.document.getText().split("\n").length + 1;
            }
          }
        }
      }

      // Manually pass file contents for unsaved, untitled files
      let filepath = document.uri.fsPath;
      if (document.isUntitled) {
        manuallyPassFileContents = document.getText();
      }

      // Handle commit message input box
      let manuallyPassPrefix: string | undefined = undefined;

      const input: AutocompleteInput = {
        isUntitledFile: document.isUntitled,
        completionId: uuidv4(),
        filepath,
        pos,
        recentlyEditedFiles: [],
        recentlyEditedRanges:
          await this.recentlyEditedTracker.getRecentlyEditedRanges(),
        manuallyPassFileContents,
        manuallyPassPrefix,
        selectedCompletionInfo,
        injectDetails,
      };

      setupStatusBar(undefined, true);
      const outcome =
        await this.completionProvider.provideInlineCompletionItems(
          input,
          signal,
        );

      if (!outcome || !outcome.completion) {
        return null;
      }

      // VS Code displays dependent on selectedCompletionInfo (their docstring below)
      // We should first always make sure we have a valid completion, but if it goes wrong we
      // want telemetry to be correct
      /**
       * Provides information about the currently selected item in the autocomplete widget if it is visible.
       *
       * If set, provided inline completions must extend the text of the selected item
       * and use the same range, otherwise they are not shown as preview.
       * As an example, if the document text is `console.` and the selected item is `.log` replacing the `.` in the document,
       * the inline completion must also replace `.` and start with `.log`, for example `.log()`.
       *
       * Inline completion providers are requested again whenever the selected item changes.
       */
      if (selectedCompletionInfo) {
        outcome.completion = selectedCompletionInfo.text + outcome.completion;
      }
      const willDisplay = this.willDisplay(
        document,
        selectedCompletionInfo,
        signal,
        outcome,
      );
      if (!willDisplay) {
        return null;
      }

      // Mark displayed
      this.completionProvider.markDisplayed(input.completionId, outcome);
      this._lastShownCompletion = outcome;

      // Construct the range/text to show
      const startPos = selectedCompletionInfo?.range.start ?? position;
      let range = new vscode.Range(startPos, startPos);
      let completionText = outcome.completion;
      const isSingleLineCompletion = outcome.completion.split("\n").length <= 1;

      if (isSingleLineCompletion) {
        const lastLineOfCompletionText = completionText.split("\n").pop();
        const currentText = document
          .lineAt(startPos)
          .text.substring(startPos.character);
        const diffs: DiffType[] = Diff.diffWords(
          currentText,
          lastLineOfCompletionText,
        );

        if (diffPatternMatches(diffs, ["+"])) {
          // Just insert, we're already at the end of the line
        } else if (
          diffPatternMatches(diffs, ["+", "="]) ||
          diffPatternMatches(diffs, ["+", "=", "+"])
        ) {
          // The model repeated the text after the cursor to the end of the line
          range = new vscode.Range(
            startPos,
            document.lineAt(startPos).range.end,
          );
        } else if (
          diffPatternMatches(diffs, ["+", "-"]) ||
          diffPatternMatches(diffs, ["-", "+"])
        ) {
          // We are midline and the model just inserted without repeating to the end of the line
          // We want to move the cursor to the end of the line
          // range = new vscode.Range(
          //   startPos,
          //   document.lineAt(startPos).range.end,
          // );
          // // Find the last removed part of the diff
          // const lastRemovedIndex = findLastIndex(
          //   diffs,
          //   (diff) => diff.removed === true,
          // );
          // const lastRemovedContent = diffs[lastRemovedIndex].value;
          // completionText += lastRemovedContent;
        } else {
          // Diff is too complicated, just insert the first added part of the diff
          // This is the safe way to ensure that it is displayed
          if (diffs[0]?.added) {
            completionText = diffs[0].value;
          } else {
            // If the first part of the diff isn't an insertion, then the model is
            // probably rewriting other parts of the line
            return undefined;
          }
        }
      } else {
        // Extend the range to the end of the line for multiline completions
        range = new vscode.Range(startPos, document.lineAt(startPos).range.end);
      }

      const completionItem = new vscode.InlineCompletionItem(
        completionText,
        range,
        {
          title: "Log Autocomplete Outcome",
          command: "continue.logAutocompleteOutcome",
          arguments: [input.completionId, this.completionProvider],
        },
      );

      (completionItem as any).completeBracketPairs = true;
      return [completionItem];
    } finally {
      stopStatusBarLoading();
    }
  }

  willDisplay(
    document: vscode.TextDocument,
    selectedCompletionInfo: vscode.SelectedCompletionInfo | undefined,
    abortSignal: AbortSignal,
    outcome: AutocompleteOutcome,
  ): boolean {
    if (selectedCompletionInfo) {
      const { text, range } = selectedCompletionInfo;
      if (!outcome.completion.startsWith(text)) {
        console.log(
          `Won't display completion because text doesn't match: ${text}, ${outcome.completion}`,
          range,
        );
        return false;
      }
    }

    if (abortSignal.aborted) {
      return false;
    }

    return true;
  }
}

type DiffPartType = "+" | "-" | "=";

function diffPatternMatches(
  diffs: DiffType[],
  pattern: DiffPartType[],
): boolean {
  if (diffs.length !== pattern.length) {
    return false;
  }

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];
    const diffPartType: DiffPartType =
      !diff.added && !diff.removed ? "=" : diff.added ? "+" : "-";

    if (diffPartType !== pattern[i]) {
      return false;
    }
  }

  return true;
}
