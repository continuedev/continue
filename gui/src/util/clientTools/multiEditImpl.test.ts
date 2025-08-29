import * as ideUtils from "core/util/ideUtils";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolExtras } from "./callClientTool";
import * as findAndReplaceUtils from "./findAndReplaceUtils";
import {
  multiEditImpl,
  validateAndEnhanceMultiEditArgs,
} from "./multiEditImpl";
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

vi.mock("core/util/ideUtils", () => ({
  resolveRelativePathInDir: vi.fn(),
  inferResolvedUriFromRelativePath: vi.fn(),
}));

vi.mock("../../redux/thunks/handleApplyStateUpdate", () => ({
  applyForEditTool: vi.fn(),
}));

vi.mock("./findAndReplaceUtils", () => ({
  validateSingleEdit: vi.fn(),
  validateCreatingForMultiEdit: vi.fn(),
  performFindAndReplace: vi.fn(),
  FOUND_MULTIPLE_FIND_STRINGS_ERROR:
    "Either provide a more specific string with surrounding context to make it unique, or use replace_all=true to replace all occurrences.",
}));

describe("multiEditImpl", () => {
  let mockExtras: ClientToolExtras;
  let mockResolveRelativePathInDir: Mock;
  let mockInferResolvedUriFromRelativePath: Mock;
  let mockApplyForEditTool: Mock;
  let mockValidateSingleEdit: Mock;
  let mockValidateCreatingForMultiEdit: Mock;
  let mockPerformFindAndReplace: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveRelativePathInDir = vi.mocked(ideUtils.resolveRelativePathInDir);
    mockInferResolvedUriFromRelativePath = vi.mocked(
      ideUtils.inferResolvedUriFromRelativePath,
    );
    mockApplyForEditTool = vi.mocked(applyForEditTool);

    // Get the mocked functions from the utility module
    mockValidateSingleEdit = vi.mocked(findAndReplaceUtils.validateSingleEdit);
    mockValidateCreatingForMultiEdit = vi.mocked(
      findAndReplaceUtils.validateCreatingForMultiEdit,
    );
    mockPerformFindAndReplace = vi.mocked(
      findAndReplaceUtils.performFindAndReplace,
    );

    // Reset mocks to their default (non-throwing) state
    mockValidateSingleEdit.mockImplementation(() => {});
    mockValidateCreatingForMultiEdit.mockReturnValue(false);
    mockPerformFindAndReplace.mockReturnValue("mocked content");

    mockExtras = {
      getState: vi.fn(() => ({
        config: { config: { allowAnonymousTelemetry: false } },
      })) as any,
      dispatch: vi.fn() as any,
      ideMessenger: {
        ide: {
          readFile: vi.fn(),
          getWorkspaceDirs: vi.fn().mockResolvedValue(["dir1"]),
        },
        request: vi.fn(),
      } as any,
    };
  });

  describe("validateAndEnhanceMultiEditArgs", () => {
    describe("argument validation", () => {
      it("should throw if filepath is missing", async () => {
        const args = { edits: [] };

        await expect(
          validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger),
        ).rejects.toThrow("filepath is required");
      });

      it("should throw if edits array is missing", async () => {
        const args = { filepath: "test.txt" };

        await expect(
          validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger),
        ).rejects.toThrow(
          "edits array is required and must contain at least one edit",
        );
      });

      it("should throw if edits array is empty", async () => {
        const args = { filepath: "test.txt", edits: [] };

        await expect(
          validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger),
        ).rejects.toThrow(
          "edits array is required and must contain at least one edit",
        );
      });

      it("should delegate validation to validateSingleEdit for each edit", async () => {
        const args = {
          filepath: "test.txt",
          edits: [
            { old_string: "test1", new_string: "replacement1" },
            { old_string: "test2", new_string: "replacement2" },
          ],
        };

        mockValidateSingleEdit.mockImplementation((oldStr, newStr, index) => {
          if (index === 1) {
            throw new Error("edit at index 1: old_string is required");
          }
        });

        await expect(
          validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger),
        ).rejects.toThrow("edit at index 1: old_string is required");

        expect(mockValidateSingleEdit).toHaveBeenCalledWith(
          "test1",
          "replacement1",
          0,
        );
        expect(mockValidateSingleEdit).toHaveBeenCalledWith(
          "test2",
          "replacement2",
          1,
        );
      });

      it("should delegate to validateCreatingForMultiEdit", async () => {
        const args = {
          filepath: "test.txt",
          edits: [{ old_string: "", new_string: "new content" }],
        };

        mockValidateCreatingForMultiEdit.mockReturnValue(true);
        mockInferResolvedUriFromRelativePath.mockResolvedValue(
          "file:///new.txt",
        );
        mockResolveRelativePathInDir.mockResolvedValue(null);

        await validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger);

        expect(mockValidateCreatingForMultiEdit).toHaveBeenCalledWith(
          args.edits,
        );
      });
    });

    describe("file resolution and editing", () => {
      describe("existing files", () => {
        beforeEach(() => {
          mockResolveRelativePathInDir.mockResolvedValue(
            "file:///dir/test/file.txt",
          );
          mockExtras.ideMessenger.ide.readFile = vi
            .fn()
            .mockResolvedValue("test content");
        });

        it("should read file and apply edits sequentially", async () => {
          mockPerformFindAndReplace
            .mockReturnValueOnce("content after edit 1")
            .mockReturnValueOnce("content after edit 2");

          const args = {
            filepath: "file.txt",
            edits: [
              { old_string: "old1", new_string: "new1" },
              { old_string: "old2", new_string: "new2", replace_all: true },
            ],
          };

          const result = await validateAndEnhanceMultiEditArgs(
            args,
            mockExtras.ideMessenger,
          );

          expect(mockResolveRelativePathInDir).toHaveBeenCalledWith(
            "file.txt",
            mockExtras.ideMessenger.ide,
          );
          expect(mockExtras.ideMessenger.ide.readFile).toHaveBeenCalledWith(
            "file:///dir/test/file.txt",
          );

          // Verify sequential processing
          expect(mockPerformFindAndReplace).toHaveBeenNthCalledWith(
            1,
            "test content",
            "old1",
            "new1",
            undefined,
            0,
          );
          expect(mockPerformFindAndReplace).toHaveBeenNthCalledWith(
            2,
            "content after edit 1",
            "old2",
            "new2",
            true,
            1,
          );

          expect(result).toEqual({
            filepath: "file.txt",
            edits: args.edits,
            fileUri: "file:///dir/test/file.txt",
            editingFileContents: "test content",
            newContent: "content after edit 2",
          });
        });

        it("should throw error if file does not exist when not creating", async () => {
          mockResolveRelativePathInDir.mockResolvedValue(null);

          const args = {
            filepath: "nonexistent.txt",
            edits: [{ old_string: "test", new_string: "replacement" }],
          };

          await expect(
            validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger),
          ).rejects.toThrow(
            'file nonexistent.txt does not exist. If you are trying to edit it, correct the filepath. If you are trying to create it, you must pass old_string=""',
          );
        });

        it("should propagate errors from performFindAndReplace", async () => {
          mockPerformFindAndReplace.mockImplementation(() => {
            throw new Error(
              'edit at index 0: string not found in file: "not found"',
            );
          });

          const args = {
            filepath: "file.txt",
            edits: [{ old_string: "not found", new_string: "replacement" }],
          };

          await expect(
            validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger),
          ).rejects.toThrow(
            'edit at index 0: string not found in file: "not found"',
          );
        });
      });

      describe("file creation", () => {
        it("should create new file with empty old_string", async () => {
          mockValidateCreatingForMultiEdit.mockReturnValue(true);
          mockResolveRelativePathInDir.mockResolvedValue(null);
          mockInferResolvedUriFromRelativePath.mockResolvedValue(
            "file:///infered/new.txt",
          );

          const args = {
            filepath: "new.txt",
            edits: [{ old_string: "", new_string: "New content\nLine 2" }],
          };

          const result = await validateAndEnhanceMultiEditArgs(
            args,
            mockExtras.ideMessenger,
          );

          expect(mockValidateCreatingForMultiEdit).toHaveBeenCalledWith(
            args.edits,
          );
          expect(mockInferResolvedUriFromRelativePath).toHaveBeenCalledWith(
            "new.txt",
            mockExtras.ideMessenger.ide,
            ["dir1"],
          );

          expect(result).toEqual({
            filepath: "new.txt",
            edits: args.edits,
            fileUri: "file:///infered/new.txt",
            editingFileContents: "",
            newContent: "New content\nLine 2",
          });
        });

        it("should throw error if file already exists when creating", async () => {
          mockValidateCreatingForMultiEdit.mockReturnValue(true);
          mockResolveRelativePathInDir.mockResolvedValue(
            "file:///existing.txt",
          );

          const args = {
            filepath: "existing.txt",
            edits: [{ old_string: "", new_string: "content" }],
          };

          await expect(
            validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger),
          ).rejects.toThrow(
            "file existing.txt already exists, cannot create new file",
          );
        });
      });
    });
  });

  describe("multiEditImpl", () => {
    it("should apply changes using enhanced args", async () => {
      const args = {
        filepath: "file.txt",
        edits: [{ old_string: "test", new_string: "replacement" }],
        fileUri: "file:///test/file.txt",
        editingFileContents: "test content",
        newContent: "replacement content",
      };

      await multiEditImpl(args, "tool-call-id", mockExtras);

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "tool-call-id",
        text: "replacement content",
        filepath: "file:///test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should return correct response structure", async () => {
      const args = {
        filepath: "file.txt",
        edits: [{ old_string: "test", new_string: "replacement" }],
        fileUri: "file:///test/file.txt",
        editingFileContents: "test content",
        newContent: "replacement content",
      };

      const result = await multiEditImpl(args, "tool-call-id", mockExtras);

      expect(result).toEqual({
        respondImmediately: false,
        output: undefined,
      });
    });
  });

  describe("error handling", () => {
    it("should wrap readFile errors in validateAndEnhanceMultiEditArgs", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("file:///test/file.txt");
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockRejectedValue(new Error("Read failed"));

      const args = {
        filepath: "file.txt",
        edits: [{ old_string: "test", new_string: "new" }],
      };

      await expect(
        validateAndEnhanceMultiEditArgs(args, mockExtras.ideMessenger),
      ).rejects.toThrow("Read failed");
    });
  });
});
