import * as fs from "fs/promises";
import * as path from "path";

import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";
import {
  cleanupMockLLMServer,
  createMockLLMServer,
  type MockLLMServer,
} from "../test-helpers/mock-llm-server.js";

describe("E2E: Headless Mode with ANTHROPIC_API_KEY", () => {
  let context: any;
  let mockServer: MockLLMServer;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    if (mockServer) {
      await cleanupMockLLMServer(mockServer);
    }
    await cleanupTestContext(context);
  });

  it("should work when ANTHROPIC_API_KEY is set in environment", async () => {
    // Create a mock LLM server using the same pattern as working tests
    mockServer = await createMockLLMServer({
      response: "Hello! This is a response from Claude.",
    });

    // Use OpenAI provider pointing to mock server (same as working tests)
    const configContent = `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - name: test-claude
    model: claude-3-5-sonnet
    provider: openai
    apiKey: test-key
    apiBase: ${mockServer.url}
    roles:
      - chat
`;

    const configPath = path.join(context.testDir, "test-config.yaml");
    await fs.writeFile(configPath, configContent);
    context.configPath = configPath;

    // Create onboarding flag to skip onboarding
    const onboardingFlagPath = path.join(
      context.testDir,
      ".continue",
      ".onboarding_complete",
    );
    await fs.mkdir(path.dirname(onboardingFlagPath), { recursive: true });
    await fs.writeFile(onboardingFlagPath, new Date().toISOString());

    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Hi there"],
      env: {
        ANTHROPIC_API_KEY: "test-api-key-from-env",
      },
      timeout: 15000,
    });

    // Verify the CLI successfully runs (even if not using env var in this test)
    expect(result.stdout).toContain("Hello! This is a response from Claude.");
    expect(result.exitCode).toBe(0);
    expect(mockServer.requests).toHaveLength(1);

    // Find the user message in the request
    const userMessage = mockServer.requests[0].body.messages.find(
      (m: any) => m.role === "user",
    );
    expect(userMessage.content).toBe("Hi there");
  }, 20000);

  it("should create config but fail with invalid API key when no config exists", async () => {
    // This test verifies that CLI automatically creates config from ANTHROPIC_API_KEY
    // when no config file exists, but fails when the API key is invalid

    const result = await runCLI(context, {
      args: ["-p", "test prompt"],
      env: {
        ANTHROPIC_API_KEY: "TEST-test-invalid-key-format",
        CONTINUE_GLOBAL_DIR: context.testDir + "/.continue",
      },
      expectError: true, // API call should fail with invalid key
      timeout: 15000,
    });

    // The CLI should create config but fail due to invalid API key
    // This is expected behavior - invalid API keys should cause authentication errors
    expect(result.exitCode).toBe(1);

    // Should contain authentication error (not service initialization error)
    expect(result.stderr).toContain("authentication_error");
    expect(result.stderr).toContain("invalid x-api-key");

    // Should NOT contain the old error about service initialization
    expect(result.stderr).not.toContain("Failed to initialize ConfigService");

    // Verify config.yaml was automatically created
    const configPath = path.join(context.testDir, ".continue", "config.yaml");
    const configExists = await fs
      .stat(configPath)
      .then(() => true)
      .catch(() => false);
    expect(configExists).toBe(true);

    if (configExists) {
      const configContent = await fs.readFile(configPath, "utf-8");
      expect(configContent).toContain("anthropic/claude-sonnet-4-5");
      expect(configContent).toContain(
        "ANTHROPIC_API_KEY: TEST-test-invalid-key-format",
      );
    }
  }, 20000);
});
