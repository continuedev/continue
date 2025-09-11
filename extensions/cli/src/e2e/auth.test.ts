import fs from "fs/promises";
import path from "path";

import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";
import { cleanupMocks } from "../test-helpers/mock-helpers.js";

describe("E2E: Authentication", () => {
  let context: any;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    cleanupMocks();
    await cleanupTestContext(context);
  });

  describe("logout command", () => {
    it("should remove auth credentials", async () => {
      const authPath = path.join(context.testDir, ".continue", "auth.json");

      // Create auth file
      await fs.mkdir(path.dirname(authPath), { recursive: true });
      await fs.writeFile(
        authPath,
        JSON.stringify({
          userId: "test-user",
          userEmail: "test@example.com",
          accessToken: "test-token",
          refreshToken: "test-refresh-token",
          expiresAt: Date.now() + 3600000,
          organizationId: null,
        }),
      );

      // Run logout
      const result = await runCLI(context, {
        args: ["logout"],
        env: {
          HOME: context.testDir,
          CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue"),
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Successfully logged out");

      // Check auth file is removed
      const authExists = await fs
        .access(authPath)
        .then(() => true)
        .catch(() => false);
      expect(authExists).toBe(false);
    });

    it("should handle logout when not logged in", async () => {
      const result = await runCLI(context, {
        args: ["logout"],
        env: {
          HOME: context.testDir,
          CONTINUE_GLOBAL_DIR: path.join(context.testDir, ".continue"),
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No active session found");
    });
  });
});
