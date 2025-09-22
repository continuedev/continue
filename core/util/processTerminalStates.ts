import { ChildProcess } from "child_process";

// Track which processes have been backgrounded
const processTerminalBackgroundStates = new Map<string, boolean>();

// Track which foreground processes are currently running
interface RunningProcessInfo {
  process: ChildProcess;
  onPartialOutput?: (params: {
    toolCallId: string;
    contextItems: any[];
  }) => void;
  currentOutput: string;
}

const processTerminalForegroundStates = new Map<string, RunningProcessInfo>();

// Background process functions (existing)
export function markProcessAsBackgrounded(toolCallId: string): void {
  processTerminalBackgroundStates.set(toolCallId, true);
}

export function isProcessBackgrounded(toolCallId: string): boolean {
  return processTerminalBackgroundStates.has(toolCallId);
}

export function removeBackgroundedProcess(toolCallId: string): void {
  processTerminalBackgroundStates.delete(toolCallId);
}

// Foreground process functions (new)
export function markProcessAsRunning(
  toolCallId: string,
  process: ChildProcess,
  onPartialOutput?: (params: {
    toolCallId: string;
    contextItems: any[];
  }) => void,
  currentOutput: string = "",
): void {
  processTerminalForegroundStates.set(toolCallId, {
    process,
    onPartialOutput,
    currentOutput,
  });
}

export function isProcessRunning(toolCallId: string): boolean {
  return processTerminalForegroundStates.has(toolCallId);
}

export function getRunningProcess(
  toolCallId: string,
): ChildProcess | undefined {
  const info = processTerminalForegroundStates.get(toolCallId);
  return info?.process;
}

export function updateProcessOutput(toolCallId: string, output: string): void {
  const info = processTerminalForegroundStates.get(toolCallId);
  if (info) {
    info.currentOutput = output;
  }
}

export function removeRunningProcess(toolCallId: string): void {
  processTerminalForegroundStates.delete(toolCallId);
}

export async function killTerminalProcess(toolCallId: string): Promise<void> {
  const processInfo = processTerminalForegroundStates.get(toolCallId);
  if (processInfo && !processInfo.process.killed) {
    const { process } = processInfo;

    process.kill("SIGTERM");

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (!process.killed) {
        process.kill("SIGKILL");
      }
    }, 5000);

    processTerminalForegroundStates.delete(toolCallId);
  }
}

// Function to cancel multiple terminal commands at once
export async function killMultipleTerminalProcesses(
  toolCallIds: string[],
): Promise<void> {
  const cancelPromises = toolCallIds.map((toolCallId) =>
    killTerminalProcess(toolCallId),
  );
  await Promise.all(cancelPromises);
}

// Function to cancel ALL currently running terminal commands
export async function killAllRunningTerminalProcesses(): Promise<string[]> {
  const runningIds = getAllRunningProcessIds();
  if (runningIds.length > 0) {
    await killMultipleTerminalProcesses(runningIds);
  }
  return runningIds; // Return the IDs that were cancelled
}

// Utility functions
export function getAllRunningProcessIds(): string[] {
  return Array.from(processTerminalForegroundStates.keys());
}

export function getAllBackgroundedProcessIds(): string[] {
  return Array.from(processTerminalBackgroundStates.keys());
}

// Utility function for testing - clears all background process states
export function clearAllBackgroundProcesses(): void {
  processTerminalBackgroundStates.clear();
}
