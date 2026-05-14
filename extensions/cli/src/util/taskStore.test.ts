import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("taskStore", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-task-store-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "task-store-session";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates, updates, and stops tracked tasks", async () => {
    const { getCurrentSession } = await import("../session.js");
    const {
      createAgentTask,
      getAgentTask,
      listAgentTasks,
      stopAgentTask,
      updateAgentTask,
    } = await import("./taskStore.js");

    expect(getCurrentSession().sessionId).toBe("task-store-session");

    const task = await createAgentTask({
      subject: "Implement task tools",
      description: "Create structured task CRUD for the CLI",
      owner: "agent-main",
    });

    expect(task.id).toBe("1");
    expect(task.status).toBe("pending");

    const updated = await updateAgentTask(task.id, {
      status: "in_progress",
      appendOutput: "Started implementation",
      addBlockedBy: ["0"],
    });

    expect(updated?.status).toBe("in_progress");
    expect(updated?.output).toEqual(["Started implementation"]);
    expect(updated?.blockedBy).toEqual(["0"]);

    const stopped = await stopAgentTask(task.id, "waiting for verification");
    expect(stopped?.status).toBe("cancelled");
    expect(stopped?.output.at(-1)).toContain("waiting for verification");

    const fetched = await getAgentTask(task.id);
    expect(fetched?.status).toBe("cancelled");

    const listed = await listAgentTasks();
    expect(listed).toHaveLength(1);
    expect(listed[0].subject).toBe("Implement task tools");
  });
});
