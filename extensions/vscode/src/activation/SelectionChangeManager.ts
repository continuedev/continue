import {
  EditableRegionStrategy,
  getNextEditableRegion,
} from "core/nextEdit/NextEditEditableRegionCalculator";
import { PrefetchQueue } from "core/nextEdit/NextEditPrefetchQueue";
import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { localPathOrUriToPath } from "core/util/pathToUri";
import * as vscode from "vscode";
import { VsCodeIde } from "../VsCodeIde";
import { JumpManager } from "./JumpManager";
import { NextEditWindowManager } from "./NextEditWindowManager";

export enum HandlerPriority {
  CRITICAL = 5,
  HIGH = 4,
  NORMAL = 3,
  LOW = 2,
  FALLBACK = 1,
}

interface StateSnapshot {
  nextEditWindowAccepted: boolean;
  jumpInProgress: boolean;
  jumpJustAccepted: boolean;
  lastDocumentChangeTime: number;
  isTypingSession: boolean;
  document?: vscode.TextDocument;
  cursorPosition?: vscode.Position;
}

type SelectionChangeHandler = (
  e: vscode.TextEditorSelectionChangeEvent,
  state: StateSnapshot,
) => Promise<boolean>;

interface HandlerRegistration {
  id: string;
  priority: number;
  handler: SelectionChangeHandler;
}

/**
 * SelectionChangeManager handles cursor movement events in a coordinated way
 * to prevent race conditions and ensure consistent behavior across features.
 *
 * Case 1: User just moves the cursor around.
 * - vscode fires onDidChangeTextEditorSelection.
 * - State is captured. All fields in StateSnapshot are false.
 * - All registered handlers return false.
 * - Fallback handler runs, deleting the chain.
 *
 * Case 2: User accepts a next edit suggestion from a window.
 * - vscode fires onDidChangeTextEditorSelection.
 * - State is captured. nextEditWindowAccepted is true.
 * - NextEditWindowManager's handler returns true.
 * - No other handlers run, and edit chain is preserved.
 *
 * Case 3: User accepts a next edit suggestion from a ghost text.
 * - vscode fires onDidChangeTextEditorSelection.
 * - State is captured with document and cursorPosition.
 * - GhostTextTracker's handler checks if ghost text was accepted at that position.
 * - If accepted, handler returns true and edit chain is preserved.
 *
 * Case 4: User is actively typing code.
 * - Each keystroke triggers documentChanged() to update lastDocumentChangeTime.
 * - When cursor moves due to typing, onDidChangeTextEditorSelection fires.
 * - State is captured with isTypingSession=true and recent lastDocumentChangeTime.
 * - Typing session handler detects time since last edit is < TYPING_DELAY.
 * - Handler returns true, preserving the edit chain during typing.
 *
 * Case 5: User performs a jump operation.
 * - Jump is initiated, setting jumpInProgress to true.
 * - When cursor position changes due to jump, onDidChangeTextEditorSelection fires.
 * - State is captured with jumpInProgress=true.
 * - JumpManager's handler returns true, preserving the edit chain.
 *
 * Case 6: User just completed a jump operation.
 * - Jump completes, setting jumpJustAccepted to true.
 * - onDidChangeTextEditorSelection fires for the final position.
 * - State is captured with jumpJustAccepted=true.
 * - JumpManager's handler returns true, preserving the edit chain.
 *
 * Case 7: Rapid cursor movements (debouncing).
 * - User rapidly moves cursor (e.g., holding an arrow key).
 * - Multiple onDidChangeTextEditorSelection events fire in quick succession.
 * - Events within DEBOUNCE_DELAY of each other are queued.
 * - Only the most recent event in a rapid sequence gets processed.
 * - Prevents performance issues from too many events.
 *
 * Case 8: Event processing timeout.
 * - An event handler takes longer than PROCESSING_TIMEOUT.
 * - The timeout promise resolves first, throwing an error.
 * - Error is caught, processing state is reset to prevent deadlocks.
 * - System can continue processing the next event.
 * - NOTE: At the current moment, there should not be any deadlocks, but I'm just making sure.
 *
 * Case 9: Error in handler.
 * - One of the handlers throws an exception.
 * - The error is caught and logged.
 * - Processing continues with the next handler rather than failing completely.
 * - Ensures stability even when individual handlers have problems.
 *
 * Case 10: Multiple queued events.
 * - An event is being processed when new events arrive.
 * - New events are added to eventQueue.
 * - After current event is processed, queued events are handled sequentially.
 * - Ensures all events are processed in the order they were received.
 * - NOTE: I'm not sure if we even want to queue these events...
 *
 * Case n: Other cases that I didn't catch.
 */
