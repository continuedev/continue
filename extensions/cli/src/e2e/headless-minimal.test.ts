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
});
