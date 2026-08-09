import {
  EditableRegionStrategy,
  getNextEditableRegion,
} from "core/nextEdit/NextEditEditableRegionCalculator";
import { PrefetchQueue } from "core/nextEdit/NextEditPrefetchQueue";
import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";
import { JumpManager } from "./JumpManager";
import { NextEditWindowManager } from "./NextEditWindowManager";
import {
  HandlerPriority,
  SelectionChangeManager,
} from "./SelectionChangeManager";

// Mock VSCode API
vi.mock("vscode", () => ({
  window: {
    activeTextEditor: {
      document: {
        uri: {
          toString: vi.fn().mockReturnValue("file:///test/file.ts"),
        },
        getText: vi.fn().mockReturnValue("Sample document text"),
        lineCount: 10,
        lineAt: vi.fn((line) => ({
          text: "sample line text",
          range: {
            start: { line, character: 0 },
            end: { line, character: 16 },
          },
        })),
      },
      selections: [
        {
          active: { line: 2, character: 5 },
          anchor: { line: 2, character: 5 },
        },
      ],
    },
  },
  Position: class {
    constructor(
      public line: number,
      public character: number,
    ) {}
  },
  Selection: class {
    constructor(
      public anchor: any,
      public active: any,
    ) {}
  },
}));

// Mock core dependencies
vi.mock("core/nextEdit/NextEditProvider", () => ({
  NextEditProvider: {
    getInstance: vi.fn(() => ({
      deleteChain: vi.fn(),
    })),
  },
}));

vi.mock("core/nextEdit/NextEditEditableRegionCalculator", () => ({
  EditableRegionStrategy: {
    Static: "static",
    Sliding: "sliding",
  },
  getNextEditableRegion: vi.fn(),
}));

vi.mock("core/nextEdit/NextEditPrefetchQueue", () => ({
  PrefetchQueue: {
    getInstance: vi.fn(() => ({
      enqueueUnprocessed: vi.fn(),
    })),
  },
}));

vi.mock("core/util/pathToUri", () => ({
  localPathOrUriToPath: vi.fn((uri) => uri.replace("file://", "")),
}));

vi.mock("../VsCodeIde", () => ({
  VsCodeIde: vi.fn(),
}));

vi.mock("./JumpManager", () => ({
  JumpManager: {
    getInstance: vi.fn(() => ({
      isJumpInProgress: vi.fn().mockReturnValue(false),
      wasJumpJustAccepted: vi.fn().mockReturnValue(false),
    })),
  },
}));

vi.mock("./NextEditWindowManager", () => ({
  NextEditWindowManager: {
    isInstantiated: vi.fn().mockReturnValue(false),
    getInstance: vi.fn(() => ({
      hasAccepted: vi.fn().mockReturnValue(false),
    })),
  },
}));

