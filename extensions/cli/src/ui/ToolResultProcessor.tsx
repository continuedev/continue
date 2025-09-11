import path from "path";

import { formatToolArgument } from "src/tools/formatters.js";
import { getToolDisplayName } from "src/tools/index.js";

import { StyledSegment } from "./MarkdownProcessor.js";

const MAX_BASH_OUTPUT_LINES = 4;
const MAX_DIFF_LINES = 16;

// Color constants for diff display
const DIFF_COLORS = {
  ADDITION_BG: "#325b30",
  DELETION_BG: "#712f37",
  LINE_NUMBER: "gray",
} as const;

// Row types for tool result processing
export interface ToolResultRow {
  type: "header" | "content" | "summary";
  segments: StyledSegment[];
}

/**
 * Convert tool call title to styled segments
 * Based on ToolCallTitle component logic
 */
export function getToolCallTitleSegments(
  toolName: string,
  args?: any,
): StyledSegment[] {
  const displayName = getToolDisplayName(toolName);

  if (!args || Object.keys(args).length === 0) {
    return [{ text: displayName, styling: { bold: true } }];
  }

  // Get the first argument value if it's a simple one
  let formattedValue = "";
  const [key, value] = Object.entries(args)[0];
  if (
    key.toLowerCase().includes("path") ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    formattedValue = formatToolArgument(value);
  } else if (typeof value === "string") {
    const valueLines = value.split("\n");
    if (valueLines.length === 1) {
      formattedValue = formatToolArgument(value);
    } else {
      // For multi-line strings, show first line with ellipsis
      const firstLine = valueLines[0].trim();
      formattedValue = firstLine
        ? `${formatToolArgument(firstLine)}...`
        : "...";
    }
  }

  return [
    { text: displayName, styling: { bold: true } },
    { text: `(${formattedValue})`, styling: {} },
  ];
}

interface ToolResultSummaryProps {
  toolName?: string;
  content: string;
}

/**
 * Helper: Process checklist content into header + checkbox rows with status styling
 */
function processChecklistRows(content: string): ToolResultRow[] {
  const rows: ToolResultRow[] = [
    {
      type: "header",
      segments: [
        { text: "⎿ ", styling: { color: "gray" } },
        { text: "Task List Updated", styling: { color: "blue" } },
      ],
    },
  ];

  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("Task list")) {
      continue; // Skip header line
    }

    const checkboxMatch = line.match(/^(\s*)-\s*\[([ x])\]\s*(.*)$/);
    if (checkboxMatch) {
      const [, indent, status, taskText] = checkboxMatch;
      const isCompleted = status === "x";

      rows.push({
        type: "content",
        segments: [
          { text: "  " + indent, styling: {} }, // Padding + indent
          {
            text: isCompleted ? "✓" : "○",
            styling: { color: isCompleted ? "green" : "yellow" },
          },
          { text: " ", styling: {} },
          {
            text: taskText,
            styling: {
              color: isCompleted ? "gray" : "white",
              strikethrough: isCompleted,
            },
          },
        ],
      });
    } else if (line.trim()) {
      rows.push({
        type: "content",
        segments: [
          { text: "  ", styling: {} }, // Padding
          { text: line, styling: { color: "white" } },
        ],
      });
    }
  }

  return rows;
}

/**
 * Helper: Process Write/Edit/MultiEdit results into success message + diff rows
 */
function processFileEditRows(
  toolName: string | undefined,
  content: string,
): ToolResultRow[] | null {
  if (
    !(
      toolName === "Write" ||
      toolName === "Edit" ||
      toolName === "MultiEdit"
    ) ||
    !content.includes("Diff:\n")
  ) {
    return null;
  }

  const diffSection = content.split("Diff:\n")[1];
  if (!diffSection) {
    return null;
  }

  const rows: ToolResultRow[] = [
    {
      type: "header",
      segments: [
        { text: "⎿ ", styling: { color: "gray" } },
        {
          text:
            toolName === "Edit"
              ? " File edited successfully"
              : toolName === "MultiEdit"
                ? " File edited successfully"
                : " File written successfully",
          styling: { color: "green" },
        },
      ],
    },
  ];

  const diffRows = processDiffIntoRows(diffSection);
  rows.push(...diffRows);

  return rows;
}

/**
 * Helper: Process bash output into header + terminal output rows with truncation
 */
