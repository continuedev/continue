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
  CRITICAL = 1000,
  HIGH = 800,
  NORMAL = 500,
  LOW = 200,
  FALLBACK = 100,
}

interface StateSnapshot {
  nextEditWindowAccepted: boolean;
  jumpInProgress: boolean;
  jumpJustAccepted: boolean;
  lastDocumentChangeTime: number;
  isTypingSession: boolean;
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

export class SelectionChangeManager {
  private static instance: SelectionChangeManager;
  private listeners: HandlerRegistration[] = [];
  private ide: VsCodeIde | null = null;

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
  private readonly TYPING_DELAY = 500; // ms

  private constructor() {}

  public static getInstance() {
    if (!SelectionChangeManager.instance) {
      SelectionChangeManager.instance = new SelectionChangeManager();
    }
    return SelectionChangeManager.instance;
  }

  public initialize(ide: VsCodeIde): void {
    this.ide = ide;

    // After handling all other listeners, this will delete the chain.
    this.registerListener(
      "defaultFallbackHandler",
      this.defaultFallbackHandler.bind(this),
      HandlerPriority.FALLBACK,
    );
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
    if (this.isProcessingEvent) {
      this.eventQueue.push(e);
      return;
    }

    try {
      // Process this event first.
      await this.processEventWithTimeout(e);

      // Process remaining queued events sequentially.
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
    const snapshot = this.captureState();

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

  private captureState(): StateSnapshot {
    return {
      nextEditWindowAccepted:
        NextEditWindowManager.isInstantiated() &&
        NextEditWindowManager.getInstance().hasAccepted(),
      jumpInProgress: JumpManager.getInstance().isJumpInProgress(),
      jumpJustAccepted: JumpManager.getInstance().wasJumpJustAccepted(),
      lastDocumentChangeTime: this.lastDocumentChangeTime,
      isTypingSession: this.isTypingSession,
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

    console.log(
      "defaultFallbackHandler: deleteChain called from onDidChangeTextEditorSelection",
    );
    await NextEditProvider.getInstance().deleteChain();

    const nextEditableRegions =
      (await getNextEditableRegion(EditableRegionStrategy.Static, {
        cursorPosition: e.selections[0].anchor,
        filepath: localPathOrUriToPath(e.textEditor.document.uri.toString()),
        ide: this.ide,
      })) ?? [];

    nextEditableRegions.forEach((region) => {
      PrefetchQueue.getInstance().enqueueUnprocessed(region);
    });

    return true;
  }
}
