import * as fs from "fs";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { multiEditTool } from "./multiEdit.js";
import { markFileAsRead } from "./readFile.js";

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

describe("multiEditTool", () => {
  const testFilePath = "/tmp/test-multi-edit-file.txt";
  const originalContent = "Hello world\nThis is a test file\nGoodbye world";

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fs functions to simulate file operations
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(originalContent);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.realpathSync).mockImplementation((path) => path.toString());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("preprocess", () => {
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

      await expect(multiEditTool.preprocess!(args)).rejects.toThrow(
        `You must use the Read tool to read ${testFilePath} before editing it.`,
      );
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

      await expect(multiEditTool.preprocess!(args)).rejects.toThrow(
        `File ${nonExistentFile} does not exist`,
      );
    });

    it("should throw error if edits array is empty", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [],
      };

      await expect(multiEditTool.preprocess!(args)).rejects.toThrow(
        "edits array is required and must contain at least one edit",
      );
    });

    it("should throw error if edit has missing old_string", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: undefined as any,
            new_string: "Hi there",
          },
        ],
      };

      await expect(multiEditTool.preprocess!(args)).rejects.toThrow(
        "Edit 1: old_string is required",
      );
    });

    it("should throw error if edit has missing new_string", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: undefined as any,
          },
        ],
      };

      await expect(multiEditTool.preprocess!(args)).rejects.toThrow(
        "Edit 1: new_string is required",
      );
    });

    it("should throw error if old_string and new_string are the same", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hello world",
          },
        ],
      };

      await expect(multiEditTool.preprocess!(args)).rejects.toThrow(
        "Edit 1: old_string and new_string must be different",
      );
    });

    it("should throw error if old_string is not found", async () => {
      markFileAsRead(testFilePath);
      vi.mocked(fs.readFileSync).mockReturnValue("Different content");

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "Not found",
            new_string: "Hi there",
          },
        ],
      };

      await expect(multiEditTool.preprocess!(args)).rejects.toThrow(
        'Edit 1: String not found in file: "Not found"',
      );
    });

    it("should throw error if old_string appears multiple times and replace_all is false", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "world",
            new_string: "universe",
            replace_all: false,
          },
        ],
      };

      await expect(multiEditTool.preprocess!(args)).rejects.toThrow(
        'Edit 1: String "world" appears 2 times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.',
      );
    });

    it("should successfully preprocess single edit", async () => {
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

      expect(result.args).toEqual({
        file_path: testFilePath,
        newContent: "Hi there\nThis is a test file\nGoodbye world",
        originalContent: originalContent,
        isCreatingNewFile: false,
        editCount: 1,
      });
      expect(result.preview).toHaveLength(2);
      expect(result.preview?.[0]).toEqual({
        type: "text",
        content: "Will apply 1 edit to modify /tmp/test-multi-edit-file.txt:",
      });
      expect(result.preview?.[1]).toEqual({
        type: "diff",
        content: "mocked diff",
      });
    });

    it("should successfully preprocess multiple edits", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi there",
          },
          {
            old_string: "Goodbye world",
            new_string: "See you later",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.newContent).toBe(
        "Hi there\nThis is a test file\nSee you later",
      );
      expect(result.args.editCount).toBe(2);
      expect(result.preview?.[0]?.content).toContain("Will apply 2 edits");
    });

    it("should successfully preprocess replace_all edit", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "world",
            new_string: "universe",
            replace_all: true,
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.newContent).toBe(
        "Hello universe\nThis is a test file\nGoodbye universe",
      );
    });

    it("should handle new file creation with empty old_string", async () => {
      const newFilePath = "/tmp/new-file.txt";
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        // Parent directory exists, but file doesn't
        if (path === "/tmp") return true;
        if (path === newFilePath) return false;
        return true;
      });

      const args = {
        file_path: newFilePath,
        edits: [
          {
            old_string: "",
            new_string: "New file content\nSecond line",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.newContent).toBe("New file content\nSecond line");
      expect(result.args.isCreatingNewFile).toBe(true);
      expect(result.preview?.[0]?.content).toContain("create");
    });

    it("should apply edits sequentially", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        edits: [
          {
            old_string: "Hello world",
            new_string: "Hi universe",
          },
          {
            old_string: "Hi universe",
            new_string: "Greetings cosmos",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.newContent).toBe(
        "Greetings cosmos\nThis is a test file\nGoodbye world",
      );
    });
  });

  describe("run", () => {
    it("should successfully write file and return success message", async () => {
      const newContent = "Hi there\nThis is a test file\nGoodbye world";
      const args = {
        file_path: testFilePath,
        newContent,
        originalContent: originalContent,
        isCreatingNewFile: false,
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
        isCreatingNewFile: false,
        editCount: 3,
      };

      const result = await multiEditTool.run(args);

      expect(result).toBe(
        `Successfully edited ${testFilePath} with 3 edits\nDiff:\nmocked diff`,
      );
    });

    it("should return correct message for new file creation", async () => {
      const args = {
        file_path: "/tmp/new-file.txt",
        newContent: "New file content",
        originalContent: "",
        isCreatingNewFile: true,
        editCount: 1,
      };

      const result = await multiEditTool.run(args);

      expect(result).toBe(
        `Successfully created /tmp/new-file.txt with 1 edit\nDiff:\nmocked diff`,
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
        isCreatingNewFile: false,
        editCount: 1,
      };

      await expect(multiEditTool.run(args)).rejects.toThrow(
        `Error: failed to edit ${testFilePath}: Write failed`,
      );
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

    it("should handle relative path for new file creation", async () => {
      const relativePath = "new-file.txt";
      const absolutePath = path.resolve(process.cwd(), relativePath);

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        // Parent directory (cwd) exists, but file doesn't
        if (path === process.cwd()) return true;
        if (path === absolutePath) return false;
        return true;
      });

      const args = {
        file_path: relativePath,
        edits: [
          {
            old_string: "",
            new_string: "New file content",
          },
        ],
      };

      const result = await multiEditTool.preprocess!(args);

      expect(result.args.file_path).toBe(absolutePath);
      expect(result.args.newContent).toBe("New file content");
      expect(result.args.isCreatingNewFile).toBe(true);
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
      expect(result.args.newContent).toContain("Hi there");
    });
  });
});
