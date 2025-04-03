import * as CompletionProvider from "core/autocomplete/CompletionProvider";
import { processSingleLineCompletion } from "core/autocomplete/util/processSingleLineCompletion";
import {
  type AutocompleteInput,
  type AutocompleteOutcome,
} from "core/autocomplete/util/types";
import { ConfigHandler } from "core/config/ConfigHandler";
import { SourceFragment } from "core/util/SourceFragment";
import * as URI from "uri-js";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

import { handleLLMError } from "../util/errorHandling";
import { showFreeTrialLoginMessage } from "../util/messages";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

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

interface PendingInlineCompletion {
  task: Promise<vscode.InlineCompletionItem[] | null> | null;
  result: vscode.InlineCompletionItem[] | null;
  cancellationSource: vscode.CancellationTokenSource | null;
  editor: vscode.TextEditor | null;
  documentUri: string;
  line: number;
  character: number;
  sourceFragment: SourceFragment;
  acceptListener: CompletionProvider.Disposable | null;
}

export class ContinueCompletionProvider
  implements vscode.InlineCompletionItemProvider, vscode.Disposable {
  private async onError(e: any) {
    if (await handleLLMError(e)) {
      return;
    }
    let message = e.message;
    if (message.includes("Please sign in with GitHub")) {
      showFreeTrialLoginMessage(
        message,
        this.configHandler.reloadConfig.bind(this.configHandler),
        () => {
          void this.webviewProtocol.request("openOnboardingCard", undefined);
        },
      );
      return;
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

  private completionProvider: CompletionProvider.CompletionProvider;
  private pendingInlineCompletion: PendingInlineCompletion | null = null;
  private recentlyVisitedRanges: RecentlyVisitedRangesService;
  private recentlyEditedTracker: RecentlyEditedTracker;
  private disposables: vscode.Disposable[];

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: VsCodeIde,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
  ) {
    this.recentlyEditedTracker = new RecentlyEditedTracker(ide.ideUtils);
    this.disposables = [];

    async function getAutocompleteModel() {
      const { config } = await configHandler.loadConfig();
      if (!config) {
        return;
      }
      return config.selectedModelByRole.autocomplete ?? undefined;
    }
    this.completionProvider = new CompletionProvider.CompletionProvider(
      this.configHandler,
      this.ide,
      getAutocompleteModel,
      this.onError.bind(this),
      getDefinitionsFromLsp,
    );
    this.recentlyVisitedRanges = new RecentlyVisitedRangesService(ide);

    this.requestNewInlineCompletionsOnEditorChanges();
  }

  private requestNewInlineCompletionsOnEditorChanges(): void {
    let disposable: vscode.Disposable | undefined;

    this.pendingInlineCompletion?.cancellationSource?.cancel();
    disposable = vscode.window.onDidChangeActiveTextEditor(() => {
      this.requestNewInlineCompletion();
    });
    this.disposables.push(disposable);

    disposable = vscode.window.onDidChangeWindowState((event) => {
      if (event.focused)
        this.requestNewInlineCompletion();
      else
        this.pendingInlineCompletion?.cancellationSource?.cancel();
    });
    this.disposables.push(disposable);
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    this.completionProvider.dispose();

    if (this.pendingInlineCompletion) {
      this.pendingInlineCompletion.cancellationSource?.cancel();
      this.pendingInlineCompletion.acceptListener?.dispose();
      this.pendingInlineCompletion = null;
    }
  }

  private async requestNewInlineCompletion() {
    setTimeout(async () => {
      await vscode.commands.executeCommand(
        "editor.action.inlineSuggest.trigger",
      );
    }, 33);
  }

  private isInlineCompletionInvalid(
    position: vscode.Position,
    document: vscode.TextDocument
  ): boolean {
    if (!this.pendingInlineCompletion) return false;

    const completionLineCount = this.pendingInlineCompletion.sourceFragment.getLineCount();

    const startLine = this.pendingInlineCompletion.line;
    const endLine = this.pendingInlineCompletion.line + completionLineCount;

    // If the cursor moved outside the completion's range, then
    // it's no longer valid
    if (position.line < startLine || position.line > endLine) return true;

    // If the cursor hasn't moved, then the document didn't change
    // so any completion is still valid
    if (this.pendingInlineCompletion.character === position.character)
      return false;

    // If we don't have a result yet, then it can't be invalid
    if (!this.pendingInlineCompletion.result) return false;

    const currentText = document.getText(new vscode.Range(
      new vscode.Position(this.pendingInlineCompletion.line, 0),
      position
    ));

    const editorFragment = new SourceFragment(currentText);
    const completionFragment = this.pendingInlineCompletion.sourceFragment;

    // The completion is invalid if what the user types no longer matches it
    return !editorFragment.endsWithStartOf(completionFragment, {
      ignoreWhitespace: true
    });
  }

  private async handlePendingInlineCompletionResult(
    position: vscode.Position,
    document: vscode.TextDocument
  ): Promise<vscode.InlineCompletionItem[] | null> {
    if (!this.pendingInlineCompletion) return null;

    if (!this.pendingInlineCompletion.result ||
        !this.pendingInlineCompletion.result[0]) {
      this.pendingInlineCompletion = null;
      return null;
    }

    const result = [new vscode.InlineCompletionItem(
      this.pendingInlineCompletion.result[0].insertText,
      this.pendingInlineCompletion.result[0].range,
      this.pendingInlineCompletion.result[0].command
    )];

    const editorText = document.getText(new vscode.Range(
      new vscode.Position(this.pendingInlineCompletion.line, 0),
      position
    ));

    const editorFragment = new SourceFragment(editorText);

    const remainingCompletion = editorFragment.getRemainingCompletion(
      this.pendingInlineCompletion.sourceFragment,
      { ignoreWhitespace: true, mergeWhitespace: true }
    );

    // If the user started to type into the completion, we need to
    // chop off what they typed and only return what's left as
    // the completion item
    if (remainingCompletion) {
      const insertText = remainingCompletion.getAsText({
        ignoreWhitespace: false,
      });
      result[0].insertText = insertText;
      result[0].range = new vscode.Range(position, position);
    }

    return result;
  }

  private async prepareNewInlineCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;

    const cancellationSource = new vscode.CancellationTokenSource();
    const completionPromise = this.provideInlineCompletionItemsLater(
      document,
      position,
      context,
      cancellationSource.token,
    );

    if (!completionPromise) return null;

    const acceptListener = this.completionProvider.onAccept((completionId, acceptedOutcome) => {
      if (!this.pendingInlineCompletion) return;

      this.pendingInlineCompletion.cancellationSource?.cancel();
      this.pendingInlineCompletion.acceptListener?.dispose();
      this.pendingInlineCompletion.task = null;
      this.pendingInlineCompletion.result = null;
      this.pendingInlineCompletion = null;
    });

    // Prime the completion with the current line until we can get an
    // answer from the LLM
    const completionText = document
      .lineAt(position.line)
      .text.slice(0, position.character);
    const completionFragment = new SourceFragment(completionText);
    this.pendingInlineCompletion = {
      task: completionPromise,
      result: null,
      cancellationSource,
      editor,
      documentUri: document.uri.toString(),
      line: position.line,
      character: position.character,
      sourceFragment: completionFragment,
      acceptListener,
    };

    this.handleInlineCompletionWhenReady(completionPromise);

    return null;
  }

  private async handleInlineCompletionWhenReady(
    completionPromise: Promise<vscode.InlineCompletionItem[] | null>
  ): Promise<void> {
    completionPromise.then(async (result: vscode.InlineCompletionItem[] | null) => {
      if (!this.pendingInlineCompletion) return;

      this.pendingInlineCompletion.task = null;
      this.pendingInlineCompletion.cancellationSource = null;
      this.pendingInlineCompletion.result = result;

      if (result && result[0]) {
        const completionText = result[0].insertText.toString();
        const currentText = this.pendingInlineCompletion.sourceFragment.getAsText({ ignoreWhitespace: false });
        this.pendingInlineCompletion.sourceFragment = new SourceFragment(currentText + completionText);
      }

      await this.requestNewInlineCompletion();
    });
  }

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | null> {
    // Check if an inline completion is already being generated
    if (this.pendingInlineCompletion) {
      // Cancel if the user has moved around
      if (this.isInlineCompletionInvalid(position, document)) {
        this.pendingInlineCompletion.cancellationSource?.cancel();
        this.pendingInlineCompletion.task = null;
        this.pendingInlineCompletion.result = null;
        this.pendingInlineCompletion = null;
        return null;
      }

      // Return null if it's still being worked on
      if (this.pendingInlineCompletion.task) return null;

      // Return it if it finished
      return await this.handlePendingInlineCompletionResult(position, document);
    }

    // Start a new completion process
    return await this.prepareNewInlineCompletion(document, position, context, token);
  }

  _lastShownCompletion: AutocompleteOutcome | undefined;

  private async provideInlineCompletionItemsLater(
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

      const input: AutocompleteInput = {
        pos,
        manuallyPassFileContents,
        manuallyPassPrefix,
        injectDetails,
        isUntitledFile: document.isUntitled,
        completionId: uuidv4(),
        filepath: document.uri.toString(),
        recentlyVisitedRanges: this.recentlyVisitedRanges.getSnippets(),
        recentlyEditedRanges:
          await this.recentlyEditedTracker.getRecentlyEditedRanges(),
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

      const selectedCompletionInfo = context.selectedCompletionInfo;

      // Special case that helps completion with the Granite models:
      //
      // If the displayed completion in the autocompletion widget is a property,
      // and the result from Granite starts with spaces before the property dot,
      // remove those spaces.
      if (
        selectedCompletionInfo &&
        selectedCompletionInfo.text.startsWith(".")
      ) {
        const trimmedCompletion = outcome.completion.trimStart();
        if (trimmedCompletion.startsWith(".")) {
          outcome.completion = trimmedCompletion;
        }
      }

      // Construct the range/text to show
      let range = new vscode.Range(position, position);
      let completionText = outcome.completion;
      const isSingleLineCompletion = outcome.completion.split("\n").length <= 1;
      // When the completion widget is up, changing the range will
      // result in our inline completion not being shown.
      const mayChangeRange = selectedCompletionInfo === undefined;

      if (isSingleLineCompletion) {
        const currentLineRemainder = document
          .lineAt(position)
          .text.substring(position.character);

        const result = processSingleLineCompletion(
          outcome.completion,
          currentLineRemainder,
          position.character,
          mayChangeRange,
        );

        if (result === undefined) {
          return undefined;
        }

        completionText = result.completionText;
        if (result.range) {
          range = new vscode.Range(
            new vscode.Position(position.line, result.range.start),
            new vscode.Position(position.line, result.range.end),
          );
        }
      } else {
        if (mayChangeRange) {
          // Extend the range to the end of the line for multiline completionsq
          range = new vscode.Range(
            position,
            document.lineAt(position).range.end,
          );
        } else {
          // Since we can't change the range, try to shorten the completion
          // into a single-line insertion

          const currentLineRemainder = document
            .lineAt(position)
            .text.substring(position.character);

          if (currentLineRemainder !== "") {
            const firstLineOfCompletion = outcome.completion.split("\n")[0];
            const remainderLocation =
              firstLineOfCompletion.lastIndexOf(currentLineRemainder);
            if (remainderLocation !== -1) {
              completionText = firstLineOfCompletion.slice(
                0,
                remainderLocation,
              );
            } else {
              return null;
            }
          }
        }
      }

      // VS Code displays dependent on selectedCompletionInfo (their docstring below)
      // We first adjust our range/text to match what they expect, but if that isn't
      // possible (because our completion is going in a different direction than the
      // selected item), but if it goes wrong we want telemetry to be correct
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
        if (range.start.isEqual(selectedCompletionInfo.range.end)) {
          range = new vscode.Range(
            selectedCompletionInfo.range.start,
            range.end,
          );
          const existingText = document.getText(selectedCompletionInfo.range);
          completionText = existingText + completionText;
        }
      }

      const willDisplay = this.willDisplay(
        document,
        selectedCompletionInfo,
        signal,
        range,
        completionText,
      );
      if (!willDisplay) {
        return null;
      }

      // Mark displayed
      this.completionProvider.markDisplayed(input.completionId, outcome);
      this._lastShownCompletion = outcome;

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
    range: vscode.Range,
    completionText: string,
  ): boolean {
    if (selectedCompletionInfo) {
      if (!range.isEqual(selectedCompletionInfo.range)) {
        return false;
      }

      if (!completionText.startsWith(selectedCompletionInfo.text)) {
        return false;
      }
    }

    if (abortSignal.aborted) {
      return false;
    }

    return true;
  }
}
