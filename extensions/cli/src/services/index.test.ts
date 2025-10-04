import { vi } from "vitest";

import { WorkflowService } from "./WorkflowService.js";

import { initializeServices, services } from "./index.js";

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
  // let mockToolPermissionsService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
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
          workflowFile: null,
          workflowModelName: null,
          workflowService: expect.any(WorkflowService),
        },
      );
    });
  });
});
