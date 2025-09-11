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

describe("E2E: Headless Mode with JSON Format", () => {
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

  it("should output valid JSON when LLM returns valid JSON", async () => {
    const validJsonResponse = {
      response: "This is a JSON response",
      status: "success",
      files: ["test.ts"],
    };

    mockServer = await setupMockLLMTest(context, {
      response: JSON.stringify(validJsonResponse),
      streaming: false, // Use non-streaming to avoid JSON escaping issues
    });

    const result = await runCLI(context, {
      args: [
        "-p",
        "--format",
        "json",
        "--config",
        context.configPath,
        "Test prompt",
      ],
      timeout: 15000,
    });

    // Verify the output is valid JSON
    expect(() => JSON.parse(result.stdout.trim())).not.toThrow();
    const parsedOutput = JSON.parse(result.stdout.trim());
    expect(parsedOutput).toEqual(validJsonResponse);
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should wrap non-JSON response in JSON object", async () => {
    const nonJsonResponse = "This is just plain text response";

    mockServer = await setupMockLLMTest(context, {
      response: nonJsonResponse,
    });

    const result = await runCLI(context, {
      args: [
        "-p",
        "--format",
        "json",
        "--config",
        context.configPath,
        "Test prompt",
      ],
      timeout: 15000,
    });

    // Verify the output is valid JSON
    expect(() => JSON.parse(result.stdout.trim())).not.toThrow();
    const parsedOutput = JSON.parse(result.stdout.trim());
    expect(parsedOutput.response).toBe(nonJsonResponse);
    expect(parsedOutput.status).toBe("success");
    expect(parsedOutput.note).toBe(
      "Response was not valid JSON, so it was wrapped in a JSON object",
    );
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should include JSON formatting instructions in system message", async () => {
    mockServer = await setupMockLLMTest(context, {
      response: '{"response": "I understand JSON format"}',
    });

    const result = await runCLI(context, {
      args: ["-p", "--format", "json", "--config", context.configPath, "Hello"],
      timeout: 15000,
    });

    expect(result.exitCode).toBe(0);
    expect(mockServer.requests).toHaveLength(1);

    // Find the system message
    const systemMessage = mockServer.requests[0].body.messages.find(
      (m: any) => m.role === "system",
    );
    expect(systemMessage.content).toContain("JSON output mode");
    expect(systemMessage.content).toContain(
      "valid JSON that can be parsed by JSON.parse()",
    );
  }, 20000);

  it("should fail validation when --format is used without -p flag", async () => {
    const result = await runCLI(context, {
      args: ["--format", "json", "Test prompt"],
      timeout: 5000,
      expectError: true,
    });

    expect(result.stderr).toContain(
      "--format flag can only be used with -p/--print flag",
    );
    expect(result.exitCode).toBe(1);
  }, 10000);

  it("should fail validation with invalid format value", async () => {
    const result = await runCLI(context, {
      args: ["-p", "--format", "xml", "Test prompt"],
      timeout: 5000,
      expectError: true,
    });

    expect(result.stderr).toContain("--format currently only supports 'json'");
    expect(result.exitCode).toBe(1);
  }, 10000);
});
