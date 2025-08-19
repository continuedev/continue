import * as fs from 'fs';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileWatcher } from './fileWatcher.js';

describe('FileWatcher', () => {
  let tempDir: string;
  let watcher: FileWatcher;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(process.cwd(), 'test-'));
    watcher = new FileWatcher({
      debounceMs: 100, // Shorter debounce for tests
      maxDepth: 2
    });
  });

  afterEach(() => {
    watcher.destroy();
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.skip('should detect when new files are created', async () => {
    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Create a new file
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(callback).toHaveBeenCalled();
  });

  it.skip('should detect when files are deleted', async () => {
    // Create a file first
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Delete the file
    fs.unlinkSync(testFile);

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(callback).toHaveBeenCalled();
  });

  it('should ignore paths that match ignore patterns', async () => {
    // Pre-create the node_modules directory to avoid directory creation events
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    fs.mkdirSync(nodeModulesDir);
    
    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Wait longer to ensure watcher is fully initialized and settled
    await new Promise(resolve => setTimeout(resolve, 100));

    // Reset the callback mock to ignore any initialization events
    callback.mockClear();

    // Create a file in node_modules (should be ignored)
    const testFile = path.join(nodeModulesDir, 'test.js');
    fs.writeFileSync(testFile, 'test content');

    // Wait for debounce with longer timeout for CI environments
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should not have been called because node_modules is ignored
    expect(callback).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing from callbacks', async () => {
    const callback = vi.fn();
    const unsubscribe = watcher.onChange(callback);
    watcher.startWatching(tempDir);

    // Unsubscribe
    unsubscribe();

    // Create a new file
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should not have been called because we unsubscribed
    expect(callback).not.toHaveBeenCalled();
  });
});
