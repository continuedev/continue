// Track which processes have been backgrounded
const backgroundedProcesses = new Map<string, boolean>();

// Function to mark a process as backgrounded
export function markProcessAsBackgrounded(toolCallId: string): void {
  backgroundedProcesses.set(toolCallId, true);
}

// Function to check if a process is backgrounded
export function isProcessBackgrounded(toolCallId: string): boolean {
  return backgroundedProcesses.has(toolCallId);
}

// Function to remove a process from the backgrounded processes map
export function removeBackgroundedProcess(toolCallId: string): void {
  backgroundedProcesses.delete(toolCallId);
}
