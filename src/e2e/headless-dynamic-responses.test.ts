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
import * as fs from "fs/promises";
import * as path from "path";

describe("E2E: Headless Mode with Dynamic Responses", () => {
  let context: any;
  let mockServer: MockLLMServer;

  afterEach(async () => {
    if (mockServer) {
      await cleanupMockLLMServer(mockServer);
    }
    if (context) {
      await cleanupTestContext(context);
    }
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
      args: ["-p", "What's the weather like?", "--config", context.configPath],
      timeout: 15000,
    });
    expect(weatherResult.stdout).toContain("It's sunny and 72°F today!");
    
    // Test time query
    const timeResult = await runCLI(context, {
      args: ["-p", "What time is it?", "--config", context.configPath],
      timeout: 15000,
    });
    expect(timeResult.stdout).toContain("The current time is 3:30 PM.");
    
    // Test unknown query
    const unknownResult = await runCLI(context, {
      args: ["-p", "Tell me about quantum physics", "--config", context.configPath],
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
      args: ["-p", "Test non-streaming", "--config", context.configPath],
      timeout: 15000,
    });

    expect(result.stdout).toContain("Non-streaming response");
    expect(result.exitCode).toBe(0);
  });

  it("should handle multiple mock servers for different models", async () => {
    context = await createTestContext();
    
    // Create two different mock servers
    const gpt4Server = await createMockLLMServer({
      response: "Response from GPT-4",
    });
    
    const claudeServer = await createMockLLMServer({
      response: "Response from Claude",
    });
    
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
    const onboardingFlagPath = path.join(context.testDir, ".continue", ".onboarding_complete");
    await fs.mkdir(path.dirname(onboardingFlagPath), { recursive: true });
    await fs.writeFile(onboardingFlagPath, new Date().toISOString());
    
    // Test with the first model (GPT-4 should be default)
    const result = await runCLI(context, {
      args: ["-p", "Hello", "--config", context.configPath],
      timeout: 15000,
    });
    
    expect(result.stdout).toContain("Response from GPT-4");
    expect(gpt4Server.requests).toHaveLength(1);
    expect(claudeServer.requests).toHaveLength(0);
    
    // Clean up extra servers
    await cleanupMockLLMServer(gpt4Server);
    await cleanupMockLLMServer(claudeServer);
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
            "Connection": "keep-alive",
          });
          
          res.write(`data: {"choices":[{"delta":{"content":"${response}"},"index":0}]}\n\n`);
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
    
    const onboardingFlagPath = path.join(context.testDir, ".continue", ".onboarding_complete");
    await fs.mkdir(path.dirname(onboardingFlagPath), { recursive: true });
    await fs.writeFile(onboardingFlagPath, new Date().toISOString());
    
    // Make multiple requests
    for (let i = 0; i < 3; i++) {
      const result = await runCLI(context, {
        args: ["-p", `Request ${i + 1}`, "--config", context.configPath],
        timeout: 15000,
      });
      expect(result.stdout).toContain(responses[i]);
    }
  });
});