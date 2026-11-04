import { describe, expect, it } from "vitest";
import type { IDE, TurnCheckpoint } from "..";
import { BuiltInToolNames } from "../tools/builtIn";
import {
  addFileSnapshot,
  applyRestore,
  hasCheckpointsFrom,
  MAX_CHECKPOINT_FILE_BYTES,
  planRestore,
  previewRestore,
  pruneCheckpointsFrom,
  resolveCheckpointTargets,
  snapshotFile,
} from "./checkpoints";

const WS = "file:///ws";

/** Minimal in-memory IDE: just the file operations checkpoints rely on. */
function makeIde(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const ide = {
    files,
    getWorkspaceDirs: async () => [WS],
    getOpenFiles: async () => [] as string[],
    getCurrentFile: async () => undefined,
    fileExists: async (u: string) => files.has(u),
    readFile: async (u: string) => {
      const c = files.get(u);
      if (c === undefined) {
        throw new Error("ENOENT");
      }
      return c;
    },
    writeFile: async (u: string, c: string) => {
      files.set(u, c);
    },
    removeFile: async (u: string) => {
      files.delete(u);
    },
    getFileStats: async (uris: string[]) =>
      Object.fromEntries(
        uris
          .filter((u) => files.has(u))
          .map((u) => [u, { size: files.get(u)!.length, lastModified: 0 }]),
      ),
  };
  return ide as typeof ide & IDE;
}

/** What the agent does in one turn: snapshot, then change the file. */
async function agentEdit(
  ide: ReturnType<typeof makeIde>,
  cps: TurnCheckpoint[],
  turnId: string,
  tool: string,
  filepath: string,
  newContent: string | null,
) {
  const [uri] = await resolveCheckpointTargets(tool, { filepath }, ide);
  cps = addFileSnapshot(cps, turnId, await snapshotFile(ide, uri));
  if (newContent === null) {
    await ide.removeFile(uri);
  } else {
    await ide.writeFile(uri, newContent);
  }
  return cps;
}

async function restoreTo(
  ide: ReturnType<typeof makeIde>,
  cps: TurnCheckpoint[],
  order: string[],
  turnId: string,
) {
  const items = await previewRestore(ide, planRestore(cps, order, turnId));
  const result = await applyRestore(ide, items);
  return { items, result };
}

describe("resolveCheckpointTargets", () => {
  it("resolves edit tools to existing files and strips ./", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "x" });
    expect(
      await resolveCheckpointTargets(
        BuiltInToolNames.EditExistingFile,
        { filepath: "./a.ts" },
        ide,
      ),
    ).toEqual([`${WS}/a.ts`]);
  });

  it("resolves create_new_file to a path that does not exist yet", async () => {
    const ide = makeIde();
    expect(
      await resolveCheckpointTargets(
        BuiltInToolNames.CreateNewFile,
        { filepath: "src/new.ts" },
        ide,
      ),
    ).toEqual([`${WS}/src/new.ts`]);
  });

  it("ignores other tools and bad args", async () => {
    const ide = makeIde();
    expect(
      await resolveCheckpointTargets(
        "run_terminal_command",
        { command: "rm" },
        ide,
      ),
    ).toEqual([]);
    expect(
      await resolveCheckpointTargets(BuiltInToolNames.MultiEdit, {}, ide),
    ).toEqual([]);
    expect(
      await resolveCheckpointTargets(
        BuiltInToolNames.MultiEdit,
        { filepath: "missing.ts" },
        ide,
      ),
    ).toEqual([]);
  });
});