function processBashOutputRows(content: string): ToolResultRow[] {
  const isStderr = content.startsWith("Stderr:");
  const actualOutput = isStderr ? content.slice(7).trim() : content;
  const outputLines = actualOutput.split("\n");

  const rows: ToolResultRow[] = [
    {
      type: "header",
      segments: [
        { text: "⎿ ", styling: { color: "gray" } },
        { text: " Terminal output:", styling: { color: "gray" } },
      ],
    },
  ];

  if (outputLines.length <= MAX_BASH_OUTPUT_LINES) {
    // Show actual output for MAX_BASH_OUTPUT_LINES lines or fewer
    for (const line of outputLines) {
      if (line.trim()) {
        rows.push({
          type: "content",
          segments: [
            { text: "  ", styling: {} }, // Padding
            { text: line, styling: { color: isStderr ? "red" : "white" } },
          ],
        });
      }
    }
  } else {
    // Show first MAX_BASH_OUTPUT_LINES lines with ellipsis for more lines
    const firstLines = outputLines.slice(0, MAX_BASH_OUTPUT_LINES);
    for (const line of firstLines) {
      if (line.trim()) {
        rows.push({
          type: "content",
          segments: [
            { text: "  ", styling: {} }, // Padding
            { text: line, styling: { color: isStderr ? "red" : "white" } },
          ],
        });
      }
    }
    rows.push({
      type: "content",
      segments: [
        { text: "  ", styling: {} }, // Padding
        {
          text: `... +${outputLines.length - MAX_BASH_OUTPUT_LINES} lines`,
          styling: { color: "gray" },
        },
      ],
    });
  }

  return rows;
}

/**
 * TOOL RESULT SEGMENTATION: Convert complex tool outputs into pre-styled rows
 *
 * Processes tool outputs upstream to prevent flickering:
 * 1. Convert tool outputs into individual rows with pre-computed styled segments
 * 2. Handle multi-row outputs (checklists, diffs, bash output) at this level
 * 3. Return ToolResultRow objects that become separate MemoizedMessage components
 * 4. Each row renders instantly with pre-styled segments
 *
 * Complex tool result types that create multiple rows:
 * - Checklist: Header + checkbox rows with status indicators and strikethrough
 * - Write/Edit diffs: Success message + diff lines with +/- styling and colors
 * - Bash output: Header + terminal output lines (truncated if exceeds limit)
 * - Other tools: Summary row with formatted content and path conversion
 */
export function processToolResultIntoRows({
  toolName,
  content,
}: ToolResultSummaryProps): ToolResultRow[] {
  if (!content) {
    return [
      {
        type: "summary",
        segments: [
          { text: "⎿ ", styling: { color: "gray" } },
          { text: " No output", styling: { color: "gray" } },
        ],
      },
    ];
  }

  const displayName = toolName ? getToolDisplayName(toolName) : "Tool";

  // Handle Checklist specially with styled display
  if (toolName === "Checklist") {
    return processChecklistRows(content);
  }

  // Handle Write/Edit/MultiEdit with diff specially
  const fileEditRows = processFileEditRows(toolName, content);
  if (fileEditRows) {
    return fileEditRows;
  }

  // Handle terminal command output specially
  if (toolName === "Bash") {
    return processBashOutputRows(content);
  }

  // Handle all other cases with text summary
  const getSummary = () => {
    // Check if this is a user cancellation first
    if (content === "Permission denied by user") {
      return "Cancelled by user";
    }

    // Check if it was an error
    if (content.startsWith("Error")) {
      const lines = content.split("\n");
      return `Error: ${lines[0]}${lines.length > 1 ? "..." : ""}`;
    }

    // Convert absolute paths to relative paths from workspace root
    const formatPath = (filePath: string) => {
      if (path.isAbsolute(filePath)) {
        const workspaceRoot = process.cwd();
        const relativePath = path.relative(workspaceRoot, filePath);
        return relativePath || filePath;
      }
      return filePath;
    };

    const lines = content.split("\n").length;
    const chars = content.length;

    // Handle specific tool output formatting
    switch (toolName) {
      case "Read":
        // Try to extract file path from content if it contains line numbers
        if (content.includes("→")) {
          const pathMatch = content.match(/^(.+?):/);
          const filePath = pathMatch ? pathMatch[1] : "file";
          return `${displayName} ${formatPath(filePath)} (${lines} lines)`;
        }
        return `${displayName} tool output (${lines} lines)`;

      case "Write":
        return content.includes("Successfully created file")
          ? "File created successfully"
          : "File updated successfully";

      case "Edit":
        return "File edited successfully";

      case "MultiEdit":
        return "File edited successfully";

      case "List":
        return `Listed ${lines} ${lines === 1 ? "item" : "items"}`;

      case "Search":
        return `Found ${lines} ${lines === 1 ? "match" : "matches"}`;

      case "Diff":
        return `Diff output (${lines} lines)`;

      default:
        // Fallback for all tools using display name
        if (chars > 1000) {
          return `${displayName} output: ${lines} lines, ${chars} characters`;
        } else if (lines > 10) {
          return `${displayName} output: ${lines} lines`;
        } else {
          return content.slice(0, 100) + (content.length > 100 ? "..." : "");
        }
    }
  };

  return [
    {
      type: "summary",
      segments: [
        { text: "⎿ ", styling: { color: "gray" } },
        { text: " " + getSummary(), styling: { color: "gray" } },
      ],
    },
  ];
}

