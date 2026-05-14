import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("team mailbox tools", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-team-mailbox-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "team-mailbox-session";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("broadcasts messages and reports mailbox state", async () => {
    const { createTeam } = await import("../util/teamStore.js");
    const { createSwarmTeam, upsertSwarmTeamMember } = await import(
      "../swarm/teamRuntime.js"
    );
    const { readUnreadMailboxMessages } = await import("../swarm/mailbox.js");
    const { sendMessageTool } = await import("./sendMessage.js");
    const { teamStatusTool } = await import("./teamStatus.js");

    await createTeam({ teamName: "Refactor Squad" });
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
        isActive: true,
        status: "completed",
        lastResult: "Mapped the control flow.",
      },
    });

    const sendResult = await sendMessageTool.run({
      to: "*",
      message: "Check your next task.",
      summary: "Next delegation",
    });
    expect(sendResult).toContain("Broadcast message sent");

    const unread = await readUnreadMailboxMessages(
      "Refactor Squad",
      "investigator",
    );
    expect(unread).toHaveLength(1);
    expect(unread[0].summary).toBe("Next delegation");

    const status = await teamStatusTool.run({ include_mailbox: true });
    expect(status).toContain("Team Refactor Squad");
    expect(status).toContain("investigator: process, completed, active");
    expect(status).toContain("Unread mailbox for team-lead: 0");
  });
});
