import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("swarm runtime", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-swarm-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "swarm-session-id";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates and updates a swarm team record", async () => {
    const {
      createSwarmTeam,
      deleteSwarmTeam,
      formatSwarmAgentId,
      readSwarmTeam,
      removeSwarmTeamMember,
      reserveSwarmTeammateName,
      upsertSwarmTeamMember,
    } = await import("./teamRuntime.js");

    const team = await createSwarmTeam({
      teamName: "Refactor Squad",
      description: "Coordinate external workers",
    });

    expect(team.name).toBe("Refactor Squad");
    expect(team.members).toHaveLength(1);
    expect(team.leadSessionId).toBe("swarm-session-id");

    const reserved = await reserveSwarmTeammateName("investigator", team.name);
    expect(reserved).toBe("investigator");

    await upsertSwarmTeamMember({
      teamName: team.name,
      member: {
        agentId: formatSwarmAgentId("investigator", team.name),
        name: "investigator",
        agentType: "Explore",
        joinedAt: Date.now(),
        tmuxPaneId: "%1",
        cwd: process.cwd(),
        subscriptions: [],
        backendType: "tmux",
        isActive: true,
      },
    });

    const duplicateName = await reserveSwarmTeammateName(
      "investigator",
      team.name,
    );
    expect(duplicateName).toBe("investigator-2");

    const updated = await readSwarmTeam(team.name);
    expect(updated?.members).toHaveLength(2);

    await removeSwarmTeamMember({
      teamName: team.name,
      name: "investigator",
    });

    const trimmed = await readSwarmTeam(team.name);
    expect(trimmed?.members).toHaveLength(1);

    expect(await deleteSwarmTeam(team.name)).toBe(true);
    expect(await readSwarmTeam(team.name)).toBeNull();
  });

  it("appends and consumes unread mailbox messages", async () => {
    const { appendMailboxMessage, readMailbox, takeUnreadMailboxMessages } =
      await import("./mailbox.js");
    const { createSwarmTeam } = await import("./teamRuntime.js");

    await createSwarmTeam({ teamName: "Refactor Squad" });

    await appendMailboxMessage({
      teamName: "Refactor Squad",
      teammateName: "investigator",
      message: {
        from: "team-lead",
        text: "Inspect the orchestrator entrypoint.",
        timestamp: new Date("2026-05-14T11:00:00.000Z").toISOString(),
        kind: "prompt",
        summary: "Inspect startup flow",
      },
    });

    const unread = await takeUnreadMailboxMessages(
      "Refactor Squad",
      "investigator",
    );
    expect(unread).toHaveLength(1);
    expect(unread[0].read).toBe(false);
    expect(unread[0].kind).toBe("prompt");

    const mailbox = await readMailbox("Refactor Squad", "investigator");
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0].read).toBe(true);

    const secondTake = await takeUnreadMailboxMessages(
      "Refactor Squad",
      "investigator",
    );
    expect(secondTake).toEqual([]);
  });
});
