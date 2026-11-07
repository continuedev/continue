import { Box, Text } from "ink";
import React from "react";

interface ChecklistDisplayProps {
  content: string;
}

// - [ ] pending, - [x] completed, and the task list's [>] in progress,
// [-] cancelled, [!] blocked.
const CHECKBOX = /^(\s*)-\s*\[([ xX>!-])\]\s*(.*)$/;

const MARKS: Record<string, { symbol: string; color: string }> = {
  " ": { symbol: "○", color: "yellow" },
  x: { symbol: "✓", color: "green" },
  X: { symbol: "✓", color: "green" },
  ">": { symbol: "▶", color: "cyan" },
  "-": { symbol: "–", color: "gray" },
  "!": { symbol: "!", color: "red" },
};

/**
 * Renders checklist content with styled checkboxes
 */
export const ChecklistDisplay: React.FC<ChecklistDisplayProps> = ({
  content,
}) => {
  const lines = content.split("\n");

  // The item to highlight: the one in progress, or else the first open one
  let currentIndex = lines.findIndex(
    (line) => line.match(CHECKBOX)?.[2] === ">",
  );
  if (currentIndex === -1) {
    currentIndex = lines.findIndex((line) => line.match(CHECKBOX)?.[2] === " ");
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {lines.map((line, index) => {
        if (line.startsWith("Task list")) {
          return null;
        }
        const checkboxMatch = line.match(CHECKBOX);

        if (checkboxMatch) {
          const [, indent, status, taskText] = checkboxMatch;
          const mark = MARKS[status];
          const isClosed = status === "x" || status === "X" || status === "-";
          const isCurrent = index === currentIndex;

          return (
            <Box key={index}>
              <Text>{indent}</Text>
              <Text color={mark.color}>{mark.symbol}</Text>
              <Text> </Text>
              <Text
                color={isClosed ? "gray" : isCurrent ? "cyan" : "white"}
                strikethrough={isClosed}
                bold={isCurrent}
              >
                {taskText}
              </Text>
            </Box>
          );
        } else if (line.trim()) {
          // Non-checkbox lines (headers, etc.)
          return (
            <Box key={index}>
              <Text color="white">{line}</Text>
            </Box>
          );
        } else {
          // Empty lines
          return <Box key={index} height={1} />;
        }
      })}
    </Box>
  );
};
