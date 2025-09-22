import { ContinueErrorReason } from "core/util/errors";
import * as ideUtils from "core/util/ideUtils";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolExtras } from "./callClientTool";
import { singleFindAndReplaceImpl } from "./singleFindAndReplaceImpl";
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

vi.mock("core/util/ideUtils", () => ({
  resolveRelativePathInDir: vi.fn(),
}));

vi.mock("../../redux/thunks/handleApplyStateUpdate", () => ({
  applyForEditTool: vi.fn(),
}));

describe("singleFindAndReplaceImpl", () => {
  let mockExtras: ClientToolExtras;
  let mockResolveRelativePathInDir: Mock;
  let mockApplyForEditTool: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveRelativePathInDir = vi.mocked(ideUtils.resolveRelativePathInDir);
    mockApplyForEditTool = vi.mocked(applyForEditTool);

    mockExtras = {
      getState: vi.fn(() => ({
        config: {
          config: {
            allowAnonymousTelemetry: false,
          },
        },
      })) as any,
      dispatch: vi.fn() as any,
      ideMessenger: {
        ide: {
          readFile: vi.fn(),
        },
        request: vi.fn(),
      } as any,
    };
  });

  describe("argument validation", () => {
    beforeEach(() => {
      // For validation tests, make the file exist so we can test validation errors
      mockResolveRelativePathInDir.mockResolvedValue("/test/file.txt");
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("content");
    });

    it("should throw error if filepath is missing", async () => {
      const args = {
        old_string: "test",
        new_string: "replacement",
      };

      await expect(
        singleFindAndReplaceImpl(args, "tool-call-id", mockExtras),
      ).rejects.toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingFilepath,
        }),
      );
    });

    it("should throw error if old_string is missing", async () => {
      const args = {
        filepath: "test.txt",
        new_string: "replacement",
      };

      await expect(
        singleFindAndReplaceImpl(args, "tool-call-id", mockExtras),
      ).rejects.toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingOldString,
        }),
      );
    });

    it("should throw error if new_string is missing", async () => {
      const args = {
        filepath: "test.txt",
        old_string: "test",
      };

      await expect(
        singleFindAndReplaceImpl(args, "tool-call-id", mockExtras),
      ).rejects.toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMissingNewString,
        }),
      );
    });

    it("should throw error if old_string and new_string are the same", async () => {
      const args = {
        filepath: "test.txt",
        old_string: "same",
        new_string: "same",
      };

      await expect(
        singleFindAndReplaceImpl(args, "tool-call-id", mockExtras),
      ).rejects.toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceIdenticalOldAndNewStrings,
        }),
      );
    });
  });

  describe("file resolution", () => {
    it("should throw error if file does not exist", async () => {
      mockResolveRelativePathInDir.mockResolvedValue(null);

      const args = {
        filepath: "nonexistent.txt",
        old_string: "test",
        new_string: "replacement",
      };

      await expect(
        singleFindAndReplaceImpl(args, "tool-call-id", mockExtras),
      ).rejects.toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FileNotFound,
        }),
      );
    });

    it("should resolve relative file paths", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/absolute/path/test.txt");
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("test content");

      const args = {
        filepath: "test.txt",
        old_string: "test",
        new_string: "replacement",
      };

      await singleFindAndReplaceImpl(args, "tool-call-id", mockExtras);

      expect(mockResolveRelativePathInDir).toHaveBeenCalledWith(
        "test.txt",
        mockExtras.ideMessenger.ide,
      );
      expect(mockExtras.ideMessenger.ide.readFile).toHaveBeenCalledWith(
        "/absolute/path/test.txt",
      );
    });
  });

  describe("string replacement", () => {
    beforeEach(() => {
      mockResolveRelativePathInDir.mockResolvedValue("/test/file.txt");
    });

    it("should throw error if old_string is not found in file", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("different content");

      const args = {
        filepath: "file.txt",
        old_string: "not found",
        new_string: "replacement",
      };

      await expect(
        singleFindAndReplaceImpl(args, "tool-call-id", mockExtras),
      ).rejects.toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceOldStringNotFound,
        }),
      );
    });

    it("should replace single occurrence", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("Hello world\nThis is a test file\nGoodbye world");

      const args = {
        filepath: "file.txt",
        old_string: "Hello world",
        new_string: "Hi there",
      };

      await singleFindAndReplaceImpl(args, "tool-call-id", mockExtras);

      // Check that the dispatch was called with the applyForEditTool thunk
      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "tool-call-id",
        text: "Hi there\nThis is a test file\nGoodbye world",
        filepath: "/test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should throw error if old_string appears multiple times and replace_all is false", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("Hello world\nThis is a test file\nGoodbye world");

      const args = {
        filepath: "file.txt",
        old_string: "world",
        new_string: "universe",
        replace_all: false,
      };

      await expect(
        singleFindAndReplaceImpl(args, "tool-call-id", mockExtras),
      ).rejects.toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMultipleOccurrences,
        }),
      );
    });

    it("should replace all occurrences when replace_all is true", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("Hello world\nThis is a test file\nGoodbye world");

      const args = {
        filepath: "file.txt",
        old_string: "world",
        new_string: "universe",
        replace_all: true,
      };

      await singleFindAndReplaceImpl(args, "tool-call-id", mockExtras);

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "tool-call-id",
        text: "Hello universe\nThis is a test file\nGoodbye universe",
        filepath: "/test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should handle empty new_string (deletion)", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("Hello world\nThis is a test file");

      const args = {
        filepath: "file.txt",
        old_string: "Hello ",
        new_string: "",
      };

      await singleFindAndReplaceImpl(args, "tool-call-id", mockExtras);

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "tool-call-id",
        text: "world\nThis is a test file",
        filepath: "/test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should handle special characters in strings", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue(
          'const regex = /[a-z]+/g;\nconst text = "Hello $world"',
        );

      const args = {
        filepath: "file.txt",
        old_string: '"Hello $world"',
        new_string: '"Hi $universe"',
      };

      await singleFindAndReplaceImpl(args, "tool-call-id", mockExtras);

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "tool-call-id",
        text: 'const regex = /[a-z]+/g;\nconst text = "Hi $universe"',
        filepath: "/test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should preserve whitespace and indentation", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue(
          "function test() {\n    const value = 'old';\n    return value;\n}",
        );

      const args = {
        filepath: "file.txt",
        old_string: "    const value = 'old';",
        new_string: "    const value = 'new';",
      };

      await singleFindAndReplaceImpl(args, "tool-call-id", mockExtras);

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "tool-call-id",
        text: "function test() {\n    const value = 'new';\n    return value;\n}",
        filepath: "/test/file.txt",
        isSearchAndReplace: true,
      });
    });
  });

  describe("return value", () => {
    it("should return correct response structure", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/test/file.txt");
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("test content");

      const args = {
        filepath: "file.txt",
        old_string: "test",
        new_string: "replacement",
      };

      const result = await singleFindAndReplaceImpl(
        args,
        "tool-call-id",
        mockExtras,
      );

      expect(result).toEqual({
        respondImmediately: false,
        output: undefined,
      });
    });
  });

  describe("error handling", () => {
    it("should wrap and rethrow errors from readFile", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/test/file.txt");
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockRejectedValue(new Error("Permission denied"));

      const args = {
        filepath: "file.txt",
        old_string: "test",
        new_string: "replacement",
      };

      await expect(
        singleFindAndReplaceImpl(args, "tool-call-id", mockExtras),
      ).rejects.toThrow("Permission denied");
    });
  });
});
