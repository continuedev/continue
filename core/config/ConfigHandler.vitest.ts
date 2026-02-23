import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";
import { testConfigHandler } from "../test/fixtures";
import { TEST_DIR } from "../test/testDir";
import { getConfigTsPath } from "../util/paths";

import { defaultConfig } from "./default";

describe.skip("Test the ConfigHandler and E2E config loading", () => {
  test("should show only local profile", () => {
    const profiles = testConfigHandler.currentOrg?.profiles;
    expect(profiles?.length).toBe(1);
    expect(profiles?.[0].profileDescription.id).toBe("local");

    const currentProfile = testConfigHandler.currentProfile;
    expect(currentProfile?.profileDescription.id).toBe("local");
  });

  test("should load the default config successfully", async () => {
    const result = await testConfigHandler.loadConfig();
    expect(result.config!.modelsByRole.chat.length).toBe(
      defaultConfig.models?.length,
    );
  });

  test("should add a system message from config.ts", async () => {
    const configTs = `export function modifyConfig(config: Config): Config {
    config.systemMessage = "SYSTEM";
    return config;
}`;
    fs.writeFileSync(getConfigTsPath(), configTs);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const config = await testConfigHandler.reloadConfig("test");
    /**
     * @ts-ignore is applied because this test is skipped
     */
    // @ts-ignore
    expect(config.systemMessage).toBe("SYSTEM");
  });

  test("should acknowledge override from .continuerc.json", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, ".continuerc.json"),
      JSON.stringify({ systemMessage: "SYSTEM2" }),
    );
    const config = await testConfigHandler.reloadConfig("test");
    /**
     * @ts-ignore is applied because this test is skipped
     */
    // @ts-ignore
    expect(config.systemMessage).toBe("SYSTEM2");
  });
});
