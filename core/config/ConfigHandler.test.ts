import fs from "node:fs";
import path from "node:path";
import { defaultConfig } from "./default";
import { getConfigTsPath } from "../util/paths";
import { testConfigHandler } from "../test/util/fixtures";
import { TEST_DIR } from "../test/util/testDir";

describe.skip("Test the ConfigHandler and E2E config loading", () => {
  test("should show only local profile", () => {
    const profiles = testConfigHandler.listProfiles();
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe("local");

    const currentProfile = testConfigHandler.currentProfile;
    expect(currentProfile.profileId).toBe("local");
  });

  test("should load the default config successfully", async () => {
    const config = await testConfigHandler.loadConfig();
    expect(config.models.length).toBe(defaultConfig.models.length);
  });

  test.skip("should add a system message from config.ts", async () => {
    const configTs = `export function modifyConfig(config: Config): Config {
    config.systemMessage = "SYSTEM";
    return config;
}`;
    fs.writeFileSync(getConfigTsPath(), configTs);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const config = await testConfigHandler.reloadConfig();
    /**
     * @ts-ignore is applied because this test is skipped
     */
    // @ts-ignore
    expect(config.systemMessage).toBe("SYSTEM");
  });

  test.skip("should acknowledge override from .continuerc.json", async () => {
    fs.writeFileSync(
      path.join(TEST_DIR, ".continuerc.json"),
      JSON.stringify({ systemMessage: "SYSTEM2" }),
    );
    const config = await testConfigHandler.reloadConfig();
    /**
     * @ts-ignore is applied because this test is skipped
     */
    // @ts-ignore
    expect(config.systemMessage).toBe("SYSTEM2");
  });
});
