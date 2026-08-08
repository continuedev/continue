import * as fs from "fs";
import * as path from "path";

import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../telemetry/utils.js";

import { multiEditTool } from "./multiEdit.js";
import { markFileAsRead } from "./readFile.js";
import { generateDiff } from "./writeFile.js";

// Mock the dependencies
vi.mock("../telemetry/telemetryService.js");
vi.mock("../telemetry/utils.js", () => ({
  calculateLinesOfCodeDiff: vi.fn().mockReturnValue({ added: 1, removed: 0 }),
  getLanguageFromFilePath: vi.fn().mockReturnValue("javascript"),
}));
vi.mock("./writeFile.js", () => ({
  generateDiff: vi.fn().mockReturnValue("mocked diff"),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    realpathSync: vi.fn(),
  };
});

describe("multiEditTool CLI specific", () => {
  const testFilePath = "/tmp/test-multi-edit-file.txt";
  const originalContent = "Hello world\nThis is a test file\nGoodbye world";

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fs functions to simulate file operations
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(originalContent);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.realpathSync).mockImplementation((path) => path.toString());

    // Setup utility mocks with proper return values
    vi.mocked(calculateLinesOfCodeDiff).mockReturnValue({
      added: 1,
      removed: 0,
    });
    vi.mocked(getLanguageFromFilePath).mockReturnValue("javascript");
    vi.mocked(generateDiff).mockReturnValue("mocked diff");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("file system validation", () => {
    it("should throw error if file has not been read", async () => {
      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
        ],
      };

      const error = await multiEditTool.preprocess!(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(ContinueErrorReason.EditToolFileNotRead);
    });

    it("should throw error if file does not exist", async () => {
      const nonExistentFile = "/tmp/non-existent-file.txt";
      markFileAsRead(nonExistentFile);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const args = {
        file_path: nonExistentFile,
        edits: [
          {
            old_string: "Hello",
            new_string: "Hi",
          },
        ],
      };

      const error = await multiEditTool.preprocess!(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(ContinueErrorReason.FileNotFound);
    });

    it("should throw error if file_path is missing", async () => {
      const args = {
        edits: [
          {
            old_string: "Hello",
            new_string: "Hi",
          },
        ],
      };

      const error = await multiEditTool.preprocess!(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(
        ContinueErrorReason.FindAndReplaceMissingFilepath,
      );
    });
  });

  describe("preprocess CLI specific", () => {
    it("should generate preview with diff", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.preview).toHaveLength(2);
      expect(result.preview?.[0]).toEqual({
        type: "text",
        content: "Will apply 1 edit to /tmp/test-multi-edit-file.txt:",
      });
      expect(result.preview?.[1]).toEqual({
        type: "diff",
        content: "mocked diff",
      });
    });
  });

  describe("run", () => {
    it("should successfully write file and return success message", async () => {
      const newContent = "Hi there\nThis is a test file\nGoodbye world";
      const args = {
        file_path: testFilePath,
        newContent,
        originalContent: originalContent,
        editCount: 1,
      };

      const result = await multiEditTool.run(args);

      expect(result).toBe(
        `Successfully edited ${testFilePath} with 1 edit\nDiff:\nmocked diff`,
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        testFilePath,
        newContent,
        "utf-8",
      );
    });

    it("should return correct message for multiple edits", async () => {
      const args = {
        file_path: testFilePath,
        newContent: "New content",
        originalContent: originalContent,
        editCount: 3,
      };

      const result = await multiEditTool.run(args);

      expect(result).toBe(
        `Successfully edited ${testFilePath} with 3 edits\nDiff:\nmocked diff`,
      );
    });

    it("should throw error if file write fails", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Write failed");
      });

      const args = {
        file_path: testFilePath,
        newContent: "new content",
        originalContent: originalContent,
        editCount: 1,
      };

      const error = await multiEditTool.run(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(ContinueErrorReason.FileWriteError);
    });
  });

  describe("relative path handling", () => {
    it("should convert relative paths to absolute paths", async () => {
      const relativePath = "test-file.txt";
      const absolutePath = path.resolve(process.cwd(), relativePath);
      markFileAsRead(absolutePath);

      const args = {
        file_path: relativePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.file_path).toBe(absolutePath);
      expect(result.args.newContent).toBe(
        "Hi there\nThis is a test file\nGoodbye world",
      );
    });

    it("should handle relative paths with subdirectories", async () => {
      const relativePath = "src/components/test.js";
      const absolutePath = path.resolve(process.cwd(), relativePath);
      markFileAsRead(absolutePath);

      const args = {
        file_path: relativePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.file_path).toBe(absolutePath);
    });

    it("should handle relative paths with ../ patterns", async () => {
      const relativePath = "../test-file.txt";
      const absolutePath = path.resolve(process.cwd(), relativePath);
      markFileAsRead(absolutePath);

      const args = {
        file_path: relativePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.file_path).toBe(absolutePath);
    });

    it("should leave absolute paths unchanged", async () => {
      const absolutePath = "/tmp/absolute-file.txt";
      markFileAsRead(absolutePath);

      const args = {
        file_path: absolutePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.file_path).toBe(absolutePath);
    });
  });

  describe("markFileAsRead", () => {
    it("should allow editing after marking file as read", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);
      expect(result.args.newContent).toBe(
        "Hi there\nThis is a test file\nGoodbye world",
      );
    });
  });
});
