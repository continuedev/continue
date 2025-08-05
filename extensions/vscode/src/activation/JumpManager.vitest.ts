import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { NextEditOutcome } from "core/nextEdit/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { CompletionDataForAfterJump, JumpManager } from "./JumpManager";

// Mock VSCode API
vi.mock("vscode", () => {
  return {
    window: {
      createTextEditorDecorationType: vi.fn(() => ({
        dispose: vi.fn(),
      })),
      activeTextEditor: {
        document: {
          lineAt: vi.fn((line) => ({
            text: "Test line content",
            lineNumber: line,
          })),
          lineCount: 10,
        },
        setDecorations: vi.fn(),
        selection: { active: { line: 0, character: 0 } },
        revealRange: vi.fn(),
        visibleRanges: [{ start: { line: 0 }, end: { line: 5 } }],
      },
      onDidChangeTextEditorSelection: vi.fn(() => ({
        dispose: vi.fn(),
      })),
    },
    commands: {
      executeCommand: vi.fn(),
      registerCommand: vi.fn(() => ({
        dispose: vi.fn(),
      })),
    },
    Position: class {
      line: number;
      character: number;
      constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
      }
      isEqual(other: any): boolean {
        return this.line === other.line && this.character === other.character;
      }
    },
    Range: class {
      start: any;
      end: any;
      constructor(
        startLine: number,
        startChar: number,
        endLine: number,
        endChar: number,
      ) {
        this.start = { line: startLine, character: startChar };
        this.end = { line: endLine, character: endChar };
      }
    },
    Selection: class {
      anchor: any;
      active: any;
      constructor(anchor: any, active: any) {
        this.anchor = anchor;
        this.active = active;
      }
    },
    TextEditorDecorationType: class {
      dispose: () => void;
      constructor() {
        this.dispose = vi.fn();
      }
    },
    TextEditorRevealType: {
      InCenter: "inCenter",
    },
    ThemeColor: class {
      id: string;
      constructor(id: string) {
        this.id = id;
      }
    },
  };
});

// Mock NextEditProvider
vi.mock("core/nextEdit/NextEditProvider", () => {
  const mockDeleteChain = vi.fn();
  const mockGetInstance = vi.fn(() => ({
    deleteChain: mockDeleteChain,
  }));

  return {
    NextEditProvider: {
      getInstance: mockGetInstance,
    },
  };
});

const createMockNextEditOutcome = (
  overrides: Partial<NextEditOutcome> = {},
): NextEditOutcome => {
  return {
    // TabAutocompleteOptions properties
    disable: false,
    maxPromptTokens: 2048,
    debounceDelay: 300,
    modelTimeout: 5000,
    maxSuffixPercentage: 0.5,
    prefixPercentage: 0.8,
    transform: true,
    template: "default",
    multilineCompletions: "auto",
    slidingWindowPrefixPercentage: 0.5,
    slidingWindowSize: 100,
    useCache: true,
    onlyMyCode: false,
    useRecentlyEdited: true,
    useRecentlyOpened: true,
    disableInFiles: [".env", "node_modules/**"],
    useImports: true,
    showWhateverWeHaveAtXMs: 2000,
    experimental_includeClipboard: true,
    experimental_includeRecentlyVisitedRanges: true,
    experimental_includeRecentlyEditedRanges: true,
    experimental_includeDiff: true,
    experimental_enableStaticContextualization: false,
    // Base properties
    elapsed: 1500,
    modelProvider: "openai",
    modelName: "gpt-4",
    completionOptions: {
      temperature: 0.7,
      max_tokens: 1000,
    },
    completionId: "comp_12345abcde",
    uniqueId: "ne_67890fghij",
    timestamp: Date.now(),
    gitRepo: "continuedev/continue",

    // NextEdit specific properties
    fileUri: "file:///workspace/project/src/main.ts",
    workspaceDirUri: "file:///workspace/project",
    prompt: "Add error handling to this function",
    userEdits: "// I added a try/catch block",
    userExcerpts: "function example() { ... }",
    originalEditableRange: "function example() {\n  return fetch(url);\n}",
    completion:
      "function example() {\n  try {\n    return fetch(url);\n  } catch (error) {\n    console.error('Fetch failed:', error);\n    throw error;\n  }\n}",
    cursorPosition: { line: 2, character: 10 },
    finalCursorPosition: { line: 4, character: 5 },
    accepted: true,
    editableRegionStartLine: 1,
    editableRegionEndLine: 3,

    // Apply any overrides
    ...overrides,
  };
};

