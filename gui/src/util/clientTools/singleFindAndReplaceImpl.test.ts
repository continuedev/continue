import * as ideUtils from "core/util/ideUtils";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolExtras } from "./callClientTool";
import * as findAndReplaceUtils from "./findAndReplaceUtils";
import {
  singleFindAndReplaceImpl,
  validateAndEnhanceSingleEditArgs,
} from "./singleFindAndReplaceImpl";
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

vi.mock("core/util/ideUtils", () => ({
  resolveRelativePathInDir: vi.fn(),
}));

vi.mock("../../redux/thunks/handleApplyStateUpdate", () => ({
  applyForEditTool: vi.fn(),
}));

vi.mock("./findAndReplaceUtils", () => ({
  validateSingleEdit: vi.fn(),
  performFindAndReplace: vi.fn(),
}));

describe("singleFindAndReplaceImpl", () => {
  let mockExtras: ClientToolExtras;
  let mockResolveRelativePathInDir: Mock;
  let mockApplyForEditTool: Mock;
  let mockValidateSingleEdit: Mock;
  let mockPerformFindAndReplace: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveRelativePathInDir = vi.mocked(ideUtils.resolveRelativePathInDir);
    mockApplyForEditTool = vi.mocked(applyForEditTool);
    // Get the mocked functions from the module mock
    mockValidateSingleEdit = vi.mocked(findAndReplaceUtils.validateSingleEdit);
    mockPerformFindAndReplace = vi.mocked(
      findAndReplaceUtils.performFindAndReplace,
    );

    // Reset mocks to their default (non-throwing) state
    mockValidateSingleEdit.mockImplementation(() => {});
    mockPerformFindAndReplace.mockReturnValue("mocked content");

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

  describe("validateAndEnhanceSingleEditArgs", () => {
    describe("argument validation", () => {
      it("should throw error if filepath is missing", async () => {
        const args = {
          old_string: "test",
          new_string: "replacement",
        };

        await expect(
          validateAndEnhanceSingleEditArgs(args, mockExtras.ideMessenger),
        ).rejects.toThrow("filepath is required");
      });

      it("should delegate validation to validateSingleEdit", async () => {
        const args = {
          filepath: "test.txt",
          old_string: "test",
          new_string: "replacement",
        };

        mockValidateSingleEdit.mockImplementation(() => {
          throw new Error("old_string is required");
        });

        await expect(
          validateAndEnhanceSingleEditArgs(args, mockExtras.ideMessenger),
        ).rejects.toThrow("old_string is required");

        expect(mockValidateSingleEdit).toHaveBeenCalledWith(
          "test",
          "replacement",
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
          validateAndEnhanceSingleEditArgs(args, mockExtras.ideMessenger),
        ).rejects.toThrow("File nonexistent.txt does not exist");
      });

      it("should resolve relative file paths and read file content", async () => {
        mockResolveRelativePathInDir.mockResolvedValue(
          "file:///absolute/path/test.txt",
        );
        mockExtras.ideMessenger.ide.readFile = vi
          .fn()
          .mockResolvedValue("test content");
        mockPerformFindAndReplace.mockReturnValue("replacement content");

        const args = {
          filepath: "test.txt",
          old_string: "test",
          new_string: "replacement",
        };

        const result = await validateAndEnhanceSingleEditArgs(
          args,
          mockExtras.ideMessenger,
        );

        expect(mockResolveRelativePathInDir).toHaveBeenCalledWith(
          "test.txt",
          mockExtras.ideMessenger.ide,
        );
        expect(mockExtras.ideMessenger.ide.readFile).toHaveBeenCalledWith(
          "file:///absolute/path/test.txt",
        );
        expect(result.editingFileContents).toBe("test content");
        expect(result.fileUri).toBe("file:///absolute/path/test.txt");
      });
    });

    describe("find and replace operation", () => {
      beforeEach(() => {
        mockResolveRelativePathInDir.mockResolvedValue("file:///test/file.txt");
        mockExtras.ideMessenger.ide.readFile = vi
          .fn()
          .mockResolvedValue("test content");
      });

      it("should delegate to performFindAndReplace and return enhanced args", async () => {
        mockPerformFindAndReplace.mockReturnValue("replacement content");

        const args = {
          filepath: "file.txt",
          old_string: "test",
          new_string: "replacement",
          replace_all: true,
        };

        const result = await validateAndEnhanceSingleEditArgs(
          args,
          mockExtras.ideMessenger,
        );

        expect(mockPerformFindAndReplace).toHaveBeenCalledWith(
          "test content",
          "test",
          "replacement",
          true,
        );
        expect(result).toEqual({
          filepath: "file.txt",
          old_string: "test",
          new_string: "replacement",
          replace_all: true,
          editingFileContents: "test content",
          newContent: "replacement content",
          fileUri: "file:///test/file.txt",
        });
      });

      it("should use default value for replace_all when not provided", async () => {
        mockPerformFindAndReplace.mockReturnValue("replacement content");

        const args = {
          filepath: "file.txt",
          old_string: "test",
          new_string: "replacement",
        };

        await validateAndEnhanceSingleEditArgs(args, mockExtras.ideMessenger);

        expect(mockPerformFindAndReplace).toHaveBeenCalledWith(
          "test content",
          "test",
          "replacement",
          false,
        );
      });

      it("should propagate errors from performFindAndReplace", async () => {
        mockPerformFindAndReplace.mockImplementation(() => {
          throw new Error('string not found in file: "not found"');
        });

        const args = {
          filepath: "file.txt",
          old_string: "not found",
          new_string: "replacement",
        };

        await expect(
          validateAndEnhanceSingleEditArgs(args, mockExtras.ideMessenger),
        ).rejects.toThrow('string not found in file: "not found"');
      });
    });
  });

  describe("singleFindAndReplaceImpl", () => {
    it("should apply changes using enhanced args", async () => {
      const args = {
        filepath: "test/file.txt",
        old_string: "test",
        new_string: "replacement",
        replace_all: false,
        editingFileContents: "test content",
        newContent: "replacement content",
        fileUri: "file:///test/file.txt",
      };

      await singleFindAndReplaceImpl(args, "tool-call-id", mockExtras);

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "tool-call-id",
        text: "mocked content",
        filepath: "file:///test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should return correct response structure", async () => {
      const args = {
        filepath: "test/file.txt",
        old_string: "test",
        new_string: "replacement",
        replace_all: false,
        editingFileContents: "test content",
        newContent: "replacement content",
        fileUri: "file:///test/file.txt",
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
    it("should wrap and rethrow errors from readFile in validateAndEnhanceSingleEditArgs", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("file:///test/file.txt");
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockRejectedValue(new Error("Permission denied"));

      const args = {
        filepath: "file.txt",
        old_string: "test",
        new_string: "replacement",
      };

      await expect(
        validateAndEnhanceSingleEditArgs(args, mockExtras.ideMessenger),
      ).rejects.toThrow("Permission denied");
    });
  });
});
