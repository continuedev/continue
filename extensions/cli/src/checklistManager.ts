/**
 * Simple checklist manager to track the latest checklist state
 * across different CLI modes (regular and serve).
 */

let currentChecklist: string | null = null;

/**
 * Update the current checklist state
 */
export function updateChecklist(checklist: string): void {
  currentChecklist = checklist;
}

/**
 * Get the current checklist state
 */
export function getCurrentChecklist(): string | null {
  return currentChecklist;
}

/**
 * Clear the current checklist
 */
export function clearChecklist(): void {
  currentChecklist = null;
}

/**
 * Check if there's an active checklist
 */
export function hasChecklist(): boolean {
  return currentChecklist !== null;
}

/**
 * Extract checklist from tool result if it's from the Checklist tool
 */
export function updateChecklistFromToolResult(result: string, toolName: string): void {
  if (toolName === "Checklist" && result.startsWith("Task list status:\n")) {
    const checklist = result.substring("Task list status:\n".length);
    updateChecklist(checklist);
  }
}