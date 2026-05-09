import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({}));

describe("VsCodeWebviewProtocol", () => {
  it("resolves pending requests when the matching response arrives", async () => {
    const { VsCodeWebviewProtocol } = await import("./webviewProtocol");
    const protocol = new VsCodeWebviewProtocol();
    let messageHandler: ((message: any) => void) | undefined;

    protocol.webview = {
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn((handler) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      }),
    } as any;

    const pending = protocol.request(
      "setTheme" as any,
      { theme: {} } as any,
      false,
    );

    const postMessageCall = (protocol.webview as any).postMessage.mock
      .calls[0][0];
    messageHandler?.({
      messageType: "setTheme",
      messageId: postMessageCall.messageId,
      data: { acknowledged: true },
    });

    await expect(pending).resolves.toEqual({ acknowledged: true });
  });

  it("cancels pending requests when the webview is cleared", async () => {
    const { VsCodeWebviewProtocol } = await import("./webviewProtocol");
    const protocol = new VsCodeWebviewProtocol();

    protocol.webview = {
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
    } as any;

    const pending = protocol.request(
      "setTheme" as any,
      { theme: {} } as any,
      false,
    );
    protocol.webview = undefined;

    await expect(pending).resolves.toBeUndefined();
  });

  it("times out requests that never receive a response", async () => {
    const { VsCodeWebviewProtocol } = await import("./webviewProtocol");
    const protocol = new VsCodeWebviewProtocol();

    protocol.webview = {
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
    } as any;

    const pending = protocol.request(
      "setTheme" as any,
      { theme: {} } as any,
      false,
      1,
    );

    await expect(pending).resolves.toBeUndefined();
  });
});
