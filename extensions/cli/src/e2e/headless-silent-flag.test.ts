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

describe("E2E: Headless Mode with --silent Flag", () => {
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

  it("should strip <think></think> tags from response with --silent flag", async () => {
    const responseWithThinkTags = `<think>
I need to write a shell script. Let me think about this.
The user wants a simple Hello World script.
</think>

#!/bin/bash
echo "Hello World"`;

    mockServer = await setupMockLLMTest(context, {
      response: responseWithThinkTags,
      streaming: false,
    });

    const result = await runCLI(context, {
      args: [
        "-p",
        "--silent",
        "--config",
        context.configPath,
        "Write a shell script",
      ],
      timeout: 15000,
    });

    // Verify think tags are stripped
    expect(result.stdout).not.toContain("<think>");
    expect(result.stdout).not.toContain("</think>");
    expect(result.stdout).not.toContain("I need to write a shell script");

    // Verify the actual content remains
    expect(result.stdout).toContain("#!/bin/bash");
    expect(result.stdout).toContain('echo "Hello World"');
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should strip multiple <think></think> blocks with --silent flag", async () => {
    const responseWithMultipleThinkTags = `<think>
First thought block
</think>

Some content here

<think>
Second thought block
More thinking...
</think>

Final content`;

    mockServer = await setupMockLLMTest(context, {
      response: responseWithMultipleThinkTags,
      streaming: false,
    });

    const result = await runCLI(context, {
      args: ["-p", "--silent", "--config", context.configPath, "Test prompt"],
      timeout: 15000,
    });

    // Verify all think tags are stripped
    expect(result.stdout).not.toContain("<think>");
    expect(result.stdout).not.toContain("</think>");
    expect(result.stdout).not.toContain("First thought block");
    expect(result.stdout).not.toContain("Second thought block");
    expect(result.stdout).not.toContain("More thinking...");

    // Verify the actual content remains
    expect(result.stdout).toContain("Some content here");
    expect(result.stdout).toContain("Final content");
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should reduce excess whitespace with --silent flag", async () => {
    const responseWithExcessWhitespace = `<think>
This will be removed
</think>



Content with lots of whitespace



More content`;

    mockServer = await setupMockLLMTest(context, {
      response: responseWithExcessWhitespace,
      streaming: false,
    });

    const result = await runCLI(context, {
      args: ["-p", "--silent", "--config", context.configPath, "Test prompt"],
      timeout: 15000,
    });

    // Verify think tags are stripped and excess whitespace is reduced
    expect(result.stdout).not.toContain("<think>");
    expect(result.stdout).not.toContain("This will be removed");
    expect(result.stdout).toContain("Content with lots of whitespace");
    expect(result.stdout).toContain("More content");

    // Verify no triple newlines exist (excess whitespace reduced)
    expect(result.stdout).not.toMatch(/\n\s*\n\s*\n/);
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should work normally without --silent flag (baseline test)", async () => {
    const responseWithThinkTags = `<think>
I need to write a shell script. Let me think about this.
</think>

#!/bin/bash
echo "Hello World"`;

    mockServer = await setupMockLLMTest(context, {
      response: responseWithThinkTags,
      streaming: false,
    });

    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Write a shell script"],
      timeout: 15000,
    });

    // Verify think tags are NOT stripped without --silent flag
    expect(result.stdout).toContain("<think>");
    expect(result.stdout).toContain("</think>");
    expect(result.stdout).toContain("I need to write a shell script");
    expect(result.stdout).toContain("#!/bin/bash");
    expect(result.stdout).toContain('echo "Hello World"');
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should handle response with no think tags using --silent flag", async () => {
    const responseWithoutThinkTags = `#!/bin/bash
echo "Hello World"

This is a simple script.`;

    mockServer = await setupMockLLMTest(context, {
      response: responseWithoutThinkTags,
      streaming: false,
    });

    const result = await runCLI(context, {
      args: [
        "-p",
        "--silent",
        "--config",
        context.configPath,
        "Write a shell script",
      ],
      timeout: 15000,
    });

    // Verify content is preserved when no think tags exist
    expect(result.stdout).toContain("#!/bin/bash");
    expect(result.stdout).toContain('echo "Hello World"');
    expect(result.stdout).toContain("This is a simple script.");
    expect(result.exitCode).toBe(0);
  }, 20000);

  it("should fail validation when --silent is used without -p flag", async () => {
    const result = await runCLI(context, {
      args: ["--silent", "Test prompt"],
      timeout: 5000,
      expectError: true,
    });

    expect(result.stderr).toContain(
      "--silent flag can only be used with -p/--print flag",
    );
    expect(result.exitCode).toBe(1);
  }, 10000);

  it("should work with both --silent and --format json flags", async () => {
    const responseWithThinkTags = `<think>
I should respond with JSON
</think>

{"message": "Hello World", "status": "success"}`;

    mockServer = await setupMockLLMTest(context, {
      response: responseWithThinkTags,
      streaming: false,
    });

    const result = await runCLI(context, {
      args: [
        "-p",
        "--silent",
        "--format",
        "json",
        "--config",
        context.configPath,
        "Test prompt",
      ],
      timeout: 15000,
    });

    // Verify think tags are stripped and JSON is valid
    expect(result.stdout).not.toContain("<think>");
    expect(result.stdout).not.toContain("I should respond with JSON");

    // Verify the output is valid JSON
    expect(() => JSON.parse(result.stdout.trim())).not.toThrow();
    const parsedOutput = JSON.parse(result.stdout.trim());
    expect(parsedOutput.message).toBe("Hello World");
    expect(parsedOutput.status).toBe("success");
    expect(result.exitCode).toBe(0);
  }, 20000);
});
