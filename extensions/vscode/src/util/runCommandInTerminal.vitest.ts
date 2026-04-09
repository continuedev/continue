import { beforeEach, describe, expect, it, vi } from "vitest";

type MockTerminal = {
  name: string;
  show: ReturnType<typeof vi.fn>;
  sendText: ReturnType<typeof vi.fn>;
};

const terminalListeners = new Set<(terminal: MockTerminal) => void>();
const terminals: MockTerminal[] = [];

const windowMock = {
  terminals,
  activeTerminal: undefined as MockTerminal | undefined,
  createTerminal: vi.fn<(name?: string) => MockTerminal>(),
  onDidOpenTerminal: vi.fn((listener: (terminal: MockTerminal) => void) => {
    terminalListeners.add(listener);
    return {
      dispose: vi.fn(() => terminalListeners.delete(listener)),
    };
  }),
};

const commandsMock = {
  executeCommand: vi.fn<(command: string) => Promise<void>>(),
};

const envMock = {
  remoteName: undefined as string | undefined,
};

vi.mock("vscode", () => ({
  window: windowMock,
  commands: commandsMock,
  env: envMock,
}));

function createTerminal(name: string): MockTerminal {
  return {
    name,
    show: vi.fn(),
    sendText: vi.fn(),
  };
}

describe("runCommandInTerminal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    terminals.length = 0;
    terminalListeners.clear();
    windowMock.activeTerminal = undefined;
    envMock.remoteName = undefined;

    windowMock.createTerminal.mockImplementation((name?: string) => {
      const terminal = createTerminal(
        name ?? "Terminal " + (terminals.length + 1),
      );
      terminals.push(terminal);
      return terminal;
    });

    commandsMock.executeCommand.mockResolvedValue();
  });

  it("reuses the active terminal and sends an executing command", async () => {
    const terminal = createTerminal("Active");
    terminals.push(terminal);
    windowMock.activeTerminal = terminal;

    const { runCommandInTerminal } = await import("./runCommandInTerminal");

    await runCommandInTerminal("echo hello");

    expect(windowMock.createTerminal).not.toHaveBeenCalled();
    expect(commandsMock.executeCommand).not.toHaveBeenCalled();
    expect(terminal.show).toHaveBeenCalledOnce();
    expect(terminal.sendText).toHaveBeenCalledWith("echo hello", true);
  });

  it("creates a named local terminal when no reusable terminal exists", async () => {
    const { runCommandInTerminal } = await import("./runCommandInTerminal");

    await runCommandInTerminal("npm test", {
      reuseTerminal: true,
      terminalName: "Start Ollama",
    });

    expect(windowMock.createTerminal).toHaveBeenCalledWith("Start Ollama");
    expect(commandsMock.executeCommand).not.toHaveBeenCalled();

    const createdTerminal = terminals[0];
    expect(createdTerminal.show).toHaveBeenCalledOnce();
    expect(createdTerminal.sendText).toHaveBeenCalledWith("npm test", true);
  });

  it("creates remote terminals through the remote-aware VS Code command", async () => {
    envMock.remoteName = "ssh-remote";
    commandsMock.executeCommand.mockImplementation(async (command: string) => {
      expect(command).toBe("workbench.action.terminal.new");
      const terminal = createTerminal("Remote Shell");
      terminals.push(terminal);
      for (const listener of terminalListeners) {
        listener(terminal);
      }
    });

    const { runCommandInTerminal } = await import("./runCommandInTerminal");

    await runCommandInTerminal("pwd", { reuseTerminal: true });

    expect(windowMock.createTerminal).not.toHaveBeenCalled();
    expect(commandsMock.executeCommand).toHaveBeenCalledWith(
      "workbench.action.terminal.new",
    );

    const createdTerminal = terminals[0];
    expect(createdTerminal.show).toHaveBeenCalledOnce();
    expect(createdTerminal.sendText).toHaveBeenCalledWith("pwd", true);
  });

  it("reuses cached remote terminals for named commands", async () => {
    envMock.remoteName = "dev-container";

    let createdCount = 0;
    commandsMock.executeCommand.mockImplementation(async () => {
      createdCount += 1;
      const terminal = createTerminal("Remote " + createdCount);
      terminals.push(terminal);
      for (const listener of terminalListeners) {
        listener(terminal);
      }
    });

    const { runCommandInTerminal } = await import("./runCommandInTerminal");

    await runCommandInTerminal("ollama serve", {
      reuseTerminal: true,
      terminalName: "Start Ollama",
    });
    await runCommandInTerminal("ollama serve", {
      reuseTerminal: true,
      terminalName: "Start Ollama",
    });

    expect(commandsMock.executeCommand).toHaveBeenCalledTimes(1);
    expect(terminals[0].sendText).toHaveBeenNthCalledWith(
      1,
      "ollama serve",
      true,
    );
    expect(terminals[0].sendText).toHaveBeenNthCalledWith(
      2,
      "ollama serve",
      true,
    );
  });
});
