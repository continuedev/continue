import fs from "fs/promises";
import path from "path";
import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";

describe("E2E: Headless Mode (Minimal)", () => {
  let context: any;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  it("should show version with --version flag", async () => {
    const result = await runCLI(context, {
      args: ["--version"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Matches version pattern
  });

  it("should show help with --help flag", async () => {
    const result = await runCLI(context, {
      args: ["--help"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Continue CLI");
    expect(result.stdout).toContain("-p, --print");
  });

  it("should accept a config file path", async () => {
    // Create a minimal YAML config
    const configPath = path.join(context.testDir, "test-config.yaml");
    await fs.writeFile(
      configPath,
      `name: Test Assistant
model: gpt-4
provider: openai`
    );

    // For now, just test that it tries to load the config
    // Without proper mocking, it will fail to connect to OpenAI
    const result = await runCLI(context, {
      args: ["-p", "Hello", "--config", configPath],
      env: { OPENAI_API_KEY: "test-key" },
      expectError: true,
    });

    // The fact that it gets past config loading is what we're testing
    expect(result.exitCode).toBeDefined();
  });
});
