import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, beforeEach } from "vitest";

import { modeService } from "../../services/ModeService.js";

import { ModeIndicator } from "./ModeIndicator.js";

describe("ModeIndicator", () => {
  beforeEach(() => {
    // Reset to normal mode for each test
    modeService.initialize({});
  });

  describe("mode display", () => {
    it("should not render anything for normal mode", () => {
      const { lastFrame } = render(<ModeIndicator />);
      expect(lastFrame()).toBe("");
    });

    it("should display plan mode with blue color", () => {
      const { lastFrame } = render(<ModeIndicator mode="plan" />);
      expect(lastFrame()).toContain("plan]");
    });

    it("should display auto mode with green color", () => {
      const { lastFrame } = render(<ModeIndicator mode="auto" />);
      expect(lastFrame()).toContain("auto]");
    });

    it("should use current mode from service when no mode prop provided", () => {
      modeService.switchMode("plan");
      const { lastFrame } = render(<ModeIndicator />);
      expect(lastFrame()).toContain("plan]");
    });

    it("should prioritize mode prop over service mode", () => {
      modeService.switchMode("plan");
      const { lastFrame } = render(<ModeIndicator mode="auto" />);
      expect(lastFrame()).toContain("auto]");
    });
  });

  describe("mode changes", () => {
    it("should update when mode changes in service", () => {
      const { lastFrame, rerender } = render(<ModeIndicator />);

      // Initially normal (no display)
      expect(lastFrame()).toBe("");

      // Switch to plan
      modeService.switchMode("plan");
      rerender(<ModeIndicator />);
      expect(lastFrame()).toContain("plan]");

      // Switch to auto
      modeService.switchMode("auto");
      rerender(<ModeIndicator />);
      expect(lastFrame()).toContain("auto]");

      // Switch back to normal
      modeService.switchMode("normal");
      rerender(<ModeIndicator />);
      expect(lastFrame()).toBe("");
    });
  });
});
