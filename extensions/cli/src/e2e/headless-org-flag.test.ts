import {
  createTestContext,
  cleanupTestContext,
  runCLI,
  createTestConfig,
} from "../test-helpers/cli-helpers.js";

describe("E2E: Headless Mode with --org flag", () => {
  let context: any;

  const testConfig = `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - name: test-model
    model: gpt-4
    provider: openai
    apiKey: test-key`;

  const testEnv = {
    OPENAI_API_KEY: "test-key",
    CONTINUE_API_KEY: "test-api-key",
  };

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  describe("--org flag mode restriction", () => {
    it("should fail when --org is used without -p flag (interactive mode)", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: [
          "--config",
          context.configPath,
          "--org",
          "my-org",
          "Test prompt",
        ],
        env: testEnv,
        expectError: true,
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain(
        "--org flag is only supported in headless mode (with -p/--print flag)",
      );
    });

    it("should accept --org flag with -p flag (headless mode)", async () => {
      await createTestConfig(context, testConfig);

      // This will fail due to missing actual auth, but should get past the flag validation
      const result = await runCLI(context, {
        args: [
          "-p",
          "--config",
          context.configPath,
          "--org",
          "my-org",
          "Test prompt",
        ],
        env: testEnv,
        expectError: true,
      });

      // Should fail for a different reason (no actual auth/API), not because of flag validation
      expect(result.stderr).not.toContain(
        "--org flag is only supported in headless mode (with -p/--print flag)",
      );
    });
  });

  describe("--org flag inheritance", () => {
    it("should inherit --org flag from parent command", async () => {
      await createTestConfig(context, testConfig);

      // Test with chat subcommand
      const result = await runCLI(context, {
        args: [
          "--org",
          "test-org",
          "chat",
          "-p",
          "--config",
          context.configPath,
          "Test prompt",
        ],
        env: testEnv,
        expectError: true,
      });

      // The org flag should be inherited and work in headless mode
      expect(result.stderr).not.toContain(
        "--org flag is only supported in headless mode (with -p/--print flag)",
      );
    });
  });
});
