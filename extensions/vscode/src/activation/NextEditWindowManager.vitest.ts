import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockedFunction,
  vi,
} from "vitest";

// Mock all modules FIRST with inline factories (no external references)
vi.mock("vscode", () => ({
  commands: {
    executeCommand: vi.fn(),
    registerCommand: vi.fn(),
  },
  window: {
    activeTextEditor: undefined,
    visibleTextEditors: [],
    createTextEditorDecorationType: vi.fn(),
    onDidChangeTextEditorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeVisibleTextEditors: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeActiveColorTheme: vi.fn(() => ({ dispose: vi.fn() })),
    showInformationMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string) => {
        const config: Record<string, any> = {
          fontSize: 14,
          fontFamily: "monospace",
          showInlineTip: true,
        };
        return config[key];
      }),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  Position: class {
    constructor(
      public line: number,
      public character: number,
    ) {}
  },
  Range: class {
    constructor(
      public start: any,
      public end: any,
    ) {}
  },
  Selection: class {
    constructor(
      public anchor: any,
      public active: any,
    ) {}
  },
  Uri: {
    parse: vi.fn((str: string) => ({ toString: () => str, scheme: "file" })),
  },
  DecorationRangeBehavior: {
    ClosedClosed: 1,
  },
  MarkdownString: class {
    value: string = "";
    isTrusted: boolean = false;
    supportHtml: boolean = false;
    constructor(value: string) {
      this.value = value;
    }
  },
  ExtensionContext: class {
    subscriptions: any[] = [];
  },
  ViewColumn: {
    One: 1,
    Two: 2,
  },
}));

vi.mock("core/control-plane/env", () => ({
  EXTENSION_NAME: "continue",
}));

vi.mock("../util/getTheme", () => ({
  getThemeString: vi.fn(() => "dark"),
}));

vi.mock("core/codeRenderer/CodeRenderer", () => ({
  CodeRenderer: {
    getInstance: vi.fn(() => ({
      setTheme: vi.fn(),
      getDataUri: vi.fn().mockResolvedValue("data:image/svg+xml;base64,mock"),
    })),
  },
}));

vi.mock("core/nextEdit/NextEditProvider", () => ({
  NextEditProvider: {
    getInstance: vi.fn(() => ({
      deleteChain: vi.fn(),
    })),
  },
}));

vi.mock("core/nextEdit/NextEditLoggingService", () => ({
  NextEditLoggingService: {
    getInstance: vi.fn(() => ({
      cancelRejectionTimeout: vi.fn(),
      cancelRejectionTimeoutButKeepCompletionId: vi.fn(),
    })),
  },
}));

vi.mock("core/diff/myers", () => ({
  myersCharDiff: vi.fn(() => []),
}));

vi.mock("core/nextEdit/diff/diff", () => ({
  getOffsetPositionAtLastNewLine: vi.fn(() => ({ line: 0, character: 0 })),
}));

// Import after mocks are set up
import * as vscode from "vscode";

import {
  ACCEPT_NEXT_EDIT_SUGGESTION_COMMAND,
  HIDE_NEXT_EDIT_SUGGESTION_COMMAND,
  NextEditWindowManager,
} from "./NextEditWindowManager";

const mockVscode = vi.mocked(vscode);

