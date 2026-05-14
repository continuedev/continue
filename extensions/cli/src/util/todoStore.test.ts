import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("todoStore", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-todo-store-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "todo-store-session";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores active todos and clears terminal-only lists", async () => {
    const { getCurrentSession } = await import("../session.js");
    const { formatTodosAsChecklist, listTodos, replaceTodos } = await import(
      "./todoStore.js"
    );

    expect(getCurrentSession().sessionId).toBe("todo-store-session");

    const activeTodos = await replaceTodos([
      {
        id: "read",
        content: "Read current implementation",
        status: "completed",
        priority: "high",
      },
      {
        id: "edit",
        content: "Apply changes",
        status: "in_progress",
        priority: "high",
      },
    ]);

    expect(activeTodos).toHaveLength(2);
    expect(formatTodosAsChecklist(activeTodos)).toContain("Apply changes");
    expect(await listTodos()).toHaveLength(2);

    const clearedTodos = await replaceTodos([
      {
        id: "verify",
        content: "Run verification",
        status: "completed",
        priority: "medium",
      },
    ]);

    expect(clearedTodos).toEqual([]);
    expect(await listTodos()).toEqual([]);
  });
});
