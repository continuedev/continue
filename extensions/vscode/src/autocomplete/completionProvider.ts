import { CompletionProvider } from "core/autocomplete/CompletionProvider";
import { processSingleLineCompletion } from "core/autocomplete/util/processSingleLineCompletion";
import {
  type AutocompleteInput,
  type AutocompleteOutcome,
} from "core/autocomplete/util/types";
import { ConfigHandler } from "core/config/ConfigHandler";
import * as URI from "uri-js";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

import { handleLLMError } from "../util/errorHandling";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

import { checkFim } from "core/nextEdit/diff/diff";
import { NextEditLoggingService } from "core/nextEdit/NextEditLoggingService";
import { PrefetchQueue } from "core/nextEdit/NextEditPrefetchQueue";
import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { NextEditOutcome } from "core/nextEdit/types";
import { JumpManager } from "../activation/JumpManager";
import { NextEditWindowManager } from "../activation/NextEditWindowManager";
import { GhostTextAcceptanceTracker } from "./GhostTextAcceptanceTracker";
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
  private jumpManager: JumpManager;
  private prefetchQueue: PrefetchQueue;

  public recentlyVisitedRanges: RecentlyVisitedRangesService;
  public recentlyEditedTracker: RecentlyEditedTracker;

  private isNextEditActive: boolean = false;
  private usingFullFileDiff: boolean = true;

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
    usingFullFileDiff: boolean,
  ) {
    this.usingFullFileDiff = usingFullFileDiff;
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

    this.jumpManager = JumpManager.getInstance();
    this.prefetchQueue = PrefetchQueue.getInstance();
    this.prefetchQueue.initialize(this.usingFullFileDiff);

    this.recentlyVisitedRanges = new RecentlyVisitedRangesService(ide);
  }

  _lastShownCompletion: AutocompleteOutcome | NextEditOutcome | undefined;

  private async getRerankModel() {
    const { config } = await this.configHandler.loadConfig();
    if (!config) {
      return;
    }
    return config.selectedModelByRole.rerank ?? undefined;
  }

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
    //@ts-ignore
  ): ProviderResult<InlineCompletionItem[] | InlineCompletionList> {
    // This method is triggered on every keystroke, tab keypress, and cursor move.
    // We need to determine why it was triggered:
    // 1. Typing (chain doesn't exist)
    // 2. Jumping (chain exists, jump was taken)
    // 3. Accepting (chain exists, jump is not taken)

    const enableTabAutocomplete =
      getStatusBarStatus() === StatusBarStatus.Enabled;
    if (token.isCancellationRequested || !enableTabAutocomplete) {
      return null;
    }

    if (document.uri.scheme === "vscode-scm") {
      return null;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    // Don't autocomplete with multi-cursor
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

    const currCursorPos = editor.selection.active;

    try {
      const abortController = new AbortController();
      const signal = abortController.signal;
      token.onCancellationRequested(() => abortController.abort());

      // Handle notebook cells
      let pos = {
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

      // handle manual autocompletion trigger
      const wasManuallyTriggered =
        context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;

      const completionId = uuidv4();
      const filepath = document.uri.toString();
      const recentlyVisitedRanges = this.recentlyVisitedRanges.getSnippets();
      let recentlyEditedRanges =
        await this.recentlyEditedTracker.getRecentlyEditedRanges();

      const ctx = {
        completionId,
        manuallyPassFileContents,
        manuallyPassPrefix,
        selectedCompletionInfo,
        isUntitledFile: document.isUntitled,
        recentlyVisitedRanges,
        recentlyEditedRanges,
      };

      let outcome: AutocompleteOutcome | NextEditOutcome | undefined;

      // TODO: We can probably decide here if we want to do the jumping logic.
      // If we aren't going to jump anyways, then we should be not be using the prefetch queue or the jump manager.
      // It would simplify the logic quite substantially.

      // Determine why this method was triggered.
      const isJumping = this.jumpManager.isJumpInProgress();
      const chainExists = this.nextEditProvider.chainExists();
      console.log("isJumping:", isJumping, "/ chainExists:", chainExists);
      this.prefetchQueue.peekThreeProcessed();

      if (isJumping && chainExists) {
        // Case 2: Jumping (chain exists, jump was taken)
        console.log("trigger reason: jumping");

        // Reset jump state.
        this.jumpManager.setJumpInProgress(false);

        // Use the saved completion from JumpManager instead of dequeuing.
        const savedCompletion = this.jumpManager.completionAfterJump;
        if (savedCompletion) {
          outcome = savedCompletion.outcome;
          this.jumpManager.clearCompletionAfterJump();
        } else {
          // Fall back to prefetch queue. This technically should not happen.
          console.error(
            "Fell back to prefetch queue even after jump was taken",
          );
          outcome = this.prefetchQueue.dequeueProcessed()?.outcome;

          // Fill in the spot after dequeuing.
          if (!this.usingFullFileDiff) {
            this.prefetchQueue.process({
              ...ctx,
              recentlyVisitedRanges: this.recentlyVisitedRanges.getSnippets(),
              recentlyEditedRanges:
                await this.recentlyEditedTracker.getRecentlyEditedRanges(),
            });
          }
        }
      } else if (chainExists) {
        // Case 3: Accepting next edit outcome (chain exists, jump is not taken).
        console.log("trigger reason: accepting");

        // Try suggesting jump for each location.
        let isJumpSuggested = false;

        while (this.prefetchQueue.processedCount > 0 && !isJumpSuggested) {
          const nextItemInQueue = this.prefetchQueue.dequeueProcessed();
          if (!nextItemInQueue) continue;

          // Fill in the spot after dequeuing.
          if (!this.usingFullFileDiff) {
            this.prefetchQueue.process({
              ...ctx,
              recentlyVisitedRanges: this.recentlyVisitedRanges.getSnippets(),
              recentlyEditedRanges:
                await this.recentlyEditedTracker.getRecentlyEditedRanges(),
            });
          }

          const nextLocation = nextItemInQueue.location;
          outcome = nextItemInQueue.outcome;

          const jumpPosition = new vscode.Position(
            nextLocation.range.start.line,
            nextLocation.range.start.character,
          );

          isJumpSuggested = await this.jumpManager.suggestJump(
            currCursorPos,
            jumpPosition,
            outcome.completion,
          );

          if (isJumpSuggested) {
            // Store completion to be rendered after a jump.
            this.jumpManager.setCompletionAfterJump({
              completionId: completionId,
              outcome,
              currentPosition: jumpPosition,
            });

            // Don't display anything yet.
            // This will be handled in Case 2.
            return undefined;
          }
        }

        if (!isJumpSuggested) {
          console.log(
            "No suitable jump location found after trying all positions",
          );
          this.nextEditProvider.deleteChain();
          return undefined;
        }
      } else {
        // Case 1: Typing (chain does not exist).

        this.nextEditProvider.startChain();

        const input: AutocompleteInput = {
          pos,
          filepath,
          ...ctx,
        };

        setupStatusBar(undefined, true);

        // Get initial completion.
        if (this.isNextEditActive) {
          outcome = await this.nextEditProvider.provideInlineCompletionItems(
            input,
            signal,
            { withChain: false, usingFullFileDiff: this.usingFullFileDiff },
          );

          // Start prefetching next edits.
          // NOTE: this might be better off not awaited.
          if (!this.usingFullFileDiff) {
            this.prefetchQueue.process(ctx);
          }

          // If initial outcome is null, suggest a jump instead.
          // Calling this method again will call it with
          // chain active but jump not suggested yet.
          if (
            !outcome ||
            (!outcome.completion && outcome.diffLines.length === 0)
          ) {
            return this.provideInlineCompletionItems(
              document,
              position,
              context,
              token,
            );
          }
        } else {
          // Handle regular autocomplete request.
          outcome = await this.completionProvider.provideInlineCompletionItems(
            input,
            signal,
            wasManuallyTriggered,
          );
        }
      }

      // Return early if no valid outcome was found.
      if (
        !outcome ||
        (!this.isNextEditActive &&
          !(outcome as AutocompleteOutcome).completion) ||
        (this.isNextEditActive &&
          !(outcome as NextEditOutcome).completion &&
          (outcome as NextEditOutcome).diffLines.length === 0)
      ) {
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

      // Marking the outcome as displayed saves the current outcome
      // as a value of the key completionId.
      if (this.isNextEditActive) {
        this.nextEditProvider.markDisplayed(
          completionId,
          outcome as NextEditOutcome,
        );
      } else {
        this.completionProvider.markDisplayed(
          completionId,
          outcome as AutocompleteOutcome,
        );
      }
      this._lastShownCompletion = outcome;

      // Construct the range/text to show
      const startPos = selectedCompletionInfo?.range.start ?? position;
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
          arguments: [completionId, this.completionProvider],
        },
      );

      (autocompleteCompletionItem as any).completeBracketPairs = true;

      // Handle autocomplete request.
      if (!this.isNextEditActive) {
        return [autocompleteCompletionItem];
      }

      // Check the diff between old and new editable region.
      const newEditRangeSlice = completionText;

      // Get the contents of the old (current) editable region.
      // const editableRegionStartLine = Math.max(
      //   currCursorPos.line - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
      //   0,
      // );
      // const editableRegionEndLine = Math.min(
      //   currCursorPos.line + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
      //   editor.document.lineCount - 1,
      // );
      const editableRegionStartLine = (outcome as NextEditOutcome)
        .editableRegionStartLine;
      const editableRegionEndLine = (outcome as NextEditOutcome)
        .editableRegionEndLine;
      const oldEditRangeSlice = editor.document
        .getText()
        .split("\n")
        .slice(editableRegionStartLine, editableRegionEndLine + 1)
        .join("\n");

      // We don't need to show the next edit window if the predicted edits are identical to the previous version.
      if (oldEditRangeSlice === newEditRangeSlice) {
        this.nextEditLoggingService.cancelRejectionTimeout(completionId);
        return undefined;
      }

      // Create a cursor position relative to the edit range slice.
      const relativeCursorPos = {
        line: currCursorPos.line - editableRegionStartLine,
        character: currCursorPos.character,
      };

      // If the diff is a FIM, render a ghost text.
      const { isFim, fimText } = checkFim(
        oldEditRangeSlice,
        newEditRangeSlice,
        relativeCursorPos,
      );

      if (isFim) {
        if (!fimText) {
          console.log("deleteChain from completionProvider.ts: !fimText");
          this.nextEditProvider.deleteChain();
          return undefined;
        }

        // Track this ghost text for acceptance detection.
        // Ghost text acceptance can *technically* be acted upon in
        // the command handler for "continue.logNextEditOutcomeAccept",
        // but there is a substantial delay between accepting and logging,
        // which introduces a lot of race conditions with different event handlers.
        // Plus, separating these concerns seems to make sense logically as well.
        GhostTextAcceptanceTracker.getInstance().setExpectedGhostTextAcceptance(
          document,
          fimText,
          new vscode.Position(currCursorPos.line, currCursorPos.character),
        );

        const nextEditCompletionItem = new vscode.InlineCompletionItem(
          fimText,
          new vscode.Range(
            new vscode.Position(currCursorPos.line, currCursorPos.character),
            new vscode.Position(currCursorPos.line, currCursorPos.character),
          ),
          {
            title: "Log Next Edit Outcome",
            command: "continue.logNextEditOutcomeAccept",
            arguments: [completionId, this.nextEditLoggingService],
          },
        );
        return [nextEditCompletionItem];
      }

      // Handle non-FIM cases with the NextEditWindowManager.
      const diffLines = (outcome as NextEditOutcome).diffLines;
      if (diffLines.length === 0) {
        // At this point, there is no way that diffLines.length === 0.
        // Only time we ever reach this point would be after the jump was taken, or if its after the very first repsonse.
        // In case of jump, this is impossible, as the JumpManager wouldn't have suggested a jump here in the first place.
        // In case of initial response, we suggested a jump.
        console.log(
          "deleteChain from completionProvider.ts: diffLines.length === 0",
        );
        NextEditProvider.getInstance().deleteChain();
      }

      if (NextEditWindowManager.isInstantiated()) {
        NextEditWindowManager.getInstance().updateCurrentCompletionId(
          completionId,
        );

        await NextEditWindowManager.getInstance().showNextEditWindow(
          editor,
          currCursorPos,
          editableRegionStartLine,
          editableRegionEndLine,
          oldEditRangeSlice,
          newEditRangeSlice,
          diffLines,
        );
      }

      return undefined;
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