describe("snapshotFile", () => {
  it("records existing, missing, and oversized files", async () => {
    const ide = makeIde({
      [`${WS}/a.ts`]: "hello",
      [`${WS}/big.ts`]: "x".repeat(MAX_CHECKPOINT_FILE_BYTES),
    });
    expect(await snapshotFile(ide, `${WS}/a.ts`)).toEqual({
      uri: `${WS}/a.ts`,
      existed: true,
      content: "hello",
    });
    expect(await snapshotFile(ide, `${WS}/none.ts`)).toEqual({
      uri: `${WS}/none.ts`,
      existed: false,
    });
    expect(await snapshotFile(ide, `${WS}/big.ts`)).toEqual({
      uri: `${WS}/big.ts`,
      existed: true,
      skipped: "too_large",
    });
  });

  it("does not throw when the IDE fails", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "x" });
    ide.readFile = async () => {
      throw new Error("boom");
    };
    expect((await snapshotFile(ide, `${WS}/a.ts`)).skipped).toBe("unreadable");
  });
});

describe("addFileSnapshot", () => {
  it("keeps only the first snapshot of a file within a turn", () => {
    let cps = addFileSnapshot([], "t1", {
      uri: "u",
      existed: true,
      content: "v0",
    });
    cps = addFileSnapshot(cps, "t1", {
      uri: "u",
      existed: true,
      content: "v1",
    });
    expect(cps).toHaveLength(1);
    expect(cps[0].files).toEqual([{ uri: "u", existed: true, content: "v0" }]);
  });

  it("evicts the oldest contents past the cap and marks them", () => {
    let cps = addFileSnapshot(
      [],
      "t1",
      { uri: "a", existed: true, content: "aaaa" },
      1,
      6,
    );
    cps = addFileSnapshot(
      cps,
      "t2",
      { uri: "b", existed: true, content: "bbbb" },
      2,
      6,
    );
    expect(cps[0].files[0]).toEqual({
      uri: "a",
      existed: true,
      skipped: "evicted",
    });
    expect(cps[1].files[0].content).toBe("bbbb");
  });
});

