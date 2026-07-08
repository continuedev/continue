import { beforeEach, describe, expect, it } from "vitest";

import { services } from "../services/index.js";
const toolPermissionService = services.toolPermissions;
describe("UserInput Keyboard Shortcuts", () => {
  beforeEach(() => {
    // Reset to normal mode for each test
    toolPermissionService.initialize({});
  });

  describe("mode cycling logic", () => {
    it("should cycle through modes in correct order", () => {
      // Initially should be normal mode
      expect(toolPermissionService.getCurrentMode()).toBe("normal");

      // Cycle to plan
      toolPermissionService.switchMode("plan");
      expect(toolPermissionService.getCurrentMode()).toBe("plan");

      // Cycle to auto
      toolPermissionService.switchMode("auto");
      expect(toolPermissionService.getCurrentMode()).toBe("auto");

      // Cycle back to normal
      toolPermissionService.switchMode("normal");
      expect(toolPermissionService.getCurrentMode()).toBe("normal");
    });

    it("should cycle through all modes sequentially", () => {
      const modes = ["normal", "plan", "auto"] as const;

      // Test cycling through all modes
      for (let i = 0; i < modes.length * 2; i++) {
        const expectedMode = modes[i % modes.length];
        toolPermissionService.switchMode(expectedMode);
        expect(toolPermissionService.getCurrentMode()).toBe(expectedMode);
      }
    });
  });
});
