import { EventEmitter } from "events";
import fs from "fs";
import os from "os";
import path from "path";

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

const execFileMock = vi.fn();
const forkMock = vi.fn();
const createJobWithProcess = vi.fn();
const cancelJob = vi.fn();

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    execFile: execFileMock,
    fork: forkMock,
  };
});

vi.mock("../services/BackgroundJobService.js", () => ({
  backgroundJobService: {
    createJobWithProcess,
    cancelJob,
  },
}));

describe("swarm spawn", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-swarm-spawn-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "swarm-spawn-session";
    vi.resetModules();
    execFileMock.mockReset();
    forkMock.mockReset();
    createJobWithProcess.mockReset();
    cancelJob.mockReset();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("spawns a background process worker and records it in the team", async () => {
    const child = new MockChildProcess();
    forkMock.mockReturnValue(child);
    createJobWithProcess.mockReturnValue({ id: "bg-1" });

    const { createSwarmTeam, readSwarmTeam } = await import("./teamRuntime.js");
    const { readUnreadMailboxMessages } = await import("./mailbox.js");
    const { spawnSwarmTeammate } = await import("./spawn.js");

    await createSwarmTeam({ teamName: "Refactor Squad" });

    const result = await spawnSwarmTeammate({
      prompt: "Inspect the startup flow.",
      workerConfig: {
        agentId: "investigator@refactor-squad",
        agentName: "investigator",
        teamName: "Refactor Squad",
        backend: "process",
      },
    });

    expect(result.status).toBe("spawned");
    expect(result.jobId).toBe("bg-1");
    expect(forkMock).toHaveBeenCalledTimes(1);

    const team = await readSwarmTeam("Refactor Squad");
    const member = team?.members.find((entry) => entry.name === "investigator");
    expect(member?.jobId).toBe("bg-1");
    expect(member?.backendType).toBe("process");
    expect(member?.isActive).toBe(true);

    const unread = await readUnreadMailboxMessages(
      "Refactor Squad",
      "investigator",
    );
    expect(unread).toHaveLength(1);
    expect(unread[0].text).toBe("Inspect the startup flow.");
  });

  it("queues a prompt for an already-active worker instead of spawning again", async () => {
    const { createSwarmTeam, upsertSwarmTeamMember } = await import(
      "./teamRuntime.js"
    );
    const { readUnreadMailboxMessages } = await import("./mailbox.js");
    const { spawnSwarmTeammate } = await import("./spawn.js");

    await createSwarmTeam({ teamName: "Refactor Squad" });
    await upsertSwarmTeamMember({
      teamName: "Refactor Squad",
      member: {
        agentId: "investigator@refactor-squad",
        name: "investigator",
        joinedAt: Date.now(),
        tmuxPaneId: "bg-1",
        cwd: process.cwd(),
        subscriptions: [],
        backendType: "process",
        jobId: "bg-1",
        isActive: true,
      },
    });

    const result = await spawnSwarmTeammate({
      prompt: "Check the mailbox flow.",
      workerConfig: {
        agentId: "investigator@refactor-squad",
        agentName: "investigator",
        teamName: "Refactor Squad",
        backend: "process",
      },
    });

    expect(result.status).toBe("queued");
    expect(forkMock).not.toHaveBeenCalled();

    const unread = await readUnreadMailboxMessages(
      "Refactor Squad",
      "investigator",
    );
    expect(unread).toHaveLength(1);
    expect(unread[0].text).toBe("Check the mailbox flow.");
  });
});
