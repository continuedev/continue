import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("task tools", () => {
  let globalDir: string;

  beforeEach(async () => {
    globalDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "yuto-core-task-tools-"),
    );
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  it("creates, lists, gets, updates, outputs, and stops tasks", async () => {
    const {
      taskCreateImpl,
      taskGetImpl,
      taskListImpl,
      taskOutputImpl,
      taskStopImpl,
      taskUpdateImpl,
    } = await import("./taskTools");

    const extras = { sessionId: "task-tools-session" } as any;

    const created = await taskCreateImpl(
      {
        subject: "  Implement core task tools  ",
        description: "  Expose shared task tracking in core  ",
        active_form: "  Implementing core task tools  ",
        owner: "  agent-main  ",
      },
      extras,
    );

    expect(created[0]?.content).toContain("Created task:");
    expect(created[0]?.content).toContain(
      "#1 [pending] Implement core task tools owner=agent-main",
    );
    expect(created[0]?.content).toContain(
      "Description: Expose shared task tracking in core",
    );
    expect(created[0]?.content).toContain(
      "Active: Implementing core task tools",
    );

    const listed = await taskListImpl({}, extras);
    expect(listed[0]?.content).toContain("Tracked tasks (1):");
    expect(listed[0]?.content).toContain(
      "#1 [pending] Implement core task tools owner=agent-main",
    );

    const updated = await taskUpdateImpl(
      {
        task_id: "1",
        status: "in_progress",
        add_blocks: ["2", " 3 "],
        add_blocked_by: [" 0 "],
        append_output: "  Started implementation  ",
      },
      extras,
    );
    expect(updated[0]?.content).toContain("Updated task:");
    expect(updated[0]?.content).toContain(
      "#1 [in_progress] Implement core task tools owner=agent-main blocks=[2, 3] blockedBy=[0]",
    );
    expect(updated[0]?.content).toContain("Blocks: 2, 3");
    expect(updated[0]?.content).toContain("Blocked by: 0");
    expect(updated[0]?.content).toContain("- Started implementation");

    const fetched = await taskGetImpl({ task_id: "1" }, extras);
    expect(fetched[0]?.content).toContain(
      "Description: Expose shared task tracking in core",
    );
    expect(fetched[0]?.content).toContain("Output:");

    const output = await taskOutputImpl({ task_id: "1" }, extras);
    expect(output[0]?.content).toBe("Task #1 output:\nStarted implementation");

    const stopped = await taskStopImpl(
      { task_id: "1", reason: "waiting for verification" },
      extras,
    );
    expect(stopped[0]?.content).toContain("Stopped task:");
    expect(stopped[0]?.content).toContain(
      "#1 [cancelled] Implement core task tools owner=agent-main blocks=[2, 3] blockedBy=[0]",
    );
    expect(stopped[0]?.content).toContain(
      "- Stopped: waiting for verification",
    );
  });

  it("requires an active session and rejects invalid task updates", async () => {
    const { taskCreateImpl, taskGetImpl, taskUpdateImpl } = await import(
      "./taskTools"
    );

    await expect(
      taskCreateImpl(
        {
          subject: "No session",
          description: "Should fail",
        },
        {} as any,
      ),
    ).rejects.toThrow("Task tools require an active session.");

    await taskCreateImpl(
      {
        subject: "Track review",
        description: "Follow the review workflow",
      },
      { sessionId: "task-tools-session" } as any,
    );

    await expect(
      taskUpdateImpl(
        {
          task_id: "1",
          status: "done",
        },
        { sessionId: "task-tools-session" } as any,
      ),
    ).rejects.toThrow("Invalid task status: done");

    const missing = await taskGetImpl({ task_id: "999" }, {
      sessionId: "task-tools-session",
    } as any);
    expect(missing[0]?.content).toBe("Task #999 not found.");
  });
});
