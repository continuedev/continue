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
  // Parse the content to extract the checklist after "Task list status:\n"
  const checklistMatch = content.match(/Task list status:\n([\s\S]*)/);
  const checklistContent = checklistMatch ? checklistMatch[1] : content;

  const lines = checklistContent.split("\n");

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray">⎿ </Text>
        <Text color="blue">Task List Updated</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        {lines.map((line, index) => {
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
                <Text color={isCompleted ? "gray" : "white"} strikethrough={isCompleted}>
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
    </Box>
  );
};