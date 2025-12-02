import { expect, test, vi } from "vitest";
import { ToolExtras } from "../..";
import { MAX_CHAR_POSITION, readFileRangeImpl } from "./readFileRange";

// Mock the dependencies
vi.mock("../../util/ideUtils", () => ({
  resolveRelativePathInDir: vi.fn(),
}));

vi.mock("../../util/uri", () => ({
  getUriPathBasename: vi.fn(),
}));

vi.mock("./readFileLimit", () => ({
  throwIfFileExceedsHalfOfContext: vi.fn(),
}));

test("readFileRangeImpl handles out-of-bounds ranges gracefully", async () => {
  const { resolveRelativePathInDir } = await import("../../util/ideUtils");
  const { getUriPathBasename } = await import("../../util/uri");
  const { throwIfFileExceedsHalfOfContext } = await import("./readFileLimit");

  // Mock the utility functions
  vi.mocked(resolveRelativePathInDir).mockResolvedValue("file:///test.txt");
  vi.mocked(getUriPathBasename).mockReturnValue("test.txt");
  vi.mocked(throwIfFileExceedsHalfOfContext).mockResolvedValue(undefined);

  // Test case 1: Start line beyond end of file
  const mockIdeOutOfBounds = {
    readRangeInFile: vi.fn().mockResolvedValue(""), // IDE returns empty string
  };

  const mockExtras1 = {
    ide: mockIdeOutOfBounds,
    config: { selectedModelByRole: { chat: { contextLength: 8192 } } },
  } as unknown as ToolExtras;

  const result1 = await readFileRangeImpl(
    {
      filepath: "test.txt",
      startLine: 100, // Beyond end of file
      endLine: 105,
    },
    mockExtras1,
  );

  expect(result1).toHaveLength(1);
  expect(result1[0].content).toBe("");
  expect(result1[0].description).toBe("test.txt (lines 100-105)");

  // Test case 2: End line beyond end of file
  const mockIdePartialRange = {
    readRangeInFile: vi.fn().mockResolvedValue("line5\nline6"), // IDE returns available content
  };

  const mockExtras2 = {
    ide: mockIdePartialRange,
    config: { selectedModelByRole: { chat: { contextLength: 8192 } } },
  } as unknown as ToolExtras;

  const result2 = await readFileRangeImpl(
    {
      filepath: "test.txt",
      startLine: 5,
      endLine: 100, // Beyond end of file
    },
    mockExtras2,
  );

  expect(result2).toHaveLength(1);
  expect(result2[0].content).toBe("line5\nline6");
  expect(result2[0].description).toBe("test.txt (lines 5-100)");

  // Verify that IDE methods were called with correct 0-based ranges
  expect(mockIdeOutOfBounds.readRangeInFile).toHaveBeenCalledWith(
    "file:///test.txt",
    {
      start: { line: 99, character: 0 }, // 100 - 1
      end: { line: 104, character: MAX_CHAR_POSITION }, // 105 - 1
    },
  );

  expect(mockIdePartialRange.readRangeInFile).toHaveBeenCalledWith(
    "file:///test.txt",
    {
      start: { line: 4, character: 0 }, // 5 - 1
      end: { line: 99, character: MAX_CHAR_POSITION }, // 100 - 1
    },
  );
});

test("readFileRangeImpl validates line number constraints", async () => {
  const mockExtras = {
    ide: { readRangeInFile: vi.fn(), readFile: vi.fn() },
    config: { selectedModelByRole: { chat: { contextLength: 8192 } } },
  } as unknown as ToolExtras;

  // Test startLine < 1 (invalid)
  await expect(
    readFileRangeImpl(
      {
        filepath: "test.txt",
        startLine: 0,
        endLine: 5,
      },
      mockExtras,
    ),
  ).rejects.toThrow("startLine must be 1 or greater");

  // Test negative startLine (no longer supported)
  await expect(
    readFileRangeImpl(
      {
        filepath: "test.txt",
        startLine: -1,
        endLine: 5,
      },
      mockExtras,
    ),
  ).rejects.toThrow("Negative line numbers are not supported");

  // Test endLine < 1 (invalid)
  await expect(
    readFileRangeImpl(
      {
        filepath: "test.txt",
        startLine: 1,
        endLine: 0,
      },
      mockExtras,
    ),
  ).rejects.toThrow("endLine must be 1 or greater");

  // Test negative endLine (no longer supported)
  await expect(
    readFileRangeImpl(
      {
        filepath: "test.txt",
        startLine: 1,
        endLine: -1,
      },
      mockExtras,
    ),
  ).rejects.toThrow("Negative line numbers are not supported");

  // Test endLine < startLine
  await expect(
    readFileRangeImpl(
      {
        filepath: "test.txt",
        startLine: 10,
        endLine: 5,
      },
      mockExtras,
    ),
  ).rejects.toThrow(
    "endLine (5) must be greater than or equal to startLine (10)",
  );
});

test("readFileRangeImpl handles normal ranges correctly", async () => {
  const { resolveRelativePathInDir } = await import("../../util/ideUtils");
  const { getUriPathBasename } = await import("../../util/uri");
  const { throwIfFileExceedsHalfOfContext } = await import("./readFileLimit");

  vi.mocked(resolveRelativePathInDir).mockResolvedValue("file:///test.txt");
  vi.mocked(getUriPathBasename).mockReturnValue("test.txt");
  vi.mocked(throwIfFileExceedsHalfOfContext).mockResolvedValue(undefined);

  const mockIde = {
    readRangeInFile: vi.fn().mockResolvedValue("line2\nline3\nline4"),
  };

  const mockExtras = {
    ide: mockIde,
    config: { selectedModelByRole: { chat: { contextLength: 8192 } } },
  } as unknown as ToolExtras;

  const result = await readFileRangeImpl(
    {
      filepath: "src/test.py",
      startLine: 2,
      endLine: 4,
    },
    mockExtras,
  );

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    name: "test.txt",
    description: "src/test.py (lines 2-4)",
    content: "line2\nline3\nline4",
    uri: {
      type: "file",
      value: "file:///test.txt",
    },
  });

  // Verify correct 0-based conversion
  expect(mockIde.readRangeInFile).toHaveBeenCalledWith("file:///test.txt", {
    start: { line: 1, character: 0 }, // 2 - 1
    end: { line: 3, character: MAX_CHAR_POSITION }, // 4 - 1
  });
});
