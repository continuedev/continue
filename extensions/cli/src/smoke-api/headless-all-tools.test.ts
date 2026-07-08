import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  createSmokeContext,
  cleanupSmokeContext,
  writeAnthropicConfig,
  runHeadless,
  type SmokeTestContext,
} from "./smoke-api-helpers.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

describe.skipIf(!ANTHROPIC_API_KEY)(
  "Smoke: Headless → all tools round-trip",
  () => {
    let ctx: SmokeTestContext;

    beforeEach(async () => {
      ctx = await createSmokeContext();
      await writeAnthropicConfig(ctx, ANTHROPIC_API_KEY!);

      // Seed a file for the model to read/edit
      await fs.writeFile(
        path.join(ctx.testDir, "seed.txt"),
        "line one\nline two\nline three\n",
      );

      // Initialize a git repo so Diff tool works
      const gitEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: "test",
        GIT_AUTHOR_EMAIL: "test@test.com",
        GIT_COMMITTER_NAME: "test",
        GIT_COMMITTER_EMAIL: "test@test.com",
      };
      execSync("git init", { cwd: ctx.testDir, env: gitEnv });
      execSync("git add .", { cwd: ctx.testDir, env: gitEnv });
      execSync('git commit -m "init"', { cwd: ctx.testDir, env: gitEnv });
    });

    afterEach(async () => {
      await cleanupSmokeContext(ctx);
    });

    const PROMPT = `You have access to tools. I need you to call EACH of the following tools in order, then say "ALL_TOOLS_DONE" when finished.

1. List: list the files in the current directory "."
2. Write: create a file called "created.txt" with content "smoke test"
3. Read: read the file "created.txt"
4. Edit: edit "created.txt" — replace "smoke test" with "smoke test edited"
5. MultiEdit: edit "seed.txt" — replace "line one" with "LINE ONE" and "line two" with "LINE TWO"
6. Search: search for "LINE" in the current directory "."
7. Bash: run the command "echo tool-test-ok"
8. Diff: show the git diff in the current directory
9. Fetch: fetch the URL "https://httpbin.org/get"
10. Checklist: create a checklist with a single item "smoke test passed"

After all tools complete, say exactly "ALL_TOOLS_DONE" as your final message.`;

    it("should exercise 10 built-in tools and complete successfully", async () => {
      const result = await runHeadless(
        ctx,
        ["-p", "--auto", "--config", ctx.configPath, PROMPT],
        { timeout: 120000 },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("ALL_TOOLS_DONE");
    }, 180000);
  },
);
