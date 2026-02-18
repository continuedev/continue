import { fdir } from "fdir";
import { AsyncFzf, FzfResultItem } from "fzf";

import { FILE_IGNORE_PATTERNS } from "../util/filePatterns.js";
import { isGitRepo } from "../util/git.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";

export interface FileItem {
  path: string;
  displayName: string;
  positions?: Set<number>;
}

export interface FileIndexServiceState {
  files: FileItem[];
  isIndexing: boolean;
  error: string | null;
}

export class FileIndexService extends BaseService<FileIndexServiceState> {
  private fzf: AsyncFzf<FileItem[]> | null = null;

  // Helper to check if a file should be included based on FILE_PATTERNS
  private shouldIncludeFile(filePath: string): boolean {
    const fileName = filePath.split("/").pop()?.toLowerCase() || "";
    const ext = fileName.split(".").pop();

    // Check if file matches any of the original FILE_PATTERNS
    const supportedExtensions = [
      "ts",
      "tsx",
      "js",
      "jsx",
      "py",
      "java",
      "cpp",
      "c",
      "h",
      "hpp",
      "cs",
      "go",
      "rs",
      "rb",
      "php",
      "swift",
      "kt",
      "scala",
      "md",
      "json",
      "yaml",
      "yml",
      "xml",
      "html",
      "css",
      "scss",
      "sass",
      "less",
      "sql",
      "sh",
      "dockerfile",
      "makefile",
      "cmake",
      "gradle",
      "toml",
      "ini",
      "env",
      "txt",
      "log",
    ];

    // Check extension match
    if (ext && supportedExtensions.includes(ext)) {
      return true;
    }

    // Check special file patterns
    if (
      fileName.startsWith("readme") ||
      fileName.startsWith("license") ||
      fileName.startsWith("changelog") ||
      fileName === "package.json" ||
      fileName === "cargo.toml" ||
      fileName === "pyproject.toml" ||
      fileName === "composer.json" ||
      fileName === "gemfile" ||
      fileName === ".gitignore" ||
      fileName.startsWith(".env")
    ) {
      return true;
    }

    return false;
  }

  constructor() {
    super("FileIndexService", {
      files: [],
      isIndexing: false,
      error: null,
    });
  }

  async doInitialize(): Promise<FileIndexServiceState> {
    await this.performFullIndex();
    return this.getState();
  }

  async cleanup(): Promise<void> {
    // No cleanup needed - no file watchers or subscriptions
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

  private async performFullIndex(
    bypassTimeout: boolean = false,
  ): Promise<void> {
    this.setState({ isIndexing: true, error: null });

    try {
      const currentDir = process.cwd();
      logger.debug(`Starting file index in directory: ${currentDir}`);

      // Determine max depth based on git repository status
      const inGitRepo = isGitRepo();
      const maxDepth = inGitRepo ? 10 : 3;

      // Create file indexing promise
      const fileIndexPromise = new fdir()
        .withFullPaths()
        .withRelativePaths()
        .withMaxDepth(maxDepth)
        .filter((path) => {
          // Use the helper function that implements original FILE_PATTERNS logic
          return this.shouldIncludeFile(path);
        })
        .exclude((dirName) => {
          // Exclude directories based on FILE_IGNORE_PATTERNS
          for (const pattern of FILE_IGNORE_PATTERNS) {
            if (pattern.startsWith("**/") && pattern.endsWith("/**")) {
              const excludeDirName = pattern.slice(3, -3);
              if (dirName === excludeDirName) {
                return true;
              }
            }
          }
          return false;
        })
        .crawl(currentDir)
        .withPromise();

      let allFiles: string[];

      if (bypassTimeout) {
        // Manual refresh - wait for completion regardless of time
        allFiles = await fileIndexPromise;
      } else {
        // Automatic indexing - race against 1-second timeout
        const timeoutPromise = new Promise<"timeout">((resolve) => {
          setTimeout(() => {
            resolve("timeout");
          }, 1000);
        });

        const result = await Promise.race([fileIndexPromise, timeoutPromise]);

        if (result === "timeout") {
          this.setState({
            files: [],
            isIndexing: false,
            error: "directory-too-large",
          });
          return;
        }

        allFiles = result as string[];
      }

      const fileItems = allFiles.map((path) => ({
        path,
        displayName: path,
      }));

      this.rebuildFzf(fileItems);
      this.setState({ files: fileItems, isIndexing: false });

      logger.debug(`Indexed ${fileItems.length} files`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error performing full file index:", error);
      this.setState({ isIndexing: false, error: errorMessage });
    }
  }

  private rebuildFzf(files: FileItem[]): void {
    this.fzf = new AsyncFzf(files, {
      selector: (item: FileItem) => item.path,
      casing: "case-insensitive",
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

  public async refreshIndex(bypassTimeout: boolean = false): Promise<void> {
    await this.performFullIndex(bypassTimeout);
  }

  public async filterFiles(
    filterText: string,
    limit: number = 10,
  ): Promise<FileItem[]> {
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

    // Use fzf for fuzzy search
    if (!this.fzf) {
      this.rebuildFzf(files);
    }

    const results = await this.fzf!.find(filterText);
    return results.slice(0, limit).map((entry: FzfResultItem<FileItem>) => ({
      path: entry.item.path,
      displayName: entry.item.displayName,
      positions: entry.positions,
    }));
  }
}
