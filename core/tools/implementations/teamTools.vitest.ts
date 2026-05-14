import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("team tools", () => {
  let globalDir: string;

  beforeEach(async () => {
    globalDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "yuto-core-team-tools-"),
    );
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  it("creates teams, sends mailbox messages, previews status, reads mailbox, and deletes teams", async () => {
    const {
      sendMessageImpl,
      teamCreateImpl,
      teamDeleteImpl,
      teamMailboxImpl,
      teamStatusImpl,
    } = await import("./teamTools");

    const extras = { sessionId: "team-tools-session" } as any;

    const created = await teamCreateImpl(
      {
        team_name: "  Coordination  ",
        description: "  Delegate review and execution  ",
      },
      extras,
    );
    expect(created[0]?.content).toContain("Team Coordination");
    expect(created[0]?.content).toContain("Lead: team-lead");

    const sent = await sendMessageImpl(
      {
        to: "reviewer",
        from: "team-lead",
        kind: "prompt",
        summary: "Trace auth flow",
        message: "Inspect the auth flow and summarize the owning files.",
      },
      extras,
    );
    expect(sent[0]?.content).toBe("Message sent to reviewer in Coordination.");

    const status = await teamStatusImpl(
      {
        include_mailbox: true,
        member_name: "reviewer",
      },
      extras,
    );
    expect(status[0]?.content).toContain("- reviewer: idle, unread=1");
    expect(status[0]?.content).toContain("Unread mailbox for reviewer: 1");
    expect(status[0]?.content).toContain(
      "- team-lead [prompt]: Trace auth flow",
    );

    const mailbox = await teamMailboxImpl(
      {
        member_name: "reviewer",
        unread_only: true,
        mark_read: true,
      },
      extras,
    );
    expect(mailbox[0]?.content).toContain(
      "Mailbox for reviewer in Coordination (1 message(s)):",
    );
    expect(mailbox[0]?.content).toContain(
      "Inspect the auth flow and summarize the owning files.",
    );
    expect(mailbox[0]?.metadata).toEqual(
      expect.objectContaining({
        mailboxOwner: "reviewer",
        unreadCount: 0,
        totalMessages: 1,
        messages: [
          expect.objectContaining({
            read: true,
            readSource: "team_mailbox",
            readBy: "reviewer",
            kind: "prompt",
          }),
        ],
      }),
    );

    const afterReadStatus = await teamStatusImpl(
      {
        include_mailbox: true,
        member_name: "reviewer",
      },
      extras,
    );
    expect(afterReadStatus[0]?.content).not.toContain("unread=1");
    expect(afterReadStatus[0]?.content).toContain(
      "Unread mailbox for reviewer: 0",
    );

    const deleted = await teamDeleteImpl({}, extras);
    expect(deleted[0]?.content).toContain("Deleted team:");
    expect(deleted[0]?.content).toContain("Team Coordination");
  });

  it("requires an active session and reports missing teams or invalid kinds", async () => {
    const { sendMessageImpl, teamDeleteImpl, teamMailboxImpl } = await import(
      "./teamTools"
    );

    await expect(teamDeleteImpl({}, {} as any)).rejects.toThrow(
      "Team tools require an active session.",
    );

    await expect(
      sendMessageImpl(
        {
          to: "reviewer",
          message: "Inspect auth",
        },
        { sessionId: "team-tools-session" } as any,
      ),
    ).rejects.toThrow("No active team exists for this session.");

    const missingMailbox = await teamMailboxImpl(
      {
        member_name: "reviewer",
      },
      { sessionId: "team-tools-session" } as any,
    ).catch((error: Error) => error.message);
    expect(missingMailbox).toBe("No active team exists for this session.");
  });
});
