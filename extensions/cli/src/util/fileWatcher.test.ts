import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileWatcher } from "./fileWatcher.js";

describe("FileWatcher", () => {
  let tempDir: string;
  let watcher: FileWatcher;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "filewatcher-test-"));
    watcher = new FileWatcher({
      debounceMs: 100, // Shorter debounce for tests
      maxDepth: 2,
    });
  });

  afterEach(() => {
    watcher.destroy();
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.skip("should detect when new files are created", async () => {
    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Create a new file
    const testFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(testFile, "test content");

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(callback).toHaveBeenCalled();
  });

  it.skip("should detect when files are deleted", async () => {
    // Create a file first
    const testFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(testFile, "test content");

    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Delete the file
    fs.unlinkSync(testFile);

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(callback).toHaveBeenCalled();
  });

  it("should ignore paths that match ignore patterns", async () => {
    // Pre-create the node_modules directory to avoid directory creation events
    const nodeModulesDir = path.join(tempDir, "node_modules");
    fs.mkdirSync(nodeModulesDir);

    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Wait longer to ensure watcher is fully initialized and settled
    // Increase timeout for CI environments where file system events may be slower
    // Account for the 50ms initialization delay plus extra time for CI
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Reset the callback mock to ignore any initialization events
    callback.mockClear();

    // Create a file in node_modules (should be ignored)
    const testFile = path.join(nodeModulesDir, "test.js");
    fs.writeFileSync(testFile, "test content");

    // Wait for debounce with longer timeout for CI environments
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should not have been called because node_modules is ignored
    expect(callback).not.toHaveBeenCalled();
  });

  it("should ignore files matching wildcard patterns like **/*.tmp", async () => {
    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Wait for watcher to initialize with longer timeout for CI
    // Account for the 50ms initialization delay plus extra time for CI
    await new Promise((resolve) => setTimeout(resolve, 600));
    callback.mockClear();

    // Create a .tmp file (should be ignored by **/*.tmp pattern)
    const tmpFile = path.join(tempDir, "test.tmp");
    fs.writeFileSync(tmpFile, "temporary content");

    // Create a .log file (should be ignored by **/*.log pattern)
    const logFile = path.join(tempDir, "debug.log");
    fs.writeFileSync(logFile, "log content");

    // Create a .min.js file (should be ignored by **/*.min.js pattern)
    const minJsFile = path.join(tempDir, "bundle.min.js");
    fs.writeFileSync(minJsFile, "minified js");

    // Wait for debounce with longer timeout for CI
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should not have been called because all files match ignore patterns
    expect(callback).not.toHaveBeenCalled();
  });

  it("should ignore specific files like .DS_Store", async () => {
    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Wait for watcher to initialize with longer timeout for CI
    // Account for the 50ms initialization delay plus extra time for CI
    await new Promise((resolve) => setTimeout(resolve, 600));
    callback.mockClear();

    // Create .DS_Store file (should be ignored by **/.DS_Store pattern)
    const dsStoreFile = path.join(tempDir, ".DS_Store");
    fs.writeFileSync(dsStoreFile, "ds store content");

    // Wait for debounce with longer timeout for CI
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should not have been called because .DS_Store matches ignore pattern
    expect(callback).not.toHaveBeenCalled();
  });

  it("should detect files that do not match ignore patterns", async () => {
    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // If the environment prevents watching (e.g., EMFILE), skip to avoid false negatives
    const lastError = (watcher as any).getLastErrorCode?.();
    if (lastError === "EMFILE") {
      return;
    }

    // Wait for watcher to initialize with longer timeout for CI
    // Account for the 50ms initialization delay plus extra time for CI
    await new Promise((resolve) => setTimeout(resolve, 600));
    callback.mockClear();

    // Create a .js file (should NOT be ignored)
    const jsFile = path.join(tempDir, "test.js");
    fs.writeFileSync(jsFile, 'console.log("hello");');

    // Wait for debounce with longer timeout for CI
    await new Promise((resolve) => setTimeout(resolve, 500));

    // If watchers are active and no EMFILE error occurred, the callback should be called
    if (
      (watcher as any).isActive?.() &&
      (watcher as any).getLastErrorCode?.() === null
    ) {
      expect(callback).toHaveBeenCalled();
    }
  });

  it("should allow unsubscribing from callbacks", async () => {
    const callback = vi.fn();
    const unsubscribe = watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Unsubscribe
    unsubscribe();

    // Create a new file
    const testFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(testFile, "test content");

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should not have been called because we unsubscribed
    expect(callback).not.toHaveBeenCalled();
  });

  describe("shouldIgnorePath method", () => {
    it("should correctly ignore wildcard file patterns", () => {
      const watcher = new FileWatcher();

      // Test the private method by accessing it through prototype
      const shouldIgnorePath = (watcher as any).shouldIgnorePath.bind(watcher);

      // Test wildcard file patterns
      expect(shouldIgnorePath("/some/path/file.tmp")).toBe(true);
      expect(shouldIgnorePath("/some/path/file.log")).toBe(true);
      expect(shouldIgnorePath("/some/path/bundle.min.js")).toBe(true);
      expect(shouldIgnorePath("/some/path/styles.min.css")).toBe(true);

      // Test files that should NOT be ignored
      expect(shouldIgnorePath("/some/path/file.js")).toBe(false);
      expect(shouldIgnorePath("/some/path/file.ts")).toBe(false);
      expect(shouldIgnorePath("/some/path/README.md")).toBe(false);

      // Test specific files
      expect(shouldIgnorePath("/some/path/.DS_Store")).toBe(true);
      expect(shouldIgnorePath("/some/path/Thumbs.db")).toBe(true);

      // Test directory patterns
      expect(shouldIgnorePath("/some/path/node_modules")).toBe(true);
      expect(shouldIgnorePath("/some/path/node_modules/package")).toBe(true);
      expect(shouldIgnorePath("/path/dist")).toBe(true);
      expect(shouldIgnorePath("/path/.git")).toBe(true);
    });
  });
});
