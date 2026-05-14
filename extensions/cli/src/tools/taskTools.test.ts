import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("task tools", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-task-tools-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "task-tools-session";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates, lists, gets, updates, outputs, and stops tasks", async () => {
    const { taskCreateTool } = await import("./taskCreate.js");
    const { taskListTool } = await import("./taskList.js");
    const { taskGetTool } = await import("./taskGet.js");
    const { taskUpdateTool } = await import("./taskUpdate.js");
    const { taskOutputTool } = await import("./taskOutput.js");
    const { taskStopTool } = await import("./taskStop.js");

    const created = await taskCreateTool.run({
      subject: "  Implement task tools  ",
      description: "  Create structured task CRUD for the CLI  ",
      active_form: "  Implementing task tools  ",
      owner: "  agent-main  ",
    });

    expect(created).toContain("Created task:");
    expect(created).toContain(
      "#1 [pending] Implement task tools owner=agent-main",
    );
    expect(created).toContain(
      "Description: Create structured task CRUD for the CLI",
    );
    expect(created).toContain("Active: Implementing task tools");

    const listed = await taskListTool.run({});
    expect(listed).toContain("Tracked tasks (1):");
    expect(listed).toContain(
      "#1 [pending] Implement task tools owner=agent-main",
    );

    const updated = await taskUpdateTool.run({
      task_id: "1",
      status: "in_progress",
      add_blocks: ["2", " 3 "],
      add_blocked_by: [" 0 "],
      append_output: "  Started implementation  ",
    });

    expect(updated).toContain("Updated task:");
    expect(updated).toContain(
      "#1 [in_progress] Implement task tools owner=agent-main blocks=[2, 3] blockedBy=[0]",
    );
    expect(updated).toContain("Blocks: 2, 3");
    expect(updated).toContain("Blocked by: 0");
    expect(updated).toContain("- Started implementation");

    const fetched = await taskGetTool.run({ task_id: "1" });
    expect(fetched).toContain(
      "Description: Create structured task CRUD for the CLI",
    );
    expect(fetched).toContain("Output:");

    const output = await taskOutputTool.run({ task_id: "1" });
    expect(output).toBe("Task #1 output:\nStarted implementation");

    const stopped = await taskStopTool.run({
      task_id: "1",
      reason: "waiting for verification",
    });
    expect(stopped).toContain("Stopped task:");
    expect(stopped).toContain(
      "#1 [cancelled] Implement task tools owner=agent-main blocks=[2, 3] blockedBy=[0]",
    );
    expect(stopped).toContain("- Stopped: waiting for verification");
  });

  it("rejects invalid task updates and reports missing tasks", async () => {
    const { taskCreateTool } = await import("./taskCreate.js");
    const { taskUpdateTool } = await import("./taskUpdate.js");
    const { taskGetTool } = await import("./taskGet.js");

    await taskCreateTool.run({
      subject: "Track review",
      description: "Follow the review workflow",
    });

    await expect(
      taskUpdateTool.run({
        task_id: "1",
        status: "done" as any,
      }),
    ).rejects.toThrow("Invalid task status: done");

    expect(await taskGetTool.run({ task_id: "999" })).toBe(
      "Task #999 not found.",
    );
  });
});
