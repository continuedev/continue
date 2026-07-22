import { describe, expect, it, vi } from "vitest";
import { readCurrentlyOpenFileImpl } from "./readCurrentlyOpenFile";

vi.mock("../../indexing/ignore", () => ({
  throwIfFileIsSecurityConcern: vi.fn(),
}));

vi.mock("./readFileLimit", () => ({
  throwIfFileExceedsHalfOfContext: vi.fn(),
}));

const makeExtras = (
  path: string,
  contents: string,
  workspaceDirs: string[],
) => ({
  ide: {
    getCurrentFile: vi.fn().mockResolvedValue({ path, contents }),
    getWorkspaceDirs: vi.fn().mockResolvedValue(workspaceDirs),
  },
  config: {
    selectedModelByRole: { chat: { contextLength: 100_000 } },
  },
});

describe("readCurrentlyOpenFileImpl output format", () => {
  it("returns raw file content without a code fence", async () => {
    const extras = makeExtras(
      "file:///workspace/src/app.ts",
      'console.log("hello");',
      ["file:///workspace"],
    );
    const result = await readCurrentlyOpenFileImpl({}, extras as any);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('console.log("hello");');
    expect(result[0].content).not.toMatch(/^```/);
  });

  it("returns raw content for extension-less files (no code fence to trigger Run button)", async () => {
    const extras = makeExtras(
      "file:///workspace/Makefile",
      "build:\n\tmake all",
      ["file:///workspace"],
    );
    const result = await readCurrentlyOpenFileImpl({}, extras as any);
    expect(result[0].content).toBe("build:\n\tmake all");
    expect(result[0].content).not.toMatch(/^```/);
  });

  it("returns raw content for single-line files (no Run button risk)", async () => {
    const extras = makeExtras("file:///workspace/hello", "hello", [
      "file:///workspace",
    ]);
    const result = await readCurrentlyOpenFileImpl({}, extras as any);
    expect(result[0].content).toBe("hello");
    expect(result[0].content).not.toMatch(/^```/);
  });

  it("name and description still identify the file", async () => {
    const extras = makeExtras(
      "file:///workspace/src/app.ts",
      "export default {};",
      ["file:///workspace"],
    );
    const result = await readCurrentlyOpenFileImpl({}, extras as any);
    expect(result[0].name).toContain("app.ts");
    expect(result[0].description).toBeTruthy();
  });
});
