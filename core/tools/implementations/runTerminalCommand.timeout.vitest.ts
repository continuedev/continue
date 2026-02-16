import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDE, ToolExtras } from "../..";
import { runTerminalCommandImpl } from "./runTerminalCommand";

// Hoist mock function so it can be referenced in vi.mock factory
const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  default: {
    spawn: mockSpawn,
  },
  spawn: mockSpawn,
}));

describe("runTerminalCommand timeout functionality", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockChildProc: any;
  let mockGetIdeInfo: ReturnType<typeof vi.fn>;
  let mockGetWorkspaceDirs: ReturnType<typeof vi.fn>;
  let mockOnPartialOutput: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let setTimeoutSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clearTimeoutSpy: any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Spy on setTimeout and clearTimeout
    setTimeoutSpy = vi.spyOn(global, "setTimeout");
    clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    // Create mock child process with EventEmitter behavior
    mockChildProc = new EventEmitter();
    mockChildProc.stdout = new EventEmitter();
    mockChildProc.stderr = new EventEmitter();
    mockChildProc.killed = false;
    mockChildProc.kill = vi.fn((signal?: NodeJS.Signals) => {
      mockChildProc.killed = true;
      setTimeout(() => {
        mockChildProc.emit("close", signal === "SIGKILL" ? 137 : 143);
      }, 100);
      return true;
    });

    mockSpawn.mockReturnValue(mockChildProc);

    mockGetIdeInfo = vi.fn().mockResolvedValue({ remoteName: "local" });
    mockGetWorkspaceDirs = vi
      .fn()
      .mockResolvedValue(["file:///tmp/test-workspace"]);
    mockOnPartialOutput = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const createMockExtras = (
    overrides: Partial<ToolExtras> = {},
  ): ToolExtras => {
    const mockIde = {
      getIdeInfo: mockGetIdeInfo,
      getWorkspaceDirs: mockGetWorkspaceDirs,
      getIdeSettings: vi.fn(),
      getDiff: vi.fn(),
      readFile: vi.fn(),
      readRangeInFile: vi.fn(),
      isTelemetryEnabled: vi.fn(),
      getProblems: vi.fn(),
      subprocess: vi.fn(),
      getWorkspaceConfigs: vi.fn(),
      showToast: vi.fn(),
      listWorkspaceContents: vi.fn(),
      getTerminalContents: vi.fn(),
      listFolders: vi.fn(),
      getSessionId: vi.fn(),
      runCommand: vi.fn(),
      showLines: vi.fn(),
      saveFile: vi.fn(),
      getBranch: vi.fn(),
      showDiff: vi.fn(),
      getOpenFiles: vi.fn(),
      showVirtualFile: vi.fn(),
      openFile: vi.fn(),
      getRepo: vi.fn(),
      pathSep: vi.fn(),
      fileExists: vi.fn(),
    } as unknown as IDE;

    return {
      ide: mockIde,
      llm: {} as any,
      fetch: vi.fn() as any,
      tool: {} as any,
      config: {} as any,
      onPartialOutput: mockOnPartialOutput,
      toolCallId: "test-tool-call-id",
      ...overrides,
    };
  };

  it("should set up timeout when waitForCompletion is true", async () => {
    const extras = createMockExtras();
    const args = { command: "echo test", waitForCompletion: true };
    const resultPromise = runTerminalCommandImpl(args, extras);
    await vi.runOnlyPendingTimersAsync();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 120_000);
    mockChildProc.emit("close", 0);
    await resultPromise;
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("should NOT set up timeout when waitForCompletion is false", async () => {
    const extras = createMockExtras();
    const args = { command: "sleep 10", waitForCompletion: false };
    const result = await runTerminalCommandImpl(args, extras);
    const timeoutCalls = setTimeoutSpy.mock.calls.filter(
      (call: any[]) => call[1] === 120_000,
    );
    expect(timeoutCalls.length).toBe(0);
    expect(result[0].status).toContain("background");
  });

  it("should kill process when timeout fires (streaming)", async () => {
    const extras = createMockExtras();
    const args = { command: "sleep 300", waitForCompletion: true };
    const resultPromise = runTerminalCommandImpl(args, extras);
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mockChildProc.kill).toHaveBeenCalledWith("SIGTERM");
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.runAllTimersAsync();
    const result = await resultPromise;
    expect(result[0].content).toContain(
      "[Timeout: process killed after 2 minutes]",
    );
  });

  it("should clear timeout on normal process exit", async () => {
    const extras = createMockExtras();
    const args = { command: "echo quick", waitForCompletion: true };
    const resultPromise = runTerminalCommandImpl(args, extras);
    // Flush async setup (getIdeInfo, getWorkspaceDirs) without advancing timer time
    await vi.advanceTimersByTimeAsync(0);
    mockChildProc.stdout.emit("data", Buffer.from("quick\n"));
    mockChildProc.emit("close", 0);
    await resultPromise;
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(mockChildProc.kill).not.toHaveBeenCalled();
  });

  it("should clear SIGKILL timeout when process exits between SIGTERM and SIGKILL grace period", async () => {
    const extras = createMockExtras();
    const args = { command: "sleep 300", waitForCompletion: true };
    const resultPromise = runTerminalCommandImpl(args, extras);

    // Let initial setup complete
    await vi.runOnlyPendingTimersAsync();

    // Advance to trigger main timeout (120s) — SIGTERM sent, SIGKILL timer started
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mockChildProc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(mockChildProc.kill).toHaveBeenCalledTimes(1);

    // Process exits gracefully after 2 seconds (before 5s grace period)
    await vi.advanceTimersByTimeAsync(2_000);
    mockChildProc.emit("close", 143); // SIGTERM exit code

    // Wait for promise to resolve
    await resultPromise;

    // Advance past the SIGKILL grace period (3 more seconds)
    await vi.advanceTimersByTimeAsync(3_000);

    // Verify SIGKILL was NOT called (timer was cleared)
    expect(mockChildProc.kill).toHaveBeenCalledTimes(1); // Only SIGTERM
    expect(mockChildProc.kill).not.toHaveBeenCalledWith("SIGKILL");
  });
});