describe("restore", () => {
  it("restores an edited file", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "v0" });
    const cps = await agentEdit(
      ide,
      [],
      "t1",
      BuiltInToolNames.EditExistingFile,
      "a.ts",
      "v1",
    );
    const { items, result } = await restoreTo(ide, cps, ["t1"], "t1");
    expect(items.map((i) => i.action)).toEqual(["restore"]);
    expect(result.restored).toEqual([`${WS}/a.ts`]);
    expect(ide.files.get(`${WS}/a.ts`)).toBe("v0");
  });

  it("deletes a file the agent created", async () => {
    const ide = makeIde();
    const cps = await agentEdit(
      ide,
      [],
      "t1",
      BuiltInToolNames.CreateNewFile,
      "new.ts",
      "hi",
    );
    expect(ide.files.has(`${WS}/new.ts`)).toBe(true);
    const { items, result } = await restoreTo(ide, cps, ["t1"], "t1");
    expect(items.map((i) => i.action)).toEqual(["delete"]);
    expect(result.deleted).toEqual([`${WS}/new.ts`]);
    expect(ide.files.has(`${WS}/new.ts`)).toBe(false);
  });

  it("recreates a file that was deleted after the checkpoint", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "v0" });
    const cps = await agentEdit(
      ide,
      [],
      "t1",
      BuiltInToolNames.SingleFindAndReplace,
      "a.ts",
      null,
    );
    expect(ide.files.has(`${WS}/a.ts`)).toBe(false);
    const { items } = await restoreTo(ide, cps, ["t1"], "t1");
    expect(items.map((i) => i.action)).toEqual(["recreate"]);
    expect(ide.files.get(`${WS}/a.ts`)).toBe("v0");
  });

  it("skips files that are already in the snapshot state", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "v0" });
    const cps = await agentEdit(
      ide,
      [],
      "t1",
      BuiltInToolNames.MultiEdit,
      "a.ts",
      "v1",
    );
    ide.files.set(`${WS}/a.ts`, "v0"); // user already reverted by hand
    const { items } = await restoreTo(ide, cps, ["t1"], "t1");
    expect(items).toEqual([]);
  });

  it("rewinds across multiple turns to the state before the chosen turn", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "a0", [`${WS}/b.ts`]: "b0" });
    const order = ["t1", "t2", "t3"];
    let cps: TurnCheckpoint[] = [];
    cps = await agentEdit(
      ide,
      cps,
      "t1",
      BuiltInToolNames.EditExistingFile,
      "a.ts",
      "a1",
    );
    cps = await agentEdit(
      ide,
      cps,
      "t2",
      BuiltInToolNames.EditExistingFile,
      "a.ts",
      "a2",
    );
    cps = await agentEdit(
      ide,
      cps,
      "t2",
      BuiltInToolNames.CreateNewFile,
      "c.ts",
      "c1",
    );
    cps = await agentEdit(
      ide,
      cps,
      "t3",
      BuiltInToolNames.EditExistingFile,
      "b.ts",
      "b1",
    );
    cps = await agentEdit(
      ide,
      cps,
      "t3",
      BuiltInToolNames.EditExistingFile,
      "a.ts",
      "a3",
    );

    // Back to before turn 2: a returns to its post-turn-1 state, c is removed,
    // b returns to its original state
    await restoreTo(ide, cps, order, "t2");
    expect(ide.files.get(`${WS}/a.ts`)).toBe("a1");
    expect(ide.files.get(`${WS}/b.ts`)).toBe("b0");
    expect(ide.files.has(`${WS}/c.ts`)).toBe(false);

    // Then back to before turn 1, using the checkpoints that remain
    const kept = pruneCheckpointsFrom(cps, order, "t2");
    expect(kept.map((c) => c.turnId)).toEqual(["t1"]);
    await restoreTo(ide, kept, order, "t1");
    expect(ide.files.get(`${WS}/a.ts`)).toBe("a0");
  });

  it("restores from a turn with no edits of its own using later turns", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "a0" });
    const order = ["t1", "t2"];
    const cps = await agentEdit(
      ide,
      [],
      "t2",
      BuiltInToolNames.EditExistingFile,
      "a.ts",
      "a1",
    );
    expect(hasCheckpointsFrom(cps, order, "t1")).toBe(true);
    expect(hasCheckpointsFrom(cps, order, "t2")).toBe(true);
    await restoreTo(ide, cps, order, "t1");
    expect(ide.files.get(`${WS}/a.ts`)).toBe("a0");
  });

  it("reports nothing to do for turns after the last edit or unknown turns", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "a0" });
    const order = ["t1", "t2"];
    const cps = await agentEdit(
      ide,
      [],
      "t1",
      BuiltInToolNames.EditExistingFile,
      "a.ts",
      "a1",
    );
    expect(hasCheckpointsFrom(cps, order, "t2")).toBe(false);
    expect(planRestore(cps, order, "t2")).toEqual([]);
    expect(planRestore(cps, order, "nope")).toEqual([]);
  });

  it("flags files whose contents were not stored and leaves them alone", async () => {
    const ide = makeIde({
      [`${WS}/big.ts`]: "x".repeat(MAX_CHECKPOINT_FILE_BYTES),
    });
    const cps = await agentEdit(
      ide,
      [],
      "t1",
      BuiltInToolNames.EditExistingFile,
      "big.ts",
      "small",
    );
    const { items, result } = await restoreTo(ide, cps, ["t1"], "t1");
    expect(items.map((i) => i.action)).toEqual(["unrestorable"]);
    expect(result.restored).toEqual([]);
    expect(ide.files.get(`${WS}/big.ts`)).toBe("small");
  });

  it("collects write failures instead of throwing", async () => {
    const ide = makeIde({ [`${WS}/a.ts`]: "v0" });
    const cps = await agentEdit(
      ide,
      [],
      "t1",
      BuiltInToolNames.EditExistingFile,
      "a.ts",
      "v1",
    );
    ide.writeFile = async () => {
      throw new Error("read-only");
    };
    const { result } = await restoreTo(ide, cps, ["t1"], "t1");
    expect(result.failed).toEqual([{ uri: `${WS}/a.ts`, error: "read-only" }]);
  });
});
