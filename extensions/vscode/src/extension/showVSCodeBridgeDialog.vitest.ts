import { afterEach, describe, expect, it, vi } from "vitest";

const showInformationMessage = vi.fn();
const showWarningMessage = vi.fn();
const showErrorMessage = vi.fn();
const showInputBox = vi.fn();
const showQuickPick = vi.fn();

vi.mock("vscode", () => ({
  window: {
    showInformationMessage,
    showWarningMessage,
    showErrorMessage,
    showInputBox,
    showQuickPick,
  },
}));

describe("showVSCodeBridgeDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps info dialogs onto showInformationMessage", async () => {
    showInformationMessage.mockResolvedValue("Use local model");

    const { showVSCodeBridgeDialog } = await import("./showVSCodeBridgeDialog");

    const result = await showVSCodeBridgeDialog({
      id: "dialog-1",
      kind: "info",
      title: "Connection issue",
      message: "Connection was refused.",
      options: [
        { title: "Add API Key", value: "api-key" },
        { title: "Use local model", value: "local-model" },
      ],
    });

    expect(showInformationMessage).toHaveBeenCalledWith(
      "Connection was refused.",
      "Add API Key",
      "Use local model",
    );
    expect(result).toEqual({
      id: "dialog-1",
      confirmed: true,
      value: "local-model",
    });
  });

  it("maps input dialogs onto showInputBox", async () => {
    showInputBox.mockResolvedValue("session-123");

    const { showVSCodeBridgeDialog } = await import("./showVSCodeBridgeDialog");

    const result = await showVSCodeBridgeDialog({
      id: "dialog-2",
      kind: "input",
      title: "Resume session",
      message: "Enter a session ID",
      placeholder: "continue-cli-...",
    });

    expect(showInputBox).toHaveBeenCalledWith({
      title: "Resume session",
      prompt: "Enter a session ID",
      placeHolder: "continue-cli-...",
      ignoreFocusOut: true,
    });
    expect(result).toEqual({
      id: "dialog-2",
      confirmed: true,
      value: "session-123",
    });
  });

  it("maps multi-pick dialogs onto showQuickPick", async () => {
    showQuickPick.mockResolvedValue([
      { label: "Read", detail: "View files", value: "read" },
      { label: "Write", detail: "Modify files", value: "write" },
    ]);

    const { showVSCodeBridgeDialog } = await import("./showVSCodeBridgeDialog");

    const result = await showVSCodeBridgeDialog({
      id: "dialog-3",
      kind: "pick",
      title: "Select tools",
      placeholder: "Choose one or more tools",
      allowMultiple: true,
      options: [
        { title: "Read", detail: "View files", value: "read" },
        { title: "Write", detail: "Modify files", value: "write" },
      ],
    });

    expect(showQuickPick).toHaveBeenCalledWith(
      [
        { label: "Read", detail: "View files", value: "read" },
        { label: "Write", detail: "Modify files", value: "write" },
      ],
      {
        title: "Select tools",
        placeHolder: "Choose one or more tools",
        canPickMany: true,
        ignoreFocusOut: true,
      },
    );
    expect(result).toEqual({
      id: "dialog-3",
      confirmed: true,
      value: ["read", "write"],
    });
  });
});
