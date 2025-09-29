import { beforeEach, describe, expect, it, vi } from "vitest";

import * as vscode from "vscode";

import { ContinueCompletionProvider } from "../completionProvider";

import * as NextEditLoggingServiceModule from "core/nextEdit/NextEditLoggingService";
import * as PrefetchQueueModule from "core/nextEdit/NextEditPrefetchQueue";
import * as NextEditProviderModule from "core/nextEdit/NextEditProvider";
import * as JumpManagerModule from "../../activation/JumpManager";

type MockNextEditProvider = ReturnType<typeof createMockNextEditProvider>;
type MockPrefetchQueue = ReturnType<typeof createMockPrefetchQueue>;
type MockJumpManager = ReturnType<typeof createMockJumpManager>;

const mockOutcome = {
  completion: "suggested change",
  diffLines: [],
  editableRegionStartLine: 0,
  editableRegionEndLine: 0,
} as any;

let mockNextEditProvider: MockNextEditProvider;
let mockPrefetchQueue: MockPrefetchQueue;
let mockJumpManager: MockJumpManager;

beforeEach(() => {
  vi.clearAllMocks();

  mockNextEditProvider = createMockNextEditProvider();
  (NextEditProviderModule as any).__setMockNextEditProviderInstance(
    mockNextEditProvider,
  );

  mockPrefetchQueue = createMockPrefetchQueue();
  (PrefetchQueueModule as any).__setMockPrefetchQueueInstance(
    mockPrefetchQueue,
  );

  mockJumpManager = createMockJumpManager();
  (JumpManagerModule as any).__setMockJumpManagerInstance(mockJumpManager);

  const mockLoggingService = createMockLoggingService();
  (NextEditLoggingServiceModule as any).__setMockNextEditLoggingServiceInstance(
    mockLoggingService,
  );

  (vscode.window as any).activeTextEditor = null;
});

describe("ContinueCompletionProvider triggering logic", () => {
  it("starts a new chain when none exists", async () => {
    const document = createDocument();
    setActiveEditor(document);

    const provider = buildProvider();

    await provider.provideInlineCompletionItems(
      document,
      createPosition(),
      createContext(),
      createToken(),
    );

    expect(mockNextEditProvider.startChain).toHaveBeenCalledTimes(1);
    expect(
      mockNextEditProvider.provideInlineCompletionItems,
    ).toHaveBeenCalledTimes(1);
    expect(mockNextEditProvider.deleteChain).not.toHaveBeenCalled();
  });

  it("clears an empty chain once in full file diff mode", async () => {
    const document = createDocument();
    setActiveEditor(document);

    mockNextEditProvider.chainExists.mockReturnValue(true);
    mockPrefetchQueue.__setProcessed([]);
    mockPrefetchQueue.__setUnprocessed([]);

    const provider = buildProvider();

    await provider.provideInlineCompletionItems(
      document,
      createPosition(),
      createContext(),
      createToken(),
    );

    expect(mockNextEditProvider.deleteChain).toHaveBeenCalledTimes(1);
    expect(mockNextEditProvider.startChain).toHaveBeenCalledTimes(1);
    expect(
      mockNextEditProvider.provideInlineCompletionItems,
    ).toHaveBeenCalledTimes(1);
  });

  it("returns null after clearing empty chain when no outcome is available", async () => {
    const document = createDocument();
    setActiveEditor(document);

    mockNextEditProvider.chainExists.mockReturnValue(true);
    mockPrefetchQueue.__setProcessed([]);
    mockPrefetchQueue.__setUnprocessed([]);
    mockNextEditProvider.provideInlineCompletionItems.mockResolvedValueOnce(
      undefined,
    );

    const provider = buildProvider();

    const result = await provider.provideInlineCompletionItems(
      document,
      createPosition(),
      createContext(),
      createToken(),
    );

    expect(result).toBeNull();
    expect(mockNextEditProvider.deleteChain).toHaveBeenCalledTimes(1);
    expect(mockNextEditProvider.startChain).toHaveBeenCalledTimes(1);
    expect(
      mockNextEditProvider.provideInlineCompletionItems,
    ).toHaveBeenCalledTimes(1);
  });

  it("uses queued outcomes when processed items exist", async () => {
    const document = createDocument();
    setActiveEditor(document);

    mockNextEditProvider.chainExists.mockReturnValue(true);
    mockPrefetchQueue.__setProcessed([
      {
        location: {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
        },
        outcome: mockOutcome,
      },
    ]);
    mockJumpManager.suggestJump.mockResolvedValue(true);

    const provider = buildProvider();

    await provider.provideInlineCompletionItems(
      document,
      createPosition(),
      createContext(),
      createToken(),
    );

    expect(mockPrefetchQueue.dequeueProcessed).toHaveBeenCalledTimes(1);
    expect(mockJumpManager.setCompletionAfterJump).toHaveBeenCalledTimes(1);
    expect(mockNextEditProvider.startChain).not.toHaveBeenCalled();
    expect(mockNextEditProvider.deleteChain).not.toHaveBeenCalled();
    expect(
      mockNextEditProvider.provideInlineCompletionItems,
    ).not.toHaveBeenCalled();
  });
});

