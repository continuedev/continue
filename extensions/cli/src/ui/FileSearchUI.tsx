import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { useServices } from "../hooks/useService.js";
import { FileIndexServiceState } from "../services/FileIndexService.js";

interface FileSearchUIProps {
  filter: string;
  selectedIndex: number;
  onSelect: (filePath: string) => void;
  onFilesUpdated?: (files: FileItem[]) => void;
}

interface FileItem {
  path: string;
  displayName: string;
}

const FileSearchUI: React.FC<FileSearchUIProps> = ({
  filter,
  selectedIndex,
  onFilesUpdated,
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);

  // Get file index service
  const { services } = useServices<{
    fileIndex: FileIndexServiceState;
  }>(["fileIndex"]);

  const fileIndexService = services.fileIndex;

  useEffect(() => {
    if (!fileIndexService) {
      return;
    }

    // Get filtered files from the service
    const filteredFiles = fileIndexService.files
      .filter((file) => {
        if (filter.length === 0) {
          return true;
        }
        const lowerFilter = filter.toLowerCase();
        return (
          file.displayName.toLowerCase().includes(lowerFilter) ||
          file.path.toLowerCase().includes(lowerFilter)
        );
      })
      .sort((a, b) => {
        if (filter.length === 0) {
          // Sort alphabetically when no filter
          const aFileName = a.path.split("/").pop() || a.path;
          const bFileName = b.path.split("/").pop() || b.path;
          return aFileName.localeCompare(bFileName);
        }

        const lowerFilter = filter.toLowerCase();
        const aFileName = a.path.split("/").pop() || a.path;
        const bFileName = b.path.split("/").pop() || b.path;

        // Prioritize exact matches in file name
        const aNameMatch = aFileName.toLowerCase().includes(lowerFilter);
        const bNameMatch = bFileName.toLowerCase().includes(lowerFilter);

        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        // Then prioritize files that start with the filter
        const aStartsWith = aFileName.toLowerCase().startsWith(lowerFilter);
        const bStartsWith = bFileName.toLowerCase().startsWith(lowerFilter);

        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // Finally, sort by file name
        return aFileName.localeCompare(bFileName);
      })
      .slice(0, 10);

    setFiles(filteredFiles);

    if (onFilesUpdated) {
      onFilesUpdated(filteredFiles);
    }
  }, [fileIndexService?.files, filter, onFilesUpdated]);

  if (fileIndexService?.isIndexing) {
    return (
      <Box paddingX={1} marginX={1} marginBottom={1}>
        <Text color="gray">Indexing files...</Text>
      </Box>
    );
  }

  if (fileIndexService?.error) {
    return (
      <Box paddingX={1} marginX={1} marginBottom={1}>
        <Text color="red">Error indexing files: {fileIndexService.error}</Text>
      </Box>
    );
  }

  if (files.length === 0) {
    return (
      <Box paddingX={1} marginX={1} marginBottom={1}>
        <Text color="gray">No matching files found</Text>
      </Box>
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
              <Text color="green">@{file.displayName}</Text>
            </Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑/↓ to navigate, Enter to select, Tab to complete
        </Text>
      </Box>
    </Box>
  );
};

export { FileSearchUI };
