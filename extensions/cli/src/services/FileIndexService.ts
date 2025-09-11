import { glob, GlobOptionsWithFileTypesFalse } from "glob";

import { FILE_IGNORE_PATTERNS, FILE_PATTERNS } from "../util/filePatterns.js";
import { getFileWatcher } from "../util/fileWatcher.js";
import { isGitRepo } from "../util/git.js";
import { isInHomeDirectory } from "../util/isInHomeDirectory.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";

export interface FileItem {
  path: string;
  displayName: string;
}

export interface FileIndexServiceState {
  files: FileItem[];
  isIndexing: boolean;
  error: string | null;
}

export class FileIndexService extends BaseService<FileIndexServiceState> {
  private fileSet = new Set<string>();
  private fileWatcherInitialized = false;
  private fileWatcherUnsubscribe: (() => void) | null = null;

  constructor() {
    super("FileIndexService", {
      files: [],
      isIndexing: false,
      error: null,
    });
  }

  async doInitialize(): Promise<FileIndexServiceState> {
    await this.performFullIndex();
    this.setupFileWatcher();
    return this.getState();
  }

  async cleanup(): Promise<void> {
    if (this.fileWatcherUnsubscribe) {
      this.fileWatcherUnsubscribe();
      this.fileWatcherUnsubscribe = null;
    }

    // Stop the file watcher to prevent resource leaks
    if (this.fileWatcherInitialized) {
      const watcher = getFileWatcher();
      watcher.stopWatching();
    }

    this.fileWatcherInitialized = false;
  }

  /**
   * Override setState to also notify the ServiceContainer
   */
  protected setState(newState: Partial<FileIndexServiceState>): void {
    super.setState(newState);

    // Also notify the ServiceContainer so UI components get updated
    const currentState = this.getState();
    serviceContainer.set("fileIndex", currentState);
  }

  private async performFullIndex(): Promise<void> {
    this.setState({ isIndexing: true, error: null });

    try {
      const inGitRepo = isGitRepo();

      if (isInHomeDirectory()) {
        this.setState({
          isIndexing: false,
          error: "Skipping full index as in home directory",
        });
        return;
      }

      const allMatches = await this.throttledGlob(FILE_PATTERNS, {
        maxDepth: inGitRepo ? 15 : 3,
        ignore: FILE_IGNORE_PATTERNS,
        dot: true,
        absolute: false,
      });

      const uniqueFiles = [...new Set(allMatches)];
      this.fileSet.clear();
      uniqueFiles.forEach((file) => this.fileSet.add(file));

      const files = uniqueFiles.map((path) => ({
        path,
        displayName: path,
      }));

      this.setState({ files, isIndexing: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error performing full file index:", error);
      this.setState({ isIndexing: false, error: errorMessage });
    }
  }

  private setupFileWatcher(): void {
    if (this.fileWatcherInitialized) {
      return;
    }

    // Only enable file watching in git repositories
    // Outside git repos (like home directory), file watching causes performance issues
    // and provides little value since files change less predictably
    const inGitRepo = isGitRepo();
    if (!inGitRepo) {
      logger.debug("Skipping file watcher: not in a git repository");
      return;
    }

    this.fileWatcherInitialized = true;
    const watcher = getFileWatcher();

    // Start watching the current directory
    watcher.startWatching();

    // Set up callback for incremental updates
    this.fileWatcherUnsubscribe = watcher.onChange(() => {
      this.handleFileSystemChange();
    });
  }

  private async handleFileSystemChange(): Promise<void> {
    try {
      // Get current files from file system
      const inGitRepo = isGitRepo();
      const allMatches = await this.throttledGlob(FILE_PATTERNS, {
        maxDepth: inGitRepo ? 15 : 3,
        ignore: FILE_IGNORE_PATTERNS,
        dot: true,
        absolute: false,
      });

      const currentFiles = new Set(allMatches);
      const previousFiles = this.fileSet;

      // Find added and removed files
      const addedFiles = [...currentFiles].filter(
        (file) => !previousFiles.has(file),
      );
      const removedFiles = [...previousFiles].filter(
        (file) => !currentFiles.has(file),
      );

      // Only update if there are actual changes
      if (addedFiles.length > 0 || removedFiles.length > 0) {
        // Update internal file set
        this.fileSet = currentFiles;

        // Create new files array
        const files = [...currentFiles].map((path) => ({
          path,
          displayName: path,
        }));

        this.setState({ files });
      }
    } catch (error) {
      logger.error("Error handling file system change:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.setState({ error: errorMessage });
    }
  }

  private async throttledGlob(
    patterns: string[],
    options: GlobOptionsWithFileTypesFalse,
    batchSize = 100,
    delay = 20,
  ): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const allMatches: string[] = [];
      let processed = 0;
      let streamEnded = false;

      const globStream = glob.stream(patterns, options);

      globStream.on("data", (file: string) => {
        allMatches.push(file);
        processed++;

        if (processed % batchSize === 0) {
          if (streamEnded) {
            return;
          }
          globStream.pause();

          setTimeout(() => {
            if (streamEnded) {
              return;
            }
            globStream.resume();
          }, delay);
        }
      });

      globStream.on("end", () => {
        streamEnded = true;
        resolve(allMatches);
      });

      globStream.on("error", (err) => {
        streamEnded = true;
        reject(err);
      });
    });
  }

  // Public API methods
  public getFiles(): FileItem[] {
    return this.getState().files;
  }

  public isIndexing(): boolean {
    return this.getState().isIndexing;
  }

  public getError(): string | null {
    return this.getState().error;
  }

  public async refreshIndex(): Promise<void> {
    await this.performFullIndex();
  }

  public filterFiles(filterText: string, limit: number = 10): FileItem[] {
    const files = this.getFiles();

    if (filterText.length === 0) {
      // Show files sorted alphabetically when no filter
      return [...files]
        .sort((a, b) => {
          const aFileName = a.path.split("/").pop() || a.path;
          const bFileName = b.path.split("/").pop() || b.path;
          return aFileName.localeCompare(bFileName);
        })
        .slice(0, limit);
    }

    const lowerFilter = filterText.toLowerCase();

    return files
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
      .slice(0, limit);
  }
}
