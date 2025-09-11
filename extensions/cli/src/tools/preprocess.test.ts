import * as fs from "fs";

import * as diff from "diff";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock fs module
vi.mock("fs", async () => {
  // Use actual fs implementation for non-mocked functions
  const actualFs = await vi.importActual("fs");
  return {
    ...(actualFs as any),
    default: actualFs,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

// Mock telemetry service
vi.mock("./src/telemetry/telemetryService.js"); // Mock diff module
vi.mock("diff", () => ({
  createTwoFilesPatch: vi.fn(),
}));

// Get mocked functions using vi.mocked
const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockCreateTwoFilesPatch = vi.mocked(diff.createTwoFilesPatch);

import { fetchTool } from "./fetch.js";
import { listFilesTool } from "./listFiles.js";
import { readFileTool } from "./readFile.js";
import { runTerminalCommandTool } from "./runTerminalCommand.js";
import { searchAndReplaceInFileTool } from "./searchAndReplace/index.js";
import { searchCodeTool } from "./searchCode.js";
import { viewDiffTool } from "./viewDiff.js";
import { writeFileTool } from "./writeFile.js";

describe.skip("Tool preprocess functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The mock functions will be configured in each test as needed
  });

  describe("fetchTool.preprocess", () => {
    it("should return preview with URL to fetch", async () => {
      const args = { url: "https://example.com" };
      const result = await fetchTool.preprocess!(args);

      expect(result).toEqual({
        preview: [
          {
            type: "text",
            content: "Will fetch: https://example.com",
          },
        ],
        args,
      });
    });

    it("should handle URL with timeout parameter", async () => {
      const args = { url: "https://example.com", timeout: 5000 };
      const result = await fetchTool.preprocess!(args);

      expect(result).toEqual({
        preview: [
          {
            type: "text",
            content: "Will fetch: https://example.com",
          },
        ],
        args,
      });
    });
  });

  describe("listFilesTool.preprocess", () => {
    it("should return preview with directory path when directory arg present", async () => {
      const args = { dirpath: "some/path" };
      const result = await listFilesTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "Will list files in: some/path",
          },
        ],
      });
    });

    it("should show current directory when no directory arg", async () => {
      const args = {};
      const result = await listFilesTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "Will list files in current directory",
          },
        ],
      });
    });
  });

  describe("readFileTool.preprocess", () => {
    it("should return formatted tool call preview", async () => {
      const args = { filepath: "path/to/file.txt" };
      const result = await readFileTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "Will read path/to/file.txt",
          },
        ],
      });
    });
  });

  describe("runTerminalCommandTool.preprocess", () => {
    it("should return preview with full command when short", async () => {
      const args = { command: "ls -la" };
      const result = await runTerminalCommandTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "Will run: ls -la",
          },
        ],
      });
    });

    it("should truncate long commands", async () => {
      const longCommand = "a".repeat(100);
      const args = { command: longCommand };
      const result = await runTerminalCommandTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: `Will run: ${"a".repeat(60)}...`,
          },
        ],
      });
    });
  });

  describe("searchCodeTool.preprocess", () => {
    it("should return preview with full pattern when short", async () => {
      const args = { pattern: "searchTerm" };
      const result = await searchCodeTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: 'Will search for: "searchTerm"',
          },
        ],
      });
    });

    it("should truncate long patterns", async () => {
      const longPattern = "a".repeat(100);
      const args = { pattern: longPattern };
      const result = await searchCodeTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: `Will search for: "${"a".repeat(50)}..."`,
          },
        ],
      });
    });
  });

  describe("viewDiffTool.preprocess", () => {
    it("should return preview indicating git diff will be shown", async () => {
      const args = { path: "/repo/path" };
      const result = await viewDiffTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "Will show git diff",
          },
        ],
      });
    });

    it("should handle empty args", async () => {
      const args = {};
      const result = await viewDiffTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "Will show git diff",
          },
        ],
      });
    });
  });

  describe("writeFileTool.preprocess", () => {
    it("should show diff preview when file exists", async () => {
      // Setup mocks for this test
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("old content");

      const args = { filepath: "path/to/file.txt", content: "new content" };
      const result = await writeFileTool.preprocess!(args);

      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).toHaveBeenCalled();
      expect(mockCreateTwoFilesPatch).toHaveBeenCalled();

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "Preview of changes:",
          },
          {
            type: "diff",
            content: "mock diff content",
          },
        ],
      });
    });

    it("should show new file content preview when file doesn't exist", async () => {
      mockExistsSync.mockReturnValue(false);

      const args = {
        filepath: "path/to/file.txt",
        content: "line 1\nline 2\nline 3\nline 4",
      };
      const result = await writeFileTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "New file content:",
          },
          {
            type: "text",
            content: "line 1",
            paddingLeft: 2,
          },
          {
            type: "text",
            content: "line 2",
            paddingLeft: 2,
          },
          {
            type: "text",
            content: "line 3",
            paddingLeft: 2,
          },
          {
            type: "text",
            content: "... (1 more lines)",
          },
        ],
      });
    });

    it("should handle empty lines in new file preview", async () => {
      mockExistsSync.mockReturnValue(false);

      const args = {
        filepath: "path/to/file.txt",
        content: "line 1\n\nline 3",
      };
      const result = await writeFileTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "New file content:",
          },
          {
            type: "text",
            content: "line 1",
            paddingLeft: 2,
          },
          {
            type: "text",
            content: " ",
            paddingLeft: 2,
          },
          {
            type: "text",
            content: "line 3",
            paddingLeft: 2,
          },
        ],
      });
    });

    it("should handle fs errors gracefully", async () => {
      mockExistsSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const args = { filepath: "path/to/file.txt", content: "new content" };
      const result = await writeFileTool.preprocess!(args);

      expect(result).toEqual({
        args,
        preview: [
          {
            type: "text",
            content: "New file content:",
          },
          {
            type: "text",
            content: "new content",
            paddingLeft: 2,
          },
        ],
      });
    });
  });

  describe("searchAndReplaceInFileTool.preprocess", () => {
    it("should process simple search and replace", async () => {
      // Setup mocks
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("old line 1\nold line 2\nold line 3");

      const args = {
        filepath: "path/to/file.txt",
        diffs: [
          `------- SEARCH
old line 2
=======
new line 2
+++++++ REPLACE`,
        ],
      };

      const result = await searchAndReplaceInFileTool.preprocess!(args);

      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).toHaveBeenCalled();
      expect(mockCreateTwoFilesPatch).toHaveBeenCalled();

      expect(result.args).toEqual({
        filepath: expect.any(String),
        newContent: "old line 1\nnew line 2\nold line 3",
        oldContent: "old line 1\nold line 2\nold line 3",
      });

      expect(result.preview).toEqual([
        {
          type: "text",
          content: "Will make the following changes:",
        },
        {
          type: "diff",
          content: "mock diff content",
        },
      ]);
    });

    it("should throw error when file doesn't exist", async () => {
      mockExistsSync.mockReturnValue(false);

      const args = {
        filepath: "/nonexistent/file.txt",
        diffs: ["some diff"],
      };

      await expect(
        searchAndReplaceInFileTool.preprocess!(args),
      ).rejects.toThrowError(/file .* does not exist/);
    });

    it("should throw error when no search/replace blocks found", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("file content");

      const args = {
        filepath: "path/to/file.txt",
        diffs: ["invalid diff format"],
      };

      await expect(
        searchAndReplaceInFileTool.preprocess!(args),
      ).rejects.toThrowError(
        "No complete search/replace blocks found in any diffs",
      );
    });

    it("should throw error when search content not found", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("old line 1\nold line 2\nold line 3");

      const args = {
        filepath: "path/to/file.txt",
        diffs: [
          `------- SEARCH
nonexistent content
=======
replacement
+++++++ REPLACE`,
        ],
      };

      await expect(
        searchAndReplaceInFileTool.preprocess!(args),
      ).rejects.toThrowError(/Search content not found in block 1:/);
    });

    it("should process multiple search/replace blocks", async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("line 1\nline 2\nline 3\nline 4");

      const args = {
        filepath: "path/to/file.txt",
        diffs: [
          `------- SEARCH
line 1
=======
modified line 1
+++++++ REPLACE

------- SEARCH
line 3
=======
modified line 3
+++++++ REPLACE`,
        ],
      };

      const result = await searchAndReplaceInFileTool.preprocess!(args);

      expect(result.args.newContent).toBe(
        "modified line 1\nline 2\nmodified line 3\nline 4",
      );
    });
  });
});
