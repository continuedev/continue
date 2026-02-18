import { ChildProcess } from "child_process";
import {
  clearAllBackgroundProcesses,
  getAllBackgroundedProcessIds,
  getAllRunningProcessIds,
  getRunningProcess,
  isProcessBackgrounded,
  isProcessRunning,
  killAllRunningTerminalProcesses,
  killMultipleTerminalProcesses,
  killTerminalProcess,
  markProcessAsBackgrounded,
  markProcessAsRunning,
  removeBackgroundedProcess,
  removeRunningProcess,
  updateProcessOutput,
} from "./processTerminalStates";

// Mock ChildProcess
const createMockProcess = (
  pid: number = 123,
  killed: boolean = false,
): jest.Mocked<ChildProcess> => {
  const mockProcess = {
    pid,
    killed,
    kill: jest.fn(),
  } as unknown as jest.Mocked<ChildProcess>;

  // Make kill() update the killed property
  mockProcess.kill.mockImplementation(() => {
    (mockProcess as any).killed = true;
    return true;
  });

  return mockProcess;
};

describe("processTerminalStates", () => {
  beforeEach(() => {
    // Clear all running processes
    const runningIds = getAllRunningProcessIds();
    runningIds.forEach((id) => removeRunningProcess(id));

    // Clear all backgrounded processes
    const backgroundedIds = getAllBackgroundedProcessIds();
    backgroundedIds.forEach((id) => removeBackgroundedProcess(id));

    // Clear all timers
    jest.clearAllTimers();
  });

  test("should mark a process as backgrounded", () => {
    const toolCallId = "test-123";
    markProcessAsBackgrounded(toolCallId);
    expect(isProcessBackgrounded(toolCallId)).toBe(true);
  });

  test("should correctly identify non-backgrounded processes", () => {
    const toolCallId = "test-123";
    const anotherToolCallId = "test-456";

    markProcessAsBackgrounded(toolCallId);

    expect(isProcessBackgrounded(toolCallId)).toBe(true);
    expect(isProcessBackgrounded(anotherToolCallId)).toBe(false);
  });

  test("should remove a process from backgrounded state", () => {
    const toolCallId = "test-123";

    markProcessAsBackgrounded(toolCallId);
    expect(isProcessBackgrounded(toolCallId)).toBe(true);

    removeBackgroundedProcess(toolCallId);
    expect(isProcessBackgrounded(toolCallId)).toBe(false);
  });

  test("should handle removing non-existent processes", () => {
    const toolCallId = "test-123";

    // Should not throw an error
    removeBackgroundedProcess(toolCallId);
    expect(isProcessBackgrounded(toolCallId)).toBe(false);
  });

  test("should handle multiple processes", () => {
    const toolCallId1 = "test-123";
    const toolCallId2 = "test-456";
    const toolCallId3 = "test-789";

    markProcessAsBackgrounded(toolCallId1);
    markProcessAsBackgrounded(toolCallId2);

    expect(isProcessBackgrounded(toolCallId1)).toBe(true);
    expect(isProcessBackgrounded(toolCallId2)).toBe(true);
    expect(isProcessBackgrounded(toolCallId3)).toBe(false);

    removeBackgroundedProcess(toolCallId1);

    expect(isProcessBackgrounded(toolCallId1)).toBe(false);
    expect(isProcessBackgrounded(toolCallId2)).toBe(true);
  });

  describe("foreground process functions", () => {
    test("should mark a process as running", () => {
      const toolCallId = "test-123";
      const mockProcess = createMockProcess();
      const mockCallback = jest.fn();
      const initialOutput = "initial output";

      markProcessAsRunning(
        toolCallId,
        mockProcess,
        mockCallback,
        initialOutput,
      );

      expect(isProcessRunning(toolCallId)).toBe(true);
      expect(getRunningProcess(toolCallId)).toBe(mockProcess);
    });

    test("should handle process without callback or initial output", () => {
      const toolCallId = "test-123";
      const mockProcess = createMockProcess();

      markProcessAsRunning(toolCallId, mockProcess);

      expect(isProcessRunning(toolCallId)).toBe(true);
      expect(getRunningProcess(toolCallId)).toBe(mockProcess);
    });

    test("should correctly identify non-running processes", () => {
      const toolCallId = "test-123";
      const anotherToolCallId = "test-456";
      const mockProcess = createMockProcess();

      markProcessAsRunning(toolCallId, mockProcess);

      expect(isProcessRunning(toolCallId)).toBe(true);
      expect(isProcessRunning(anotherToolCallId)).toBe(false);
    });

    test("should update process output", () => {
      const toolCallId = "test-123";
      const mockProcess = createMockProcess();
      const initialOutput = "initial";
      const updatedOutput = "updated output";

      markProcessAsRunning(toolCallId, mockProcess, undefined, initialOutput);
      updateProcessOutput(toolCallId, updatedOutput);

      // We can't directly test the output value, but we can ensure the function doesn't throw
      expect(() =>
        updateProcessOutput(toolCallId, updatedOutput),
      ).not.toThrow();
    });

    test("should handle updating output for non-existent process", () => {
      const toolCallId = "non-existent";

      expect(() =>
        updateProcessOutput(toolCallId, "some output"),
      ).not.toThrow();
    });

    test("should remove a process from running state", () => {
      const toolCallId = "test-123";
      const mockProcess = createMockProcess();

      markProcessAsRunning(toolCallId, mockProcess);
      expect(isProcessRunning(toolCallId)).toBe(true);

      removeRunningProcess(toolCallId);
      expect(isProcessRunning(toolCallId)).toBe(false);
      expect(getRunningProcess(toolCallId)).toBeUndefined();
    });

    test("should handle removing non-existent running processes", () => {
      const toolCallId = "test-123";

      expect(() => removeRunningProcess(toolCallId)).not.toThrow();
      expect(isProcessRunning(toolCallId)).toBe(false);
    });

    test("should return undefined for non-existent running process", () => {
      const toolCallId = "non-existent";

      expect(getRunningProcess(toolCallId)).toBeUndefined();
    });
  });

  describe("terminal command cancellation", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("should cancel a running terminal command", async () => {
      const toolCallId = "test-123";
      const mockProcess = createMockProcess();

      markProcessAsRunning(toolCallId, mockProcess);
      expect(isProcessRunning(toolCallId)).toBe(true);

      await killTerminalProcess(toolCallId);

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
      expect(isProcessRunning(toolCallId)).toBe(false);
    });

    test("should handle cancelling non-existent process", async () => {
      const toolCallId = "non-existent";

      await expect(killTerminalProcess(toolCallId)).resolves.not.toThrow();
    });

    test("should handle cancelling already killed process", async () => {
      const toolCallId = "test-123";
      const mockProcess = createMockProcess(123, true); // Already killed

      markProcessAsRunning(toolCallId, mockProcess);

      await killTerminalProcess(toolCallId);

      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    test("should send SIGKILL after timeout if process not killed", async () => {
      const toolCallId = "test-123";
      const mockProcess = createMockProcess();

      // Mock kill to not actually set killed=true for SIGTERM
      mockProcess.kill.mockImplementation((signal) => {
        if (signal === "SIGKILL") {
          (mockProcess as any).killed = true;
        }
        return true;
      });

      markProcessAsRunning(toolCallId, mockProcess);

      const cancelPromise = killTerminalProcess(toolCallId);

      // Fast-forward time to trigger the timeout
      jest.advanceTimersByTime(5000);

      await cancelPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
      expect(mockProcess.kill).toHaveBeenCalledWith("SIGKILL");
    });

    test("should not send SIGKILL if process was already killed", async () => {
      const toolCallId = "test-123";
      const mockProcess = createMockProcess();

      markProcessAsRunning(toolCallId, mockProcess);

      const cancelPromise = killTerminalProcess(toolCallId);

      // Fast-forward time to trigger the timeout
      jest.advanceTimersByTime(5000);

      await cancelPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
      expect(mockProcess.kill).toHaveBeenCalledTimes(1); // Only SIGTERM, no SIGKILL
    });
  });

  describe("utility functions", () => {
    test("should get all running process IDs", () => {
      const toolCallId1 = "test-123";
      const toolCallId2 = "test-456";
      const mockProcess1 = createMockProcess(123);
      const mockProcess2 = createMockProcess(456);

      markProcessAsRunning(toolCallId1, mockProcess1);
      markProcessAsRunning(toolCallId2, mockProcess2);

      const runningIds = getAllRunningProcessIds();
      expect(runningIds).toContain(toolCallId1);
      expect(runningIds).toContain(toolCallId2);
      expect(runningIds).toHaveLength(2);
    });

    test("should get all backgrounded process IDs", () => {
      const toolCallId1 = "test-123";
      const toolCallId2 = "test-456";

      markProcessAsBackgrounded(toolCallId1);
      markProcessAsBackgrounded(toolCallId2);

      const backgroundedIds = getAllBackgroundedProcessIds();
      expect(backgroundedIds).toContain(toolCallId1);
      expect(backgroundedIds).toContain(toolCallId2);
      expect(backgroundedIds).toHaveLength(2);
    });

    test("should return empty arrays when no processes", () => {
      expect(getAllRunningProcessIds()).toEqual([]);
      expect(getAllBackgroundedProcessIds()).toEqual([]);
    });

    test("should cancel multiple terminal commands", async () => {
      const toolCallId1 = "test-123";
      const toolCallId2 = "test-456";
      const mockProcess1 = createMockProcess(123);
      const mockProcess2 = createMockProcess(456);

      markProcessAsRunning(toolCallId1, mockProcess1);
      markProcessAsRunning(toolCallId2, mockProcess2);

      await killMultipleTerminalProcesses([toolCallId1, toolCallId2]);

      expect(mockProcess1.kill).toHaveBeenCalledWith("SIGTERM");
      expect(mockProcess2.kill).toHaveBeenCalledWith("SIGTERM");
      expect(isProcessRunning(toolCallId1)).toBe(false);
      expect(isProcessRunning(toolCallId2)).toBe(false);
    });

    test("should cancel all running terminal commands", async () => {
      const toolCallId1 = "test-123";
      const toolCallId2 = "test-456";
      const mockProcess1 = createMockProcess(123);
      const mockProcess2 = createMockProcess(456);

      markProcessAsRunning(toolCallId1, mockProcess1);
      markProcessAsRunning(toolCallId2, mockProcess2);

      const cancelledIds = await killAllRunningTerminalProcesses();

      expect(cancelledIds).toContain(toolCallId1);
      expect(cancelledIds).toContain(toolCallId2);
      expect(cancelledIds).toHaveLength(2);
      expect(mockProcess1.kill).toHaveBeenCalledWith("SIGTERM");
      expect(mockProcess2.kill).toHaveBeenCalledWith("SIGTERM");
      expect(isProcessRunning(toolCallId1)).toBe(false);
      expect(isProcessRunning(toolCallId2)).toBe(false);
    });

    test("should return empty array when no running commands to cancel", async () => {
      const cancelledIds = await killAllRunningTerminalProcesses();
      expect(cancelledIds).toEqual([]);
    });

    test("should clear all background processes", () => {
      const toolCallId1 = "test-123";
      const toolCallId2 = "test-456";

      markProcessAsBackgrounded(toolCallId1);
      markProcessAsBackgrounded(toolCallId2);

      expect(getAllBackgroundedProcessIds()).toHaveLength(2);

      clearAllBackgroundProcesses();

      expect(getAllBackgroundedProcessIds()).toEqual([]);
      expect(isProcessBackgrounded(toolCallId1)).toBe(false);
      expect(isProcessBackgrounded(toolCallId2)).toBe(false);
    });
  });
});