export class SelectionChangeManager {
  private static instance: SelectionChangeManager;
  private listeners: HandlerRegistration[] = [];
  private ide: VsCodeIde | null = null;
  private usingFullFileDiff: boolean = true;

  // Event bus-related attributes.
  private eventQueue: vscode.TextEditorSelectionChangeEvent[] = [];
  private lastEventTime = 0;
  private isProcessingEvent = false;
  private processingTimeout: NodeJS.Timeout | null = null;

  // Debounce settings.
  private readonly DEBOUNCE_DELAY = 50;
  private readonly PROCESSING_TIMEOUT = 500;

  // Track typing session state.
  private isTypingSession = false;
  private typingTimer: NodeJS.Timeout | null = null;
  private lastDocumentChangeTime = 0;
  private readonly TYPING_SESSION_TIMEOUT = 2000; // ms

  private constructor() {}

  public static getInstance() {
    if (!SelectionChangeManager.instance) {
      SelectionChangeManager.instance = new SelectionChangeManager();
    }
    return SelectionChangeManager.instance;
  }

  public initialize(ide: VsCodeIde, usingFullFileDiff: boolean): void {
    this.ide = ide;
    this.usingFullFileDiff = usingFullFileDiff;

    // After handling all other listeners, this will delete the chain.
    this.registerListener(
      "defaultFallbackHandler",
      this.defaultFallbackHandler.bind(this),
      HandlerPriority.FALLBACK,
    );
  }

  /**
   * Updates this class's usingFullFileDiff flag.
   * @param usingFullFileDiff New value to set.
   */
  public updateUsingFullFileDiff(usingFullFileDiff: boolean) {
    this.usingFullFileDiff = usingFullFileDiff;
  }

  public documentChanged(): void {
    this.isTypingSession = true;
    this.lastDocumentChangeTime = Date.now();
    this.resetTypingSession();
  }

  private resetTypingSession(): void {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    this.typingTimer = setTimeout(() => {
      this.isTypingSession = false;
    }, this.TYPING_SESSION_TIMEOUT);
  }

  /**
   * Register a listener for the selection change event.
   * @param id Unique id for this handler.
   * @param handler Function to handle the event.
   * @param priority Higher priority runs first.
   * @returns Function to unregister this listener.
   */
  public registerListener(
    id: string,
    handler: SelectionChangeHandler,
    priority: HandlerPriority = HandlerPriority.NORMAL,
  ): () => void {
    // Remove any existing handler with the same id.
    this.listeners = this.listeners.filter((l) => l.id !== id);

    // Add the new handler.
    this.listeners.push({ id, priority, handler });

    // Sort by desc priority.
    this.listeners.sort((a, b) => b.priority - a.priority);

    // Return the unregister function.
    return () => {
      this.listeners = this.listeners.filter((l) => l.id !== id);
    };
  }