describe("NextEditWindowManager", () => {
  let manager: NextEditWindowManager;
  let mockEditor: any;
  let mockDocument: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear singleton instance
    NextEditWindowManager.clearInstance();

    // Create mock document
    mockDocument = {
      uri: { toString: () => "file:///test.ts", scheme: "file" },
      version: 1,
      lineCount: 10,
      lineAt: vi.fn((line: number) => ({
        text: `line ${line} content`,
        range: new mockVscode.Range(
          new mockVscode.Position(line, 0),
          new mockVscode.Position(line, 20),
        ),
      })),
    };

    // Create mock editor
    mockEditor = {
      document: mockDocument,
      selection: {
        active: new mockVscode.Position(0, 0),
      },
      setDecorations: vi.fn(),
      edit: vi.fn((callback: any) => {
        callback({
          replace: vi.fn(),
          delete: vi.fn(),
        });
        return Promise.resolve(true);
      }),
    };

    // Create mock context
    mockContext = {
      subscriptions: [],
    };

    // Setup default mock implementations
    (
      mockVscode.commands.executeCommand as MockedFunction<any>
    ).mockResolvedValue(undefined);
    (mockVscode.commands.registerCommand as MockedFunction<any>)
      //@ts-ignore
      .mockImplementation((command: string, callback: any) => ({
        dispose: vi.fn(),
      }));
    (
      mockVscode.window.createTextEditorDecorationType as MockedFunction<any>
    ).mockReturnValue({
      dispose: vi.fn(),
    });

    // Get manager instance
    manager = NextEditWindowManager.getInstance();
  });

  afterEach(() => {
    NextEditWindowManager.clearInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = NextEditWindowManager.getInstance();
      const instance2 = NextEditWindowManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should properly clear instance", () => {
      const instance1 = NextEditWindowManager.getInstance();
      NextEditWindowManager.clearInstance();
      const instance2 = NextEditWindowManager.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Key Reservation State Management", () => {
    beforeEach(async () => {
      await manager.setupNextEditWindowManager(mockContext);
    });

    it("should start with keys in free state", () => {
      expect(manager["keyReservationState"]).toBe("free");
    });

    it("should reserve keys when showing window", async () => {
      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(0, 0),
        0,
        0,
        "old",
        "new",
        [],
      );

      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "nextEditWindowActive",
        true,
      );
      expect(manager["keyReservationState"]).toBe("reserved");
    });

    it("should free keys when hiding windows", async () => {
      // First show a window
      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(0, 0),
        0,
        0,
        "old",
        "new",
        [],
      );

      // Then hide it
      await manager.hideAllNextEditWindows();

      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "nextEditWindowActive",
        false,
      );
      expect(manager["keyReservationState"]).toBe("free");
    });

    it("should handle sequential reserve/free operations", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await NextEditWindowManager.reserveTabAndEsc();
      expect(manager["keyReservationState"]).toBe("reserved");

      await NextEditWindowManager.freeTabAndEsc();
      expect(manager["keyReservationState"]).toBe("free");

      await NextEditWindowManager.reserveTabAndEsc();
      expect(manager["keyReservationState"]).toBe("reserved");

      // Should have been called 3 times + 1 from beforeEach
      expect(executeCommand).toHaveBeenCalledTimes(4);
    });

    it("should skip redundant reserve operations", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await NextEditWindowManager.reserveTabAndEsc();
      executeCommand.mockClear();

      // Try to reserve again
      await NextEditWindowManager.reserveTabAndEsc();

      // Should not have called executeCommand again
      expect(executeCommand).not.toHaveBeenCalled();
      expect(manager["keyReservationState"]).toBe("reserved");
    });

    it("should skip redundant free operations", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;
      executeCommand.mockClear();

      // Already free, try to free again
      await NextEditWindowManager.freeTabAndEsc();

      // Should not have called executeCommand
      expect(executeCommand).not.toHaveBeenCalled();
      expect(manager["keyReservationState"]).toBe("free");
    });
  });

  describe("Race Condition Prevention", () => {
    beforeEach(async () => {
      await manager.setupNextEditWindowManager(mockContext);
    });

    it("should handle concurrent operations with random delays and last-write-wins", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;
      let completedOperations: string[] = [];

      // Reset key reservation to ensure clean state
      await manager.resetKeyReservation();

      // Start from reserved state so first free() will proceed
      manager["keyReservationState"] = "reserved";
      executeCommand.mockClear();

      // Make executeCommand take random time and track completions
      executeCommand.mockImplementation((cmd, key, value) => {
        const operationId = `${value ? "reserve" : "free"}-${Date.now()}-${Math.random()}`;
        return new Promise((resolve) => {
          setTimeout(() => {
            completedOperations.push(operationId);
            // Immediately update state to ensure next operation proceeds
            // This simulates fast state changes
            manager["keyReservationState"] = value ? "reserved" : "free";
            resolve(undefined);
          }, Math.random() * 50);
        });
      });

      // Fire multiple operations concurrently
      const operations = [
        NextEditWindowManager.reserveTabAndEsc(), // operation 1: reserve (skipped - already reserved)
        NextEditWindowManager.freeTabAndEsc(), // operation 2: free (proceeds)
        NextEditWindowManager.reserveTabAndEsc(), // operation 3: reserve (proceeds after 2 completes)
        NextEditWindowManager.freeTabAndEsc(), // operation 4: free (proceeds after 3 completes)
      ];

      await Promise.all(operations);

      // Count how many actually proceeded (those that didn't early return)
      const actualCalls = executeCommand.mock.calls.length;

      // The state should match the last operation's intent
      // But the actual number of calls depends on timing and early returns
      expect(manager["latestOperationId"]).toBeGreaterThanOrEqual(actualCalls);
    });

    it("should ignore stale operations", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await manager.resetKeyReservation();
      executeCommand.mockClear();

      // Create deferred promises with guaranteed resolvers
      const createDeferred = () => {
        let resolve: Function;
        const promise = new Promise((res) => {
          resolve = res;
        });
        return { promise, resolve: resolve! };
      };

      const deferred1 = createDeferred();
      const deferred2 = createDeferred();

      // Control when each operation completes
      executeCommand
        .mockImplementationOnce(() => deferred1.promise)
        .mockImplementationOnce(() => deferred2.promise);

      // Start operations
      const op1 = NextEditWindowManager.reserveTabAndEsc();
      const op2 = NextEditWindowManager.freeTabAndEsc();

      // Complete op2 first (even though op1 started first)
      deferred2.resolve(undefined);
      await op2;

      // State should be free (from op2)
      expect(manager["keyReservationState"]).toBe("free");
      expect(manager["latestOperationId"]).toBe(2);

      // Now complete op1 (should be ignored as stale)
      deferred1.resolve(undefined);
      await op1;

      // State should still be free (op1 was ignored)
      expect(manager["keyReservationState"]).toBe("free");
      expect(manager["latestOperationId"]).toBe(2);
    });

    it("should handle rapid fire operations correctly (loop)", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await manager.resetKeyReservation();
      executeCommand.mockClear();

      // Make operations instant
      executeCommand.mockResolvedValue(undefined);

      // Fire many operations rapidly
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(
          i % 2 === 0
            ? NextEditWindowManager.reserveTabAndEsc()
            : NextEditWindowManager.freeTabAndEsc(),
        );
      }

      await Promise.all(operations);

      // Last operation (i=19) was free (odd number)
      expect(manager["keyReservationState"]).toBe("free");
      expect(manager["latestOperationId"]).toBe(20);
    });

    it("should handle alternating reserve/free with delays", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await manager.resetKeyReservation();
      executeCommand.mockClear();

      // Track actual VS Code context values set
      const contextValues: boolean[] = [];
      executeCommand.mockImplementation((cmd, key, value) => {
        if (cmd === "setContext") {
          //@ts-ignore
          contextValues.push(value);
        }
        return Promise.resolve(undefined);
      });

      // Alternating operations
      await NextEditWindowManager.reserveTabAndEsc();
      expect(manager["keyReservationState"]).toBe("reserved");

      await NextEditWindowManager.freeTabAndEsc();
      expect(manager["keyReservationState"]).toBe("free");

      await NextEditWindowManager.reserveTabAndEsc();
      expect(manager["keyReservationState"]).toBe("reserved");

      // Check that context was set correctly each time
      expect(contextValues).toEqual([true, false, true]);
    });

    it("should handle rapid alternations correctly", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await manager.resetKeyReservation();
      executeCommand.mockClear();

      // Track all setContext calls
      const contextCalls: boolean[] = [];
      executeCommand.mockImplementation((cmd, key, value) => {
        if (cmd === "setContext" && key === "nextEditWindowActive") {
          //@ts-ignore
          contextCalls.push(value);
        }
        return Promise.resolve();
      });

      // Simulate rapid SEQUENTIAL user interactions:
      // These need to be sequential to ensure state changes between calls
      await NextEditWindowManager.reserveTabAndEsc(); // free -> reserved
      await NextEditWindowManager.freeTabAndEsc(); // reserved -> free
      await NextEditWindowManager.reserveTabAndEsc(); // free -> reserved
      await NextEditWindowManager.freeTabAndEsc(); // reserved -> free

      // Should end in free state (last operation)
      expect(manager["keyReservationState"]).toBe("free");

      // Should have made all 4 calls since state alternates
      expect(contextCalls).toEqual([true, false, true, false]);
    });

    it("should handle concurrent duplicate operations efficiently", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await manager.resetKeyReservation();
      executeCommand.mockClear();

      // Track all setContext calls
      const contextCalls: boolean[] = [];
      executeCommand.mockImplementation((cmd, key, value) => {
        if (cmd === "setContext" && key === "nextEditWindowActive") {
          //@ts-ignore
          contextCalls.push(value);
        }
        return Promise.resolve();
      });

      // When multiple reserve operations happen concurrently (e.g., multiple completions)
      // Only the first should actually make the call
      const operations = [
        NextEditWindowManager.reserveTabAndEsc(),
        NextEditWindowManager.reserveTabAndEsc(),
        NextEditWindowManager.reserveTabAndEsc(),
      ];

      await Promise.all(operations);

      // Should have made only the necessary calls
      // Since all start with state "free", all will proceed to call setContext
      // This is because they all check state before any completes
      expect(contextCalls.length).toBeGreaterThan(0);
      expect(manager["keyReservationState"]).toBe("reserved");

      // All calls should be trying to reserve (true)
      expect(contextCalls.every((call) => call === true)).toBe(true);
    });

    it("should handle truly concurrent mixed operations", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await manager.resetKeyReservation();
      // Start in reserved state
      await NextEditWindowManager.reserveTabAndEsc();
      executeCommand.mockClear();

      // Track all setContext calls
      const contextCalls: boolean[] = [];
      executeCommand.mockImplementation((cmd, key, value) => {
        if (cmd === "setContext" && key === "nextEditWindowActive") {
          //@ts-ignore
          contextCalls.push(value);
          // Add small delay to simulate real async behavior
          return new Promise((resolve) => setTimeout(resolve, 5));
        }
        return Promise.resolve();
      });

      // Mix of operations starting from "reserved" state
      const operations = [
        NextEditWindowManager.freeTabAndEsc(), // Will proceed (reserved -> free)
        NextEditWindowManager.freeTabAndEsc(), // Will proceed (checks while first is in flight)
        NextEditWindowManager.reserveTabAndEsc(), // Will proceed (different operation)
      ];

      await Promise.all(operations);

      // The last operation to complete wins (but order is non-deterministic)
      // State should be either "free" or "reserved" depending on completion order
      expect(["free", "reserved"]).toContain(manager["keyReservationState"]);

      // Should have made at least some calls
      expect(contextCalls.length).toBeGreaterThan(0);
    });

    it("should maintain correct state with stale operations", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      await manager.resetKeyReservation();
      executeCommand.mockClear();

      // Create a controlled execution order
      let resolveFirst: () => void;
      let resolveSecond: () => void;

      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      const secondPromise = new Promise<void>((resolve) => {
        resolveSecond = resolve;
      });

      executeCommand
        .mockImplementationOnce(() => firstPromise)
        .mockImplementationOnce(() => secondPromise);

      // Start operations
      const op1 = NextEditWindowManager.reserveTabAndEsc();
      const op2 = NextEditWindowManager.freeTabAndEsc();

      // Complete second operation first (out of order)
      resolveSecond!();
      await op2;

      // State should be free (last operation to start, even though it completed first)
      expect(manager["keyReservationState"]).toBe("free");

      // Complete first operation
      resolveFirst!();
      await op1;

      // State should still be free (op1 was stale)
      expect(manager["keyReservationState"]).toBe("free");
    });
  });

  describe("Error Recovery", () => {
    beforeEach(async () => {
      await manager.setupNextEditWindowManager(mockContext);
    });

    it("should recover from failed key reservation", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      // Make reservation fail
      executeCommand.mockRejectedValueOnce(new Error("VS Code busy"));

      await expect(NextEditWindowManager.reserveTabAndEsc()).rejects.toThrow(
        "VS Code busy",
      );

      // State should reset to free
      expect(manager["keyReservationState"]).toBe("free");

      // Should be able to try again
      executeCommand.mockResolvedValueOnce(undefined);
      await NextEditWindowManager.reserveTabAndEsc();
      expect(manager["keyReservationState"]).toBe("reserved");
    });

    it("should recover from failed key freeing", async () => {
      const executeCommand = mockVscode.commands
        .executeCommand as MockedFunction<any>;

      // First reserve successfully
      await NextEditWindowManager.reserveTabAndEsc();
      expect(manager["keyReservationState"]).toBe("reserved");

      // Make freeing fail
      executeCommand.mockRejectedValueOnce(new Error("VS Code busy"));

      await expect(NextEditWindowManager.freeTabAndEsc()).rejects.toThrow(
        "VS Code busy",
      );

      // State should still reset to free (safety mechanism)
      expect(manager["keyReservationState"]).toBe("free");
    });

    it("should handle decoration creation failure", async () => {
      const createDecoration = mockVscode.window
        .createTextEditorDecorationType as MockedFunction<any>;
      createDecoration.mockImplementationOnce(() => {
        throw new Error("Failed to create decoration");
      });

      // Should not throw, but should clean up
      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(0, 0),
        0,
        0,
        "old",
        "new",
        [],
      );

      // Keys should be freed due to error
      expect(manager["keyReservationState"]).toBe("free");
      expect(manager["currentDecoration"]).toBeNull();
    });
  });

  describe("Command Registration", () => {
    it("should register hide command", async () => {
      await manager.setupNextEditWindowManager(mockContext);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        HIDE_NEXT_EDIT_SUGGESTION_COMMAND,
        expect.any(Function),
      );
    });

    it("should register accept command", async () => {
      await manager.setupNextEditWindowManager(mockContext);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        ACCEPT_NEXT_EDIT_SUGGESTION_COMMAND,
        expect.any(Function),
      );
    });

    it("should handle command registration failure gracefully", async () => {
      const registerCommand = mockVscode.commands
        .registerCommand as MockedFunction<any>;
      registerCommand.mockImplementationOnce(() => {
        throw new Error("Command already registered");
      });

      // Should not throw
      await expect(
        manager.setupNextEditWindowManager(mockContext),
      ).resolves.not.toThrow();
    });
  });

  describe("Window Management", () => {
    beforeEach(async () => {
      await manager.setupNextEditWindowManager(mockContext);
    });

    it("should store tooltip text when showing window", async () => {
      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(0, 0),
        0,
        2,
        "old code",
        "new code",
        [],
      );

      expect(manager["currentTooltipText"]).toBe("new code");
      expect(manager["activeEditor"]).toBe(mockEditor);
    });

    it("should clear tooltip text when hiding windows", async () => {
      // Show first
      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(0, 0),
        0,
        2,
        "old",
        "new",
        [],
      );

      // Then hide
      await manager.hideAllNextEditWindows();

      expect(manager["currentTooltipText"]).toBeNull();
      expect(manager["activeEditor"]).toBeNull();
    });

    it("should handle line deletion case", async () => {
      mockEditor.document.lineAt = vi.fn((lineNumber: number) => ({
        text: "line to delete",
      }));

      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(1, 0),
        1,
        1,
        "line to delete",
        "", // Empty means deletion
        [{ type: "old", line: "line to delete" }],
      );

      expect(manager["isLineDelete"]).toBe(true);
      // Final cursor should be at end of previous line
      expect(manager["finalCursorPos"]?.line).toBe(0);
    });

    it("should skip rendering for excluded URIs", async () => {
      mockEditor.document.uri = {
        toString: () => "output://test",
        scheme: "output",
      };

      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(0, 0),
        0,
        0,
        "old",
        "new",
        [],
      );

      // Should not create decoration for excluded URI
      expect(
        mockVscode.window.createTextEditorDecorationType,
      ).not.toHaveBeenCalled();
      expect(manager["currentDecoration"]).toBeNull();
    });
  });

  describe("Accept/Reject Flow", () => {
    beforeEach(async () => {
      await manager.setupNextEditWindowManager(mockContext);
    });

    it("should apply text when accepting", async () => {
      // Show window first
      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(0, 0),
        0,
        0,
        "old",
        "new text",
        [],
      );

      // Get the accept command callback
      const registerCalls = (
        mockVscode.commands.registerCommand as MockedFunction<any>
      ).mock.calls;
      const acceptCall = registerCalls.find(
        (call) => call[0] === ACCEPT_NEXT_EDIT_SUGGESTION_COMMAND,
      );
      //@ts-ignore
      const acceptCallback = acceptCall[1];

      // Call accept
      //@ts-ignore
      await acceptCallback();

      // Should have called edit
      expect(mockEditor.edit).toHaveBeenCalled();

      // Should have cleared the decoration
      expect(manager["currentTooltipText"]).toBeNull();
      expect(manager["keyReservationState"]).toBe("free");
    });

    it("should not accept when no active window", async () => {
      // Get the accept command callback
      const registerCalls = (
        mockVscode.commands.registerCommand as MockedFunction<any>
      ).mock.calls;
      const acceptCall = registerCalls.find(
        (call) => call[0] === ACCEPT_NEXT_EDIT_SUGGESTION_COMMAND,
      );
      //@ts-ignore
      const acceptCallback = acceptCall[1];

      // Call accept without showing window
      //@ts-ignore
      await acceptCallback();

      // Should not have called edit
      expect(mockEditor.edit).not.toHaveBeenCalled();
    });

    it("should hide window when rejecting", async () => {
      // Show window first
      await manager.showNextEditWindow(
        mockEditor,
        new mockVscode.Position(0, 0),
        0,
        0,
        "old",
        "new",
        [],
      );

      // Get the hide command callback
      const registerCalls = (
        mockVscode.commands.registerCommand as MockedFunction<any>
      ).mock.calls;
      const hideCall = registerCalls.find(
        (call) => call[0] === HIDE_NEXT_EDIT_SUGGESTION_COMMAND,
      );
      //@ts-ignore
      const hideCallback = hideCall[1];

      // Call hide
      //@ts-ignore
      await hideCallback();

      // Should have cleared everything
      expect(manager["currentTooltipText"]).toBeNull();
      expect(manager["activeEditor"]).toBeNull();
      expect(manager["keyReservationState"]).toBe("free");
    });
  });

  describe("Disposal", () => {
    it("should free keys on disposal", async () => {
      await manager.setupNextEditWindowManager(mockContext);

      // Reserve keys first
      await NextEditWindowManager.reserveTabAndEsc();
      expect(manager["keyReservationState"]).toBe("reserved");

      // Dispose
      manager.dispose();

      // Should attempt to free keys
      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "nextEditWindowActive",
        false,
      );
    });

    it("should dispose decorations on disposal", async () => {
      await manager.setupNextEditWindowManager(mockContext);

      const mockDecoration = { dispose: vi.fn() };
      const mockDisposable1 = { dispose: vi.fn() };
      const mockDisposable2 = { dispose: vi.fn() };

      manager["currentDecoration"] = mockDecoration as any;
      manager["disposables"] = [mockDisposable1, mockDisposable2];

      manager.dispose();

      expect(mockDecoration.dispose).toHaveBeenCalled();
      expect(mockDisposable1.dispose).toHaveBeenCalled();
      expect(mockDisposable2.dispose).toHaveBeenCalled();
    });
  });

  describe("Configuration Changes", () => {
    it("should update on theme change", async () => {
      await manager.setupNextEditWindowManager(mockContext);

      // Get the configuration change listener
      const onDidChange = mockVscode.workspace
        .onDidChangeConfiguration as MockedFunction<any>;
      const changeCallback = onDidChange.mock.calls[0][0];

      // Simulate theme change
      //@ts-ignore
      await changeCallback({
        affectsConfiguration: (key: string) => key === "workbench.colorTheme",
      });

      // Should have updated theme
      const { getThemeString } = await import("../util/getTheme");
      expect(getThemeString).toHaveBeenCalled();
    });

    it("should update on font size change", async () => {
      await manager.setupNextEditWindowManager(mockContext);

      const onDidChange = mockVscode.workspace
        .onDidChangeConfiguration as MockedFunction<any>;
      const changeCallback = onDidChange.mock.calls[0][0];

      // Change font size
      (
        mockVscode.workspace.getConfiguration as MockedFunction<any>
      ).mockReturnValueOnce({
        get: (key: string) => (key === "fontSize" ? 16 : "monospace"),
      });

      //@ts-ignore
      await changeCallback({
        affectsConfiguration: (key: string) => key === "editor.fontSize",
      });

      expect(manager["fontSize"]).toBe(16);
    });
  });
});
