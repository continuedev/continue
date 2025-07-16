import { Box, Text } from "ink";
import React, { useEffect, useState, useRef } from "react";
import { glob } from "glob";

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

const FileSearchUI: React.FC<FileSearchUIProps> = ({
  filter,
  selectedIndex,
  onSelect,
  onFilesUpdated,
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const initializingRef = useRef(false);

  // Initialize cache once
  const initializeCache = async () => {
    if (cacheInitialized || initializingRef.current) {
      return;
    }
    
    initializingRef.current = true;
    
    try {
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

      const allMatches: string[] = [];
      
      // Use Promise.all for parallel glob searches
      const results = await Promise.all(
        patterns.map(pattern => 
          glob(pattern, {
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
            ],
            dot: true,
            absolute: false,
          })
        )
      );

      // Flatten and deduplicate results
      for (const matches of results) {
        // Handle case where glob might return undefined
        if (matches) {
          allMatches.push(...matches);
        }
      }

      const uniqueFiles = [...new Set(allMatches)];
      
      allFiles = uniqueFiles.map((path) => ({
        path,
        displayName: path,
      }));

      cacheInitialized = true;
    } catch (error) {
      console.error("Error initializing file cache:", error);
    } finally {
      initializingRef.current = false;
    }
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
          const aFileName = a.path.split('/').pop() || a.path;
          const bFileName = b.path.split('/').pop() || b.path;
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
        const aFileName = a.path.split('/').pop() || a.path;
        const bFileName = b.path.split('/').pop() || b.path;
        
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

export default FileSearchUI;