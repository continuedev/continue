import { CompletionProvider } from "core/autocomplete/CompletionProvider";
import { processSingleLineCompletion } from "core/autocomplete/util/processSingleLineCompletion";
import {
  type AutocompleteInput,
  type AutocompleteOutcome,
} from "core/autocomplete/util/types";
import { ConfigHandler } from "core/config/ConfigHandler";
// import { IS_NEXT_EDIT_ACTIVE } from "core/nextEdit/constants";
// import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import * as URI from "uri-js";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

import { handleLLMError } from "../util/errorHandling";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

import { myersDiff } from "core/diff/myers";
import {
  NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
  NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
} from "core/nextEdit/constants";
import { checkFim } from "core/nextEdit/diff/diff";
import { NextEditLoggingService } from "core/nextEdit/NextEditLoggingService";
import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { NextEditOutcome } from "core/nextEdit/types";
import { NextEditWindowManager } from "../activation/NextEditWindowManager";
import { getDefinitionsFromLsp } from "./lsp";
import { RecentlyEditedTracker } from "./recentlyEdited";
import { RecentlyVisitedRangesService } from "./RecentlyVisitedRangesService";
import {
  StatusBarStatus,
  getStatusBarStatus,
  setupStatusBar,
  stopStatusBarLoading,
} from "./statusBar";

