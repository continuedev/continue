import { beforeEach, describe, expect, it, vi } from "vitest";

const showErrorMessage = vi.fn();
const showInformationMessage = vi.fn();
const showWarningMessage = vi.fn();
const showBridgeDialog = vi.fn();

vi.mock("vscode", () => ({
  window: {
    showErrorMessage,
    showInformationMessage,
    showWarningMessage,
    withProgress: vi.fn(async (_options, task) => task()),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  Uri: {
    parse: vi.fn((value: string) => ({ fsPath: value, toString: () => value })),
    joinPath: vi.fn(),
  },
  ProgressLocation: {
    Notification: 15,
  },
}));

vi.mock("core/protocol/passThrough", () => ({
  CORE_TO_WEBVIEW_PASS_THROUGH: [],
  WEBVIEW_TO_CORE_PASS_THROUGH: [],
}));

vi.mock("core/util/repoUrl", () => ({
  normalizeRepoUrl: vi.fn((value: string) => value.toLowerCase()),
}));

vi.mock("core/util/sanitization", () => ({
  sanitizeShellArgument: vi.fn((value: string) => JSON.stringify(value)),
  validateGitHubRepoUrl: vi.fn(() => true),
}));

vi.mock("../apply", () => ({
  ApplyManager: class {},
}));

vi.mock("../diff/vertical/manager", () => ({
  VerticalDiffManager: class {},
}));

vi.mock("../quickEdit/AddCurrentSelection", () => ({
  addCurrentSelectionToEdit: vi.fn(),
}));

vi.mock("../quickEdit/EditDecorationManager", () => ({
  default: class {},
}));

vi.mock("../stubs/WorkOsAuthProvider", () => ({
  getControlPlaneSessionInfo: vi.fn(),
  WorkOsAuthProvider: class {},
}));

vi.mock("../util/errorHandling", () => ({
  handleLLMError: vi.fn(),
}));

vi.mock("../util/tutorial", () => ({
  showTutorial: vi.fn(),
}));

vi.mock("../util/vscode", () => ({
  getExtensionUri: vi.fn(() => ({ toString: () => "extension-uri" })),
}));

vi.mock("../ui/dialogLaunchers", () => ({
  createDialogLaunchers: vi.fn(
    (overrides?: { showBridgeDialog?: typeof showBridgeDialog }) => ({
      showBridgeDialog: overrides?.showBridgeDialog ?? showBridgeDialog,
    }),
  ),
}));

function createHarness() {
  const handlers = new Map<string, (message: any) => Promise<any> | any>();

  const webviewProtocol = {
    on: vi.fn(
      async (
        messageType: string,
        handler: (message: any) => Promise<any> | any,
      ) => {
        handlers.set(messageType, handler);
      },
    ),
    request: vi.fn(),
    send: vi.fn(),
  };

  const repo = {
    state: {
      workingTreeChanges: [],
      indexChanges: [],
    },
    checkout: vi.fn(),
    fetch: vi.fn(),
  };

  const ide = {
    getWorkspaceDirs: vi.fn().mockResolvedValue(["/workspace/repo"]),
    getRepoName: vi.fn().mockResolvedValue("https://github.com/acme/project"),
    getRepo: vi.fn().mockResolvedValue(repo),
    getBranch: vi.fn().mockResolvedValue("main"),
  };

  const controlPlaneClient = {
    getAgentSession: vi.fn().mockResolvedValue({
      repoUrl: "https://github.com/acme/project",
      branch: "main",
    }),
    getAgentState: vi
      .fn()
      .mockResolvedValueOnce({
        session: { title: "Pending 1" },
        isProcessing: true,
        messageQueueLength: 1,
        pendingPermission: {
          requestId: "request-1",
          toolName: "Bash",
          toolArgs: { command: "git status" },
          timestamp: 1,
        },
      })
      .mockResolvedValueOnce({
        session: { title: "Pending 2" },
        isProcessing: true,
        messageQueueLength: 1,
        pendingPermission: {
          requestId: "request-2",
          toolName: "Edit",
          toolArgs: { filePath: "README.md" },
          timestamp: 2,
        },
      })
      .mockResolvedValueOnce({
        session: { title: "Ready Session" },
        isProcessing: false,
        messageQueueLength: 0,
        pendingPermission: null,
      }),
    respondToAgentPermission: vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        requestId: "request-1",
        approved: true,
      })
      .mockResolvedValueOnce({
        success: true,
        requestId: "request-2",
        approved: false,
      }),
  };

  return {
    handlers,
    webviewProtocol,
    ide,
    repo,
    controlPlaneClient,
    inProcessMessenger: {
      externalOn: vi.fn(),
      externalRequest: vi.fn(),
    },
  };
}

