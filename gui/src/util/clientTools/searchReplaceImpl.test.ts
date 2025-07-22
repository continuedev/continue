import { findSearchMatch } from "core/edit/searchAndReplace/findSearchMatch";
import { parseAllSearchReplaceBlocks } from "core/edit/searchAndReplace/parseSearchReplaceBlock";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientToolExtras } from "./callClientTool";
import { searchReplaceToolImpl } from "./searchReplaceImpl";

// Mock the dependencies
vi.mock("core/edit/searchAndReplace/findSearchMatch");
vi.mock("core/edit/searchAndReplace/parseSearchReplaceBlock");
vi.mock("core/util/ideUtils");
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-stream-id"),
}));

const mockFindSearchMatch = vi.mocked(findSearchMatch);
const mockParseAllSearchReplaceBlocks = vi.mocked(parseAllSearchReplaceBlocks);
const mockResolveRelativePathInDir = vi.mocked(resolveRelativePathInDir);

describe("searchReplaceToolImpl", () => {
  let mockExtras: ClientToolExtras;
  let mockIdeMessenger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock IDE messenger
    mockIdeMessenger = {
      ide: {
        readFile: vi.fn(),
      },
      request: vi.fn(),
    };

    // Create mock extras
    mockExtras = {
      ideMessenger: mockIdeMessenger,
      getState: vi.fn<any>(() => ({
        config: {
          config: {
            allowAnonymousTelemetry: false,
          },
        },
      })),
      dispatch: vi.fn(),
    };
  });

  describe("basic validation", () => {
    it("should throw error when file does not exist", async () => {
      mockResolveRelativePathInDir.mockResolvedValue(undefined);

      await expect(
        searchReplaceToolImpl(
          { filepath: "nonexistent.txt", diffs: ["some diff"] },
          "tool-call-id",
          mockExtras,
        ),
      ).rejects.toThrow("File nonexistent.txt does not exist");
    });

    it("should throw error when no search/replace blocks found in first diff", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([]);

      await expect(
        searchReplaceToolImpl(
          { filepath: "test.txt", diffs: ["invalid diff content"] },
          "tool-call-id",
          mockExtras,
        ),
      ).rejects.toThrow("No complete search/replace blocks found in diff 1");
    });

    it("should throw error when no search/replace blocks found in second diff", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks
        .mockReturnValueOnce([
          {
            isComplete: true,
            searchContent: "valid content",
            replaceContent: "replacement",
          },
        ])
        .mockReturnValueOnce([]);

      await expect(
        searchReplaceToolImpl(
          {
            filepath: "test.txt",
            diffs: ["valid diff", "invalid diff content"],
          },
          "tool-call-id",
          mockExtras,
        ),
      ).rejects.toThrow("No complete search/replace blocks found in diff 2");
    });

    it("should throw error when all diffs are empty", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([]);

      await expect(
        searchReplaceToolImpl(
          { filepath: "test.txt", diffs: [] },
          "tool-call-id",
          mockExtras,
        ),
      ).rejects.toThrow("No complete search/replace blocks found in any diffs");
    });
  });

  describe("single block replacement", () => {
    it("should successfully apply single search/replace block", async () => {
      const originalContent = `function hello() {
  console.log("Hello");
  return "world";
}`;

      const expectedFinalContent = `function hello() {
  console.log("Hi there!");
  return "world";
}`;

      // Setup mocks
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.js");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: 'console.log("Hello");',
          replaceContent: 'console.log("Hi there!");',
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);

      // Calculate correct positions for 'console.log("Hello");' in the original content
      const searchText = 'console.log("Hello");';
      const startIndex = originalContent.indexOf(searchText);
      const endIndex = startIndex + searchText.length;

      mockFindSearchMatch.mockReturnValue({
        startIndex,
        endIndex,
        strategyName: "exactMatch",
      });
      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      const result = await searchReplaceToolImpl(
        { filepath: "test.js", diffs: ["mock diff content"] },
        "tool-call-id",
        mockExtras,
      );

      // Verify the result
      expect(result).toEqual({
        respondImmediately: false,
        output: undefined,
      });

      // Verify applyToFile was called with correct parameters
      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: expectedFinalContent,
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.js",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });
  });

  describe("single diff scenarios", () => {
    it("should successfully apply single diff with single search/replace block", async () => {
      const originalContent = `function hello() {
  console.log("Hello");
  return "world";
}`;

      const expectedFinalContent = `function hello() {
  console.log("Hi there!");
  return "world";
}`;

      // Setup mocks
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.js");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: 'console.log("Hello");',
          replaceContent: 'console.log("Hi there!");',
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);

      // Calculate correct positions for 'console.log("Hello");' in the original content
      const searchText = 'console.log("Hello");';
      const startIndex = originalContent.indexOf(searchText);
      const endIndex = startIndex + searchText.length;

      mockFindSearchMatch.mockReturnValue({
        startIndex,
        endIndex,
        strategyName: "exactMatch",
      });
      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      const result = await searchReplaceToolImpl(
        { filepath: "test.js", diffs: ["mock diff content"] },
        "tool-call-id",
        mockExtras,
      );

      // Verify the result
      expect(result).toEqual({
        respondImmediately: false,
        output: undefined,
      });

      // Verify applyToFile was called with correct parameters
      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: expectedFinalContent,
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.js",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });
  });

  describe("multiple block replacement", () => {
    it("should successfully apply multiple search/replace blocks sequentially", async () => {
      const originalContent = `const a = 1;
const b = 2;
const c = 3;`;

      const expectedFinalContent = `const a = 100;
const b = 200;
const c = 3;`;

      // Setup mocks
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.js");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "const a = 1;",
          replaceContent: "const a = 100;",
        },
        {
          isComplete: true,
          searchContent: "const b = 2;",
          replaceContent: "const b = 200;",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);

      // Calculate positions for sequential replacements
      const firstSearchText = "const a = 1;";
      const secondSearchText = "const b = 2;";

      const firstStartIndex = originalContent.indexOf(firstSearchText);
      const firstEndIndex = firstStartIndex + firstSearchText.length;

      // After first replacement: "const a = 100;\nconst b = 2;\nconst c = 3;"
      const contentAfterFirstReplacement =
        originalContent.substring(0, firstStartIndex) +
        "const a = 100;" +
        originalContent.substring(firstEndIndex);

      const secondStartIndex =
        contentAfterFirstReplacement.indexOf(secondSearchText);
      const secondEndIndex = secondStartIndex + secondSearchText.length;

      // Mock sequential search matches
      mockFindSearchMatch
        .mockReturnValueOnce({
          startIndex: firstStartIndex,
          endIndex: firstEndIndex,
          strategyName: "exactMatch",
        })
        .mockReturnValueOnce({
          startIndex: secondStartIndex,
          endIndex: secondEndIndex,
          strategyName: "exactMatch",
        });

      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      const result = await searchReplaceToolImpl(
        { filepath: "test.js", diffs: ["mock diff content"] },
        "tool-call-id",
        mockExtras,
      );

      // Verify the result
      expect(result).toEqual({
        respondImmediately: false,
        output: undefined,
      });

      // Verify findSearchMatch was called twice with updated content
      expect(mockFindSearchMatch).toHaveBeenCalledTimes(2);
      expect(mockFindSearchMatch).toHaveBeenNthCalledWith(
        1,
        originalContent,
        "const a = 1;",
      );
      expect(mockFindSearchMatch).toHaveBeenNthCalledWith(
        2,
        contentAfterFirstReplacement,
        "const b = 2;",
      );
      // Verify final applyToFile call
      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: expectedFinalContent,
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.js",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });
  });

  describe("multiple diff scenarios", () => {
    it("should successfully apply multiple diffs each with single search/replace block", async () => {
      const originalContent = `const a = 1;
const b = 2;
const c = 3;`;

      const expectedFinalContent = `const a = 100;
const b = 200;
const c = 3;`;

      // Setup mocks - each diff returns one block
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.js");
      mockParseAllSearchReplaceBlocks
        .mockReturnValueOnce([
          {
            isComplete: true,
            searchContent: "const a = 1;",
            replaceContent: "const a = 100;",
          },
        ])
        .mockReturnValueOnce([
          {
            isComplete: true,
            searchContent: "const b = 2;",
            replaceContent: "const b = 200;",
          },
        ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);

      // Calculate positions for sequential replacements
      const firstSearchText = "const a = 1;";
      const secondSearchText = "const b = 2;";

      const firstStartIndex = originalContent.indexOf(firstSearchText);
      const firstEndIndex = firstStartIndex + firstSearchText.length;

      // After first replacement: "const a = 100;\nconst b = 2;\nconst c = 3;"
      const contentAfterFirstReplacement =
        originalContent.substring(0, firstStartIndex) +
        "const a = 100;" +
        originalContent.substring(firstEndIndex);

      const secondStartIndex =
        contentAfterFirstReplacement.indexOf(secondSearchText);
      const secondEndIndex = secondStartIndex + secondSearchText.length;

      // Mock sequential search matches
      mockFindSearchMatch
        .mockReturnValueOnce({
          startIndex: firstStartIndex,
          endIndex: firstEndIndex,
          strategyName: "exactMatch",
        })
        .mockReturnValueOnce({
          startIndex: secondStartIndex,
          endIndex: secondEndIndex,
          strategyName: "exactMatch",
        });

      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      const result = await searchReplaceToolImpl(
        { filepath: "test.js", diffs: ["first diff", "second diff"] },
        "tool-call-id",
        mockExtras,
      );

      // Verify the result
      expect(result).toEqual({
        respondImmediately: false,
        output: undefined,
      });

      // Verify parseAllSearchReplaceBlocks was called for each diff
      expect(mockParseAllSearchReplaceBlocks).toHaveBeenCalledTimes(2);
      expect(mockParseAllSearchReplaceBlocks).toHaveBeenNthCalledWith(
        1,
        "first diff",
      );
      expect(mockParseAllSearchReplaceBlocks).toHaveBeenNthCalledWith(
        2,
        "second diff",
      );

      // Verify final applyToFile call
      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: expectedFinalContent,
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.js",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });
  });

  describe("deletion scenarios", () => {
    it("should handle empty replacement (deletion)", async () => {
      const originalContent = `keep this
remove this line
keep this too`;

      const expectedFinalContent = `keep this

keep this too`;

      // Setup mocks
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "remove this line",
          replaceContent: "",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);
      mockFindSearchMatch.mockReturnValue({
        startIndex: 10, // Position of "remove this line"
        endIndex: 26, // End of "remove this line"
        strategyName: "exactMatch",
      });
      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      const result = await searchReplaceToolImpl(
        { filepath: "test.txt", diffs: ["mock diff content"] },
        "tool-call-id",
        mockExtras,
      );

      expect(result).toEqual({
        respondImmediately: false,
        output: undefined,
      });

      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: expectedFinalContent,
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.txt",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });

    it("should handle undefined replaceContent as empty string", async () => {
      const originalContent = "line1\nline2\nline3";
      const expectedFinalContent = "line1\n\nline3";

      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "line2",
          replaceContent: undefined, // undefined should be treated as empty string
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);
      mockFindSearchMatch.mockReturnValue({
        startIndex: 6,
        endIndex: 11,
        strategyName: "exactMatch",
      });
      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      await searchReplaceToolImpl(
        { filepath: "test.txt", diffs: ["mock diff content"] },
        "tool-call-id",
        mockExtras,
      );

      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: expectedFinalContent,
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.txt",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });
  });

  describe("error handling", () => {
    it("should throw error when search content is not found", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "nonexistent content",
          replaceContent: "replacement",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue("some file content");
      mockFindSearchMatch.mockReturnValue(null); // Search content not found

      await expect(
        searchReplaceToolImpl(
          { filepath: "test.txt", diffs: ["mock diff content"] },
          "tool-call-id",
          mockExtras,
        ),
      ).rejects.toThrow(
        "Search content not found in block 1:\nnonexistent content",
      );
    });

    it("should throw error when search content is not found in second block", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "found content",
          replaceContent: "replacement1",
        },
        {
          isComplete: true,
          searchContent: "missing content",
          replaceContent: "replacement2",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(
        "found content and other stuff",
      );

      // First search succeeds, second fails
      mockFindSearchMatch
        .mockReturnValueOnce({
          startIndex: 0,
          endIndex: 13,
          strategyName: "exactMatch",
        })
        .mockReturnValueOnce(null); // Second search fails

      await expect(
        searchReplaceToolImpl(
          { filepath: "test.txt", diffs: ["mock diff content"] },
          "tool-call-id",
          mockExtras,
        ),
      ).rejects.toThrow(
        "Search content not found in block 2:\nmissing content",
      );
    });

    it("should handle file read errors", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "content",
          replaceContent: "replacement",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockRejectedValue(
        new Error("File read error"),
      );

      await expect(
        searchReplaceToolImpl(
          { filepath: "test.txt", diffs: ["mock diff content"] },
          "tool-call-id",
          mockExtras,
        ),
      ).rejects.toThrow("Failed to apply search and replace: File read error");
    });

    it("should handle applyToFile errors", async () => {
      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "content",
          replaceContent: "replacement",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue("content");
      mockFindSearchMatch.mockReturnValue({
        startIndex: 0,
        endIndex: 7,
        strategyName: "exactMatch",
      });
      mockIdeMessenger.request.mockRejectedValue(new Error("Apply failed"));

      await expect(
        searchReplaceToolImpl(
          { filepath: "test.txt", diffs: ["mock diff content"] },
          "tool-call-id",
          mockExtras,
        ),
      ).rejects.toThrow("Failed to apply search and replace: Apply failed");
    });
  });

  describe("edge cases", () => {
    it("should handle empty search content", async () => {
      const originalContent = "existing content";
      const expectedFinalContent = "new contentexisting content";

      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "",
          replaceContent: "new content",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);
      mockFindSearchMatch.mockReturnValue({
        startIndex: 0, // Empty search matches at beginning
        endIndex: 0,
        strategyName: "exactMatch",
      });
      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      await searchReplaceToolImpl(
        { filepath: "test.txt", diffs: ["mock diff content"] },
        "tool-call-id",
        mockExtras,
      );

      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: expectedFinalContent,
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.txt",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });

    it("should handle whole file replacement", async () => {
      const originalContent = "old file content";
      const expectedFinalContent = "completely new content";

      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: originalContent,
          replaceContent: "completely new content",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);
      mockFindSearchMatch.mockReturnValue({
        startIndex: 0,
        endIndex: originalContent.length,
        strategyName: "exactMatch",
      });
      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      await searchReplaceToolImpl(
        { filepath: "test.txt", diffs: ["mock diff content"] },
        "tool-call-id",
        mockExtras,
      );

      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: expectedFinalContent,
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.txt",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });
  });

  describe("dependency integration", () => {
    it("should call all dependencies with correct parameters", async () => {
      const originalContent = "test content";

      mockResolveRelativePathInDir.mockResolvedValue("/resolved/path/test.txt");
      mockParseAllSearchReplaceBlocks.mockReturnValue([
        {
          isComplete: true,
          searchContent: "test",
          replaceContent: "updated",
        },
      ]);
      mockIdeMessenger.ide.readFile.mockResolvedValue(originalContent);
      mockFindSearchMatch.mockReturnValue({
        startIndex: 0,
        endIndex: 4,
        strategyName: "exactMatch",
      });
      mockIdeMessenger.request.mockResolvedValue({ status: "success" });

      await searchReplaceToolImpl(
        { filepath: "relative/test.txt", diffs: ["mock diff content"] },
        "tool-call-id",
        mockExtras,
      );

      // Verify all dependencies were called correctly
      expect(mockResolveRelativePathInDir).toHaveBeenCalledWith(
        "relative/test.txt",
        mockIdeMessenger.ide,
      );
      expect(mockParseAllSearchReplaceBlocks).toHaveBeenCalledWith(
        "mock diff content",
      );
      expect(mockIdeMessenger.ide.readFile).toHaveBeenCalledWith(
        "/resolved/path/test.txt",
      );
      expect(mockFindSearchMatch).toHaveBeenCalledWith(originalContent, "test");
      expect(mockIdeMessenger.request).toHaveBeenCalledWith("applyToFile", {
        text: "updated content",
        streamId: "test-stream-id",
        filepath: "/resolved/path/test.txt",
        toolCallId: "tool-call-id",
        isSearchAndReplace: true,
      });
    });
  });
});
