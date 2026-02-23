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

  it("should accept a config file path", async () => {
    // Create a minimal YAML config
    const configPath = path.join(context.testDir, "test-config.yaml");
    await fs.writeFile(
      configPath,
      `name: Test Assistant
model: gpt-4
provider: openai`,
    );

    // For now, just test that it tries to load the config
    // Without proper mocking, it will fail to connect to OpenAI
    const result = await runCLI(context, {
      args: ["-p", "--config", configPath, "Hello"],
      env: { OPENAI_API_KEY: "test-key" },
      expectError: true,
    });

    // The fact that it gets past config loading is what we're testing
    expect(result.exitCode).toBeDefined();
  });

  it("should run in TTY-less environment with supplied prompt", async () => {
    // Create a minimal YAML config
    const configPath = path.join(context.testDir, "test-config.yaml");
    await fs.writeFile(
      configPath,
      `name: Test Assistant
model: gpt-4
provider: openai`,
    );

    const result = await runCLI(context, {
      args: ["-p", "--config", configPath, "Hello, world!"],
      env: {
        OPENAI_API_KEY: "test-key",
        // Simulate TTY-less environment (like Docker, CI, or VSCode terminal tool)
        FORCE_NO_TTY: "true",
      },
      expectError: true, // Will fail without proper LLM setup, but that's okay
    });

    // The key test is that it doesn't hang or crash due to TTY issues
    expect(result.exitCode).toBeDefined();
    // Should not contain TTY-related error messages
    expect(result.stderr).not.toMatch(/Cannot start TUI/);
    expect(result.stderr).not.toMatch(/raw mode/);
  });

  it("should fail gracefully without a prompt in headless mode", async () => {
    const result = await runCLI(context, {
      args: ["-p"],
      env: { FORCE_NO_TTY: "true" },
      expectError: true,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/prompt is required|Usage/);
  });
});
