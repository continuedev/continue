import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("sessionScopedStore", () => {
  let globalDir: string;

  beforeEach(async () => {
    globalDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "yuto-core-session-store-"),
    );
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  it("reads and writes JSON state under the global agent-state directory", async () => {
    const {
      getSessionScopedStatePath,
      loadSessionScopedJsonState,
      saveSessionScopedJsonState,
    } = await import("./sessionScopedStore");

    await saveSessionScopedJsonState("todos", "session-1", {
      todos: [{ id: "read", content: "Read file" }],
    });

    const filePath = await getSessionScopedStatePath("todos", "session-1");
    const loaded = await loadSessionScopedJsonState("todos", "session-1", {
      todos: [],
    });

    expect(filePath).toBe(
      path.join(globalDir, "agent-state", "todos", "session-1.json"),
    );
    expect(loaded).toEqual({
      todos: [{ id: "read", content: "Read file" }],
    });
  });

  it("deletes stored state cleanly", async () => {
    const {
      deleteSessionScopedJsonState,
      loadSessionScopedJsonState,
      saveSessionScopedJsonState,
    } = await import("./sessionScopedStore");

    await saveSessionScopedJsonState("todos", "session-2", {
      todos: [{ id: "verify", content: "Run tests" }],
    });
    await deleteSessionScopedJsonState("todos", "session-2");

    const loaded = await loadSessionScopedJsonState("todos", "session-2", {
      todos: [],
    });

    expect(loaded).toEqual({ todos: [] });
  });

  it("extracts a normalized tool session id from extras", async () => {
    const { getToolSessionId } = await import("./sessionScopedStore");

    expect(getToolSessionId({ sessionId: " tool-session " } as any)).toBe(
      "tool-session",
    );
    expect(getToolSessionId({} as any)).toBeNull();
  });
});