describe("SelectionChangeManager", () => {
  let selectionChangeManager: SelectionChangeManager;
  let mockIde: VsCodeIde;
  let mockDeleteChain: ReturnType<typeof vi.fn>;
  let mockEnqueueUnprocessed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup mock implementations
    mockDeleteChain = vi.fn();
    mockEnqueueUnprocessed = vi.fn();

    vi.mocked(NextEditProvider.getInstance).mockReturnValue({
      deleteChain: mockDeleteChain,
    } as any);

    vi.mocked(PrefetchQueue.getInstance).mockReturnValue({
      enqueueUnprocessed: mockEnqueueUnprocessed,
    } as any);

    vi.mocked(getNextEditableRegion).mockResolvedValue([
      {
        filepath: "/test/file.ts",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 },
        },
        // content: "test content",
        // cursorPosition: { line: 2, character: 5 },
      },
    ]);

    // Create mock context and webview protocol promise
    const mockContext = {
      subscriptions: [],
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(),
        keys: vi.fn().mockReturnValue([]),
      },
      globalState: {
        get: vi.fn(),
        update: vi.fn(),
        keys: vi.fn().mockReturnValue([]),
        setKeysForSync: vi.fn(),
      },
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
        delete: vi.fn(),
        onDidChange: vi.fn(),
      },
      extensionUri: { fsPath: "/mock/extension/path" } as any,
      extensionPath: "/mock/extension/path",
      environmentVariableCollection: {} as any,
      asAbsolutePath: vi.fn(),
      storageUri: undefined,
      storagePath: undefined,
      globalStorageUri: { fsPath: "/mock/global/storage" } as any,
      globalStoragePath: "/mock/global/storage",
      logUri: { fsPath: "/mock/log" } as any,
      logPath: "/mock/log",
      extensionMode: 1, // Production mode
      extension: {} as any,
    } as vscode.ExtensionContext;
    let resolveWebviewProtocol: any = undefined;
    const webviewProtocolPromise = new Promise<VsCodeWebviewProtocol>(
      (resolve) => {
        resolveWebviewProtocol = resolve;
      },
    );

    // Create VsCodeIde instance with proper constructor arguments
    mockIde = new VsCodeIde(webviewProtocolPromise, mockContext);

    // Get a fresh instance
    selectionChangeManager = SelectionChangeManager.getInstance();

    // Clear any existing listeners from previous tests
    const privateManager = selectionChangeManager as any;
    privateManager.listeners = [];

    selectionChangeManager.initialize(mockIde, false);
  });

  afterEach(() => {
    // Clear any timers
    vi.clearAllTimers();

    // Reset all private state to prevent test interference
    const privateManager = selectionChangeManager as any;
    privateManager.listeners = [];
    privateManager.eventQueue = [];
    privateManager.lastEventTime = 0;
    privateManager.isProcessingEvent = false;
    if (privateManager.processingTimeout) {
      clearTimeout(privateManager.processingTimeout);
      privateManager.processingTimeout = null;
    }
    privateManager.isTypingSession = false;
    if (privateManager.typingTimer) {
      clearTimeout(privateManager.typingTimer);
      privateManager.typingTimer = null;
    }
    privateManager.lastDocumentChangeTime = 0;
  });

  describe("getInstance", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = SelectionChangeManager.getInstance();
      const instance2 = SelectionChangeManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("initialize", () => {
    it("should set up IDE and register default fallback handler", () => {
      const newManager = new (SelectionChangeManager as any)();
      const registerSpy = vi.spyOn(newManager, "registerListener");

      newManager.initialize(mockIde, true);

      expect(registerSpy).toHaveBeenCalledWith(
        "defaultFallbackHandler",
        expect.any(Function),
        HandlerPriority.FALLBACK,
      );
    });
  });

  describe("documentChanged", () => {
    it("should set typing session to true and update last document change time", () => {
      const beforeTime = Date.now();
      selectionChangeManager.documentChanged();
      const afterTime = Date.now();

      // Access private properties for testing
      const privateManager = selectionChangeManager as any;
      expect(privateManager.isTypingSession).toBe(true);
      expect(privateManager.lastDocumentChangeTime).toBeGreaterThanOrEqual(
        beforeTime,
      );
      expect(privateManager.lastDocumentChangeTime).toBeLessThanOrEqual(
        afterTime,
      );
    });

    it("should reset typing session timer", () => {
      vi.useFakeTimers();

      selectionChangeManager.documentChanged();
      const privateManager = selectionChangeManager as any;

      expect(privateManager.isTypingSession).toBe(true);

      // Fast-forward past the typing session timeout
      vi.advanceTimersByTime(2100); // TYPING_SESSION_TIMEOUT is 2000ms

      expect(privateManager.isTypingSession).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("registerListener", () => {
    it("should register a handler with correct priority", () => {
      const mockHandler = vi.fn();
      const unregister = selectionChangeManager.registerListener(
        "testHandler",
        mockHandler,
        HandlerPriority.HIGH,
      );

      // Access private listeners array
      const privateManager = selectionChangeManager as any;
      const testHandler = privateManager.listeners.find(
        (l: any) => l.id === "testHandler",
      );

      expect(testHandler).toBeDefined();
      expect(testHandler.priority).toBe(HandlerPriority.HIGH);
      expect(testHandler.handler).toBe(mockHandler);

      // Test unregister function
      unregister();
      const afterUnregister = privateManager.listeners.find(
        (l: any) => l.id === "testHandler",
      );
      expect(afterUnregister).toBeUndefined();
    });

    it("should replace existing handler with same id", () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      selectionChangeManager.registerListener(
        "testHandler",
        firstHandler,
        HandlerPriority.NORMAL,
      );

      selectionChangeManager.registerListener(
        "testHandler",
        secondHandler,
        HandlerPriority.HIGH,
      );

      const privateManager = selectionChangeManager as any;
      const handlers = privateManager.listeners.filter(
        (l: any) => l.id === "testHandler",
      );

      expect(handlers).toHaveLength(1);
      expect(handlers[0].handler).toBe(secondHandler);
      expect(handlers[0].priority).toBe(HandlerPriority.HIGH);
    });

    it("should sort handlers by priority in descending order", () => {
      selectionChangeManager.registerListener(
        "low",
        vi.fn(),
        HandlerPriority.LOW,
      );
      selectionChangeManager.registerListener(
        "critical",
        vi.fn(),
        HandlerPriority.CRITICAL,
      );
      selectionChangeManager.registerListener(
        "normal",
        vi.fn(),
        HandlerPriority.NORMAL,
      );

      const privateManager = selectionChangeManager as any;
      const priorities = privateManager.listeners.map((l: any) => l.priority);

      // Should be sorted in descending order (CRITICAL=5, NORMAL=3, LOW=2, FALLBACK=1)
      expect(priorities[0]).toBe(HandlerPriority.CRITICAL);
      expect(priorities[1]).toBe(HandlerPriority.NORMAL);
      expect(priorities[2]).toBe(HandlerPriority.LOW);
      expect(priorities[3]).toBe(HandlerPriority.FALLBACK);
    });
  });

  describe("handleSelectionChange", () => {
    let mockEvent: vscode.TextEditorSelectionChangeEvent;
    let mockEvent1: vscode.TextEditorSelectionChangeEvent;
    let mockEvent2: vscode.TextEditorSelectionChangeEvent;
    let mockEvent3: vscode.TextEditorSelectionChangeEvent;

    beforeEach(() => {
      mockEvent = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      mockEvent1 = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(0, 1),
          ),
        ],
        kind: undefined,
      };

      mockEvent2 = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(1, 0),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      mockEvent3 = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 0),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };
    });

    it("should queue event if already processing", async () => {
      vi.useFakeTimers();

      // Mock Date.now to work with fake timers
      const mockDateNow = vi.spyOn(Date, "now");
      let currentTime = 1000; // Start at some arbitrary time
      mockDateNow.mockImplementation(() => currentTime);

      let firstHandlerResolve: (value: boolean) => void;
      let handlerCallCount = 0;

      const slowHandler = vi.fn().mockImplementation(() => {
        handlerCallCount++;
        if (handlerCallCount === 1) {
          return new Promise<boolean>((resolve) => {
            firstHandlerResolve = resolve;
          });
        } else {
          return Promise.resolve(true);
        }
      });

      selectionChangeManager.registerListener(
        "slowHandler",
        slowHandler,
        HandlerPriority.HIGH,
      );

      // First event - should bypass debouncing and start processing immediately
      const firstEventPromise =
        selectionChangeManager.handleSelectionChange(mockEvent1);

      // Advance time to simulate the first event being processed
      currentTime += 10; // Small increment to simulate processing start
      vi.advanceTimersByTime(10);

      expect(slowHandler).toHaveBeenCalledTimes(1);

      // Second event comes quickly (within DEBOUNCE_DELAY of 50ms)
      currentTime += 10; // Total elapsed: 10ms (< 50ms DEBOUNCE_DELAY)
      const secondEventPromise =
        selectionChangeManager.handleSelectionChange(mockEvent2);

      // The second event should be queued due to isProcessingEvent = true, not debouncing
      expect(slowHandler).toHaveBeenCalledTimes(1); // Still only called once

      // Third event comes within debounce window, replacing the second event.
      currentTime += 10; // Total elapsed: 30ms (< 50ms DEBOUNCE_DELAY)
      const thirdEventPromise =
        selectionChangeManager.handleSelectionChange(mockEvent3);

      // Still should only be called once
      expect(slowHandler).toHaveBeenCalledTimes(1);

      // Now resolve the first handler to allow queued events to process
      firstHandlerResolve!(true);

      // Advance time to allow any pending timers to resolve
      vi.advanceTimersByTime(100);

      // Wait for all events to complete
      await Promise.all([
        firstEventPromise,
        secondEventPromise,
        thirdEventPromise,
      ]);

      // Should have been called twice total:
      // - Once for the first event
      // - Once for the last queued event (debouncing replaces earlier queued events)
      expect(slowHandler).toHaveBeenCalledTimes(2);

      mockDateNow.mockRestore();
      vi.useRealTimers();
    });

    it("should implement debouncing for rapid events", async () => {
      vi.useFakeTimers();

      const mockHandler = vi.fn().mockResolvedValue(true);
      selectionChangeManager.registerListener(
        "testHandler",
        mockHandler,
        HandlerPriority.HIGH,
      );

      // Fire multiple events rapidly
      selectionChangeManager.handleSelectionChange(mockEvent);
      selectionChangeManager.handleSelectionChange(mockEvent);
      selectionChangeManager.handleSelectionChange(mockEvent);

      // Only the last event should be queued due to debouncing
      const privateManager = selectionChangeManager as any;
      expect(privateManager.eventQueue).toHaveLength(1);

      vi.useRealTimers();
    });

    it("should handle timeout for slow processing", async () => {
      vi.useFakeTimers();

      const slowHandler = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => {
              console.log("Slow handler resolving");
              resolve(true);
            }, 1000),
          ),
      );

      selectionChangeManager.registerListener(
        "slowHandler",
        slowHandler,
        HandlerPriority.HIGH,
      );

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Start processing and advance past timeout
      console.log("Starting event processing");
      const eventPromise =
        selectionChangeManager.handleSelectionChange(mockEvent);

      console.log("Advancing timers by 600ms");
      vi.advanceTimersByTime(700); // PROCESSING_TIMEOUT is 500ms

      try {
        await eventPromise;
        console.log("Event promise resolved successfully");
      } catch (error) {
        console.log("Event promise rejected:", error);
      }

      console.log("Console error calls:", consoleErrorSpy.mock.calls);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      vi.useRealTimers();
    });

    it("should handle errors in handlers gracefully", async () => {
      const errorHandler = vi
        .fn()
        .mockRejectedValue(new Error("Handler error"));
      const goodHandler = vi.fn().mockResolvedValue(true);

      selectionChangeManager.registerListener(
        "errorHandler",
        errorHandler,
        HandlerPriority.HIGH,
      );
      selectionChangeManager.registerListener(
        "goodHandler",
        goodHandler,
        HandlerPriority.NORMAL,
      );

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await selectionChangeManager.handleSelectionChange(mockEvent);

      expect(errorHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in selection change handler:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("captureState", () => {
    beforeEach(() => {
      vi.resetAllMocks();

      // Explicitly set up the mocks. For some reason the toplevel mock leaves these as undefined.
      vi.mocked(NextEditWindowManager.isInstantiated).mockReturnValue(false);
      vi.mocked(NextEditWindowManager.getInstance).mockReturnValue({
        hasAccepted: vi.fn().mockReturnValue(false),
      } as any);

      vi.mocked(JumpManager.getInstance).mockReturnValue({
        isJumpInProgress: vi.fn().mockReturnValue(false),
        wasJumpJustAccepted: vi.fn().mockReturnValue(false),
      } as any);
    });

    it("should capture current state snapshot", () => {
      const mockEvent: vscode.TextEditorSelectionChangeEvent = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      // Setup some state
      selectionChangeManager.documentChanged();

      const privateManager = selectionChangeManager as any;
      const state = privateManager.captureState(mockEvent);

      expect(state).toEqual({
        nextEditWindowAccepted: false,
        jumpInProgress: false,
        jumpJustAccepted: false,
        lastDocumentChangeTime: expect.any(Number),
        isTypingSession: true,
        document: mockEvent.textEditor.document,
        cursorPosition: mockEvent.selections[0].active,
      });
    });

    it("should reflect NextEditWindowManager acceptance state", () => {
      vi.mocked(NextEditWindowManager.isInstantiated).mockReturnValue(true);
      vi.mocked(NextEditWindowManager.getInstance).mockReturnValue({
        hasAccepted: vi.fn().mockReturnValue(true),
      } as any);

      const mockEvent: vscode.TextEditorSelectionChangeEvent = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      const privateManager = selectionChangeManager as any;
      const state = privateManager.captureState(mockEvent);

      expect(state.nextEditWindowAccepted).toBe(true);
    });

    it("should reflect JumpManager state", () => {
      vi.mocked(JumpManager.getInstance).mockReturnValue({
        isJumpInProgress: vi.fn().mockReturnValue(true),
        wasJumpJustAccepted: vi.fn().mockReturnValue(true),
      } as any);

      const mockEvent: vscode.TextEditorSelectionChangeEvent = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      const privateManager = selectionChangeManager as any;
      const state = privateManager.captureState(mockEvent);

      expect(state.jumpInProgress).toBe(true);
      expect(state.jumpJustAccepted).toBe(true);
    });
  });

  describe("defaultFallbackHandler", () => {
    it("should call deleteChain on NextEditProvider", async () => {
      const mockEvent: vscode.TextEditorSelectionChangeEvent = {
        textEditor: {
          ...vscode.window.activeTextEditor!,
          document: {
            //@ts-ignore
            uri: {
              toString: vi.fn().mockReturnValue("file:///test/file.ts"),
            },
          },
        },
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      const mockState = {
        nextEditWindowAccepted: false,
        jumpInProgress: false,
        jumpJustAccepted: false,
        lastDocumentChangeTime: Date.now(),
        isTypingSession: false,
        document: mockEvent.textEditor.document,
        cursorPosition: mockEvent.selections[0].active,
      };

      const privateManager = selectionChangeManager as any;
      const result = await privateManager.defaultFallbackHandler(
        mockEvent,
        mockState,
      );

      expect(mockDeleteChain).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should handle missing IDE gracefully", async () => {
      const mockEvent: vscode.TextEditorSelectionChangeEvent = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      const mockState = {
        nextEditWindowAccepted: false,
        jumpInProgress: false,
        jumpJustAccepted: false,
        lastDocumentChangeTime: Date.now(),
        isTypingSession: false,
        document: mockEvent.textEditor.document,
        cursorPosition: mockEvent.selections[0].active,
      };

      const privateManager = selectionChangeManager as any;
      privateManager.ide = null;

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await privateManager.defaultFallbackHandler(
        mockEvent,
        mockState,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "IDE not initialized in SelectionChangeManager",
      );
      expect(result).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it("should prefetch editable regions when not using full file diff", async () => {
      // Initialize with usingFullFileDiff = false
      const newManager = SelectionChangeManager.getInstance();
      newManager.initialize(mockIde, false);

      const mockEvent: vscode.TextEditorSelectionChangeEvent = {
        textEditor: {
          ...vscode.window.activeTextEditor!,
          document: {
            //@ts-ignore
            uri: {
              toString: vi.fn().mockReturnValue("file:///test/file.ts"),
            },
          },
        },
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      const mockState = {
        nextEditWindowAccepted: false,
        jumpInProgress: false,
        jumpJustAccepted: false,
        lastDocumentChangeTime: Date.now(),
        isTypingSession: false,
        document: mockEvent.textEditor.document,
        cursorPosition: mockEvent.selections[0].active,
      };

      const mockRegions = [
        {
          filepath: "/test/file.ts",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          // content: "test content",
          // cursorPosition: { line: 2, character: 5 },
        },
      ];

      vi.mocked(getNextEditableRegion).mockResolvedValue(mockRegions);

      const privateManager = newManager as any;
      await privateManager.defaultFallbackHandler(mockEvent, mockState);

      expect(getNextEditableRegion).toHaveBeenCalledWith(
        EditableRegionStrategy.Static,
        {
          cursorPosition: mockEvent.selections[0].anchor,
          filepath: "/test/file.ts",
          ide: mockIde,
        },
      );

      expect(mockEnqueueUnprocessed).toHaveBeenCalledWith(mockRegions[0]);
    });

    it("should skip prefetching when using full file diff", async () => {
      // Initialize with usingFullFileDiff = true
      const newManager = SelectionChangeManager.getInstance();
      newManager.initialize(mockIde, true);

      const mockEvent: vscode.TextEditorSelectionChangeEvent = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      const mockState = {
        nextEditWindowAccepted: false,
        jumpInProgress: false,
        jumpJustAccepted: false,
        lastDocumentChangeTime: Date.now(),
        isTypingSession: false,
        document: mockEvent.textEditor.document,
        cursorPosition: mockEvent.selections[0].active,
      };

      const privateManager = newManager as any;
      await privateManager.defaultFallbackHandler(mockEvent, mockState);

      expect(getNextEditableRegion).not.toHaveBeenCalled();
      expect(mockEnqueueUnprocessed).not.toHaveBeenCalled();
    });
  });

  describe("handler execution order", () => {
    it("should execute handlers in priority order and stop on first true return", async () => {
      const handler1 = vi.fn().mockResolvedValue(false);
      const handler2 = vi.fn().mockResolvedValue(true);
      const handler3 = vi.fn().mockResolvedValue(false);
      const fallbackHandler = vi.fn().mockResolvedValue(true);

      selectionChangeManager.registerListener(
        "handler1",
        handler1,
        HandlerPriority.CRITICAL,
      );
      selectionChangeManager.registerListener(
        "handler2",
        handler2,
        HandlerPriority.HIGH,
      );
      selectionChangeManager.registerListener(
        "handler3",
        handler3,
        HandlerPriority.NORMAL,
      );

      const mockEvent: vscode.TextEditorSelectionChangeEvent = {
        textEditor: vscode.window.activeTextEditor!,
        selections: [
          new vscode.Selection(
            new vscode.Position(2, 5),
            new vscode.Position(2, 5),
          ),
        ],
        kind: undefined,
      };

      await selectionChangeManager.handleSelectionChange(mockEvent);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled(); // Should not be called because handler2 returned true
      expect(mockDeleteChain).not.toHaveBeenCalled(); // Fallback should not run
    });
  });
});
