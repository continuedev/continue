import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { TEST_DIR, TEST_DIR_PATH, setUpTestDir } from "../test/testDir";
import { getConfigJsonPath, getConfigTsPath } from "../util/paths";

import { LLMLogger } from "../llm/logger";
import FileSystemIde from "../util/filesystem";
import { ConfigHandler } from "./ConfigHandler";
import { defaultConfig } from "./default";

describe("Test the ConfigHandler and E2E config loading", () => {
  // Store original environment variables
  const originalEnv = { ...process.env };
  let tempConfigDir: string;
  let customConfigHandler: ConfigHandler;

  // Set up test environment variables
  beforeAll(async () => {
    // Create the test directory structure first
    setUpTestDir();

    // Create a unique temporary directory for this test suite
    tempConfigDir = path.join(
      os.tmpdir(),
      `continue-config-test-${Date.now()}`,
    );
    fs.mkdirSync(tempConfigDir, { recursive: true });

    // Save original and set custom CONTINUE_GLOBAL_DIR
    process.env.CONTINUE_GLOBAL_DIR = tempConfigDir;
    console.log(`Using temporary config directory: ${tempConfigDir}`);

    // Create a new ConfigHandler instance that will use our custom CONTINUE_GLOBAL_DIR
    const testIde = new FileSystemIde(TEST_DIR);
    const ideSettingsPromise = testIde.getIdeSettings();
    customConfigHandler = new ConfigHandler(
      testIde,
      ideSettingsPromise,
      new LLMLogger(),
      Promise.resolve(undefined),
    );
  });

  // Restore original environment and clean up after tests
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up the temporary directory
    if (fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true });
      console.log(`Cleaned up temporary config directory: ${tempConfigDir}`);
    }

    // Clean up test directory
    if (fs.existsSync(TEST_DIR_PATH)) {
      fs.rmSync(TEST_DIR_PATH, { recursive: true });
    }
  });

  test("should show only local profile with custom config directory", async () => {
    await customConfigHandler.initPromise;
    const profiles = customConfigHandler.currentOrg?.profiles;
    expect(profiles?.length).toBe(1);
    expect(profiles?.[0].profileDescription.id).toBe("local");

    const currentProfile = customConfigHandler.currentProfile;
    expect(currentProfile?.profileDescription.id).toBe("local");
  });

  test("should load the default config successfully with custom config directory", async () => {
    await customConfigHandler.initPromise;
    const result = await customConfigHandler.loadConfig();
    expect(result.config!.modelsByRole.chat.length).toBe(
      defaultConfig.models?.length,
    );

    // Verify that we're using the custom directory
    expect(process.env.CONTINUE_GLOBAL_DIR).toBe(tempConfigDir);

    // Check that config.yaml exists in our temporary directory
    const configYamlPath = path.join(tempConfigDir, "config.yaml");
    expect(fs.existsSync(configYamlPath)).toBe(true);
  });

  test("should add a system message from config.ts with custom config directory", async () => {
    await customConfigHandler.initPromise;

    // Remove the existing config.yaml file
    const configYamlPath = path.join(tempConfigDir, "config.yaml");
    if (fs.existsSync(configYamlPath)) {
      fs.unlinkSync(configYamlPath);
    }

    // Create config.json file with default configuration
    fs.writeFileSync(
      getConfigJsonPath(),
      JSON.stringify(
        {
          models: [],
        },
        null,
        2,
      ),
    );

    const configTs = `export function modifyConfig(config: Config): Config {
    config.userToken = "TEST_TOKEN";
    return config;
}`;
    fs.writeFileSync(getConfigTsPath(), configTs);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const config = await customConfigHandler.reloadConfig();
    expect(config.config?.userToken).toBe("TEST_TOKEN");
  });
});
