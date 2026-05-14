import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("teamStore", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-team-store-"));
    process.env.YUTOAGENTIC_GLOBAL_DIR = tempDir;
    process.env.CONTINUE_CLI_TEST_SESSION_ID = "team-store-session";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.YUTOAGENTIC_GLOBAL_DIR;
    delete process.env.CONTINUE_CLI_TEST_SESSION_ID;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates a team and tracks teammate runs", async () => {
    const {
      createTeam,
      deleteTeam,
      finishTeamMemberRun,
      formatTeam,
      getActiveTeam,
      startTeamMemberRun,
    } = await import("./teamStore.js");

    const team = await createTeam({
      teamName: "refactor-squad",
      description: "Coordinate focused workers",
    });
    expect(team.teamName).toBe("refactor-squad");

    await startTeamMemberRun({
      teamName: "refactor-squad",
      teammateName: "investigator",
      subagentName: "Explore",
      description: "Inspect affected files",
      prompt: "Map the implementation.",
    });

    let active = await getActiveTeam();
    expect(active?.members[0].status).toBe("running");

    await finishTeamMemberRun({
      teamName: "refactor-squad",
      teammateName: "investigator",
      status: "completed",
      result: "Found the controlling abstraction.",
    });

    active = await getActiveTeam();
    expect(active?.members[0].status).toBe("completed");
    expect(formatTeam(active!)).toContain("investigator (Explore): completed");

    const deleted = await deleteTeam("refactor-squad");
    expect(deleted?.teamName).toBe("refactor-squad");
    expect(await getActiveTeam()).toBeNull();
  });
});
