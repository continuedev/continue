import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("teamMailboxStore", () => {
  let globalDir: string;

  beforeEach(async () => {
    globalDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "yuto-core-team-mailbox-"),
    );
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  it("appends, counts, and marks unread mailbox messages as read", async () => {
    const {
      appendMailboxMessage,
      getUnreadMailboxCounts,
      readMailbox,
      readUnreadMailboxMessages,
      takeUnreadMailboxMessages,
    } = await import("./teamMailboxStore");

    await appendMailboxMessage("session-a", {
      teamName: "Alpha",
      memberName: "reviewer",
      message: {
        from: "team-lead",
        text: "Inspect the error path",
        timestamp: "2026-05-14T00:00:00.000Z",
        kind: "prompt",
        summary: "Trace the error path",
      },
    });
    await appendMailboxMessage("session-a", {
      teamName: "Alpha",
      memberName: "reviewer",
      message: {
        from: "team-lead",
        text: "Write up the findings",
        timestamp: "2026-05-14T00:01:00.000Z",
        kind: "message",
      },
    });

    const unread = await readUnreadMailboxMessages(
      "session-a",
      "Alpha",
      "reviewer",
    );
    expect(unread).toHaveLength(2);
    expect(await getUnreadMailboxCounts("session-a", "Alpha")).toEqual({
      reviewer: 2,
    });

    const taken = await takeUnreadMailboxMessages(
      "session-a",
      "Alpha",
      "reviewer",
      {
        readSource: "subagent",
        readBy: "reviewer",
        readAt: "2026-05-14T00:02:00.000Z",
      },
    );
    expect(taken).toHaveLength(2);
    expect(taken[0]).toEqual(
      expect.objectContaining({
        read: true,
        readSource: "subagent",
        readBy: "reviewer",
        readAt: "2026-05-14T00:02:00.000Z",
      }),
    );
    expect(await getUnreadMailboxCounts("session-a", "Alpha")).toEqual({
      reviewer: 0,
    });

    const mailbox = await readMailbox("session-a", "Alpha", "reviewer");
    expect(mailbox[1]).toEqual(
      expect.objectContaining({
        read: true,
        readSource: "subagent",
        readBy: "reviewer",
      }),
    );
  });

  it("can take only selected unread mailbox kinds without consuming the rest", async () => {
    const {
      appendMailboxMessage,
      readUnreadMailboxMessages,
      takeUnreadMailboxMessages,
    } = await import("./teamMailboxStore");

    await appendMailboxMessage("session-a", {
      teamName: "Alpha",
      memberName: "reviewer",
      message: {
        from: "team-lead",
        text: "Inspect the auth flow",
        timestamp: "2026-05-14T00:00:00.000Z",
        kind: "prompt",
      },
    });
    await appendMailboxMessage("session-a", {
      teamName: "Alpha",
      memberName: "reviewer",
      message: {
        from: "team-lead",
        text: "Pause the previous plan and compare the new route",
        timestamp: "2026-05-14T00:01:00.000Z",
        kind: "control",
      },
    });
    await appendMailboxMessage("session-a", {
      teamName: "Alpha",
      memberName: "reviewer",
      message: {
        from: "teammate",
        text: "I already checked the middleware.",
        timestamp: "2026-05-14T00:02:00.000Z",
        kind: "message",
      },
    });

    const firstUnread = await readUnreadMailboxMessages(
      "session-a",
      "Alpha",
      "reviewer",
    );

    const taken = await takeUnreadMailboxMessages(
      "session-a",
      "Alpha",
      "reviewer",
      {
        kinds: ["prompt", "control"],
        ids: [firstUnread[0]!.id],
        readSource: "panel_subagent_delegate",
        readBy: "reviewer",
      },
    );

    expect(taken).toHaveLength(1);
    expect(taken[0]?.kind).toBe("prompt");
    expect(taken[0]?.readSource).toBe("panel_subagent_delegate");

    const unread = await readUnreadMailboxMessages(
      "session-a",
      "Alpha",
      "reviewer",
    );
    expect(unread).toHaveLength(2);
    expect(unread.map((message) => message.kind)).toEqual([
      "control",
      "message",
    ]);
  });

  it("deletes mailbox state for a team without affecting others", async () => {
    const { appendMailboxMessage, deleteTeamMailbox, getUnreadMailboxCounts } =
      await import("./teamMailboxStore");

    await appendMailboxMessage("session-a", {
      teamName: "Alpha",
      memberName: "reviewer",
      message: {
        from: "team-lead",
        text: "Inspect the error path",
        timestamp: "2026-05-14T00:00:00.000Z",
        kind: "prompt",
      },
    });
    await appendMailboxMessage("session-a", {
      teamName: "Beta",
      memberName: "reviewer",
      message: {
        from: "team-lead",
        text: "Inspect the other path",
        timestamp: "2026-05-14T00:05:00.000Z",
        kind: "prompt",
      },
    });

    await deleteTeamMailbox("session-a", "Alpha");

    expect(await getUnreadMailboxCounts("session-a", "Alpha")).toEqual({});
    expect(await getUnreadMailboxCounts("session-a", "Beta")).toEqual({
      reviewer: 1,
    });
  });
});
