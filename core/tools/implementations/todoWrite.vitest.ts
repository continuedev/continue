import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("todoWriteImpl", () => {
  let globalDir: string;

  beforeEach(async () => {
    globalDir = await fs.mkdtemp(path.join(os.tmpdir(), "yuto-core-todo-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  it("normalizes todo ids and content and formats a checklist", async () => {
    const { todoWriteImpl } = await import("./todoWrite");
    const { loadSessionScopedJsonState } = await import(
      "../../util/sessionScopedStore"
    );

    const result = await todoWriteImpl(
      {
        todos: [
          {
            id: " read-file ",
            content: " Review the current implementation ",
            status: "in_progress",
            priority: "high",
          },
          {
            id: "verify",
            content: "Run verification",
            status: "pending",
            priority: "medium",
          },
        ],
      },
      { sessionId: "todo-session" } as any,
    );

    const persisted = await loadSessionScopedJsonState(
      "todos",
      "todo-session",
      { todos: [] },
    );

    expect(result).toEqual([
      {
        name: "Todo List",
        description: "Updated todo list",
        content:
          "- [ ] Review the current implementation (in_progress, high)\n- [ ] Run verification (pending, medium)",
      },
    ]);
    expect(persisted).toEqual({
      todos: [
        {
          id: "read-file",
          content: "Review the current implementation",
          status: "in_progress",
          priority: "high",
        },
        {
          id: "verify",
          content: "Run verification",
          status: "pending",
          priority: "medium",
        },
      ],
    });
  });

  it("clears persisted state when all todos are terminal", async () => {
    const { todoWriteImpl } = await import("./todoWrite");
    const { loadSessionScopedJsonState } = await import(
      "../../util/sessionScopedStore"
    );

    await todoWriteImpl(
      {
        todos: [
          {
            id: "active",
            content: "Work item",
            status: "in_progress",
            priority: "high",
          },
        ],
      },
      { sessionId: "todo-session" } as any,
    );

    const result = await todoWriteImpl(
      {
        todos: [
          {
            id: "done",
            content: "Completed work",
            status: "completed",
            priority: "low",
          },
        ],
      },
      { sessionId: "todo-session" } as any,
    );

    const persisted = await loadSessionScopedJsonState(
      "todos",
      "todo-session",
      { todos: [] },
    );

    expect(result[0]?.content).toBe("- [x] Completed work (completed, low)");
    expect(persisted).toEqual({ todos: [] });
  });

  it("returns an empty checklist for an empty todo list", async () => {
    const { todoWriteImpl } = await import("./todoWrite");

    const result = await todoWriteImpl({ todos: [] }, {} as any);

    expect(result[0]?.content).toBe("(empty todo list)");
  });

  it("rejects invalid todo payloads", async () => {
    const { todoWriteImpl } = await import("./todoWrite");

    await expect(
      todoWriteImpl(
        {
          todos: [
            {
              id: "one",
              content: "First task",
              status: "in_progress",
              priority: "high",
            },
            {
              id: "two",
              content: "Second task",
              status: "in_progress",
              priority: "medium",
            },
          ],
        },
        {} as any,
      ),
    ).rejects.toThrow("Only one todo item can be in_progress at a time.");

    await expect(
      todoWriteImpl(
        {
          todos: [
            {
              id: "bad-status",
              content: "Task",
              status: "done",
              priority: "high",
            },
          ],
        },
        {} as any,
      ),
    ).rejects.toThrow("Invalid todo status: done");

    await expect(
      todoWriteImpl(
        {
          todos: [
            {
              id: "bad-priority",
              content: "Task",
              status: "pending",
              priority: "urgent",
            },
          ],
        },
        {} as any,
      ),
    ).rejects.toThrow("Invalid todo priority: urgent");

    await expect(
      todoWriteImpl(
        {
          todos: [
            {
              id: "   ",
              content: "Task",
              status: "pending",
              priority: "high",
            },
          ],
        },
        {} as any,
      ),
    ).rejects.toThrow("Todo id cannot be empty.");
  });
});
