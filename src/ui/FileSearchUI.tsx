import { glob, GlobOptionsWithFileTypesFalse } from "glob";
import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { isGitRepo } from "../util/git.js";

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

// Cache for file search results
const fileCache = new Map<string, FileItem[]>();
let allFiles: FileItem[] = [];
let cacheInitialized = false;
let cacheInitializationPromise: Promise<void> | null = null;

// Initialize cache once
const initializeCache = async (): Promise<void> => {
  if (cacheInitialized) {
    return;
  }

  if (cacheInitializationPromise) {
    return cacheInitializationPromise;
  }

  cacheInitializationPromise = (async () => {
    try {
      const inGitRepo = isGitRepo();
      // Use a single, more efficient pattern
      const patterns = [
        "**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,go,rs,rb,php,swift,kt,scala,md,json,yaml,yml,xml,html,css,scss,sass,less,sql,sh,dockerfile,makefile,cmake,gradle,toml,ini,env,txt,log}",
        "**/README*",
        "**/LICENSE*",
        "**/CHANGELOG*",
        "**/package.json",
        "**/Cargo.toml",
        "**/pyproject.toml",
        "**/composer.json",
        "**/Gemfile",
        "**/.gitignore",
        "**/.env*",
      ];

      const allMatches = await throttledGlob(patterns, {
        maxDepth: inGitRepo ? 15 : 3,
        ignore: [
          "**/node_modules/**",
          "**/dist/**",
          "**/build/**",
          "**/out/**",
          "**/target/**",
          "**/.git/**",
          "**/.vscode/**",
          "**/.idea/**",
          "**/coverage/**",
          "**/*.min.js",
          "**/*.min.css",
          "**/*.bundle.js",
          "**/*.bundle.css",
          "**/.DS_Store",
          "**/Thumbs.db",
          "**/*.log",
          "**/*.tmp",
          "**/*.temp",
          "**/*.swp",
          "**/*.swo",
          "**/*.bak",
          "**/*.orig",
          "**/*.rej",
          "**/*.pyc",
          "**/*.pyo",
          "**/*.class",
          "**/*.o",
          "**/*.obj",
          "**/*.exe",
          "**/*.dll",
          "**/*.so",
          "**/*.dylib",
          "**/*.a",
          "**/*.lib",
          "**/*.jar",
          "**/*.war",
          "**/*.ear",
          "**/*.zip",
          "**/*.tar.gz",
          "**/*.tgz",
          "**/*.rar",
          "**/*.7z",
          "**/*.next",
        ],
        dot: true,
        absolute: false,
      });

      const uniqueFiles = [...new Set(allMatches)];

      allFiles = uniqueFiles.map((path) => ({
        path,
        displayName: path,
      }));

      cacheInitialized = true;
    } catch (error) {
      console.error("Error initializing file cache:", error);
    }
  })();

  return cacheInitializationPromise;
};

// Export function to start indexing proactively
export const startFileIndexing = (): Promise<void> => {
  return initializeCache();
};

// Filter files from cache
const filterFiles = (filterText: string): FileItem[] => {
  if (!cacheInitialized) {
    return [];
  }

  if (filterText.length === 0) {
    // Show most recently modified files when no filter
    return allFiles
      .sort((a, b) => {
        const aFileName = a.path.split("/").pop() || a.path;
        const bFileName = b.path.split("/").pop() || b.path;
        return aFileName.localeCompare(bFileName);
      })
      .slice(0, 10);
  }

  const lowerFilter = filterText.toLowerCase();

  // Check cache first
  const cacheKey = lowerFilter;
  if (fileCache.has(cacheKey)) {
    return fileCache.get(cacheKey)!;
  }

  const filteredFiles = allFiles
    .filter((file) => {
      return (
        file.displayName.toLowerCase().includes(lowerFilter) ||
        file.path.toLowerCase().includes(lowerFilter)
      );
    })
    .sort((a, b) => {
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

  // Cache the result
  fileCache.set(cacheKey, filteredFiles);

  // Limit cache size
  if (fileCache.size > 100) {
    const firstKey = fileCache.keys().next().value;
    if (firstKey) {
      fileCache.delete(firstKey);
    }
  }

  return filteredFiles;
};

const FileSearchUI: React.FC<FileSearchUIProps> = ({
  filter,
  selectedIndex,
  onFilesUpdated,
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const searchFiles = async () => {
      if (!cacheInitialized) {
        setIsLoading(true);
        await initializeCache();
        setIsLoading(false);
      }

      const filteredFiles = filterFiles(filter);
      setFiles(filteredFiles);

      if (onFilesUpdated) {
        onFilesUpdated(filteredFiles);
      }
    };

    searchFiles();
  }, [filter, onFilesUpdated]);

  if (isLoading) {
    return (
      <Box paddingX={1} marginX={1} marginBottom={1}>
        <Text color="gray">Indexing files...</Text>
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
          Use ↑/↓ to navigate, Enter to select, Tab to complete
        </Text>
      </Box>
    </Box>
  );
};

export { FileSearchUI };

export async function throttledGlob(
  patterns: string[],
  options: GlobOptionsWithFileTypesFalse,
  batchSize = 100,
  delay = 20,
): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const allMatches: string[] = [];
    let processed = 0;

    // Combine all patterns into a single glob stream using brace expansion
    // This is more efficient than running separate glob operations
    const globStream = glob.stream(patterns, options);

    globStream.on("data", (file: string) => {
      allMatches.push(file);
      processed++;

      // Pause the stream periodically to give other processes a chance
      if (processed % batchSize === 0) {
        if (globStream.emittedEnd) {
          return;
        }
        globStream.pause();

        setTimeout(() => {
          if (globStream.emittedEnd) {
            return;
          }
          globStream.resume();
        }, delay); // Short pause
      }
    });

    globStream.on("end", () => resolve(allMatches));
    globStream.on("error", (err) => reject(err));
  });
}
