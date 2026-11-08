import type { IDE } from "core";
import { reminderFileStamp } from "core/util/loopReminders";
import { describe, expect, it } from "vitest";
import { stampLoopFiles } from "./loopReminderFiles";

const WORKSPACE = "file:///repo";

function ideWith(files: Record<string, string>, mtime = 1) {
  return {
    getWorkspaceDirs: async () => [WORKSPACE],
    fileExists: async (uri: string) => uri in files,
    readFile: async (uri: string) => files[uri] ?? "",
    getFileStats: async (uris: string[]) =>
      Object.fromEntries(
        uris.map((uri) => [
          uri,
          { size: files[uri].length, lastModified: mtime },
        ]),
      ),
  } as unknown as IDE;
}

const stamp = async (ide: IDE, file: string) =>
  (await stampLoopFiles(ide, [file]))[file];

describe("stampLoopFiles", () => {
  it("stamps a relative path through the workspace", async () => {
    const ide = ideWith({ "file:///repo/a.ts": "one" });
    expect(await stamp(ide, "a.ts")).toBe(reminderFileStamp("one"));
  });

  it("stamps an absolute path or URI, so a change to it can be seen", async () => {
    const ide = ideWith({
      "file:///home/me/a.ts": "one",
      "file:///D:/repo/a.ts": "two",
    });
    expect(await stamp(ide, "/home/me/a.ts")).toBe(reminderFileStamp("one"));
    expect(await stamp(ide, "file:///home/me/a.ts")).toBe(
      reminderFileStamp("one"),
    );
    expect(await stamp(ide, "D:\\repo\\a.ts")).toBe(reminderFileStamp("two"));
  });

  it("gives a missing file the absent stamp", async () => {
    const ide = ideWith({});
    expect(await stamp(ide, "a.ts")).toBe(reminderFileStamp(undefined));
    expect(await stamp(ide, "/x/a.ts")).toBe(reminderFileStamp(undefined));
  });

  it("does not trust a read that may be partial", async () => {
    const big = "x".repeat(100_000);
    const uri = "file:///repo/big.ts";
    const first = await stamp(ideWith({ [uri]: big }, 1), "big.ts");
    expect(first).toBe("stat:100000:1");
    // The same file seen through a different read length is the same stamp
    expect(await stamp(ideWith({ [uri]: big }, 1), "big.ts")).toBe(first);
    expect(await stamp(ideWith({ [uri]: big }, 2), "big.ts")).not.toBe(first);
  });
});
