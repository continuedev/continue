import * as ideUtils from "core/util/ideUtils";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolExtras } from "./callClientTool";
import { FOUND_MULTIPLE_FIND_STRINGS_ERROR } from "./findAndReplaceUtils";
import { multiEditImpl } from "./multiEditImpl";

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

describe("multiEditImpl", () => {
  let mockExtras: ClientToolExtras;
  let mockResolveRelativePathInDir: Mock;
  let mockInferResolvedUriFromRelativePath: Mock;
  let mockApplyForEditTool: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveRelativePathInDir = vi.mocked(ideUtils.resolveRelativePathInDir);
    mockInferResolvedUriFromRelativePath = vi.mocked(
      ideUtils.inferResolvedUriFromRelativePath,
    );
    mockApplyForEditTool = vi.mocked(applyForEditTool);

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

  describe("argument validation", () => {
    it("should throw if filepath is missing", async () => {
      await expect(
        multiEditImpl({ edits: [] }, "id", mockExtras),
      ).rejects.toThrow("filepath is required");
    });

    it("should throw if edits array is empty", async () => {
      await expect(
        multiEditImpl({ filepath: "test.txt", edits: [] }, "id", mockExtras),
      ).rejects.toThrow(
        "edits array is required and must contain at least one edit",
      );
    });

    it("should throw if edit has invalid old_string", async () => {
      await expect(
        multiEditImpl(
          {
            filepath: "test.txt",
            edits: [{ old_string: null, new_string: "test" }],
          },
          "id",
          mockExtras,
        ),
      ).rejects.toThrow("edit at index 0: old_string is required");
    });

    it("should throw if edit has undefined new_string", async () => {
      await expect(
        multiEditImpl(
          {
            filepath: "test.txt",
            edits: [{ old_string: "test", new_string: undefined }],
          },
          "id",
          mockExtras,
        ),
      ).rejects.toThrow("edit at index 0: new_string is required");
    });

    it("should throw if old_string equals new_string", async () => {
      await expect(
        multiEditImpl(
          {
            filepath: "test.txt",
            edits: [{ old_string: "same", new_string: "same" }],
          },
          "id",
          mockExtras,
        ),
      ).rejects.toThrow(
        "edit at index 0: old_string and new_string must be different",
      );
    });
  });

  describe("sequential edits", () => {
    beforeEach(() => {
      mockResolveRelativePathInDir.mockResolvedValue(
        "file:///dir/test/file.txt",
      );
    });

    it("should apply single edit", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("Hello world");

      await multiEditImpl(
        {
          filepath: "file.txt",
          edits: [{ old_string: "Hello", new_string: "Hi" }],
        },
        "id",
        mockExtras,
      );

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "id",
        text: "Hi world",
        filepath: "file:///dir/test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should apply multiple edits sequentially", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("Hello world\nGoodbye world");

      await multiEditImpl(
        {
          filepath: "file.txt",
          edits: [
            { old_string: "Hello", new_string: "Hi" },
            { old_string: "world", new_string: "universe", replace_all: true },
          ],
        },
        "id",
        mockExtras,
      );

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "id",
        text: "Hi universe\nGoodbye universe",
        filepath: "file:///dir/test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should handle edits that depend on previous edits", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("const x = 1;");

      await multiEditImpl(
        {
          filepath: "file.txt",
          edits: [
            { old_string: "const x", new_string: "let x" },
            { old_string: "let x = 1;", new_string: "let x = 2;" },
          ],
        },
        "id",
        mockExtras,
      );

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "id",
        text: "let x = 2;",
        filepath: "file:///dir/test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should throw if string not found in edit sequence", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("Hello world");

      await expect(
        multiEditImpl(
          {
            filepath: "file.txt",
            edits: [
              { old_string: "Hello", new_string: "Hi" },
              { old_string: "not found", new_string: "test" },
            ],
          },
          "id",
          mockExtras,
        ),
      ).rejects.toThrow(
        'edit at index 1: string not found in file: "not found"',
      );
    });

    it("should throw if multiple occurrences without replace_all", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("test test test");

      await expect(
        multiEditImpl(
          {
            filepath: "file.txt",
            edits: [{ old_string: "test", new_string: "replaced" }],
          },
          "id",
          mockExtras,
        ),
      ).rejects.toThrow(
        `edit at index 0: String "test" appears 3 times in the file. ${FOUND_MULTIPLE_FIND_STRINGS_ERROR}`,
      );
    });
  });

  describe("file creation", () => {
    it("should create new file with empty old_string", async () => {
      mockResolveRelativePathInDir.mockResolvedValue(null);
      mockInferResolvedUriFromRelativePath.mockResolvedValue(
        "file:///infered/new.txt",
      );

      await multiEditImpl(
        {
          filepath: "new.txt",
          edits: [{ old_string: "", new_string: "New content\nLine 2" }],
        },
        "id",
        mockExtras,
      );

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "id",
        text: "New content\nLine 2",
        filepath: "file:///infered/new.txt",
        isSearchAndReplace: true,
      });
    });
  });

  describe("replace_all functionality", () => {
    beforeEach(() => {
      mockResolveRelativePathInDir.mockResolvedValue(
        "file:///dir/test/file.txt",
      );
    });

    it("should replace all occurrences when specified", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("foo bar foo baz foo");

      await multiEditImpl(
        {
          filepath: "file.txt",
          edits: [{ old_string: "foo", new_string: "qux", replace_all: true }],
        },
        "id",
        mockExtras,
      );

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "id",
        text: "qux bar qux baz qux",
        filepath: "file:///dir/test/file.txt",
        isSearchAndReplace: true,
      });
    });

    it("should handle mixed replace_all settings", async () => {
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockResolvedValue("x y x z x");

      await multiEditImpl(
        {
          filepath: "file.txt",
          edits: [
            { old_string: "x", new_string: "a", replace_all: true },
            { old_string: "y", new_string: "b" },
          ],
        },
        "id",
        mockExtras,
      );

      expect(mockApplyForEditTool).toHaveBeenCalledWith({
        streamId: "test-uuid",
        toolCallId: "id",
        text: "a b a z a",
        filepath: "file:///dir/test/file.txt",
        isSearchAndReplace: true,
      });
    });
  });

  describe("error handling", () => {
    it("should wrap readFile errors", async () => {
      mockResolveRelativePathInDir.mockResolvedValue(
        "file:///dir/test/file.txt",
      );
      mockExtras.ideMessenger.ide.readFile = vi
        .fn()
        .mockRejectedValue(new Error("Read failed"));

      await expect(
        multiEditImpl(
          {
            filepath: "file.txt",
            edits: [{ old_string: "test", new_string: "new" }],
          },
          "id",
          mockExtras,
        ),
      ).rejects.toThrow("Read failed");
    });
  });

  describe("return value", () => {
    it("should return correct structure", async () => {
      mockResolveRelativePathInDir.mockResolvedValue(
        "file:///dir/test/file.txt",
      );
      mockExtras.ideMessenger.ide.readFile = vi.fn().mockResolvedValue("test");

      const result = await multiEditImpl(
        {
          filepath: "file.txt",
          edits: [{ old_string: "test", new_string: "new" }],
        },
        "id",
        mockExtras,
      );

      expect(result).toEqual({
        respondImmediately: false,
        output: undefined,
      });
    });
  });
});