interface VsCodeCompletionInput {
  document: vscode.TextDocument;
  position: vscode.Position;
  context: vscode.InlineCompletionContext;
}

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private async onError(e: unknown) {
    if (await handleLLMError(e)) {
      return;
    }
    let message = "Continue Autocomplete Error";
    if (e instanceof Error) {
      message += `: ${e.message}`;
    }
    vscode.window.showErrorMessage(message, "Documentation").then((val) => {
      if (val === "Documentation") {
        vscode.env.openExternal(
          vscode.Uri.parse(
            "https://docs.continue.dev/features/tab-autocomplete",
          ),
        );
      }
    });
  }

  private completionProvider: CompletionProvider;
  private nextEditProvider: NextEditProvider;
  private nextEditLoggingService: NextEditLoggingService;
  public recentlyVisitedRanges: RecentlyVisitedRangesService;
  public recentlyEditedTracker: RecentlyEditedTracker;

  private isNextEditActive: boolean = false;

  public activateNextEdit() {
    this.isNextEditActive = true;
  }

  public deactivateNextEdit() {
    this.isNextEditActive = false;
  }

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: VsCodeIde,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
  ) {
    this.recentlyEditedTracker = new RecentlyEditedTracker(ide.ideUtils);

    async function getAutocompleteModel() {
      const { config } = await configHandler.loadConfig();
      if (!config) {
        return;
      }
      return config.selectedModelByRole.autocomplete ?? undefined;
    }
    this.completionProvider = new CompletionProvider(
      this.configHandler,
      this.ide,
      getAutocompleteModel,
      this.onError.bind(this),
      getDefinitionsFromLsp,
    );

    // Logging service must be created first.
    this.nextEditLoggingService = NextEditLoggingService.getInstance();
    this.nextEditProvider = NextEditProvider.initialize(
      this.configHandler,
      this.ide,
      getAutocompleteModel,
      this.onError.bind(this),
      getDefinitionsFromLsp,
      "fineTuned",
    );

    this.recentlyVisitedRanges = new RecentlyVisitedRangesService(ide);
  }

  _lastShownCompletion: AutocompleteOutcome | NextEditOutcome | undefined;

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

    const selectedCompletionInfo = context.selectedCompletionInfo;

    // This code checks if there is a selected completion suggestion in the given context and ensures that it is valid
    // To improve the accuracy of suggestions it checks if the user has typed at least 4 characters
    // This helps refine and filter out irrelevant autocomplete options
    if (selectedCompletionInfo) {
      const { text, range } = selectedCompletionInfo;
      const typedText = document.getText(range);

      const typedLength = range.end.character - range.start.character;

      if (typedLength < 4) {
        return null;
      }

      if (!text.startsWith(typedText)) {
        return null;
      }
    }
    let injectDetails: string | undefined = undefined;

    try {
      const abortController = new AbortController();
      const signal = abortController.signal;
      token.onCancellationRequested(() => abortController.abort());

      // Handle notebook cells
      const pos = {
        line: position.line,
        character: position.character,
      };
      // const pos = {
      //   line: 0,
      //   character: 0,
      // };
      let manuallyPassFileContents: string | undefined = undefined;
      if (document.uri.scheme === "vscode-notebook-cell") {
        const notebook = vscode.workspace.notebookDocuments.find((notebook) =>
          notebook
            .getCells()
            .some((cell) =>
              URI.equal(cell.document.uri.toString(), document.uri.toString()),
            ),
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
            if (
              URI.equal(cell.document.uri.toString(), document.uri.toString())
            ) {
              break;
            } else {
              pos.line += cell.document.getText().split("\n").length + 1;
            }
          }
        }
      }

      // Manually pass file contents for unsaved, untitled files
      if (document.isUntitled) {
        manuallyPassFileContents = document.getText();
      }

      // Handle commit message input box
      let manuallyPassPrefix: string | undefined = undefined;

      // handle manual autocompletion trigger
      const wasManuallyTriggered =
        context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;

      const input: AutocompleteInput = {
        pos,
        manuallyPassFileContents,
        manuallyPassPrefix,
        selectedCompletionInfo,
        injectDetails,
        isUntitledFile: document.isUntitled,
        completionId: uuidv4(),
        filepath: document.uri.toString(),
        recentlyVisitedRanges: this.recentlyVisitedRanges.getSnippets(),
        recentlyEditedRanges:
          await this.recentlyEditedTracker.getRecentlyEditedRanges(),
      };

      setupStatusBar(undefined, true);

      // TODO: fix type of outcome to be a union between NextEditOutcome and AutocompleteOutcome.
      const outcome: AutocompleteOutcome | NextEditOutcome | undefined = this
        .isNextEditActive
        ? await this.nextEditProvider.provideInlineCompletionItems(
            input,
            signal,
          )
        : await this.completionProvider.provideInlineCompletionItems(
            input,
            signal,
            wasManuallyTriggered,
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

      // Marking the outcome as displayed saves
      // the current outcome as a value of the key completionId.
      if (this.isNextEditActive) {
        this.nextEditProvider.markDisplayed(
          input.completionId,
          outcome as NextEditOutcome,
        );
      } else {
        this.completionProvider.markDisplayed(
          input.completionId,
          outcome as AutocompleteOutcome,
        );
      }
      this._lastShownCompletion = outcome;

      // Construct the range/text to show
      const startPos = selectedCompletionInfo?.range.start ?? position;
      // const startPos = new vscode.Position(0, 0);
      // const endPos = new vscode.Position(0, 5);
      let range = new vscode.Range(startPos, startPos);
      // let range = new vscode.Range(startPos, endPos);
      let completionText = outcome.completion;

      // NOTE: This seems like an autocomplete logic.
      const isSingleLineCompletion = outcome.completion.split("\n").length <= 1;

      if (isSingleLineCompletion) {
        const lastLineOfCompletionText = completionText.split("\n").pop() || "";
        const currentText = document
          .lineAt(startPos)
          .text.substring(startPos.character);

        const result = processSingleLineCompletion(
          lastLineOfCompletionText,
          currentText,
          startPos.character,
        );

        if (result === undefined) {
          return undefined;
        }

        completionText = result.completionText;
        if (result.range) {
          range = new vscode.Range(
            new vscode.Position(startPos.line, result.range.start),
            new vscode.Position(startPos.line, result.range.end),
          );
        }
      } else {
        // Extend the range to the end of the line for multiline completions
        range = new vscode.Range(startPos, document.lineAt(startPos).range.end);
      }

      const autocompleteCompletionItem = new vscode.InlineCompletionItem(
        completionText,
        range,
        {
          title: "Log Autocomplete Outcome",
          command: "continue.logAutocompleteOutcome",
          arguments: [input.completionId, this.completionProvider],
        },
      );

      (autocompleteCompletionItem as any).completeBracketPairs = true;

      if (this.isNextEditActive) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return undefined;
        }

        // Check the diff between old and new editable region.
        const newEditRangeSlice = completionText;

        // We don't need to show the next edit window if the predicted edits is empty.
        if (newEditRangeSlice === "") {
          this.nextEditLoggingService.cancelRejectionTimeout(
            input.completionId,
          );
          return undefined;
        }

        // Get the contents of the old (current) editable region.
        const currCursorPos = editor.selection.active;
        const editableRegionStartLine = Math.max(
          currCursorPos.line - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
          0,
        );
        const editableRegionEndLine = Math.min(
          currCursorPos.line + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
          editor.document.lineCount - 1,
        );
        const oldEditRangeSlice = editor.document
          .getText()
          .split("\n")
          .slice(editableRegionStartLine, editableRegionEndLine + 1)
          .join("\n");

        // We don't need to show the next edit window if the predicted edits are identical to the previous version.
        if (oldEditRangeSlice === newEditRangeSlice) {
          this.nextEditLoggingService.cancelRejectionTimeout(
            input.completionId,
          );
          return undefined;
        }

        // If the diff is a FIM, render a ghost text.
        const { isFim, fimText } = checkFim(
          oldEditRangeSlice,
          newEditRangeSlice,
          currCursorPos,
        );
        if (isFim) {
          const nextEditCompletionItem = new vscode.InlineCompletionItem(
            fimText,
            new vscode.Range(
              new vscode.Position(currCursorPos.line, currCursorPos.character),
              new vscode.Position(currCursorPos.line, currCursorPos.character),
            ),
            {
              title: "Log Next Edit Outcome",
              command: "continue.logNextEditOutcomeAccept",
              arguments: [input.completionId, this.nextEditLoggingService], // TODO: this may have to be this.completionProvider.
            },
          );
          return [nextEditCompletionItem];
        }

        // Else, render a next edit window.
        const diffLines = myersDiff(oldEditRangeSlice, newEditRangeSlice);

        if (NextEditWindowManager.isInstantiated()) {
          NextEditWindowManager.getInstance().updateCurrentCompletionId(
            input.completionId,
          );

          await NextEditWindowManager.getInstance().showNextEditWindow(
            editor,
            currCursorPos,
            editableRegionStartLine,
            oldEditRangeSlice,
            newEditRangeSlice,
            diffLines,
          );
        }

        return undefined;
      } else {
        return [autocompleteCompletionItem];
      }
    } finally {
      stopStatusBarLoading();
    }
  }

  willDisplay(
    document: vscode.TextDocument,
    selectedCompletionInfo: vscode.SelectedCompletionInfo | undefined,
    abortSignal: AbortSignal,
    outcome: AutocompleteOutcome | NextEditOutcome,
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
