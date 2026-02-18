import { describe, expect, test } from "vitest";

describe("Local Config Switching Investigation", () => {
  test("understands local vs remote config paths", () => {
    // Document the different types of config paths:

    const configTypes = {
      localFilePaths: [
        "~/.continue/config.yaml",
        "./config.yaml",
        "/absolute/path/to/config.yaml",
      ],
      remoteAssistantSlugs: [
        "continuedev/default-cli-config",
        "myorg/custom-assistant",
        "user/my-assistant",
      ],
      undefinedMeansDefault: undefined, // Uses saved assistant slug or first assistant
    };

    // The isFilePath method checks for these patterns:
    const isFilePath = (configPath: string) => {
      return (
        configPath.startsWith(".") ||
        configPath.startsWith("/") ||
        configPath.startsWith("~")
      );
    };

    // Verify our understanding
    configTypes.localFilePaths.forEach((path) => {
      expect(isFilePath(path)).toBe(true);
    });

    configTypes.remoteAssistantSlugs.forEach((slug) => {
      expect(isFilePath(slug)).toBe(false);
    });
  });

  test("documents the local config switching problem", () => {
    // User reported issue: "Switching configs always works except when I'm using a local config"

    const problemScenarios = [
      {
        name: "Remote to Remote switching",
        from: "continuedev/default-cli-config",
        to: "myorg/custom-assistant",
        works: true,
        reason: "Both are assistant slugs, normal flow works",
      },
      {
        name: "Remote to Local switching",
        from: "continuedev/default-cli-config",
        to: "~/.continue/config.yaml",
        works: false, // This is the reported issue
        reason: "UNKNOWN - this is what we need to debug",
      },
      {
        name: "Local to Remote switching",
        from: "~/.continue/config.yaml",
        to: "continuedev/default-cli-config",
        works: false, // Likely also broken
        reason: "UNKNOWN - probably same root cause",
      },
      {
        name: "Local to Local switching",
        from: "~/.continue/config.yaml",
        to: "./other-config.yaml",
        works: false, // Likely also broken
        reason: "UNKNOWN - probably same root cause",
      },
    ];

    // The problem is specifically with local configs
    const brokenScenarios = problemScenarios.filter((s) => !s.works);
    expect(brokenScenarios.length).toBeGreaterThan(0);

    // All broken scenarios involve local configs
    const allInvolveLocalConfigs = brokenScenarios.every(
      (scenario) =>
        scenario.from.includes("/") ||
        scenario.from.includes("~") ||
        scenario.from.includes(".") ||
        scenario.to.includes("/") ||
        scenario.to.includes("~") ||
        scenario.to.includes("."),
    );
    expect(allInvolveLocalConfigs).toBe(true);
  });

  test("hypothesis: local config loading has different behavior", async () => {
    // The loadConfiguration function has different code paths:

    const { loadConfiguration } = await import("../configLoader.js");

    // Path 1: Local file loading (lines 176-189 in config.ts)
    // if (config.startsWith(".") || config.startsWith("/") || config.startsWith("~")) {
    //   const configYaml = await loadConfigYaml(authConfig?.accessToken ?? null, config, organizationId, apiClient);
    //   return configYaml;
    // }

    // Path 2: Remote assistant slug loading (lines 190-203 in config.ts)
    // else {
    //   const [ownerSlug, packageSlug] = config.split("/");
    //   const resp = await apiClient.getAssistant({ ownerSlug, packageSlug, ... });
    //   return result.config;
    // }

    // Hypothesis: The loadConfiguration function works correctly, but something else is different
    // about how local configs are handled in the ConfigService or service container

    expect(typeof loadConfiguration).toBe("function");

    // The issue might be:
    // 1. Different state management for local vs remote configs
    // 2. Assistant slug handling interfering with local configs
    // 3. Service container reload behavior differs for local configs
    // 4. Some caching or memoization issue specific to file paths
  });

  test("investigates assistant slug handling for local configs", async () => {
    // When switching to a local config, we call updateAssistantSlug(null)
    // When switching to a remote config, we call updateAssistantSlug(configPath)

    const { updateAssistantSlug, getAssistantSlug } = await import(
      "../auth/workos.js"
    );

    expect(typeof updateAssistantSlug).toBe("function");
    expect(typeof getAssistantSlug).toBe("function");

    // Question: Could the assistant slug clearing/setting be interfering
    // with the config loading process?

    // In loadConfiguration, when config is undefined, it checks for saved assistant slug:
    // const assistantSlug = getAssistantSlug(authConfig);
    // if (assistantSlug) { config = assistantSlug; }

    // Potential issue: If we're switching TO a local config but the assistant slug
    // is still set from a previous remote config, could that interfere?
  });

  test("checks if ConfigService state management differs for local configs", async () => {
    const { ConfigService } = await import("../services/ConfigService.js");

    // The ConfigService.updateConfigPath method should work the same for both types:
    // 1. Load new config via loadConfiguration(authConfig, newConfigPath, ...)
    // 2. Update this.currentState = { config, configPath: newConfigPath }
    // 3. Call serviceContainer.set(CONFIG, this.currentState)
    // 4. Call serviceContainer.reload(MODEL) and serviceContainer.reload(MCP)

    // But maybe there's a subtle difference in how the state is managed?

    const configService = new ConfigService();
    expect(typeof configService.getState).toBe("function");

    // The state should be: { config: AssistantUnrolled, configPath: string | undefined }
    // This should be the same regardless of whether configPath is a file or slug
  });
});