  /**
   * Handle a given selection change event.
   * @param e THe selection change event.
   */
  public async handleSelectionChange(
    e: vscode.TextEditorSelectionChangeEvent,
  ): Promise<void> {
    const now = Date.now();

    // Simple debouncing logic.
    // Ignore events that come too quickly after the previous one.
    // TODO: test this.
    if (now - this.lastEventTime < this.DEBOUNCE_DELAY) {
      // Replace the queued event with the most recent one.
      if (this.eventQueue.length > 0) {
        this.eventQueue[this.eventQueue.length - 1] = e;
      } else {
        this.eventQueue.push(e);
      }

      return;
    }

    this.lastEventTime = now;

    // Queue this event for later if the manager is already processing an event.
    // NOTE: Depending on if we want an event bus or not, do an early return instead.
    if (this.isProcessingEvent) {
      this.eventQueue.push(e);
      return;
    }

    try {
      // Process this event first.
      await this.processEventWithTimeout(e);

      // Process remaining queued events sequentially.
      // NOTE: Depending on if we want an event bus or not, skip this.
      while (this.eventQueue.length > 0) {
        const nextEvent = this.eventQueue.shift()!;
        await this.processEventWithTimeout(nextEvent);
      }
    } catch (err) {
      console.error("Error processing selection change event:", err);
      this.isProcessingEvent = false;
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
        this.processingTimeout = null;
      }
    }
  }

  /**
   * Process a given event with a timeout.
   * This is in attempt to prevent deadlocks between events.
   * @param e The selection change event.
   */
  private async processEventWithTimeout(
    e: vscode.TextEditorSelectionChangeEvent,
  ): Promise<void> {
    this.isProcessingEvent = true;

    // Set up a timeout to prevent deadlocks.
    const timeoutPromise = new Promise<void>((_, reject) => {
      this.processingTimeout = setTimeout(() => {
        reject(new Error("Selection change event processing timed out"));
      }, this.PROCESSING_TIMEOUT);
    });

    try {
      await Promise.race([this.processEvent(e), timeoutPromise]);
    } finally {
      // Clean up.
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
        this.processingTimeout = null;
      }

      this.isProcessingEvent = false;
    }
  }

  /**
   * Core event processing logic.
   * @param e The selection change event.
   */
  private async processEvent(
    e: vscode.TextEditorSelectionChangeEvent,
  ): Promise<void> {
    const snapshot = this.captureState(e);

    for (const { handler } of this.listeners) {
      try {
        if (await handler(e, snapshot)) {
          return;
        }
      } catch (err) {
        console.error("Error in selection change handler:", err);
        // Don't break just yet -- go to next handler.
      }
    }
  }

  private captureState(
    e: vscode.TextEditorSelectionChangeEvent,
  ): StateSnapshot {
    return {
      nextEditWindowAccepted:
        NextEditWindowManager.isInstantiated() &&
        NextEditWindowManager.getInstance().hasAccepted(),
      jumpInProgress: JumpManager.getInstance().isJumpInProgress(),
      jumpJustAccepted: JumpManager.getInstance().wasJumpJustAccepted(),
      lastDocumentChangeTime: this.lastDocumentChangeTime,
      isTypingSession: this.isTypingSession,
      document: e.textEditor.document,
      cursorPosition: e.selections[0].active,
    };
  }

  private async defaultFallbackHandler(
    e: vscode.TextEditorSelectionChangeEvent,
    state: StateSnapshot,
  ): Promise<boolean> {
    if (!this.ide) {
      console.error("IDE not initialized in SelectionChangeManager");
      return false;
    }

    // console.debug(
    //   "defaultFallbackHandler: deleteChain called from onDidChangeTextEditorSelection",
    // );
    await NextEditProvider.getInstance().deleteChain();

    if (!this.usingFullFileDiff) {
      const nextEditableRegions =
        (await getNextEditableRegion(EditableRegionStrategy.Static, {
          cursorPosition: e.selections[0].anchor,
          filepath: localPathOrUriToPath(e.textEditor.document.uri.toString()),
          ide: this.ide,
        })) ?? [];
      // (await getNextEditableRegion(EditableRegionStrategy.Sliding, {
      //   filepath: localPathOrUriToPath(e.textEditor.document.uri.toString()),
      //   fileLines: e.textEditor.document.getText().split("\n"),
      // })) ?? [];

      nextEditableRegions.forEach((region) => {
        PrefetchQueue.getInstance().enqueueUnprocessed(region);
      });
    }

    return true;
  }
}
