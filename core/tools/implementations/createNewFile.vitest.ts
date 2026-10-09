import { describe, expect, it, vi } from "vitest";

vi.mock("../../util/ideUtils", () => ({
  inferResolvedUriFromRelativePath: async (path: string) =>
    `file:///workspace/${path}`,
}));

import { createNewFileImpl } from "./createNewFile";

function fakeExtras() {
  const written: Record<string, string> = {};
  const ide = {
    fileExists: async () => false,
    writeFile: async (uri: string, contents: string) => {
      written[uri] = contents;
    },
    openFile: async () => {},
    saveFile: async () => {},
  };
  return { written, extras: { ide } as any };
}

describe("createNewFileImpl", () => {
  it("writes a JSON value sent as contents as indented JSON", async () => {
    const { written, extras } = fakeExtras();
    await createNewFileImpl(
      {
        filepath: "app/package.json",
        contents: { name: "app", private: true },
      },
      extras,
    );
    expect(written["file:///workspace/app/package.json"]).toBe(
      '{\n  "name": "app",\n  "private": true\n}',
    );
  });

  it("writes string contents unchanged", async () => {
    const { written, extras } = fakeExtras();
    await createNewFileImpl(
      { filepath: "src/a.ts", contents: "export const a = 1;\n" },
      extras,
    );
    expect(written["file:///workspace/src/a.ts"]).toBe("export const a = 1;\n");
  });
});