function buildProvider(options: { usingFullFileDiff?: boolean } = {}) {
  const usingFullFileDiff = options.usingFullFileDiff ?? true;
  const configHandler = {
    loadConfig: vi.fn(async () => ({
      config: { selectedModelByRole: { autocomplete: undefined } },
    })),
  } as any;

  const ide = { ideUtils: {} } as any;
  const webviewProtocol = {} as any;

  const provider = new ContinueCompletionProvider(
    configHandler,
    ide,
    webviewProtocol,
    usingFullFileDiff,
  );
  provider.activateNextEdit();
  return provider;
}

function createDocument(
  text = "function example() {\n  return true;\n}",
): vscode.TextDocument {
  const lines = text.split("\n");
  return {
    uri: vscode.Uri.parse("file:///test"),
    isUntitled: false,
    getText: (range?: any) => {
      if (!range) {
        return text;
      }
      const startLine = range.start?.line ?? 0;
      const endLine = range.end?.line ?? startLine;
      const startChar = range.start?.character ?? 0;
      const endChar = range.end?.character ?? lines[endLine]?.length ?? 0;
      if (startLine === endLine) {
        const lineText = lines[startLine] ?? "";
        return lineText.slice(startChar, endChar);
      }
      return text;
    },
    lineAt: (position: any) => {
      const lineNumber =
        typeof position === "number" ? position : position.line;
      const lineText = lines[lineNumber] ?? "";
      const range = new (vscode.Range as any)(
        new (vscode.Position as any)(lineNumber, 0),
        new (vscode.Position as any)(lineNumber, lineText.length),
      );
      return {
        lineNumber,
        text: lineText,
        range,
        rangeIncludingLineBreak: range,
        firstNonWhitespaceCharacterIndex: 0,
        isEmptyOrWhitespace: lineText.trim().length === 0,
      } as unknown as vscode.TextLine;
    },
  } as unknown as vscode.TextDocument;
}

function createContext(): any {
  return {
    triggerKind: (vscode.InlineCompletionTriggerKind as any).Automatic,
    selectedCompletionInfo: undefined,
  };
}

function createPosition(line = 0, character = 0) {
  return new (vscode.Position as any)(line, character);
}

function createToken(): any {
  return {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(),
  };
}

function setActiveEditor(document: any, cursor = createPosition()) {
  const selection = { active: cursor, anchor: cursor };
  (vscode.window as any).activeTextEditor = {
    document,
    selection,
    selections: [selection],
  };
}

function createMockNextEditProvider() {
  return {
    chainExists: vi.fn(() => false),
    startChain: vi.fn(),
    deleteChain: vi.fn(async () => {}),
    provideInlineCompletionItems: vi.fn(async () => mockOutcome),
    provideInlineCompletionItemsWithChain: vi.fn(async () => mockOutcome),
    markDisplayed: vi.fn(),
    getChainLength: vi.fn(() => 0),
  };
}

function createMockPrefetchQueue() {
  let processedItems: any[] = [];
  let unprocessedItems: any[] = [];

  const queue: any = {
    initialize: vi.fn(),
    process: vi.fn(),
    peekThreeProcessed: vi.fn(),
    dequeueProcessed: vi.fn(() => processedItems.shift()),
    enqueueProcessed: vi.fn((item: any) => {
      processedItems.push(item);
    }),
    __setProcessed(items: any[]) {
      processedItems = [...items];
    },
    __setUnprocessed(items: any[]) {
      unprocessedItems = [...items];
    },
  };

  Object.defineProperty(queue, "processedCount", {
    get: () => processedItems.length,
  });

  Object.defineProperty(queue, "unprocessedCount", {
    get: () => unprocessedItems.length,
  });

  return queue;
}

