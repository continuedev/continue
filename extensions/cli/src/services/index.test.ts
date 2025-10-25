import { vi } from "vitest";

import { MCPService } from "./MCPService.js";

import { initializeServices, services } from "./index.js";

describe("initializeServices", () => {
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
        {
          connections: [],
          mcpService: expect.any(MCPService),
          prompts: [],
          tools: [],
        },
      );
    });
  });
});
