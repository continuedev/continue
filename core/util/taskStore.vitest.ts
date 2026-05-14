import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("taskStore", () => {
  let globalDir: string;

  beforeEach(async () => {
    globalDir = await fs.mkdtemp(path.join(os.tmpdir(), "yuto-core-task-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  it("creates, updates, lists, and stops session-scoped tasks", async () => {
    const {
      createAgentTask,
      formatAgentTask,
      formatAgentTaskDetails,
      getAgentTask,
      listAgentTasks,
      stopAgentTask,
      updateAgentTask,
    } = await import("./taskStore");

    const created = await createAgentTask("task-session", {
      subject: "Implement task store",
      description: "Add a shared core task state layer",
      activeForm: "Implementing task store",
      owner: "agent-main",
      metadata: { area: "core" },
    });

    expect(formatAgentTask(created)).toBe(
      "#1 [pending] Implement task store owner=agent-main",
    );

    const updated = await updateAgentTask("task-session", "1", {
      status: "in_progress",
      addBlocks: ["2", " 3 "],
      addBlockedBy: ["0"],
      appendOutput: "Started implementation",
    });

    expect(updated).not.toBeNull();
    expect(formatAgentTask(updated!)).toBe(
      "#1 [in_progress] Implement task store owner=agent-main blocks=[2,  3 ] blockedBy=[0]",
    );
    expect(formatAgentTaskDetails(updated!)).toContain(
      "Description: Add a shared core task state layer",
    );
    expect(formatAgentTaskDetails(updated!)).toContain(
      "Output:\n- Started implementation",
    );

    const listed = await listAgentTasks("task-session");
    const fetched = await getAgentTask("task-session", "1");
    const stopped = await stopAgentTask(
      "task-session",
      "1",
      "waiting for verification",
    );

    expect(listed).toHaveLength(1);
    expect(fetched?.status).toBe("in_progress");
    expect(stopped?.status).toBe("cancelled");
    expect(stopped?.output.at(-1)).toBe("Stopped: waiting for verification");
  });

  it("isolates tasks per session and rejects missing session ids", async () => {
    const { createAgentTask, getAgentTask, listAgentTasks, updateAgentTask } =
      await import("./taskStore");

    await createAgentTask("session-a", {
      subject: "Task A",
      description: "Only in session A",
    });
    await createAgentTask("session-b", {
      subject: "Task B",
      description: "Only in session B",
    });

    expect(await listAgentTasks("session-a")).toHaveLength(1);
    expect(await listAgentTasks("session-b")).toHaveLength(1);
    expect(await getAgentTask("session-a", "1")).toMatchObject({
      subject: "Task A",
    });
    expect(
      await updateAgentTask("session-a", "999", { status: "failed" }),
    ).toBeNull();

    await expect(
      createAgentTask("   ", {
        subject: "Invalid",
        description: "Missing session",
      }),
    ).rejects.toThrow("A non-empty sessionId is required for task state.");
  });
});
