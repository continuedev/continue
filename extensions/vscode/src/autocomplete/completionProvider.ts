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

  /**
   * Updates this class and the prefetch queue's usingFullFileDiff flag.
   * @param usingFullFileDiff New value to set.
   */
  public updateUsingFullFileDiff(usingFullFileDiff: boolean) {
    this.usingFullFileDiff = usingFullFileDiff;
    this.prefetchQueue.initialize(this.usingFullFileDiff);
  }

  /**
   * This is the entry point to the autocomplete and next edit logic.
   * @param document The text document containing the current cursor position.
   * @param position The current cursor position.
   * @param context Contextual information about the inline completion request.
   */
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

    /* START OF CONTEXT GATHERING BOILERPLATE */

    // The code in this block is meant for gathering context for autocomplete and next edit requests.
    // e.g. filepath, cursor position, editor, notebook-ness, etc.

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
      const completionId = uuidv4();

      if (this.isNextEditActive) {
        this.nextEditLoggingService.trackPendingCompletion(completionId);
      }

      token.onCancellationRequested(() => {
        abortController.abort();
        if (this.isNextEditActive) {
          this.nextEditLoggingService.handleAbort(completionId);
        }
      });

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

      // const completionId = uuidv4();
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

      /* END OF CONTEXT GATHERING BOILERPLATE */

      /* START OF MODEL OUTCOME RECEIVING BLOCK */

      // Throughout this function, we choose whether we want an autocomplete or a next edit request.
      // The conditional logic below is pretty convoluted, so it would be a good idea to refactor.
      // The idea was to re-use as much code as possible, but in hindsight I should've just made different functions.
      // this.isNextEditActive is the boolean that determines whether we use autocomplete vs. next edit.

      // You will also see mentions of this.usingFullFileDiff.
      // This was initially a flag for whether we should let the model output a full file as an output (or to the best of its abilities).
      // It ended up becoming a Mercury Coder vs. non-Mercury Coder flag, and is now used to determine whether we should prefetch next edits.
      // This is a good place to refactor on.
      // In the future, it will be desirable to have a map where we split models into different next edit requirements and capabilities,
      // Then use the model's name to retrieve all of its requirements (or better yet, have a model-specific logic inside children class).

      // Prefetching is also a relic of the past.
      // Before, I envisioned that we should call the model in the background to get next next edits.
      // Due to subpar results, lack of satisfactory next edit location suggestion algorithms and token cost/latency issues, I scratched the idea.

      let outcome: AutocompleteOutcome | NextEditOutcome | undefined;

      // TODO: We can probably decide here if we want to do the jumping logic.
      // If we aren't going to jump anyways, then we should be not be using the prefetch queue or the jump manager.
      // It would simplify the logic quite substantially.

      // Here, we introduce the concept of jumping and chains.
      // Jump and chain are next edit-specific concepts, and autocomplete has nothing to do with it.
      // Next edit is rendered to the users in three modes:
      // 1. Default. This is the case where the user either hasn't seen a next edit suggestion, or has rejected the previous one.
      // We would render either a ghost text or an SVG with deletion decoration.

      // 2. Jumping. This is the case where the user has just accepted a suggestion, and there are more suggestions in the chain to jump to.
      // We would render a Jump label suggesting the user to take the jump or reject.

      // 3. Jumped. This is when the user just accepted the jump.
      // We grab the next edit suggestion from the chain and render that instead of calling the model.

      // Determine why this method was triggered.
      const isJumping = this.jumpManager.isJumpInProgress();
      let chainExists = this.nextEditProvider.chainExists();
      const processedCount = this.prefetchQueue.processedCount;
      const unprocessedCount = this.prefetchQueue.unprocessedCount;
      // console.debug("isJumping:", isJumping, "/ chainExists:", chainExists);
      this.prefetchQueue.peekThreeProcessed();

      let resetChainInFullFileDiff = false;
      if (
        chainExists &&
        this.usingFullFileDiff &&
        processedCount === 0 &&
        unprocessedCount === 0
      ) {
        // Skipping jump logic due to empty queues while using full file diff
        await this.nextEditProvider.deleteChain();
        chainExists = false;
        resetChainInFullFileDiff = true;
      }

      if (isJumping && chainExists) {
        // Case 2: Jumping (chain exists, jump was taken)
        // console.debug("trigger reason: jumping");

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
        // console.debug("trigger reason: accepting");

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

            // Don't display anything yet. This will be handled in Case 2.
            // Recall from above that provideInlineCompletions runs on every cursor movement.
            return undefined;
          }
        }

        if (!isJumpSuggested) {
          // console.debug(
          //   "No suitable jump location found after trying all positions",
          // );
          this.nextEditProvider.deleteChain();
          return undefined;
        }
      } else {
        // Case 1: Typing (chain does not exist).
        // if resetChainInFullFileDiff is true then we are Rebuilding next edit chain after clearing empty queues in full file diff mode
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

          if (
            resetChainInFullFileDiff &&
            (!outcome ||
              (!outcome.completion && outcome.diffLines.length === 0))
          ) {
            // No next edit outcome after resetting chain; returning null
            return null;
          }

          // Start prefetching next edits if not using full file diff.
          // NOTE: this is better off not awaited. fire and forget.
          if (!this.usingFullFileDiff) {
            this.prefetchQueue.process(ctx);
          }

          // If initial outcome is null, suggest a jump instead.
          // Calling this method again will call it with chain active but jump not suggested yet.
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

      // Marking the outcome as displayed saves the current outcome as a value of the key completionId.
      // NOTE: It seems like autocomplete relies on this to be considered accepted.
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

      /* END OF MODEL OUTCOME RECEIVING BLOCK */

      /* START OF RENDERING BLOCK */

      // Here we determine how to render the outcome received in the previous block.
      // We check whether the outcome is a FIM completion or not.
      // If FIM, we render a ghost text, and an SVG + deletion decoration if not.
      // If we are using autocomplete instead of next edit, we just render a ghost text.

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
          // console.debug("deleteChain from completionProvider.ts: !fimText");
          this.nextEditProvider.deleteChain();
          return undefined;
        }

        // Track this ghost text for acceptance detection.
        // Ghost text acceptance can *technically* be acted upon in the command handler for "continue.logNextEditOutcomeAccept".
        // However, there is a substantial delay between accepting and logging, which introduces a lot of race conditions with different event handlers.
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
        // console.debug(
        //   "deleteChain from completionProvider.ts: diffLines.length === 0",
        // );
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

    /* END OF RENDERING BLOCK */
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
        // console.debug(
        //   `Won't display completion because text doesn't match: ${text}, ${outcome.completion}`,
        //   range,
        // );
        return false;
      }
    }

    if (abortSignal.aborted) {
      return false;
    }

    return true;
  }
}
