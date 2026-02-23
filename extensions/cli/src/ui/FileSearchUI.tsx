import { Box, Text, useInput } from "ink";
import React, { useEffect, useState } from "react";

import { useServices } from "../hooks/useService.js";
import {
  FileIndexServiceState,
  FileItem,
} from "../services/FileIndexService.js";
import { services } from "../services/index.js";

interface FileSearchUIProps {
  filter: string;
  selectedIndex: number;
  onSelect: (filePath: string) => void;
  onFilesUpdated?: (files: FileItem[]) => void;
}

// Highlighting component for matched characters
const HighlightedText: React.FC<{ text: string; positions?: Set<number> }> = ({
  text,
  positions,
}) => {
  if (!positions || positions.size === 0) {
    return <>{text}</>;
  }

  const chars = text.split("");
  const elements: React.ReactNode[] = [];

  chars.forEach((char, index) => {
    if (positions.has(index)) {
      elements.push(
        <Text key={index} color="white">
          {char}
        </Text>,
      );
    } else {
      elements.push(char);
    }
  });

  return <>{elements}</>;
};

// Reusable container for consistent layout
const FileSearchContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Box paddingX={1} marginX={1} marginBottom={1} flexDirection="column">
    <Box marginTop={1}>{children}</Box>
  </Box>
);

// Keyboard navigation shortcuts help text
const KEYBOARD_SHORTCUTS =
  "↑/↓ to navigate, Enter to select, Tab to complete, Ctrl+r to refresh list";

const FileSearchUI: React.FC<FileSearchUIProps> = ({
  filter,
  selectedIndex,
  onFilesUpdated,
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);

  // Get file index service state for reactive updates
  const { services: serviceStates } = useServices<{
    fileIndex: FileIndexServiceState;
  }>(["fileIndex"]);

  const fileIndexServiceState = serviceStates.fileIndex;

  useEffect(() => {
    if (!fileIndexServiceState) {
      return;
    }

    // Use the FileIndexService's filterFiles method which includes fzf fuzzy matching
    const fetchFilteredFiles = async () => {
      try {
        // console.log(`FileSearchUI: Filtering files with "${filter}", total files in state:`, fileIndexServiceState?.files?.length);
        const filteredFiles = await services.fileIndex.filterFiles(filter, 10);
        // console.log(`FileSearchUI: Filtered to ${filteredFiles.length} files`);
        setFiles(filteredFiles);

        if (onFilesUpdated) {
          onFilesUpdated(filteredFiles);
        }
      } catch (error) {
        // Suppress expected "search cancelled" errors from AsyncFzf when typing fast
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("search cancelled")) {
          console.error("Error filtering files:", error);
        }
        setFiles([]);
      }
    };

    fetchFilteredFiles();
  }, [fileIndexServiceState?.files, filter, onFilesUpdated]);

  // Handle Ctrl+R to refresh file index
  useInput((input, key) => {
    if (key.ctrl && input === "r") {
      services.fileIndex.refreshIndex(true); // Bypass timeout for manual refresh
    }
  });

  if (fileIndexServiceState?.error) {
    // Special handling for directory too large error
    if (fileIndexServiceState.error === "directory-too-large") {
      return (
        <FileSearchContainer>
          <Text color="gray" dimColor>
            Ctrl+r to refresh list (this may take several seconds)
          </Text>
        </FileSearchContainer>
      );
    }

    // Other errors
    return (
      <FileSearchContainer>
        <Text color="red">
          Error indexing files: {fileIndexServiceState.error}
        </Text>
      </FileSearchContainer>
    );
  }

  if (files.length === 0 && !fileIndexServiceState?.isIndexing) {
    // Only show "No matching files found" if:
    // 1. There are files in the index (so it's not a system issue)
    // 2. There's actually a search filter (not just "@")
    if (
      fileIndexServiceState?.files &&
      fileIndexServiceState.files.length > 0 &&
      filter.length > 0
    ) {
      return (
        <FileSearchContainer>
          <Text color="gray" dimColor>
            No matching files found
          </Text>
        </FileSearchContainer>
      );
    }

    // Show keyboard navigation hints
    return (
      <FileSearchContainer>
        <Text color="gray" dimColor>
          {KEYBOARD_SHORTCUTS}
        </Text>
      </FileSearchContainer>
    );
  }

  return (
    <Box paddingX={1} marginX={1} marginBottom={1} flexDirection="column">
      {files.map((file, index) => {
        const isSelected = index === selectedIndex;

        return (
          <Box key={file.path}>
            <Text color="white" bold={isSelected}>
              {"  "}
              <Text color="green" dimColor={!isSelected}>
                @
                <HighlightedText
                  text={file.displayName}
                  positions={file.positions}
                />
              </Text>
            </Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {KEYBOARD_SHORTCUTS}
        </Text>
      </Box>
    </Box>
  );
};

export { FileSearchUI };
