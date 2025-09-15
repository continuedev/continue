import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";
import {
  setupMockLLMTest,
  cleanupMockLLMServer,
  type MockLLMServer,
} from "../test-helpers/mock-llm-server.js";

describe("E2E: Headless Mode with Mock Server", () => {
  let context: any;
  let mockServer: MockLLMServer;

  beforeEach(async () => {
    context = await createTestContext();
    mockServer = await setupMockLLMTest(context, {
      response: "Hello World!",
    });
  });

  afterEach(async () => {
    await cleanupMockLLMServer(mockServer);
    await cleanupTestContext(context);
  });

  it('should output "Hello World!" when using cn -p "Hi"', async () => {
    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Hi"],
      timeout: 15000,
    });

    // Verify stdout contains "Hello World!"
    expect(result.stdout).toContain("Hello World!");
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should handle streaming responses correctly", async () => {
    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Say hello"],
      timeout: 15000,
    });

    expect(result.stdout).toContain("Hello World!");
    expect(result.exitCode).toBe(0);
    expect(mockServer.requests).toHaveLength(1);
    // Find the user message (system message is first)
    const userMessage = mockServer.requests[0].body.messages.find(
      (m: any) => m.role === "user",
    );
    expect(userMessage.content).toBe("Say hello");
  }, 20000);

  it("should work with longer prompts", async () => {
    const result = await runCLI(context, {
      args: [
        "-p",
        "--config",
        context.configPath,
        "Please respond with exactly 'Hello World!' and nothing else",
      ],
      timeout: 15000,
    });

    expect(result.stdout).toContain("Hello World!");
    expect(result.exitCode).toBe(0);
    expect(mockServer.requests).toHaveLength(1);
    // Find the user message (system message is first)
    const userMessage = mockServer.requests[0].body.messages.find(
      (m: any) => m.role === "user",
    );
    expect(userMessage.content).toBe(
      "Please respond with exactly 'Hello World!' and nothing else",
    );
  }, 20000);
});