describe("VsCodeMessenger openAgentLocally", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves sequential pending permissions before loading the agent session", async () => {
    showBridgeDialog
      .mockResolvedValueOnce({
        id: "dialog-1",
        confirmed: true,
        value: "approve",
      })
      .mockResolvedValueOnce({
        id: "dialog-2",
        confirmed: true,
        value: "deny",
      });

    const { VsCodeMessenger } = await import("./VsCodeMessenger");
    const harness = createHarness();
    harness.webviewProtocol.request
      .mockResolvedValueOnce({
        id: "dialog-1",
        confirmed: true,
        value: "approve",
      })
      .mockResolvedValueOnce({
        id: "dialog-2",
        confirmed: true,
        value: "deny",
      });

    new VsCodeMessenger(
      harness.inProcessMessenger as any,
      harness.webviewProtocol as any,
      harness.ide as any,
      Promise.resolve({} as any),
      Promise.resolve({
        controlPlaneClient: harness.controlPlaneClient,
      } as any),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const openAgentLocally = harness.handlers.get("openAgentLocally");
    expect(openAgentLocally).toBeDefined();

    await openAgentLocally?.({
      messageId: "message-1",
      data: { agentSessionId: "agent-1" },
    });

    expect(
      harness.controlPlaneClient.respondToAgentPermission,
    ).toHaveBeenNthCalledWith(1, "agent-1", {
      requestId: "request-1",
      approved: true,
    });
    expect(
      harness.controlPlaneClient.respondToAgentPermission,
    ).toHaveBeenNthCalledWith(2, "agent-1", {
      requestId: "request-2",
      approved: false,
    });
    expect(harness.webviewProtocol.request).toHaveBeenNthCalledWith(
      1,
      "vscode/showBridgeDialog",
      expect.objectContaining({
        id: "request-1",
        kind: "warning",
      }),
      false,
      5_000,
    );
    expect(harness.controlPlaneClient.getAgentState).toHaveBeenCalledTimes(3);
    expect(harness.webviewProtocol.send).toHaveBeenCalledWith(
      "loadAgentSession",
      {
        session: { title: "Ready Session" },
        agentSessionId: "agent-1",
      },
    );
    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(showInformationMessage).toHaveBeenCalledWith(
      "Successfully loaded agent workflow: Ready Session",
    );
  });

  it("falls back to the extension dialog launcher when the webview responder is unavailable", async () => {
    showBridgeDialog.mockResolvedValueOnce({
      id: "dialog-1",
      confirmed: true,
      value: "approve",
    });

    const { VsCodeMessenger } = await import("./VsCodeMessenger");
    const harness = createHarness();
    harness.webviewProtocol.request.mockResolvedValueOnce(undefined);
    harness.controlPlaneClient.getAgentState = vi
      .fn()
      .mockResolvedValueOnce({
        session: { title: "Pending 1" },
        isProcessing: true,
        messageQueueLength: 1,
        pendingPermission: {
          requestId: "request-1",
          toolName: "Bash",
          toolArgs: { command: "git status" },
          timestamp: 1,
        },
      })
      .mockResolvedValueOnce({
        session: { title: "Ready Session" },
        isProcessing: false,
        messageQueueLength: 0,
        pendingPermission: null,
      });
    harness.controlPlaneClient.respondToAgentPermission = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        requestId: "request-1",
        approved: true,
      });

    new VsCodeMessenger(
      harness.inProcessMessenger as any,
      harness.webviewProtocol as any,
      harness.ide as any,
      Promise.resolve({} as any),
      Promise.resolve({
        controlPlaneClient: harness.controlPlaneClient,
      } as any),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const openAgentLocally = harness.handlers.get("openAgentLocally");
    await openAgentLocally?.({
      messageId: "message-1",
      data: { agentSessionId: "agent-1" },
    });

    expect(showBridgeDialog).toHaveBeenCalledTimes(1);
    expect(
      harness.controlPlaneClient.respondToAgentPermission,
    ).toHaveBeenCalledWith("agent-1", {
      requestId: "request-1",
      approved: true,
    });
  });
});
