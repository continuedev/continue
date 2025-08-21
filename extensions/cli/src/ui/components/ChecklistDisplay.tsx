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

          return (
            <Box key={index}>
              <Text>{indent}</Text>
              <Text color={isCompleted ? "green" : "yellow"}>
                {isCompleted ? "✓" : "○"}
              </Text>
              <Text> </Text>
              <Text
                color={isCompleted ? "gray" : "white"}
                strikethrough={isCompleted}
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
