import { describe, expect, it, beforeEach } from "vitest";

import { modeService } from "../services/ModeService.js";

describe("UserInput Keyboard Shortcuts", () => {
  beforeEach(() => {
    // Reset to normal mode for each test
    modeService.initialize({});
  });

  describe("mode cycling logic", () => {
    it("should cycle through modes in correct order", () => {
      // Initially should be normal mode
      expect(modeService.getCurrentMode()).toBe("normal");

      // Cycle to plan
      modeService.switchMode("plan");
      expect(modeService.getCurrentMode()).toBe("plan");

      // Cycle to auto
      modeService.switchMode("auto");
      expect(modeService.getCurrentMode()).toBe("auto");

      // Cycle back to normal
      modeService.switchMode("normal");
      expect(modeService.getCurrentMode()).toBe("normal");
    });

    it("should cycle through all modes sequentially", () => {
      const modes = ["normal", "plan", "auto"] as const;

      // Test cycling through all modes
      for (let i = 0; i < modes.length * 2; i++) {
        const expectedMode = modes[i % modes.length];
        modeService.switchMode(expectedMode);
        expect(modeService.getCurrentMode()).toBe(expectedMode);
      }
    });
  });
});
