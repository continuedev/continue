import { vi } from "vitest";

import { modeService } from "./ModeService.js";

import { initializeServices } from "./index.js";

describe("initializeServices", () => {
  let mockModeService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock mode service
    mockModeService = {
      initialize: vi.fn(),
      getCurrentMode: vi.fn(),
    };

    // Set up modeService mock
    (modeService as any).initialize = mockModeService.initialize;
    (modeService as any).getCurrentMode = mockModeService.getCurrentMode;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mode conversion", () => {
    it("should pass only readonly flag for plan mode", async () => {
      await initializeServices({
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
        // auto should NOT be set
      });
    });

    it("should pass only auto flag for auto mode", async () => {
      await initializeServices({
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
        // readonly should NOT be set
      });
    });

    it("should pass no mode flags for normal mode", async () => {
      await initializeServices({
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
        // Neither readonly nor auto should be set
      });
    });

    it("should pass no mode flags when mode is undefined", async () => {
      await initializeServices({
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
        // Neither readonly nor auto should be set
      });
    });

    it("should call initialize with defaults when no toolPermissionOverrides provided", async () => {
      await initializeServices({});

      expect(mockModeService.initialize).toHaveBeenCalledWith({
        isHeadless: undefined,
      });
    });
  });
});
