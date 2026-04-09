import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VsCodeWebviewProtocol } from "./webviewProtocol";
import { handleLLMError } from "./util/errorHandling";

vi.mock("uuid", () => ({
  v4: () => "test-uuid",
}));

vi.mock("vscode", () => ({
  window: {
    showInformationMessage: vi.fn(),
  },
}));

vi.mock("./util/errorHandling", () => ({
  handleLLMError: vi.fn(),
}));

vi.mock("core/util/extractMinimalStackTraceInfo", () => ({
  extractMinimalStackTraceInfo: vi.fn(() => "stack"),
}));

vi.mock("core/util/posthog", () => ({
  Telemetry: {
    capture: vi.fn(),
  },
}));

describe("VsCodeWebviewProtocol", () => {
  let protocol: VsCodeWebviewProtocol;
  let listener: (message: any) => Promise<void>;
  let postMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(handleLLMError).mockResolvedValue(false);

    postMessage = vi.fn();
    protocol = new VsCodeWebviewProtocol();
    protocol.webview = {
      postMessage,
      onDidReceiveMessage: vi.fn((callback) => {
        listener = callback;
        return { dispose: vi.fn() };
      }),
    } as any;

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps ECONNREFUSED stream chat errors to a friendly message", async () => {
    protocol.on("llm/streamChat" as any, async () => {
      const error = new Error("Connection error.");
      (error as any).cause = {
        code: "ECONNREFUSED",
        message: "connect ECONNREFUSED 127.0.0.1:1234",
      };
      throw error;
    });

    await listener({
      messageType: "llm/streamChat",
      messageId: "msg-1",
      data: {},
    });

    expect(postMessage).toHaveBeenCalledWith({
      messageType: "llm/streamChat",
      messageId: "msg-1",
      data: {
        done: true,
        error: expect.stringContaining("Connection was refused."),
        status: "error",
      },
    });
  });

  it("shows proxy onboarding actions when the friendly message comes from the error cause", async () => {
    const vscode = await import("vscode");
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(
      undefined,
    );

    protocol.on("llm/streamChat" as any, async () => {
      const error = new Error("Connection error.");
      (error as any).cause = {
        name: "ProxyError",
        message: 'upstream failed\n{"message":"https://proxy-server exceeded"}',
      };
      throw error;
    });

    await listener({
      messageType: "llm/streamChat",
      messageId: "msg-3",
      data: {},
    });

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("set up a local model or use your own API key"),
      "Add API Key",
      "Use Local Model",
    );
  });

  it("responds once when handleLLMError already handled the error", async () => {
    vi.mocked(handleLLMError).mockResolvedValue(true);

    protocol.on("llm/streamChat" as any, async () => {
      throw new Error("Unable to connect to local Ollama instance.");
    });

    await listener({
      messageType: "llm/streamChat",
      messageId: "msg-2",
      data: {},
    });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      messageType: "llm/streamChat",
      messageId: "msg-2",
      data: {
        done: true,
        status: "error",
      },
    });
  });
});
