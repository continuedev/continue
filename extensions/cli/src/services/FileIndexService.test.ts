import * as fs from "fs";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileIndexService } from "./FileIndexService.js";

// Mock the file watcher
vi.mock("../util/fileWatcher.js", () => ({
  getFileWatcher: () => ({
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
    onChange: vi.fn(() => () => {}), // Return unsubscribe function
  }),
}));

// Mock git detection
vi.mock("../util/git.js", () => ({
  isGitRepo: vi.fn(() => false),
}));

describe("FileIndexService", () => {
  let service: FileIndexService;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(process.cwd(), "test-fileindex-"));
    process.chdir(tempDir);

    service = new FileIndexService();
  });

  afterEach(async () => {
    await service.cleanup();
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should initialize and index files", async () => {
    // Create test files
    fs.writeFileSync("test.js", 'console.log("test");');
    fs.writeFileSync("test.ts", 'console.log("test");');
    fs.writeFileSync("README.md", "# Test");

    // Initialize the service
    await service.initialize();

    // Should have indexed the files
    const files = service.getFiles();
    expect(files.length).toBeGreaterThan(0);

    const filePaths = files.map((f) => f.path);
    expect(filePaths).toContain("test.js");
    expect(filePaths).toContain("test.ts");
    expect(filePaths).toContain("README.md");
  });

  it("should filter files correctly", async () => {
    // Create test files
    fs.writeFileSync("component.tsx", "export default () => <div></div>");
    fs.writeFileSync("utils.ts", "export const util = () => {}");
    fs.writeFileSync("styles.css", ".test { color: red; }");

    await service.initialize();

    // Test filtering by extension
    const tsFiles = service.filterFiles("ts");
    expect(tsFiles.some((f) => f.path === "component.tsx")).toBe(true);
    expect(tsFiles.some((f) => f.path === "utils.ts")).toBe(true);
    expect(tsFiles.some((f) => f.path === "styles.css")).toBe(false);

    // Test filtering by name
    const componentFiles = service.filterFiles("component");
    expect(componentFiles.some((f) => f.path === "component.tsx")).toBe(true);
    expect(componentFiles.some((f) => f.path === "utils.ts")).toBe(false);
  });

  it("should handle empty directory", async () => {
    await service.initialize();

    const files = service.getFiles();
    expect(files).toEqual([]);
    expect(service.isIndexing()).toBe(false);
    expect(service.getError()).toBeNull();
  });

  it("should ignore specified patterns", async () => {
    // Create files that should be ignored
    fs.mkdirSync("node_modules");
    fs.writeFileSync(
      path.join("node_modules", "package.js"),
      "module.exports = {}",
    );

    fs.mkdirSync("dist");
    fs.writeFileSync(path.join("dist", "bundle.js"), 'console.log("bundle")');

    // Create files that should be included
    fs.writeFileSync("src.js", 'console.log("src")');

    await service.initialize();

    const files = service.getFiles();
    const filePaths = files.map((f) => f.path);

    // Should include src.js
    expect(filePaths).toContain("src.js");

    // Should not include ignored files
    expect(filePaths.some((p) => p.includes("node_modules"))).toBe(false);
    expect(filePaths.some((p) => p.includes("dist"))).toBe(false);
  });

  it("should sort files correctly with no filter", async () => {
    // Create files in non-alphabetical order
    fs.writeFileSync("zebra.js", 'console.log("zebra")');
    fs.writeFileSync("alpha.js", 'console.log("alpha")');
    fs.writeFileSync("beta.js", 'console.log("beta")');

    await service.initialize();

    const files = service.filterFiles("");
    expect(files[0].path).toBe("alpha.js");
    expect(files[1].path).toBe("beta.js");
    expect(files[2].path).toBe("zebra.js");
  });

  it("should include files with matching names and paths", async () => {
    // Create nested structure
    fs.mkdirSync("src");
    fs.writeFileSync(path.join("src", "test-helper.js"), "helper");
    fs.writeFileSync("test.js", "test file");

    await service.initialize();

    const filtered = service.filterFiles("test");

    // Should include both files that match the filter
    expect(filtered.length).toBeGreaterThanOrEqual(2);
    const filePaths = filtered.map((f) => f.path);
    expect(filePaths).toContain("test.js");
    // Normalize path separators for cross-platform compatibility
    expect(filePaths).toContain(path.join("src", "test-helper.js"));
  });

  it("should respect limit parameter", async () => {
    // Create many files
    for (let i = 0; i < 20; i++) {
      fs.writeFileSync(`file${i}.js`, `console.log("file${i}")`);
    }

    await service.initialize();

    const files = service.filterFiles("", 5);
    expect(files.length).toBe(5);
  });

  it("should handle refresh correctly", async () => {
    // Create initial file
    fs.writeFileSync("initial.js", 'console.log("initial")');

    await service.initialize();
    expect(service.getFiles().length).toBe(1);

    // Add another file
    fs.writeFileSync("added.js", 'console.log("added")');

    // Refresh should pick up the new file
    await service.refreshIndex();
    expect(service.getFiles().length).toBe(2);
  });
});
