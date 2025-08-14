import { expect, test, vi } from "vitest";
import { ToolExtras } from "../..";
import { readFileHeadImpl } from "./readFileHead";

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

test("readFileHeadImpl reads first N lines correctly", async () => {
  const { resolveRelativePathInDir } = await import("../../util/ideUtils");
  const { getUriPathBasename } = await import("../../util/uri");
  const { throwIfFileExceedsHalfOfContext } = await import("./readFileLimit");

  vi.mocked(resolveRelativePathInDir).mockResolvedValue("file:///test.txt");
  vi.mocked(getUriPathBasename).mockReturnValue("test.txt");
  vi.mocked(throwIfFileExceedsHalfOfContext).mockResolvedValue(undefined);

  const expectedContent = "line1\nline2\nline3";
  const mockIde = {
    readRangeInFile: vi.fn().mockResolvedValue(expectedContent),
  };

  const mockExtras = {
    ide: mockIde,
    config: { selectedModelByRole: { chat: { contextLength: 8192 } } },
  } as unknown as ToolExtras;

  const result = await readFileHeadImpl(
    {
      filepath: "src/test.py",
      lines: 3,
    },
    mockExtras,
  );

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    name: "test.txt",
    description: "src/test.py (first 3 lines)",
    content: expectedContent,
    uri: {
      type: "file",
      value: "file:///test.txt",
    },
  });

  // Verify readRangeInFile was called with correct 0-based range
  expect(mockIde.readRangeInFile).toHaveBeenCalledWith("file:///test.txt", {
    start: { line: 0, character: 0 }, // First line (0-based)
    end: { line: 2, character: Number.MAX_SAFE_INTEGER }, // 3rd line (0-based)
  });
});

test("readFileHeadImpl validates lines parameter", async () => {
  const mockExtras = {
    ide: { readRangeInFile: vi.fn() },
    config: { selectedModelByRole: { chat: { contextLength: 8192 } } },
  } as unknown as ToolExtras;

  // Test lines < 1
  await expect(
    readFileHeadImpl(
      {
        filepath: "test.txt",
        lines: 0,
      },
      mockExtras,
    ),
  ).rejects.toThrow("lines must be 1 or greater");

  await expect(
    readFileHeadImpl(
      {
        filepath: "test.txt",
        lines: -5,
      },
      mockExtras,
    ),
  ).rejects.toThrow("lines must be 1 or greater");
});

test("readFileHead handles file not found errors", async () => {
  const { resolveRelativePathInDir } = await import("../../util/ideUtils");

  vi.mocked(resolveRelativePathInDir).mockResolvedValue(undefined);

  const mockExtras = {
    ide: { readFile: vi.fn(), readRangeInFile: vi.fn() },
    config: { selectedModelByRole: { chat: { contextLength: 8192 } } },
  } as unknown as ToolExtras;

  // Test readFileHead with non-existent file
  await expect(
    readFileHeadImpl(
      {
        filepath: "nonexistent.txt",
        lines: 5,
      },
      mockExtras,
    ),
  ).rejects.toThrow('File "nonexistent.txt" does not exist');
});