function createMockJumpManager() {
  return {
    isJumpInProgress: vi.fn(() => false),
    setJumpInProgress: vi.fn(),
    completionAfterJump: undefined,
    clearCompletionAfterJump: vi.fn(),
    setCompletionAfterJump: vi.fn(),
    suggestJump: vi.fn(async () => false),
    wasJumpJustAccepted: vi.fn(() => false),
  };
}

function createMockLoggingService() {
  return {
    trackPendingCompletion: vi.fn(),
    handleAbort: vi.fn(),
    markDisplayed: vi.fn(),
    cancelRejectionTimeout: vi.fn(),
    deleteAbortController: vi.fn(),
    cancel: vi.fn(),
  };
}

vi.mock("vscode", () => {
  class Position {
    constructor(
      public line: number,
      public character: number,
    ) {}
  }

  class Range {
    constructor(
      public start: Position,
      public end: Position,
    ) {}
  }

  class InlineCompletionItem {
    public insertText: string;
    public range: Range;
    public command?: any;

    constructor(insertText: string, range: Range, command?: any) {
      this.insertText = insertText;
      this.range = range;
      this.command = command;
    }
  }

  const window = {
    activeTextEditor: null as any,
    showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
  };

  const workspace = {
    notebookDocuments: [] as any[],
    getConfiguration: vi.fn(() => ({ get: vi.fn() })),
  };

  return {
    window,
    workspace,
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    Position,
    Range,
    InlineCompletionItem,
    InlineCompletionTriggerKind: { Automatic: 0, Invoke: 1 },
    NotebookCellKind: { Markup: 1 },
  };
});

vi.mock("core/autocomplete/CompletionProvider", () => {
  return {
    CompletionProvider: class {
      provideInlineCompletionItems = vi.fn();
      markDisplayed = vi.fn();
    },
  };
});

vi.mock("core/autocomplete/util/processSingleLineCompletion", () => ({
  processSingleLineCompletion: vi.fn((text: string) => ({
    completionText: text,
    range: { start: 0, end: text.length },
  })),
}));

vi.mock("../statusBar", () => {
  const StatusBarStatus = {
    Enabled: "enabled",
    Disabled: "disabled",
  } as const;

  return {
    StatusBarStatus,
    getStatusBarStatus: vi.fn(() => StatusBarStatus.Enabled),
    setupStatusBar: vi.fn(),
    stopStatusBarLoading: vi.fn(),
  };
});

vi.mock("../GhostTextAcceptanceTracker", () => {
  const instance = {
    setExpectedGhostTextAcceptance: vi.fn(),
  };
  return {
    GhostTextAcceptanceTracker: {
      getInstance: () => instance,
    },
  };
});

vi.mock("../lsp", () => ({
  getDefinitionsFromLsp: vi.fn(),
}));

vi.mock("../recentlyEdited", () => ({
  RecentlyEditedTracker: class {
    async getRecentlyEditedRanges() {
      return [];
    }
  },
}));

vi.mock("../RecentlyVisitedRangesService", () => ({
  RecentlyVisitedRangesService: class {
    getSnippets() {
      return [];
    }
  },
}));

vi.mock("../activation/NextEditWindowManager", () => ({
  NextEditWindowManager: {
    isInstantiated: vi.fn(() => false),
    getInstance: vi.fn(),
  },
}));

vi.mock("../../activation/JumpManager", () => {
  let instance: any = null;
  return {
    JumpManager: {
      getInstance: () => instance,
    },
    __setMockJumpManagerInstance(value: any) {
      instance = value;
    },
  };
});

vi.mock("core/nextEdit/NextEditPrefetchQueue", () => {
  let instance: any = null;
  return {
    PrefetchQueue: {
      getInstance: () => instance,
    },
    __setMockPrefetchQueueInstance(value: any) {
      instance = value;
    },
  };
});

vi.mock("core/nextEdit/NextEditProvider", () => {
  let instance: any = null;
  return {
    NextEditProvider: {
      initialize: vi.fn(() => instance),
      getInstance: vi.fn(() => instance),
    },
    __setMockNextEditProviderInstance(value: any) {
      instance = value;
    },
  };
});

vi.mock("core/nextEdit/NextEditLoggingService", () => {
  let instance: any = null;
  return {
    NextEditLoggingService: {
      getInstance: () => instance,
    },
    __setMockNextEditLoggingServiceInstance(value: any) {
      instance = value;
    },
  };
});

vi.mock("core/nextEdit/diff/diff", () => ({
  checkFim: vi.fn(() => ({ isFim: true, fimText: "ghost" })),
}));

vi.mock("../util/errorHandling", () => ({
  handleLLMError: vi.fn(async () => false),
}));
