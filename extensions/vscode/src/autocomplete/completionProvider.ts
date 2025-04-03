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

import type { IDE } from "core";

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
  private recentlyEditedTracker = new RecentlyEditedTracker();
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
  ) {
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

    // Disable the suggestion widget until the LLM has had a chance to generate a completion
    vscode.commands.executeCommand("continue.disableSuggestionWidget");

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

  private async suggestionWidgetMatchesInlineCompletion() {
    if (!this.pendingInlineCompletion) return true;
    if (!this.pendingInlineCompletion.result) return false;

    const [completionResult] = this.pendingInlineCompletion.result;

    if (!completionResult) return false;

    const position = new vscode.Position(
      this.pendingInlineCompletion.line,
      this.pendingInlineCompletion.character,
    );

    let hasCompatibleSuggestion;
    try {
      const completionList =
        await vscode.commands.executeCommand<vscode.CompletionList>(
          "vscode.executeCompletionItemProvider",
          this.pendingInlineCompletion.editor!.document.uri,
          position,
        );

      const inlineCompletionText = completionResult.insertText.toString();

      hasCompatibleSuggestion = completionList.items.some((item) => {
        const insertText = item.insertText?.toString() || item.label.toString();
        return (
          inlineCompletionText.startsWith(insertText) ||
          insertText.startsWith(inlineCompletionText)
        );
      });
    } catch (error) {
      hasCompatibleSuggestion = false;
    }

    if (!hasCompatibleSuggestion) return false;

    return hasCompatibleSuggestion;
  }

  private async requestSuggestWidget() {
    const isDisabled = await vscode.commands.executeCommand(
      "continue.isSuggestionWidgetDisabled",
    );

    if (isDisabled) return;

    const hasCompatibleSuggestion =
      await this.suggestionWidgetMatchesInlineCompletion();

    if (!hasCompatibleSuggestion) return;

    setTimeout(async () => {
      await vscode.commands.executeCommand("editor.action.triggerSuggest");
    }, 500);
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

    const result = [...this.pendingInlineCompletion.result];

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

      const isDisabled = await vscode.commands.executeCommand("continue.isSuggestionWidgetDisabled");
      if (isDisabled) {
        vscode.commands.executeCommand("continue.enableSuggestionWidget");
        this.requestSuggestWidget();
      }
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

    vscode.commands.executeCommand("continue.disableSuggestionWidget");

    const acceptListener = this.completionProvider.onAccept((completionId, acceptedOutcome) => {
      if (!this.pendingInlineCompletion) return;
      vscode.commands.executeCommand("continue.disableSuggestionWidget");

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
        const isDisabled = await vscode.commands.executeCommand("continue.isSuggestionWidgetDisabled");
        if (isDisabled)
          vscode.commands.executeCommand("continue.disableSuggestionWidget");

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

      // Mark displayed
      this.completionProvider.markDisplayed(input.completionId, outcome);
      this._lastShownCompletion = outcome;

      // Construct the range/text to show
      const startPos = position;
      let range = new vscode.Range(startPos, startPos);
      let completionText = outcome.completion;
      const isSingleLineCompletion = outcome.completion.split("\n").length <= 1;

      if (isSingleLineCompletion) {
        const lastLineOfCompletionText = completionText.split("\n").pop() || "";
        const currentText = document
          .lineAt(startPos)
          .text.substring(startPos.character);

        const result = processSingleLineCompletion(
          lastLineOfCompletionText,
          currentText,
          startPos.character
        );

        if (result === undefined) return undefined;

        completionText = result.completionText;
        if (result.range) {
          range = new vscode.Range(
            new vscode.Position(startPos.line, result.range.start),
            new vscode.Position(startPos.line, result.range.start)
          );
        }
      } else {
        // Extend the range to the end of the line for multiline completions
        range = new vscode.Range(startPos, startPos);
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
}
