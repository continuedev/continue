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
          accessToken: "test-token",
          user: { id: "test-user", email: "test@example.com" },
        })
      );

      // Run logout
      const result = await runCLI(context, { args: ["logout"] });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("logged out");

      // Check auth file is removed
      const authExists = await fs
        .access(authPath)
        .then(() => true)
        .catch(() => false);
      expect(authExists).toBe(false);
    });

    it("should handle logout when not logged in", async () => {
      const result = await runCLI(context, { args: ["logout"] });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("logged out");
    });
  });

  describe("auth state in chat", () => {
    it("should prompt for login when using authenticated features", async () => {
      // This tests that the CLI properly handles unauthenticated state
      const result = await runCLI(context, {
        args: ["-p", "Hello"],
        env: {
          OPENAI_API_KEY: "", // No API key
        },
        timeout: 5000,
        expectError: true,
      });

      // Should fail or prompt for configuration
      expect(result.exitCode).not.toBe(0);
    });
  });
});
