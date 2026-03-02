import { beforeEach, describe, expect, it, vi } from "vitest";

import { initializeServices, services } from "../services/index.js";

import { exitPlanModeTool } from "./planMode.js";

describe("exitPlanModeTool", () => {
  beforeEach(async () => {
    await initializeServices({
      headless: true,
      toolPermissionOverrides: {
        mode: "plan",
      },
    });
  });

  describe("metadata", () => {
    it("should have the correct name", () => {
      expect(exitPlanModeTool.name).toBe("ExitPlanMode");
    });

    it("should be marked as readonly", () => {
      expect(exitPlanModeTool.readonly).toBe(true);
    });

    it("should be a built-in tool", () => {
      expect(exitPlanModeTool.isBuiltIn).toBe(true);
    });

    it("should require a summary parameter", () => {
      expect(exitPlanModeTool.parameters.required).toContain("summary");
    });
  });

  describe("preprocess", () => {
    it("should return a preview with the summary", async () => {
      const result = await exitPlanModeTool.preprocess!({
        summary: "Refactor the auth module",
      });
      expect(result.preview).toBeDefined();
      expect(result.preview![0].content).toContain("Refactor the auth module");
      expect(result.preview![0].color).toBe("blue");
    });
  });

  describe("run", () => {
    it("should switch from plan mode to normal mode", async () => {
      expect(services.toolPermissions.getCurrentMode()).toBe("plan");

      const result = await exitPlanModeTool.run({
        summary: "Add error handling to the API layer",
      });

      expect(services.toolPermissions.getCurrentMode()).toBe("normal");
      expect(result).toContain("Plan approved");
      expect(result).toContain("Add error handling to the API layer");
    });

    it("should return informational message when not in plan mode", async () => {
      // Switch to normal mode first
      services.toolPermissions.switchMode("normal");

      const result = await exitPlanModeTool.run({
        summary: "Some plan",
      });

      expect(result).toContain("not currently in plan mode");
      // Mode should remain normal
      expect(services.toolPermissions.getCurrentMode()).toBe("normal");
    });

    it("should include the summary in the result", async () => {
      const result = await exitPlanModeTool.run({
        summary: "Migrate database schema to v2",
      });

      expect(result).toContain("Migrate database schema to v2");
    });

    it("should instruct the agent to track progress with Checklist", async () => {
      const result = await exitPlanModeTool.run({
        summary: "Refactor module",
      });

      expect(result).toContain("Checklist");
      expect(result).toContain("mark items as completed");
    });
  });
});
