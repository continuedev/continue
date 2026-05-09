import { describe, expect, it, vi } from "vitest";

const mockShowVSCodeBridgeDialog = vi.fn();

vi.mock("../extension/showVSCodeBridgeDialog", () => ({
  showVSCodeBridgeDialog: mockShowVSCodeBridgeDialog,
}));

describe("createDialogLaunchers", () => {
  it("delegates bridge dialogs to the shared VS Code dialog helper", async () => {
    mockShowVSCodeBridgeDialog.mockResolvedValue({
      id: "dialog-1",
      confirmed: true,
      value: "approved",
    });

    const { createDialogLaunchers } = await import("./dialogLaunchers");
    const launchers = createDialogLaunchers();

    const request = {
      id: "dialog-1",
      kind: "info" as const,
      title: "Permission request",
      message: "Allow this tool call?",
    };

    await expect(launchers.showBridgeDialog(request)).resolves.toEqual({
      id: "dialog-1",
      confirmed: true,
      value: "approved",
    });
    expect(mockShowVSCodeBridgeDialog).toHaveBeenCalledWith(request);
  });
});
