import { Configuration, DefaultApi } from "@continuedev/sdk/dist/api";
import { vi } from "vitest";

import { initializeServices, services } from "./index.js";

// Mock the onboarding module
vi.mock("../onboarding.js", () => ({
  initializeWithOnboarding: vi.fn().mockResolvedValue({ wasOnboarded: false }),
  createOrUpdateConfig: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth module
vi.mock("../auth/workos.js", () => ({
  loadAuthConfig: vi.fn().mockReturnValue({}),
  getConfigUri: vi.fn().mockReturnValue(null),
}));

// Mock the config loader
vi.mock("../configLoader.js", () => ({
  loadConfiguration: vi.fn().mockResolvedValue({
    config: { name: "test", version: "1.0.0" },
    source: { type: "test" },
  }),
}));

describe("initializeServices", () => {
  // let mockToolPermissionsService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock service methods to avoid actual initialization
    vi.spyOn(services.auth, "initialize").mockResolvedValue({
      authConfig: {
        accessToken: "",
        expiresAt: 123,
        organizationId: "",
        refreshToken: "",
        userEmail: "",
      },
      isAuthenticated: false,
    });
    vi.spyOn(services.apiClient, "initialize").mockResolvedValue({
      apiClient: new DefaultApi(
        new Configuration({
          basePath: "",
          accessToken: "",
        }),
      ),
    });
    vi.spyOn(services.agentFile, "initialize").mockResolvedValue({
      slug: null,
      agentFile: null,
      agentFileModel: null,
      parsedRules: null,
      parsedTools: null,
    });
    vi.spyOn(services.config, "initialize").mockResolvedValue({
      config: { name: "test", version: "1.0.0" },
      configPath: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mode conversion", () => {
    it("should pass only auto flag for auto mode", async () => {
      const spy = vi.spyOn(services.toolPermissions, "initialize");
      await initializeServices({
        headless: true, // Skip onboarding
        toolPermissionOverrides: {
          mode: "auto",
          allow: ["tool1"],
          ask: ["tool2"],
          exclude: ["tool3"],
        },
      });

      expect(spy).toHaveBeenCalledWith(
        {
          allow: ["tool1"],
          ask: ["tool2"],
          exclude: ["tool3"],
          mode: "auto",
          isHeadless: true,
        },
        {
          slug: null,
          agentFile: null,
          agentFileModel: null,
          parsedRules: null,
          parsedTools: null,
        },
      );
    });
  });
});
