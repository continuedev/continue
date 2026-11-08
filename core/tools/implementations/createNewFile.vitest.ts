import { describe, expect, test, vi } from "vitest";
import { createNewFileImpl } from "./createNewFile";

vi.mock("../../util/ideUtils", () => ({
  inferResolvedUriFromRelativePath: async (path: string) => `file:///w/${path}`,
}));

function extrasWith(files: Record<string, string>) {
  const ide = {
    fileExists: async (uri: string) => uri in files,
    readFile: async (uri: string) => files[uri],
    writeFile: async (uri: string, contents: string) => {
      files[uri] = contents;
    },
    openFile: async () => {},
    saveFile: async () => {},
  };
  return { ide } as any;
}

const URI = "file:///w/report.md";

describe("create_new_file", () => {
  test("creates a file", async () => {
    const files: Record<string, string> = {};
    await createNewFileImpl(
      { filepath: "report.md", contents: "one\n" },
      extrasWith(files),
    );
    expect(files[URI]).toBe("one\n");
  });

  test("refuses a file that exists, without append", async () => {
    const files = { [URI]: "kept" };
    await expect(
      createNewFileImpl(
        { filepath: "report.md", contents: "x" },
        extrasWith(files),
      ),
    ).rejects.toThrow("already exists");
    expect(files[URI]).toBe("kept");
  });

  test("append adds to the end of the file", async () => {
    const files = { [URI]: "one\n" };
    const result = await createNewFileImpl(
      { filepath: "report.md", contents: "two\n", append: true },
      extrasWith(files),
    );
    expect(files[URI]).toBe("one\ntwo\n");
    expect(result[0].content).toBe("Added to the file");
  });

  test("append needs the file to exist", async () => {
    const files: Record<string, string> = {};
    await expect(
      createNewFileImpl(
        { filepath: "report.md", contents: "x", append: true },
        extrasWith(files),
      ),
    ).rejects.toThrow("does not exist yet");
    expect(files[URI]).toBeUndefined();
  });
});
