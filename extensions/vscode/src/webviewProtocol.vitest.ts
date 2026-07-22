import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock core/protocol dependencies before importing webviewProtocol
vi.mock("core/protocol", () => ({
  Message: class {},
}));

vi.mock("core/protocol/messenger", () => ({
  IMessenger: class {},
}));

// Mock vscode
vi.mock("vscode", () => {
  return {
    window: {},
    workspace: {},
    commands: {},
    Uri: {},
  };
});

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid"),
}));

// Mock the error handling utility
vi.mock("./util/errorHandling", () => ({
  handleLLMError: vi.fn(async () => false),
}));

// Import after mocks are set up
import { VsCodeWebviewProtocol } from "./webviewProtocol";

describe("VsCodeWebviewProtocol handleMessage error handling", () => {
  let protocol: VsCodeWebviewProtocol;
  let mockWebview: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    protocol = new VsCodeWebviewProtocol();

    // Create a simple mock webview
    mockWebview = {
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn((callback: (msg: any) => void) => {
        mockWebview._callback = callback;
        return { dispose: vi.fn() };
      }),
      _callback: null as any,
    };

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should handle circular-reference crash prevention", async () => {
    // Register handler that throws
    protocol.on("session/share", () => {
      throw new Error("Test error");
    });

    // Set webview to register handleMessage
    protocol.webview = mockWebview;

    // Build a message with a circular reference
    const obj: any = {};
    obj.self = obj;

    const msg = {
      messageType: "session/share",
      messageId: "id1",
      data: obj,
    };

    // Call handleMessage via the webview callback
    await mockWebview._callback(msg);

    // Assert: console.error was called with a string containing "[unserializable message:"
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorCall = consoleErrorSpy.mock.calls[0][0];
    expect(errorCall).toContain("[unserializable message:");
  });

  it("should handle normal handler error where stringify succeeds", async () => {
    // Register handler that throws
    protocol.on("didChangeSelectedProfile", () => {
      throw new Error("boom");
    });

    // Set webview to register handleMessage
    protocol.webview = mockWebview;

    const msg = {
      messageType: "didChangeSelectedProfile",
      messageId: "id2",
      data: { foo: "bar" },
    };

    // Call handleMessage via the webview callback
    await mockWebview._callback(msg);

    // Assert: console.error was called with the serialized message type
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorCall = consoleErrorSpy.mock.calls[0][0];
    expect(errorCall).toContain("didChangeSelectedProfile");
  });

  it("should handle llm/streamChat early return", async () => {
    // Register handler that throws
    protocol.on("llm/streamChat", () => {
      throw new Error("Stream error");
    });

    // Set webview to register handleMessage
    protocol.webview = mockWebview;

    const msg = {
      messageType: "llm/streamChat",
      messageId: "id3",
      data: { foo: "bar" },
    };

    // Call handleMessage via the webview callback
    await mockWebview._callback(msg);

    // Assert: resolves without rethrowing (early return taken)
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should handle chatDescriber/describe early return", async () => {
    // Register handler that throws
    protocol.on("chatDescriber/describe", () => {
      throw new Error("Describe error");
    });

    // Set webview to register handleMessage
    protocol.webview = mockWebview;

    const msg = {
      messageType: "chatDescriber/describe",
      messageId: "id4",
      data: { foo: "bar" },
    };

    // Call handleMessage via the webview callback
    await mockWebview._callback(msg);

    // Assert: resolves without rethrowing (early return taken)
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
