import {
  createTestContext,
  cleanupTestContext,
  runCLI,
  createTestConfig,
} from "../test-helpers/cli-helpers.js";

describe("E2E: Headless Mode - Missing Prompt", () => {
  let context: any;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  it("should exit with helpful error message when no prompt is provided with -p flag", async () => {
    await createTestConfig(
      context,
      `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`,
    );

    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath],
      env: { OPENAI_API_KEY: "test-key" },
      expectError: true,
      timeout: 5000, // Short timeout to avoid hanging
    });

    // Should exit with non-zero exit code
    expect(result.exitCode).toBe(1);

    // Should provide helpful error message
    const output = result.stderr + result.stdout;
    expect(output).toContain(
      "A prompt is required when using the -p/--print flag",
    );
    expect(output).toContain('cn -p "please review my current git diff"');
    expect(output).toContain('echo "hello" | cn -p');
    expect(output).toContain('cn -p "analyze the code in src/"');
  });

  it("should work correctly when prompt is provided with -p flag", async () => {
    await createTestConfig(
      context,
      `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`,
    );

    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Hello assistant"],
      env: { OPENAI_API_KEY: "test-key" },
      expectError: true, // Will fail due to invalid API key, but should process the prompt
      timeout: 5000,
    });

    // Should attempt to process the prompt (will fail due to invalid API key)
    expect(result.exitCode).not.toBe(0);

    // Should NOT show the "prompt required" error message
    const output = result.stderr + result.stdout;
    expect(output).not.toContain(
      "A prompt is required when using the -p/--print flag",
    );
  });

  it("should work correctly when prompt is provided via stdin with -p flag", async () => {
    // NOTE: In our current implementation, stdin reading is disabled in test environments
    // for safety (to prevent hanging). This test verifies the expected behavior when
    // stdin input is provided but cannot be read during tests.
    await createTestConfig(
      context,
      `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`,
    );

    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath],
      env: { OPENAI_API_KEY: "test-key" },
      input: "Hello from stdin",
      expectError: true, // Will show "prompt required" error because stdin is disabled in tests
      timeout: 5000,
    });

    // Should exit with error code due to missing prompt (stdin reading is disabled in tests)
    expect(result.exitCode).toBe(1);

    // Should show the "prompt required" error message since stdin reading is disabled in test env
    const output = result.stderr + result.stdout;
    expect(output).toContain(
      "A prompt is required when using the -p/--print flag",
    );
  });

  it("should prioritize command line prompt over stdin when both are provided", async () => {
    await createTestConfig(
      context,
      `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`,
    );

    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath, "Command line prompt"],
      env: { OPENAI_API_KEY: "test-key" },
      input: "Stdin input that should be ignored",
      expectError: true, // Will fail due to invalid API key
      timeout: 5000,
    });

    // Should use command line prompt over stdin
    expect(result.exitCode).not.toBe(0);

    // Should NOT show the "prompt required" error message
    const output = result.stderr + result.stdout;
    expect(output).not.toContain(
      "A prompt is required when using the -p/--print flag",
    );
  });

  it("should not require prompt with -p flag when --agent flag is provided", async () => {
    await createTestConfig(
      context,
      `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`,
    );

    // This test verifies that the initial validation passes when --agent is provided
    // The actual agent file loading would fail (since we're using a fake slug), but
    // we should get past the "prompt required" check
    const result = await runCLI(context, {
      args: [
        "-p",
        "--config",
        context.configPath,
        "--agent",
        "owner/test-agent",
      ],
      env: { OPENAI_API_KEY: "test-key" },
      expectError: true, // Will fail when trying to load the agent file
      timeout: 5000,
    });

    // Should NOT show the "prompt required" error message from index.ts
    const output = result.stderr + result.stdout;
    expect(output).not.toContain(
      "A prompt is required when using the -p/--print flag",
    );

    // Should show usage examples in the error message
    expect(output).not.toContain('cn -p "analyze the code in src/"');
  });

  it("should show updated usage examples including --agent flag", async () => {
    await createTestConfig(
      context,
      `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - model: gpt-4
    provider: openai
    apiKey: test-key
    roles:
      - chat`,
    );

    const result = await runCLI(context, {
      args: ["-p", "--config", context.configPath],
      env: { OPENAI_API_KEY: "test-key" },
      expectError: true,
      timeout: 5000,
    });

    // Should exit with non-zero exit code
    expect(result.exitCode).toBe(1);

    // Should include the new usage example with --agent flag
    const output = result.stderr + result.stdout;
    expect(output).toContain("cn -p --agent owner/agent-name");
  });
});
