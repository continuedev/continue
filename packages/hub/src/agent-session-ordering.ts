/**
 * Agent session categorization and ordering constants for hub.continue.dev
 *
 * These define the canonical ordering for agent session categories in the
 * kanban board view.
 */

/**
 * PR Status ordering
 * Unknown values should appear after these defined states
 */
export const PR_STATUS_ORDER = [
  "No PR",
  "Draft",
  "Open",
  "Merged",
  "Closed",
] as const;

export type PRStatus = (typeof PR_STATUS_ORDER)[number];

/**
 * Agent Status ordering
 * Unknown values should appear after these defined states
 */
export const AGENT_STATUS_ORDER = [
  "Planning",
  "Working",
  "Blocked",
  "Done",
] as const;

export type AgentStatus = (typeof AGENT_STATUS_ORDER)[number];

/**
 * Group by options for agent sessions
 */
export type AgentSessionGroupBy =
  | "PR Status"
  | "Creator"
  | "Repository"
  | "Agent Status";

/**
 * Get the sort index for a PR status
 * @param status The PR status string
 * @returns Sort index (lower = earlier in list), or Infinity for unknown values
 */
export function getPRStatusSortIndex(status: string): number {
  const index = PR_STATUS_ORDER.indexOf(status as PRStatus);
  return index === -1 ? Infinity : index;
}

/**
 * Get the sort index for an agent status
 * @param status The agent status string (case-insensitive)
 * @returns Sort index (lower = earlier in list), or Infinity for unknown values
 */
export function getAgentStatusSortIndex(status: string): number {
  const normalized =
    status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const index = AGENT_STATUS_ORDER.indexOf(normalized as AgentStatus);
  return index === -1 ? Infinity : index;
}

/**
 * Comparator for sorting by PR status
 */
export function comparePRStatus(a: string, b: string): number {
  const indexA = getPRStatusSortIndex(a);
  const indexB = getPRStatusSortIndex(b);
  if (indexA !== indexB) {
    return indexA - indexB;
  }
  // Fallback to alphabetical for unknown values
  return a.localeCompare(b);
}

/**
 * Comparator for sorting by agent status
 */
export function compareAgentStatus(a: string, b: string): number {
  const indexA = getAgentStatusSortIndex(a);
  const indexB = getAgentStatusSortIndex(b);
  if (indexA !== indexB) {
    return indexA - indexB;
  }
  // Fallback to alphabetical for unknown values
  return a.localeCompare(b);
}

/**
 * For Creator and Repository groupings, use alphabetical sorting
 */
export function compareAlphabetical(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Get the appropriate comparator function for a given group-by option
 * @param groupBy The grouping option
 * @returns A comparator function for sorting categories in that grouping
 */
export function getComparator(
  groupBy: AgentSessionGroupBy,
): (a: string, b: string) => number {
  switch (groupBy) {
    case "PR Status":
      return comparePRStatus;
    case "Agent Status":
      return compareAgentStatus;
    case "Creator":
    case "Repository":
      return compareAlphabetical;
    default:
      return compareAlphabetical;
  }
}
