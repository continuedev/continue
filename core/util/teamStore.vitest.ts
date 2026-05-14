import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("teamStore", () => {
  let globalDir: string;

  beforeEach(async () => {
    globalDir = await fs.mkdtemp(path.join(os.tmpdir(), "yuto-core-team-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = globalDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    await fs.rm(globalDir, { recursive: true, force: true });
  });

  it("creates and updates team members within a session", async () => {
    const {
      TEAM_LEAD_NAME,
      createTeam,
      finishTeamMemberRun,
      formatTeam,
      getActiveTeam,
      startTeamMemberRun,
    } = await import("./teamStore");

    const team = await createTeam("session-a", {
      teamName: "Coordination",
      description: "Review and execution",
    });

    expect(team.leadName).toBe(TEAM_LEAD_NAME);
    expect(team.members).toHaveLength(1);
    expect(formatTeam(team)).toContain("Lead: team-lead");

    await startTeamMemberRun("session-a", {
      teamName: "Coordination",
      teammateName: "reviewer",
      subagentName: "Explore",
      description: "Trace the auth flow",
      prompt: "Inspect the auth flow",
    });

    const running = await getActiveTeam("session-a");
    expect(running?.members).toHaveLength(2);
    expect(
      running?.members.find((member) => member.name === "reviewer"),
    ).toMatchObject({
      subagentName: "Explore",
      status: "running",
      lastPrompt: "Inspect the auth flow",
    });

    await finishTeamMemberRun("session-a", {
      teamName: "Coordination",
      teammateName: "reviewer",
      status: "completed",
      result: "Found the owning files",
    });

    const finished = await getActiveTeam("session-a");
    expect(
      finished?.members.find((member) => member.name === "reviewer"),
    ).toMatchObject({
      status: "completed",
      lastResult: "Found the owning files",
    });
  });

  it("isolates teams by session and deletes them cleanly", async () => {
    const { createTeam, deleteTeam, getActiveTeam } = await import(
      "./teamStore"
    );

    await createTeam("session-a", { teamName: "Alpha" });
    await createTeam("session-b", { teamName: "Beta" });

    expect((await getActiveTeam("session-a"))?.teamName).toBe("Alpha");
    expect((await getActiveTeam("session-b"))?.teamName).toBe("Beta");

    const deleted = await deleteTeam("session-a", "Alpha");
    expect(deleted?.teamName).toBe("Alpha");
    expect(await getActiveTeam("session-a")).toBeNull();
    expect((await getActiveTeam("session-b"))?.teamName).toBe("Beta");
  });
});
