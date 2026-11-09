import * as fs from "fs";
import * as path from "path";

import { ContinueError, ContinueErrorReason } from "core/util/errors.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  calculateLinesOfCodeDiff,
  getLanguageFromFilePath,
} from "../telemetry/utils.js";

import { editTool } from "./edit.js";
import { markFileAsRead, readFilesSet } from "./readFile.js";
import { generateDiff } from "./writeFile.js";

// Mock the dependencies
const headless = vi.hoisted(() => ({ value: false }));
vi.mock("../services/index.js", () => ({
  services: { toolPermissions: { isHeadless: () => headless.value } },
}));
vi.mock("../telemetry/telemetryService.js");
vi.mock("../telemetry/utils.js");
vi.mock("./writeFile.js");
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
  // Inside the working directory: a file outside it gets a preview note
  const testFilePath = path.join(process.cwd(), "test-edit-file.txt");
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
    readFilesSet.clear();
  });

  describe("preprocess", () => {
    it("should throw error if file has not been read", async () => {
      const args = {
        file_path: testFilePath,
        old_string: "Hello world",
        new_string: "Hi there",
      };

      const error = await editTool.preprocess!(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(ContinueErrorReason.EditToolFileNotRead);
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

      const error = await editTool.preprocess!(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(ContinueErrorReason.FileNotFound);
    });

    it("should throw error if old_string is not found", async () => {
      markFileAsRead(testFilePath);
      vi.mocked(fs.readFileSync).mockReturnValue("Different content");

      const args = {
        file_path: testFilePath,
        old_string: "Not found",
        new_string: "Hi there",
      };

      const error = await editTool.preprocess!(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(
        ContinueErrorReason.FindAndReplaceOldStringNotFound,
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

      const error = await editTool.preprocess!(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(
        ContinueErrorReason.FindAndReplaceMultipleOccurrences,
      );
    });

    it("should throw error if old_string and new_string are the same", async () => {
      markFileAsRead(testFilePath);

      const args = {
        file_path: testFilePath,
        old_string: "Hello world",
        new_string: "Hello world",
      };

      const error = await editTool.preprocess!(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(
        ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
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

      const error = await editTool.run(args).catch((e) => e);
      expect(error).toBeInstanceOf(ContinueError);
      expect(error.reason).toBe(ContinueErrorReason.FileWriteError);
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

describe("editTool and the working directory", () => {
  const outsidePath = path.resolve(process.cwd(), "..", "elsewhere.txt");

  beforeEach(() => {
    vi.clearAllMocks();
    headless.value = false;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("Hello world");
    vi.mocked(fs.realpathSync).mockImplementation((p) => p.toString());
    vi.mocked(generateDiff).mockReturnValue("mocked diff");
  });

  afterEach(() => {
    readFilesSet.clear();
    headless.value = false;
  });

  it("says in the preview when the file is outside the working directory", async () => {
    markFileAsRead(outsidePath);
    const result = await editTool.preprocess!({
      file_path: outsidePath,
      old_string: "Hello",
      new_string: "Hi",
    });
    expect(result.preview?.[0]).toMatchObject({
      type: "text",
      content: expect.stringContaining("Outside the working directory"),
    });
    expect(result.preview?.[0].content).toContain(outsidePath);
    expect(result.preview?.[0].content).toContain(process.cwd());
  });

  it("refuses such an edit in a headless run, naming the path and the working directory", async () => {
    headless.value = true;
    markFileAsRead(outsidePath);
    const error = await editTool.preprocess!({
      file_path: outsidePath,
      old_string: "Hello",
      new_string: "Hi",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ContinueError);
    expect(error.message).toContain("Edit was not run");
    expect(error.message).toContain(outsidePath);
    expect(error.message).toContain(process.cwd());
  });

  it("adds nothing for a file inside the working directory", async () => {
    const inside = path.join(process.cwd(), "src", "inside.txt");
    markFileAsRead(inside);
    const result = await editTool.preprocess!({
      file_path: inside,
      old_string: "Hello",
      new_string: "Hi",
    });
    expect(result.preview?.[0]).toEqual({
      type: "text",
      content: "Will make the following changes:",
    });
  });
});
