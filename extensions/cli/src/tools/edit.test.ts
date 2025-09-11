import * as fs from "fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { editTool } from "./edit.js";
import { markFileAsRead, readFilesSet } from "./readFile.js";

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

describe("editTool", () => {
  const testFilePath = "/tmp/test-edit-file.txt";
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
    readFilesSet.clear();
  });

  describe("preprocess", () => {
    it("should throw error if file has not been read", async () => {
      const args = {
        file_path: testFilePath,
        old_string: "Hello world",
        new_string: "Hi there",
      };

      await expect(editTool.preprocess!(args)).rejects.toThrow(
        `You must use the Read tool to read ${testFilePath} before editing it.`,
      );
    });

    it("should throw error if file does not exist", async () => {
      const nonExistentFile = "/tmp/non-existent-file.txt";
      markFileAsRead(nonExistentFile);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const args = {
        file_path: nonExistentFile,
        old_string: "Hello",
        new_string: "Hi",
      };

      await expect(editTool.preprocess!(args)).rejects.toThrow(
        `File ${nonExistentFile} does not exist`,
      );
    });

    it("should throw error if old_string is not found", async () => {
      markFileAsRead(testFilePath);
      vi.mocked(fs.readFileSync).mockReturnValue("Different content");

      const args = {
        file_path: testFilePath,
        old_string: "Not found",
        new_string: "Hi there",
      };

      await expect(editTool.preprocess!(args)).rejects.toThrow(
        "String not found in file: Not found",
      );
    });

    it("should throw error if old_string appears multiple times and replace_all is false", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        old_string: "world",
        new_string: "universe",
        replace_all: false,
      };

      await expect(editTool.preprocess!(args)).rejects.toThrow(
        'String "world" appears 2 times in the file. Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.',
      );
    });

    it("should throw error if old_string and new_string are the same", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        old_string: "Hello world",
        new_string: "Hello world",
      };

      await expect(editTool.preprocess!(args)).rejects.toThrow(
        "old_string and new_string must be different",
      );
    });

    it("should successfully preprocess valid single replacement", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        old_string: "Hello world",
        new_string: "Hi there",
      };

      const result = await editTool.preprocess!(args);

      expect(result.args).toEqual({
        resolvedPath: testFilePath,
        newContent: "Hi there\nThis is a test file\nGoodbye world",
        oldContent: originalContent,
      });
      expect(result.preview).toHaveLength(2);
      expect(result.preview?.[0]).toEqual({
        type: "text",
        content: "Will make the following changes:",
      });
      expect(result.preview?.[1]).toEqual({
        type: "diff",
        content: "mocked diff",
      });
    });

    it("should successfully preprocess replace_all", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        old_string: "world",
        new_string: "universe",
        replace_all: true,
      };

      const result = await editTool.preprocess!(args);

      expect(result.args.newContent).toBe(
        "Hello universe\nThis is a test file\nGoodbye universe",
      );
    });
  });

  describe("run", () => {
    it("should successfully write file and return success message", async () => {
      const newContent = "Hi there\nThis is a test file\nGoodbye world";
      const args = {
        resolvedPath: testFilePath,
        newContent,
        oldContent: originalContent,
      };

      const result = await editTool.run(args);

      expect(result).toBe(
        `Successfully edited ${testFilePath}\nDiff:\nmocked diff`,
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        testFilePath,
        newContent,
        "utf-8",
      );
    });

    it("should throw error if file write fails", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Write failed");
      });

      const args = {
        resolvedPath: testFilePath,
        newContent: "new content",
        oldContent: originalContent,
      };

      await expect(editTool.run(args)).rejects.toThrow(
        `Error: failed to edit ${testFilePath}: Write failed`,
      );
    });
  });

  describe("markFileAsRead", () => {
    it("should allow editing after marking file as read", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        old_string: "Hello world",
        new_string: "Hi there",
      };

      const result = await editTool.preprocess!(args);
      expect(result.args.newContent).toContain("Hi there");
    });
  });
});
