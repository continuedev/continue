import { render } from "ink-testing-library";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { initializeServices, services } from "src/services/index.js";

import { ModeIndicator } from "./ModeIndicator.js";

describe("ModeIndicator", () => {
  const toolPermissionService = services.toolPermissions;
  beforeEach(async () => {
    // Reset to normal mode for each test
    await initializeServices({
      headless: true,
      toolPermissionOverrides: {
        mode: "normal",
      },
    });
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
      toolPermissionService.switchMode("plan");
      const { lastFrame } = render(<ModeIndicator />);
      expect(lastFrame()).toContain("plan]");
    });

    it("should prioritize mode prop over service mode", () => {
      toolPermissionService.switchMode("plan");
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
      toolPermissionService.switchMode("plan");
      rerender(<ModeIndicator />);
      expect(lastFrame()).toContain("plan]");

      // Switch to auto
      toolPermissionService.switchMode("auto");
      rerender(<ModeIndicator />);
      expect(lastFrame()).toContain("auto]");

      // Switch back to normal
      toolPermissionService.switchMode("normal");
      rerender(<ModeIndicator />);
      expect(lastFrame()).toBe("");
    });
  });
});
