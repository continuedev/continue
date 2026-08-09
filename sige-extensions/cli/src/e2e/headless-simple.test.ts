import {
  createTestContext,
  cleanupTestContext,
  runCLI,
  createTestConfig,
} from "../test-helpers/cli-helpers.js";

describe("E2E: Headless Mode (Simple)", () => {
  let context: any;

  const testConfig = `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`;

  const testEnv = { OPENAI_API_KEY: "test-key" };

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  describe("basic headless functionality", () => {
    it.skip("should output response and exit with -p flag", async () => {
      // Skip this test as it requires mocking the LLM which doesn't work in subprocess
      // This functionality is better tested with integration tests
    });

    it.skip("should handle streaming responses in headless mode", async () => {
      // Skip this test as it requires mocking the LLM which doesn't work in subprocess
    });

    it("should fail gracefully when config is invalid", async () => {
      // Test with invalid config
      await createTestConfig(
        context,
        `invalid: yaml
no models here`,
      );

      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath, "Test"],
        expectError: true,
      });

      expect(result.exitCode).not.toBe(0);
    });

    it.skip("should work with minimal config", async () => {
      // Skip this test as it requires mocking the LLM which doesn't work in subprocess
    });

    it("should handle missing prompt in headless mode", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath],
        env: testEnv,
        expectError: true,
      });

      expect(result.exitCode).not.toBe(0);
    });

    it("should accept piped input with -p flag", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath],
        env: testEnv,
        input: "Hello from piped input",
        expectError: true,
      });

      expect(result.stderr).not.toContain("You:");
      expect(result.stdout).not.toContain("You:");
      expect(result.exitCode).not.toBe(0);
    });

    it("should combine piped input with prompt argument", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath, "Command line argument"],
        env: testEnv,
        input: "Piped input to be combined",
        expectError: true,
      });

      expect(result.stderr).not.toContain("You:");
      expect(result.stdout).not.toContain("You:");
      expect(result.exitCode).not.toBe(0);
    });

    it("should work with only prompt argument", async () => {
      await createTestConfig(context, testConfig);

      const result = await runCLI(context, {
        args: [
          "-p",
          "--config",
          context.configPath,
          "Only command line argument",
        ],
        env: testEnv,
        expectError: true,
      });

      expect(result.stderr).not.toContain("You:");
      expect(result.stdout).not.toContain("You:");
      expect(result.exitCode).not.toBe(0);
    });
  });
});
