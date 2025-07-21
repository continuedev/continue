import { createTestContext, cleanupTestContext, runCLI, createTestConfig } from "../test-helpers/cli-helpers.js";

describe("E2E: Headless Mode (Simple)", () => {
  let context: any;

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
      await createTestConfig(context, `invalid: yaml
no models here`);
      
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
      await createTestConfig(context, `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`);
      
      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath],
        env: { OPENAI_API_KEY: "test-key" },
        expectError: true,
      });
      
      // Should error when no prompt provided in headless mode
      expect(result.exitCode).not.toBe(0);
    });
  });
});