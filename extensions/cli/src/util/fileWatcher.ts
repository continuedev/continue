import * as fs from "fs";
import * as path from "path";

import { FILE_IGNORE_PATTERNS } from "./filePatterns.js";

interface FileWatcherOptions {
  ignore?: string[];
  debounceMs?: number;
  maxDepth?: number;
}

export class FileWatcher {
  private watchers: fs.FSWatcher[] = [];
  private callbacks: Set<() => void> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;
  private options: Required<FileWatcherOptions>;
  private watchedDirs: Set<string> = new Set();
  private isInitializing: boolean = false;
  private lastErrorCode: string | null = null;

  constructor(options: FileWatcherOptions = {}) {
    this.options = {
      ignore: [...FILE_IGNORE_PATTERNS, ...(options.ignore || [])],
      debounceMs: options.debounceMs || 1000,
      maxDepth: options.maxDepth || 10,
    };
  }

  private shouldIgnorePath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath).replace(/\\/g, "/");

    return this.options.ignore.some((pattern) => {
      if (pattern.startsWith("**/")) {
        const suffix = pattern.slice(3);
        if (suffix.endsWith("/**")) {
          // Directory pattern like **/node_modules/**
          const dirName = suffix.slice(0, -3);
          return (
            normalizedPath.includes(`/${dirName}/`) ||
            normalizedPath.endsWith(`/${dirName}`) ||
            normalizedPath === dirName
          );
        } else if (suffix.startsWith("*")) {
          // File pattern like **/*.tmp
          const extension = suffix.slice(1); // Remove the '*' to get the extension
          return normalizedPath.endsWith(extension);
        } else {
          // File pattern like **/package.json
          return (
            normalizedPath.endsWith(`/${suffix}`) ||
            normalizedPath.endsWith(suffix)
          );
        }
      }
      return normalizedPath.includes(pattern);
    });
  }

  private triggerCallbacks(): void {
    // Don't trigger callbacks during initialization
    if (this.isInitializing) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.callbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error("Error in file watcher callback:", error);
        }
      });
    }, this.options.debounceMs);
  }

  private handleFileChange = (
    eventType: string,
    filename: string | null,
    dirPath: string,
    depth: number,
  ): void => {
    if (!filename) return;

    const fullPath = path.join(dirPath, filename);

    // Skip if path should be ignored
    if (this.shouldIgnorePath(fullPath)) {
      return;
    }

    // Check if it's a directory and we should watch it
    if (eventType === "rename") {
      this.handleNewDirectory(fullPath, depth);
    }

    this.triggerCallbacks();
  };

  private handleNewDirectory(fullPath: string, depth: number): void {
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory() && depth < this.options.maxDepth) {
        // New directory created, start watching it
        this.watchDirectory(fullPath, depth + 1);
      }
    } catch {
      // File/directory was deleted or not accessible
    }
  }

  private setupWatcher(dirPath: string, depth: number): void {
    try {
      const watcher = fs.watch(
        dirPath,
        { persistent: false },
        (eventType, filename) => {
          this.handleFileChange(eventType, filename, dirPath, depth);
        },
      );

      watcher.on("error", (error: any) => {
        this.lastErrorCode = error?.code || null;
        console.error(`File watcher error for ${dirPath}:`, error);
      });

      this.watchers.push(watcher);
    } catch (error: any) {
      // Gracefully handle environments that restrict fs.watch (e.g., low descriptor limits)
      this.lastErrorCode = error?.code || null;
      console.error(`Failed to create watcher for ${dirPath}:`, error);
    }
  }

  private watchSubdirectories(dirPath: string, depth: number): void {
    try {
      const entries = fs.readdirSync(dirPath);
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        if (this.shouldIgnorePath(entryPath)) {
          continue;
        }

        try {
          const stats = fs.statSync(entryPath);
          if (stats.isDirectory()) {
            this.watchDirectory(entryPath, depth + 1);
          }
        } catch {
          // Skip inaccessible entries
        }
      }
    } catch {
      // Skip if can't read directory
    }
  }

  private watchDirectory(dirPath: string, depth: number = 0): void {
    if (
      depth > this.options.maxDepth ||
      this.shouldIgnorePath(dirPath) ||
      this.watchedDirs.has(dirPath)
    ) {
      return;
    }

    try {
      // Check if directory exists and is accessible
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        return;
      }

      this.watchedDirs.add(dirPath);
      this.setupWatcher(dirPath, depth);
      this.watchSubdirectories(dirPath, depth);
    } catch (error) {
      console.error(`Failed to watch directory ${dirPath}:`, error);
    }
  }

  public startWatching(rootPath: string = process.cwd()): void {
    this.stopWatching();
    this.isInitializing = true;
    this.watchDirectory(rootPath);

    // Allow a small delay for initial file system events to settle
    // before enabling callbacks
    setTimeout(() => {
      this.isInitializing = false;
    }, 50);
  }

  public stopWatching(): void {
    this.isInitializing = false;
    this.watchers.forEach((watcher) => {
      try {
        watcher.close();
      } catch (error) {
        console.error("Error closing file watcher:", error);
      }
    });
    this.watchers = [];
    this.watchedDirs.clear();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  public onChange(callback: () => void): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public destroy(): void {
    this.stopWatching();
    this.callbacks.clear();
  }

  // Expose watcher health for tests and diagnostics
  public isActive(): boolean {
    return this.watchers.length > 0;
  }

  public getLastErrorCode(): string | null {
    return this.lastErrorCode;
  }
}

// Singleton instance for the entire application
let globalFileWatcher: FileWatcher | null = null;

export function getFileWatcher(): FileWatcher {
  if (!globalFileWatcher) {
    globalFileWatcher = new FileWatcher({
      debounceMs: 1000, // 1 second debounce
      maxDepth: 10,
    });
  }
  return globalFileWatcher;
}

export function startFileWatching(): void {
  const watcher = getFileWatcher();
  watcher.startWatching();
}

export function stopFileWatching(): void {
  if (globalFileWatcher) {
    globalFileWatcher.destroy();
    globalFileWatcher = null;
  }
}
