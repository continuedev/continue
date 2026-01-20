import { expect, test, vi } from "vitest";
import { ToolExtras } from "../..";
import * as walkDirModule from "../../indexing/walkDir";
import { lsToolImpl, resolveLsToolDirPath } from "./lsTool";

vi.mock("../../indexing/walkDir");

const mockExtras = {
  ide: {
    fileExists: async (path: string) => true,
    getWorkspaceDirs: async () => ["dir1"],
  },
} as unknown as ToolExtras;

test("resolveLsToolDirPath handles undefined path", () => {
  expect(resolveLsToolDirPath(undefined)).toBe(".");
});

test("resolveLsToolDirPath handles empty string", () => {
  expect(resolveLsToolDirPath("")).toBe(".");
});

test("resolveLsToolDirPath handles dot", () => {
  expect(resolveLsToolDirPath(".")).toBe(".");
});

test("resolveLsToolDirPath handles dot relative", () => {
  expect(resolveLsToolDirPath("./hi")).toBe("./hi");
});

test("resolveLsToolDirPath normalizes backslashes to forward slashes", () => {
  expect(resolveLsToolDirPath("path\\to\\dir")).toBe("path/to/dir");
});

test("resolveLsToolDirPath preserves forward slashes", () => {
  expect(resolveLsToolDirPath("path/to/dir")).toBe("path/to/dir");
});

test("lsToolImpl truncates output when entries exceed MAX_LS_TOOL_LINES", async () => {
  // Generate more than MAX_LS_TOOL_LINES entries (which is 200)
  const mockEntries = Array.from({ length: 250 }, (_, i) => `file${i}.txt`);

  // Mock walkDir to return our large array
  vi.spyOn(walkDirModule, "walkDir").mockResolvedValue(mockEntries);

  const result = await lsToolImpl(
    { dirPath: "testDir", recursive: true },
    mockExtras,
  );

  // Check that the result contains the truncation message
  expect(result.length).toBe(2);
  expect(result[0].content).toContain("file1.txt");
  expect(result[0].content).toContain("file199.txt");
  expect(result[1].content).toContain("Try using a non-recursive search");
  expect(result[1].content).toContain("50 ls entries were truncated");

  // Check that only MAX_LS_TOOL_LINES entries are included
  const contentLines = result[0].content.split("\n");
  // Account for the truncation message line
  expect(contentLines.length).toBe(200);

  // Check the suggestion to use non-recursive search is included
  expect(result[1].content).toContain("Try using a non-recursive search");
});

test("lsToolImpl shows truncation message without suggestion for non-recursive search", async () => {
  // Generate more than MAX_LS_TOOL_LINES entries
  const mockEntries = Array.from({ length: 250 }, (_, i) => `file${i}.txt`);

  // Mock walkDir to return our large array
  vi.spyOn(walkDirModule, "walkDir").mockResolvedValue(mockEntries);

  const result = await lsToolImpl(
    { dirPath: "testDir", recursive: false },
    mockExtras,
  );

  // Check that the result contains the truncation message
  expect(result.length).toBe(2);
  expect(result[1].content).toContain("50 ls entries were truncated");

  // Check that the suggestion to use non-recursive search is NOT included
  expect(result[1].content).not.toContain("Try using a non-recursive search");
});

test("lsToolImpl shows message when no files are found", async () => {
  // Mock walkDir to return empty array
  vi.spyOn(walkDirModule, "walkDir").mockResolvedValue([]);

  const result = await lsToolImpl({ dirPath: "emptyDir" }, mockExtras);

  // Check that the result contains the "no files found" message
  expect(result.length).toBe(1);
  expect(result[0].content).toBe("No files/folders found in emptyDir");
});
