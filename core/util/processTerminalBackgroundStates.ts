// Track which processes have been backgrounded
const processTerminalBackgroundStates = new Map<string, boolean>();

// Function to mark a process as backgrounded
export function markProcessAsBackgrounded(toolCallId: string): void {
  processTerminalBackgroundStates.set(toolCallId, true);
}

// Function to check if a process is backgrounded
export function isProcessBackgrounded(toolCallId: string): boolean {
  return processTerminalBackgroundStates.has(toolCallId);
}

// Function to remove a process from the backgrounded processes map
export function removeBackgroundedProcess(toolCallId: string): void {
  processTerminalBackgroundStates.delete(toolCallId);
}