// Diff line interface (from ColoredDiff)
interface DiffLine {
  type: "add" | "del" | "context" | "hunk" | "other";
  oldLine?: number;
  newLine?: number;
  content: string;
}

/**
 * Parse diff content into individual lines (extracted from ColoredDiff)
 */
function parseDiffWithLineNumbers(diffContent: string): DiffLine[] {
  const lines = diffContent.split("\n");
  const result: DiffLine[] = [];
  let currentOldLine = 0;
  let currentNewLine = 0;
  let inHunk = false;
  const hunkHeaderRegex = /^@@ -(\d+),?\d* \+(\d+),?\d* @@/;

  for (const line of lines) {
    const hunkMatch = line.match(hunkHeaderRegex);
    if (hunkMatch) {
      currentOldLine = parseInt(hunkMatch[1], 10);
      currentNewLine = parseInt(hunkMatch[2], 10);
      inHunk = true;
      result.push({ type: "hunk", content: line });
      currentOldLine--;
      currentNewLine--;
      continue;
    }
    if (!inHunk) {
      if (
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("diff --git") ||
        line.startsWith("index ")
      )
        continue;
      continue;
    }
    if (line.startsWith("+")) {
      currentNewLine++;
      result.push({
        type: "add",
        newLine: currentNewLine,
        content: line.substring(1),
      });
    } else if (line.startsWith("-")) {
      currentOldLine++;
      result.push({
        type: "del",
        oldLine: currentOldLine,
        content: line.substring(1),
      });
    } else if (line.startsWith(" ")) {
      currentOldLine++;
      currentNewLine++;
      result.push({
        type: "context",
        oldLine: currentOldLine,
        newLine: currentNewLine,
        content: line.substring(1),
      });
    } else if (line.startsWith("\\")) {
      result.push({ type: "other", content: line });
    }
  }
  return result;
}

/**
 * Process diff content into individual row segments
 */
function processDiffIntoRows(diffContent: string): ToolResultRow[] {
  const parsedLines = parseDiffWithLineNumbers(diffContent);

  if (parsedLines.length === 0) {
    return [
      {
        type: "content",
        segments: [
          { text: "No changes detected.", styling: { color: "gray" } },
        ],
      },
    ];
  }

  const displayableLines = parsedLines.filter(
    (l) => l.type !== "hunk" && l.type !== "other",
  );

  const truncatedLines = displayableLines.slice(0, MAX_DIFF_LINES);
  const isTruncated = displayableLines.length > MAX_DIFF_LINES;

  const rows: ToolResultRow[] = [];

  // Process each diff line into a separate row
  for (const line of truncatedLines) {
    let gutterNumStr = "";
    let prefixSymbol = " ";
    let textColor: string = "white";
    let backgroundColor: string | undefined = undefined;

    switch (line.type) {
      case "add":
        gutterNumStr = (line.newLine ?? "").toString();
        backgroundColor = DIFF_COLORS.ADDITION_BG;
        prefixSymbol = "+";
        textColor = "white";
        break;
      case "del":
        gutterNumStr = (line.oldLine ?? "").toString();
        backgroundColor = DIFF_COLORS.DELETION_BG;
        prefixSymbol = "-";
        textColor = "white";
        break;
      case "context":
        gutterNumStr = (line.newLine ?? "").toString();
        textColor = "gray";
        prefixSymbol = " ";
        break;
      default:
        continue;
    }

    rows.push({
      type: "content",
      segments: [
        {
          text: gutterNumStr.padEnd(4) + " ",
          styling: { color: DIFF_COLORS.LINE_NUMBER },
        },
        {
          text: prefixSymbol + " ",
          styling: { color: textColor, backgroundColor },
        },
        {
          text: line.content,
          styling: { color: textColor, backgroundColor },
        },
      ],
    });
  }

  // Add truncation indicator if needed
  if (isTruncated) {
    rows.push({
      type: "content",
      segments: [
        {
          text: `... (${displayableLines.length - MAX_DIFF_LINES} more lines)`,
          styling: { color: "gray" },
        },
      ],
    });
  }

  return rows;
}
