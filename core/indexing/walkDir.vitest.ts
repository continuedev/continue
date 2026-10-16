import { afterEach, describe, expect, it } from "vitest";
import { IDE } from "..";
import { walkDir, walkDirCache, walkDirs } from "./walkDir";

describe("walkDir error resilience", () => {
  afterEach(() => {
    walkDirCache.invalidate();
  });

  it("skips subdirectories where listDir throws and evicts failed cache entries", async () => {
    const mockIde = {
      getWorkspaceDirs: async () => ["adt://workspace"],
      listDir: async (uri: string) => {
        if (uri === "adt://workspace") {
          return [
            ["ENHC/XF ZEH_FBRA", 2],
            ["src", 2],
            ["root.ts", 1],
          ];
        }
        if (uri === "adt://workspace/ENHC/XF ZEH_FBRA") {
          throw new Error(
            "Operation not supported for object ENHC/XF ZEH_FBRA",
          );
        }
        if (uri === "adt://workspace/src") {
          return [["rules.md", 1]];
        }
        return [];
      },
      readFile: async () => "",
      fileExists: async () => false,
    } as unknown as IDE;

    const files = await walkDir("adt://workspace", mockIde, {
      returnRelativeUrisPaths: true,
    });

    expect(files.sort()).toEqual(["root.ts", "src/rules.md"].sort());
    expect(
      walkDirCache.dirListCache.has("adt://workspace/ENHC/XF ZEH_FBRA"),
    ).toBe(false);
  });

  it("returns empty array when root directory listDir throws", async () => {
    const mockIde = {
      getWorkspaceDirs: async () => ["adt://unsupported"],
      listDir: async () => {
        throw new Error("Operation not supported");
      },
      readFile: async () => "",
      fileExists: async () => false,
    } as unknown as IDE;

    const files = await walkDir("adt://unsupported", mockIde);
    expect(files).toEqual([]);
    expect(walkDirCache.dirListCache.has("adt://unsupported")).toBe(false);
  });

  it("recovers on subsequent walk after transient listDir failure", async () => {
    let shouldFail = true;
    const mockIde = {
      getWorkspaceDirs: async () => ["file:///workspace"],
      listDir: async (uri: string) => {
        if (uri === "file:///workspace") {
          return [["pkg", 2]];
        }
        if (uri === "file:///workspace/pkg") {
          if (shouldFail) {
            throw new Error("Transient EBUSY");
          }
          return [["index.ts", 1]];
        }
        return [];
      },
      readFile: async () => "",
      fileExists: async () => false,
    } as unknown as IDE;

    const firstWalk = await walkDirs(mockIde);
    expect(firstWalk).toEqual([]);

    shouldFail = false;
    const secondWalk = await walkDirs(mockIde);
    expect(secondWalk).toEqual(["file:///workspace/pkg/index.ts"]);
  });
});
