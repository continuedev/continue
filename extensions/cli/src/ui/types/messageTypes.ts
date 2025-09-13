/**
 * Simplified StyledSegment interface for the unified MessageRow architecture
 * Removes unused semantic type field while preserving all actual functionality
 */
export interface StyledSegment {
  text: string;
  styling: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    color?: string;
    backgroundColor?: string;
    codeLanguage?: string; // If present, treat as code block with syntax highlighting
  };
}

/**
 * Unified MessageRow type - single structure for all message rendering
 *
 * Replaces the complex ChatHistoryItemWithSplit with optional fields.
 * All message types (user, assistant, tool results) are converted to this format.
 */
export type MessageRow = {
  // Row metadata
  role: "user" | "assistant" | "system" | "tool-result";
  rowType: "content" | "header" | "summary";

  // Unified rendering data - always use segments for rendering
  segments: StyledSegment[];

  // Visual formatting
  showBullet: boolean; // Show ● indicator
  marginBottom: number; // 0 for continuation rows, 1 for last row

  // Optional tool metadata (only for tool result rows)
  toolMeta?: {
    toolCallId: string;
    toolName: string;
  };
};
