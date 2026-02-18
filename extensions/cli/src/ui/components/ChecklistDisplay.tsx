import { Box, Text } from "ink";
import React from "react";

interface ChecklistDisplayProps {
  content: string;
}

/**
 * Renders checklist content with styled checkboxes
 */
export const ChecklistDisplay: React.FC<ChecklistDisplayProps> = ({
  content,
}) => {
  const lines = content.split("\n");

  // Find the index of the first incomplete checkbox item
  let firstIncompleteIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const checkboxMatch = line.match(/^(\s*)-\s*\[([ x])\]\s*(.*)$/);
    if (checkboxMatch && checkboxMatch[2] === " ") {
      firstIncompleteIndex = i;
      break;
    }
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {lines.map((line, index) => {
        if (line.startsWith("Task list")) {
          return null;
        }
        // Match both completed [x] and incomplete [ ] checkboxes
        const checkboxMatch = line.match(/^(\s*)-\s*\[([ x])\]\s*(.*)$/);

        if (checkboxMatch) {
          const [, indent, status, taskText] = checkboxMatch;
          const isCompleted = status === "x";
          const isFirstIncomplete = index === firstIncompleteIndex;

          return (
            <Box key={index}>
              <Text>{indent}</Text>
              <Text color={isCompleted ? "green" : "yellow"}>
                {isCompleted ? "✓" : "○"}
              </Text>
              <Text> </Text>
              <Text
                color={
                  isCompleted ? "gray" : isFirstIncomplete ? "cyan" : "white"
                }
                strikethrough={isCompleted}
                bold={isFirstIncomplete}
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
