import { vi } from "vitest";

import { modeService } from "./ModeService.js";
import { serviceContainer } from "./ServiceContainer.js";

import { initializeServices } from "./index.js";

// Mock the onboarding module
vi.mock("../onboarding.js", () => ({
  initializeWithOnboarding: vi.fn().mockResolvedValue({ wasOnboarded: false }),
  createOrUpdateConfig: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth module
vi.mock("../auth/workos.js", () => ({
  loadAuthConfig: vi.fn().mockReturnValue({}),
}));

describe("initializeServices", () => {
  let mockModeService: any;
  let mockServiceContainer: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock mode service
    mockModeService = {
      initialize: vi.fn(),
      getCurrentMode: vi.fn(),
      getToolPermissionService: vi.fn().mockReturnValue({
        getState: vi.fn().mockReturnValue({
          currentMode: "normal",
          isHeadless: false,
          permissions: { policies: [] },
        }),
      }),
    };

    // Create mock service container
    mockServiceContainer = {
      registerValue: vi.fn(),
      register: vi.fn(),
      initializeAll: vi.fn().mockResolvedValue(undefined),
    };

    // Set up mocks
    (modeService as any).initialize = mockModeService.initialize;
    (modeService as any).getCurrentMode = mockModeService.getCurrentMode;
    (modeService as any).getToolPermissionService =
      mockModeService.getToolPermissionService;

    // Mock serviceContainer methods
    (serviceContainer as any).registerValue =
      mockServiceContainer.registerValue;
    (serviceContainer as any).register = mockServiceContainer.register;
    (serviceContainer as any).initializeAll =
      mockServiceContainer.initializeAll;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mode conversion", () => {
    it("should pass only readonly flag for plan mode", async () => {
      await initializeServices({
        headless: true, // Skip onboarding
        toolPermissionOverrides: {
          mode: "plan",
          allow: ["tool1"],
          ask: ["tool2"],
          exclude: ["tool3"],
        },
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        allow: ["tool1"],
        ask: ["tool2"],
        exclude: ["tool3"],
        readonly: true,
        isHeadless: true,
        // auto should NOT be set
      });
    });

    it("should pass only auto flag for auto mode", async () => {
      await initializeServices({
        headless: true, // Skip onboarding
        toolPermissionOverrides: {
          mode: "auto",
          allow: ["tool1"],
          ask: ["tool2"],
          exclude: ["tool3"],
        },
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        allow: ["tool1"],
        ask: ["tool2"],
        exclude: ["tool3"],
        auto: true,
        isHeadless: true,
        // readonly should NOT be set
      });
    });

    it("should pass no mode flags for normal mode", async () => {
      await initializeServices({
        headless: true, // Skip onboarding
        toolPermissionOverrides: {
          mode: "normal",
          allow: ["tool1"],
          ask: ["tool2"],
          exclude: ["tool3"],
        },
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        allow: ["tool1"],
        ask: ["tool2"],
        exclude: ["tool3"],
        isHeadless: true,
        // Neither readonly nor auto should be set
      });
    });

    it("should pass no mode flags when mode is undefined", async () => {
      await initializeServices({
        headless: true, // Skip onboarding
        toolPermissionOverrides: {
          allow: ["tool1"],
          ask: ["tool2"],
          exclude: ["tool3"],
        },
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        allow: ["tool1"],
        ask: ["tool2"],
        exclude: ["tool3"],
        isHeadless: true,
        // Neither readonly nor auto should be set
      });
    });

    it("should call initialize with defaults when no toolPermissionOverrides provided", async () => {
      await initializeServices({
        headless: true, // Skip onboarding
      });

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        isHeadless: true,
      });
    });
  });
});
