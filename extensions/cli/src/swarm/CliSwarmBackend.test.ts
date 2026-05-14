import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawnSwarmTeammate, readSwarmTeam, upsertSwarmTeamMember } = vi.hoisted(
  () => ({
    spawnSwarmTeammate: vi.fn(),
    readSwarmTeam: vi.fn(),
    upsertSwarmTeamMember: vi.fn(),
  }),
);

vi.mock("../session.js", () => ({
  getCurrentSession: () => ({ sessionId: "parent-session" }),
}));

vi.mock("./spawn.js", () => ({
  spawnSwarmTeammate,
}));

vi.mock("./teamRuntime.js", () => ({
  readSwarmTeam,
  upsertSwarmTeamMember,
}));

import { CliSwarmBackend } from "./CliSwarmBackend";

describe("CliSwarmBackend", () => {
  beforeEach(() => {
    spawnSwarmTeammate.mockReset();
    readSwarmTeam.mockReset();
    upsertSwarmTeamMember.mockReset();
  });

  it("maps spawnAgent inputs to worker config for process workers", async () => {
    spawnSwarmTeammate.mockResolvedValue({
      status: "spawned",
      backend: "process",
      jobId: "bg-1",
      summary: "Spawned background teammate investigator (job bg-1).",
    });

    const backend = new CliSwarmBackend();
    const result = await backend.spawnAgent({
      agentId: "investigator@coordination",
      agentName: "investigator",
      teamName: "Coordination",
      prompt: "Trace the worker launch path",
      backend: "process",
      model: "coord-worker",
      agentType: "Coordinator Worker",
      description: "Investigate launch behavior",
      profile: "coordinator-worker",
    });

    expect(spawnSwarmTeammate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Trace the worker launch path",
        workerConfig: expect.objectContaining({
          agentId: "investigator@coordination",
          agentName: "investigator",
          teamName: "Coordination",
          backend: "process",
          model: "coord-worker",
          agentType: "Coordinator Worker",
          description: "Investigate launch behavior",
          profile: "coordinator-worker",
          parentSessionId: "parent-session",
        }),
      }),
    );
    expect(result).toEqual({
      status: "spawned",
      handle: "bg-1",
      summary: "Spawned background teammate investigator (job bg-1).",
    });
  });

  it("marks the member cancelled when stopAgent is called", async () => {
    readSwarmTeam.mockResolvedValue({
      members: [
        {
          agentId: "investigator@coordination",
          name: "investigator",
          status: "running",
          isActive: true,
        },
      ],
    });

    const backend = new CliSwarmBackend();
    await backend.stopAgent("investigator@coordination", "Coordination");

    expect(upsertSwarmTeamMember).toHaveBeenCalledWith(
      expect.objectContaining({
        teamName: "Coordination",
        member: expect.objectContaining({
          agentId: "investigator@coordination",
          status: "cancelled",
          isActive: false,
        }),
      }),
    );
  });

  it("returns null status when agent does not exist", async () => {
    readSwarmTeam.mockResolvedValue({
      members: [{ agentId: "other@coordination", isActive: true }],
    });

    const backend = new CliSwarmBackend();
    const status = await backend.getAgentStatus(
      "investigator@coordination",
      "Coordination",
    );

    expect(status).toBeNull();
  });

  it("falls back to process backend when none is provided", async () => {
    spawnSwarmTeammate.mockResolvedValue({
      status: "spawned",
      backend: "process",
      jobId: "bg-2",
      summary: "Spawned background teammate reviewer (job bg-2).",
    });

    const backend = new CliSwarmBackend();
    await backend.spawnAgent({
      agentId: "reviewer@coordination",
      agentName: "reviewer",
      teamName: "Coordination",
      prompt: "Review the queued diff",
    });

    expect(spawnSwarmTeammate).toHaveBeenCalledWith(
      expect.objectContaining({
        workerConfig: expect.objectContaining({
          backend: "process",
        }),
      }),
    );
  });

  it("returns pane handle when tmux backend spawns a pane", async () => {
    spawnSwarmTeammate.mockResolvedValue({
      status: "spawned",
      backend: "tmux",
      paneId: "%12",
      summary: "Spawned tmux teammate investigator in yt-swarm:%12.",
    });

    const backend = new CliSwarmBackend();
    const result = await backend.spawnAgent({
      agentId: "investigator@coordination",
      agentName: "investigator",
      teamName: "Coordination",
      prompt: "Inspect worker pane output",
      backend: "tmux",
    });

    expect(result).toEqual({
      status: "spawned",
      handle: "%12",
      summary: "Spawned tmux teammate investigator in yt-swarm:%12.",
    });
  });
});