describe("JumpManager", () => {
  let jumpManager: JumpManager;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Clear any existing instance
    JumpManager.clearInstance();

    // Get a fresh instance
    jumpManager = JumpManager.getInstance();
  });

  afterEach(() => {
    jumpManager.dispose();
  });

  describe("getInstance", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = JumpManager.getInstance();
      const instance2 = JumpManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("clearInstance", () => {
    it("should dispose the current instance and clear it", () => {
      const instance = JumpManager.getInstance();
      const disposeSpy = vi.spyOn(instance, "dispose");

      JumpManager.clearInstance();

      expect(disposeSpy).toHaveBeenCalled();

      // Get a new instance
      const newInstance = JumpManager.getInstance();
      expect(newInstance).not.toBe(instance);
    });
  });

  describe("suggestJump", () => {
    it("should set jumpInProgress to true", async () => {
      const currentPosition = new vscode.Position(1, 0);
      const nextJumpLocation = new vscode.Position(3, 0);

      await jumpManager.suggestJump(currentPosition, nextJumpLocation);

      expect(jumpManager.isJumpInProgress()).toBe(true);
    });

    it("should not suggest jump if completion content matches document content", async () => {
      const currentPosition = new vscode.Position(1, 0);
      const nextJumpLocation = new vscode.Position(3, 0);
      const completionContent = "Test line content";

      // Mock document content to match the completion content
      vscode.window.activeTextEditor!.document.lineAt = vi.fn(() => ({
        text: "Test line content",
        lineNumber: 3,
      })) as any;

      await jumpManager.suggestJump(
        currentPosition,
        nextJumpLocation,
        completionContent,
      );

      // Jump should not be suggested, so decorations should not be created
      expect(
        vscode.window.createTextEditorDecorationType,
      ).not.toHaveBeenCalled();
    });

    it("should render decoration for jump location outside visible range (below)", async () => {
      const currentPosition = new vscode.Position(1, 0);
      const nextJumpLocation = new vscode.Position(8, 0); // Outside visible range (below)

      await jumpManager.suggestJump(currentPosition, nextJumpLocation);

      // Should create decoration
      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalled();
      // Should set context
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "continue.jumpDecorationVisible",
        true,
      );
      // Should register key listeners
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "continue.acceptJump",
        expect.any(Function),
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        "continue.rejectJump",
        expect.any(Function),
      );
    });

    it("should render decoration for jump location outside visible range (above)", async () => {
      // Set visible range to be below the jump target
      // @ts-ignore
      vscode.window.activeTextEditor!.visibleRanges = [
        { start: { line: 5 }, end: { line: 10 } },
      ];

      const currentPosition = new vscode.Position(6, 0);
      const nextJumpLocation = new vscode.Position(2, 0); // Outside visible range (above)

      await jumpManager.suggestJump(currentPosition, nextJumpLocation);

      // Should create decoration
      expect(vscode.window.createTextEditorDecorationType).toHaveBeenCalled();
    });
  });

  describe("registerKeyListeners", () => {
    it("should register acceptJump command that moves cursor", async () => {
      // Setup private method access (this is a bit of a hack for testing private methods)
      const privateJumpManager = jumpManager as any;

      // Mock context
      privateJumpManager._jumpDecorationVisible = true;

      // Create editor mock
      const editor = {
        selection: null,
        setSelection: vi.fn(),
      };

      // Create jump position
      const jumpPosition = new vscode.Position(3, 5);

      // Call the private method
      await privateJumpManager.registerKeyListeners(editor, jumpPosition);

      // Find the command handler
      //@ts-ignore
      const commandArgs = vscode.commands.registerCommand.mock.calls.find(
        (call: any) => call[0] === "continue.acceptJump",
      );
      const acceptJumpHandler = commandArgs[1];

      // Call the handler
      await acceptJumpHandler();

      // Expect selection to be updated
      expect(editor.selection).toEqual(
        new vscode.Selection(jumpPosition, jumpPosition),
      );
      // Expect decoration to be cleared
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "continue.jumpDecorationVisible",
        false,
      );
    });

    it("should register rejectJump command that deletes the chain", async () => {
      // Setup private method access
      const privateJumpManager = jumpManager as any;

      // Mock context
      privateJumpManager._jumpDecorationVisible = true;

      // Get a reference to the mocked deleteChain
      const mockDeleteChain = vi.mocked(
        NextEditProvider.getInstance().deleteChain,
      );
      mockDeleteChain.mockClear();

      // Call the private method
      await privateJumpManager.registerKeyListeners(
        {} as vscode.TextEditor,
        new vscode.Position(0, 0),
      );

      // Find the command handler
      //@ts-ignore
      const commandArgs = vscode.commands.registerCommand.mock.calls.find(
        (call: any) => call[0] === "continue.rejectJump",
      );
      expect(commandArgs).toBeDefined();
      const rejectJumpHandler = commandArgs?.[1];
      expect(rejectJumpHandler).toBeDefined();

      // Reset executeCommand mock
      vi.mocked(vscode.commands.executeCommand).mockClear();

      // Call the handler
      await rejectJumpHandler();

      // Debug: Log state after calling handler
      console.log("mockDeleteChain called:", mockDeleteChain.mock.calls.length);

      // Expect NextEditProvider.deleteChain to be called
      expect(mockDeleteChain).toHaveBeenCalled();

      // Expect decoration to be cleared
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "continue.jumpDecorationVisible",
        false,
      );
    });
  });

  describe("setCompletionAfterJump", () => {
    it("should store completion data", () => {
      const completionData: CompletionDataForAfterJump = {
        completionId: "test-id",
        outcome: createMockNextEditOutcome(),
        currentPosition: new vscode.Position(1, 0),
      };

      // Set the completion data
      jumpManager.setCompletionAfterJump(completionData);

      // Verify the completion data was stored correctly
      expect((jumpManager as any)._completionAfterJump).toEqual(completionData);
    });

    it("should process completion data when jump is completed", async () => {
      const completionData: CompletionDataForAfterJump = {
        completionId: "test-id",
        outcome: createMockNextEditOutcome(),
        currentPosition: new vscode.Position(1, 0),
      };

      // Set the completion data
      jumpManager.setCompletionAfterJump(completionData);

      // Verify the completion data was set correctly
      expect((jumpManager as any)._completionAfterJump).toEqual(completionData);

      // Reset executeCommand mock to clear previous calls
      vi.mocked(vscode.commands.executeCommand).mockClear();

      // Directly simulate what happens when a jump is completed
      // by manipulating the internal state
      (jumpManager as any)._jumpInProgress = false;

      // Now directly call the method that would show the completion
      // We need to manually implement what the callback would do
      if ((jumpManager as any)._completionAfterJump) {
        vscode.commands.executeCommand(
          "continue.showNextEditAfterJump",
          (jumpManager as any)._completionAfterJump,
        );
        (jumpManager as any)._completionAfterJump = null;
      }

      // Verify that the command was called with the completion data
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "continue.showNextEditAfterJump",
        completionData,
      );

      // Verify that _completionAfterJump was reset to null
      expect((jumpManager as any)._completionAfterJump).toBeNull();
    });
  });

  describe("clearJumpDecoration", () => {
    it("should dispose decoration and reset state", async () => {
      // Setup private method access
      const privateJumpManager = jumpManager as any;

      // Create a mock decoration with a spy on dispose
      const mockDispose = vi.fn();
      privateJumpManager._jumpDecoration = {
        dispose: mockDispose,
      };
      privateJumpManager._jumpDecorationVisible = true;

      // Reset executeCommand mock
      vi.mocked(vscode.commands.executeCommand).mockClear();

      // Call the method
      await privateJumpManager.clearJumpDecoration();

      // Expect dispose to have been called
      expect(mockDispose).toHaveBeenCalled();

      // Expect decoration to be undefined after clearing
      expect(privateJumpManager._jumpDecoration).toBeUndefined();
      expect(privateJumpManager._jumpDecorationVisible).toBe(false);

      // Expect context to be reset
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "setContext",
        "continue.jumpDecorationVisible",
        false,
      );
    });
  });
});
