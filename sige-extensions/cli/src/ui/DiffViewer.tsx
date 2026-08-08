import { Box, Text, useInput } from "ink";
import React, { useEffect } from "react";

import { ColoredDiff } from "./ColoredDiff.js";

interface DiffViewerProps {
  diffContent: string;
  onClose: () => void;
}

/**
 * Full-screen diff viewer overlay
 * Shows diff content with syntax highlighting and allows closing with ESC
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffContent,
  onClose,
}) => {
  // Handle ESC key to close the diff viewer
  useInput((input, key) => {
    if (key.escape) {
      onClose();
    }
  });

  // Auto-focus when component mounts
  useEffect(() => {
    // Component is already focused by default in Ink
  }, []);

  return (
    <Box
      flexDirection="column"
      height="100%"
      borderStyle="single"
      borderColor="blue"
      padding={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="blue" bold>
          Git Diff (Press ESC to close)
        </Text>
      </Box>

      {/* Diff content - scrollable */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {diffContent.trim() ? (
          <ColoredDiff diffContent={diffContent} />
        ) : (
          <Text color="gray" italic>
            No changes to display
          </Text>
        )}
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
        <Text color="gray" dimColor>
          ESC to close
        </Text>
      </Box>
    </Box>
  );
};
