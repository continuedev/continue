import * as fs from "fs/promises";
import * as path from "path";

import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";
import {
  setupMockLLMTest,
  cleanupMockLLMServer,
  createMockLLMServer,
  createMockLLMConfig,
  type MockLLMServer,
} from "../test-helpers/mock-llm-server.js";

describe("E2E: Headless Mode with Dynamic Responses", () => {
  let context: any;
  let mockServer: MockLLMServer;
  let extraServers: MockLLMServer[] = [];

  beforeEach(async () => {
    context = undefined;
    mockServer = undefined as any;
    extraServers = [];
  });

  afterEach(async () => {
    // Clean up all extra servers first
    if (extraServers.length > 0) {
      await Promise.all(
        extraServers.map((server) => cleanupMockLLMServer(server)),
      );
      extraServers = [];
    }

    // Clean up main server
    if (mockServer) {
      await cleanupMockLLMServer(mockServer);
      mockServer = undefined as any;
    }

    // Clean up context last
    if (context) {
      await cleanupTestContext(context);
      context = undefined;
    }

    // Small delay to ensure cleanup completes
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it("should respond dynamically based on prompt content", async () => {
    context = await createTestContext();

    // Create a mock server with dynamic responses
    mockServer = await setupMockLLMTest(context, {
      response: (prompt: string) => {
        if (prompt.includes("weather")) {
          return "It's sunny and 72°F today!";
        } else if (prompt.includes("time")) {
          return "The current time is 3:30 PM.";
        } else {
          return "I don't understand your question.";
        }
      },
    });

    // Test weather query
    const weatherResult = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "What's the weather like?"],
      timeout: 15000,
    });
    expect(weatherResult.stdout).toContain("It's sunny and 72°F today!");

    // Test time query
    const timeResult = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "What time is it?"],
      timeout: 15000,
    });
    expect(timeResult.stdout).toContain("The current time is 3:30 PM.");

    // Test unknown query
    const unknownResult = await runCLI(context, {
      args: [
        "-p",
        "--config",
        context.configPath,
        "Tell me about quantum physics",
      ],
      timeout: 15000,
    });
    expect(unknownResult.stdout).toContain("I don't understand your question.");

    // Verify all requests were tracked
    expect(mockServer.requests).toHaveLength(3);
  });

  it("should work with non-streaming responses", async () => {
    context = await createTestContext();

    mockServer = await setupMockLLMTest(context, {
      response: "Non-streaming response",
      streaming: false,
    });

    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Test non-streaming"],
      timeout: 15000,
    });

    expect(result.stdout).toContain("Non-streaming response");
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should handle multiple mock servers for different models", async () => {
    context = await createTestContext();

    // Create two different mock servers and track them for cleanup
    const gpt4Server = await createMockLLMServer({
      response: "Response from GPT-4",
    });
    extraServers.push(gpt4Server);

    const claudeServer = await createMockLLMServer({
      response: "Response from Claude",
    });
    extraServers.push(claudeServer);

    // Create a config with multiple models
    const configContent = `name: Multi-Model Assistant
version: 1.0.0
schema: v1
models:
  - name: test-gpt-4
    model: gpt-4
    provider: openai
    apiKey: test-key-1
    apiBase: ${gpt4Server.url}
    roles:
      - chat
  - name: test-claude
    model: claude-2
    provider: anthropic
    apiKey: test-key-2
    apiBase: ${claudeServer.url}
`;

    const configPath = path.join(context.testDir, "multi-model-config.yaml");
    await fs.writeFile(configPath, configContent);
    context.configPath = configPath;

    // Create onboarding flag
    const onboardingFlagPath = path.join(
      context.testDir,
      ".continue",
      ".onboarding_complete",
    );
    await fs.mkdir(path.dirname(onboardingFlagPath), { recursive: true });
    await fs.writeFile(onboardingFlagPath, new Date().toISOString());

    // Test with the first model (GPT-4 should be default)
    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Hello"],
      timeout: 15000,
    });

    expect(result.stdout).toContain("Response from GPT-4");
    expect(gpt4Server.requests).toHaveLength(1);
    expect(claudeServer.requests).toHaveLength(0);

    // Servers will be cleaned up in afterEach
  });

  it("should allow custom request handling", async () => {
    context = await createTestContext();

    let requestCount = 0;
    const responses = ["First response", "Second response", "Third response"];

    // Create server with custom handler
    mockServer = await createMockLLMServer({
      customHandler: (req, res) => {
        if (req.method === "POST" && req.url === "/chat/completions") {
          const response = responses[requestCount % responses.length];
          requestCount++;

          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          res.write(
            `data: {"choices":[{"delta":{"content":"${response}"},"index":0}]}\n\n`,
          );
          res.write(`data: [DONE]\n\n`);
          res.end();
        } else {
          res.writeHead(404);
          res.end();
        }
      },
    });

    // Set up the test environment
    const configContent = createMockLLMConfig(mockServer);
    const configPath = path.join(context.testDir, "test-config.yaml");
    await fs.writeFile(configPath, configContent);
    context.configPath = configPath;

    const onboardingFlagPath = path.join(
      context.testDir,
      ".continue",
      ".onboarding_complete",
    );
    await fs.mkdir(path.dirname(onboardingFlagPath), { recursive: true });
    await fs.writeFile(onboardingFlagPath, new Date().toISOString());

    // Make multiple requests
    for (let i = 0; i < 3; i++) {
      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath, `Request ${i + 1}`],
        timeout: 15000,
      });
      expect(result.stdout).toContain(responses[i]);
    }
  });
});
