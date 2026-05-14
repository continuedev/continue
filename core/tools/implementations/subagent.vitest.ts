import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolExtras } from "../..";
import {
  appendMailboxMessage,
  readUnreadMailboxMessages,
} from "../../util/teamMailboxStore";
import { createTeam, getActiveTeam } from "../../util/teamStore";
import { subagentToolImpl } from "./subagent";

const { mockRunAgent } = vi.hoisted(() => ({
  mockRunAgent: vi.fn(),
}));

vi.mock("../../agent/AgentRunner", () => ({
  runAgent: mockRunAgent,
}));

vi.mock("../../util/paths", () => ({
  getContinueGlobalPath: () => process.env.YUTOAGENTIC_GLOBAL_DIR ?? "",
}));

describe("subagentToolImpl", () => {
  let globalDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    globalDir = await fs.mkdtemp(path.join(os.tmpdir(), "yuto-core-subagent-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  function createExtras(): ToolExtras {
    return {
      ide: {} as any,
      llm: {} as any,
      fetch: vi.fn() as any,
      tool: {} as any,
      toolCallId: "tool-call-id",
      config: {
        tools: [],
        selectedModelByRole: {
          subagent: {
            title: "Coordinator Worker",
            model: "coord-worker",
            toolOverrides: [],
            baseAgentSystemMessage: "Base system message",
          },
        },
        modelsByRole: {
          subagent: [
            {
              title: "Coordinator Worker",
              model: "coord-worker",
              toolOverrides: [],
              baseAgentSystemMessage: "Base system message",
            },
          ],
        },
      } as any,
      sessionId: "parent-session",
      _agentSessionId: "parent-session",
    } as ToolExtras & { _agentSessionId: string };
  }

  it("threads coordinator scratchpad context into the child system message and appends the result", async () => {
    mockRunAgent.mockResolvedValue({
      messages: [{ role: "assistant", content: "Worker summary" }],
      stopReason: "done",
      totalTurns: 2,
    });

    const extras = createExtras();

    const result = await subagentToolImpl(
      {
        prompt: "Inspect the failing tool path",
        subagent_name: "Coordinator Worker",
        profile: "coordinator-worker",
      },
      extras,
    );

    const scratchpadPath = path.join(
      globalDir,
      "coordinator",
      "parent-session",
      "WORKER_SCRATCHPAD.md",
    );
    const scratchpad = await fs.readFile(scratchpadPath, "utf8");

    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        systemMessage: expect.stringContaining(
          `Shared scratchpad path: ${scratchpadPath}`,
        ),
      }),
    );
    expect(result[0]?.content).toContain("Worker summary");
    expect(scratchpad).toContain("Inspect the failing tool path");
    expect(scratchpad).toContain("Worker summary");
  });

  it("records failures in the coordinator scratchpad before rethrowing", async () => {
    mockRunAgent.mockRejectedValue(new Error("subagent failed"));

    const extras = createExtras();
    const scratchpadPath = path.join(
      globalDir,
      "coordinator",
      "parent-session",
      "WORKER_SCRATCHPAD.md",
    );

    await expect(
      subagentToolImpl(
        {
          prompt: "Reproduce the failure",
          subagent_name: "Coordinator Worker",
          profile: "coordinator-worker",
        },
        extras,
      ),
    ).rejects.toThrow("subagent failed");

    const scratchpad = await fs.readFile(scratchpadPath, "utf8");
    expect(scratchpad).toContain("Status: failed");
    expect(scratchpad).toContain("subagent failed");
  });

  it("records aborted coordinator workers as cancelled", async () => {
    mockRunAgent.mockResolvedValue({
      messages: [],
      stopReason: "aborted",
      totalTurns: 1,
    });

    const extras = createExtras();
    const scratchpadPath = path.join(
      globalDir,
      "coordinator",
      "parent-session",
      "WORKER_SCRATCHPAD.md",
    );

    const result = await subagentToolImpl(
      {
        prompt: "Start the fix and stop midway",
        subagent_name: "Coordinator Worker",
        profile: "coordinator-worker",
      },
      extras,
    );

    const scratchpad = await fs.readFile(scratchpadPath, "utf8");
    expect(result[0]?.description).toContain("stopReason=aborted");
    expect(result[0]?.content).toContain(
      "Subagent was cancelled before producing a final response.",
    );
    expect(scratchpad).toContain("Status: cancelled");
  });

  it("shares the session-scoped team context with child tools and records teammate results", async () => {
    mockRunAgent.mockResolvedValue({
      messages: [{ role: "assistant", content: "Mapped the owning files." }],
      stopReason: "done",
      totalTurns: 3,
    });

    await createTeam("parent-session", {
      teamName: "Coordination",
      description: "Coordinate nested workers",
    });

    const extras = createExtras();
    const result = await subagentToolImpl(
      {
        description: "Investigate the routing layer",
        prompt: "Trace the subagent tool call path",
        subagent_name: "Coordinator Worker",
        teammate_name: "investigator",
      },
      extras,
    );

    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        toolExtras: expect.objectContaining({
          sessionId: "parent-session",
        }),
      }),
    );

    const team = await getActiveTeam("parent-session");
    expect(team?.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "investigator",
          status: "completed",
          lastPrompt: "Trace the subagent tool call path",
        }),
      ]),
    );

    const mailbox = await readUnreadMailboxMessages(
      "parent-session",
      "Coordination",
      "team-lead",
    );
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0]).toEqual(
      expect.objectContaining({
        from: "investigator",
        kind: "message",
        summary: "Investigate the routing layer",
      }),
    );
    expect(mailbox[0]?.metadata).toMatchObject({
      source: "subagent",
      status: "completed",
    });
    expect(result[0]?.content).toContain("Mapped the owning files.");
  });

  it("injects unread prompt and control mailbox handoff items into the delegated subagent prompt", async () => {
    mockRunAgent.mockResolvedValue({
      messages: [{ role: "assistant", content: "Completed the handoff task." }],
      stopReason: "done",
      totalTurns: 4,
    });

    await createTeam("parent-session", {
      teamName: "Coordination",
      description: "Coordinate nested workers",
    });
    await appendMailboxMessage("parent-session", {
      teamName: "Coordination",
      memberName: "investigator",
      message: {
        from: "team-lead",
        text: "Trace the auth flow from UI entry to token storage.",
        summary: "Primary handoff",
        timestamp: "2026-05-14T00:00:00.000Z",
        kind: "prompt",
      },
    });
    await appendMailboxMessage("parent-session", {
      teamName: "Coordination",
      memberName: "investigator",
      message: {
        from: "coordinator",
        text: "Prefer the current session files over stale transcript context.",
        timestamp: "2026-05-14T00:01:00.000Z",
        kind: "control",
      },
    });
    await appendMailboxMessage("parent-session", {
      teamName: "Coordination",
      memberName: "investigator",
      message: {
        from: "reviewer",
        text: "I already checked the middleware branch.",
        timestamp: "2026-05-14T00:02:00.000Z",
        kind: "message",
      },
    });

    const result = await subagentToolImpl(
      {
        prompt: "Map the implementation and summarize the owning files.",
        subagent_name: "Coordinator Worker",
        teammate_name: "investigator",
      },
      createExtras(),
    );

    expect(mockRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          "Mailbox handoff for investigator in team Coordination:",
        ),
      }),
    );

    const [{ prompt: delegatedPrompt }] = mockRunAgent.mock.calls[0] ?? [];
    expect(delegatedPrompt).toContain(
      "Trace the auth flow from UI entry to token storage.",
    );
    expect(delegatedPrompt).toContain(
      "Prefer the current session files over stale transcript context.",
    );
    expect(delegatedPrompt).not.toContain(
      "I already checked the middleware branch.",
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        name: "Mailbox Handoff",
        description: "2 claimed message(s) for investigator",
      }),
    );
    expect(result[0]?.content).toContain(
      "Consumed 2 mailbox handoff message(s) for investigator in team Coordination:",
    );
    expect(result[1]?.name).toBe("Subagent Result");

    const unread = await readUnreadMailboxMessages(
      "parent-session",
      "Coordination",
      "investigator",
    );
    expect(unread).toHaveLength(1);
    expect(unread[0]?.kind).toBe("message");
  });
});
