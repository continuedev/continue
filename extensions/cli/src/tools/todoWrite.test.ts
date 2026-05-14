import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("TodoWrite tool", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-todo-tool-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "todo-tool-session";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("normalizes todos in preprocess and persists them on run", async () => {
    const { todoWriteTool } = await import("./todoWrite.js");
    const { listTodos } = await import("../util/todoStore.js");

    const preprocess = await todoWriteTool.preprocess!({
      todos: [
        {
          id: " read ",
          content: " Review current implementation ",
          status: "in_progress",
          priority: "high",
        },
      ],
    });

    expect(preprocess.args.todos[0]).toEqual({
      id: "read",
      content: "Review current implementation",
      status: "in_progress",
      priority: "high",
    });
    expect(preprocess.preview?.[0].content).toContain(
      "Review current implementation",
    );

    const output = await todoWriteTool.run({
      todos: preprocess.args.todos,
    });

    expect(output).toContain("Review current implementation");
    expect(await listTodos()).toEqual(preprocess.args.todos);
  });

  it("rejects invalid todo payloads", async () => {
    const { todoWriteTool } = await import("./todoWrite.js");

    await expect(
      todoWriteTool.run({
        todos: [
          {
            id: "one",
            content: "Do one thing",
            status: "pending",
            priority: "high",
          },
          {
            id: "two",
            content: "Do another thing",
            status: "in_progress",
            priority: "medium",
          },
          {
            id: "three",
            content: "Do a third thing",
            status: "in_progress",
            priority: "low",
          },
        ],
      }),
    ).rejects.toThrow("Only one todo item can be in_progress at a time");

    await expect(
      todoWriteTool.run({
        todos: [
          {
            id: "bad",
            content: "Review output",
            status: "done" as any,
            priority: "high",
          },
        ],
      }),
    ).rejects.toThrow("Invalid todo status: done");

    await expect(
      todoWriteTool.run({
        todos: [
          {
            id: "bad-priority",
            content: "Review output",
            status: "pending",
            priority: "urgent" as any,
          },
        ],
      }),
    ).rejects.toThrow("Invalid todo priority: urgent");
  });
});
