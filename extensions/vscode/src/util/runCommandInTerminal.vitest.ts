import { beforeEach, describe, expect, it, vi } from "vitest";

type MockTerminal = {
  name: string;
  show: ReturnType<typeof vi.fn>;
  sendText: ReturnType<typeof vi.fn>;
};

const terminalListeners = new Set<(terminal: MockTerminal) => void>();
const activeTerminalListeners = new Set<
  (terminal: MockTerminal | undefined) => void
>();
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
  onDidChangeActiveTerminal: vi.fn(
    (listener: (terminal: MockTerminal | undefined) => void) => {
      activeTerminalListeners.add(listener);
      return {
        dispose: vi.fn(() => activeTerminalListeners.delete(listener)),
      };
    },
  ),
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

function notifyTerminalOpened(terminal: MockTerminal) {
  for (const listener of terminalListeners) {
    listener(terminal);
  }
}

function setActiveTerminal(terminal: MockTerminal | undefined) {
  windowMock.activeTerminal = terminal;
  for (const listener of activeTerminalListeners) {
    listener(terminal);
  }
}

describe("runCommandInTerminal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    terminals.length = 0;
    terminalListeners.clear();
    activeTerminalListeners.clear();
    setActiveTerminal(undefined);
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
    setActiveTerminal(terminal);

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
      setActiveTerminal(terminal);
      notifyTerminalOpened(terminal);
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
      setActiveTerminal(terminal);
      notifyTerminalOpened(terminal);
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

  it("ignores unrelated remote terminals that open before the command terminal becomes active", async () => {
    envMock.remoteName = "dev-container";
    commandsMock.executeCommand.mockImplementation(async () => {
      const unrelatedTerminal = createTerminal("Unrelated");
      terminals.push(unrelatedTerminal);
      notifyTerminalOpened(unrelatedTerminal);

      const commandTerminal = createTerminal("Remote Command");
      terminals.push(commandTerminal);
      setActiveTerminal(commandTerminal);
      notifyTerminalOpened(commandTerminal);
    });

    const { runCommandInTerminal } = await import("./runCommandInTerminal");

    await runCommandInTerminal("pwd", { reuseTerminal: true });

    expect(terminals[0].sendText).not.toHaveBeenCalled();
    expect(terminals[1].sendText).toHaveBeenCalledWith("pwd", true);
  });
});
