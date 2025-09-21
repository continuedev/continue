import { describe, it, expect, beforeEach } from "vitest";

import {
  updateChecklist,
  getCurrentChecklist,
  clearChecklist,
  hasChecklist,
  updateChecklistFromToolResult,
} from "./checklistManager.js";

describe("checklistManager", () => {
  beforeEach(() => {
    clearChecklist();
  });

  describe("basic operations", () => {
    it("should start with no checklist", () => {
      expect(hasChecklist()).toBe(false);
      expect(getCurrentChecklist()).toBe(null);
    });

    it("should update and retrieve checklist", () => {
      const testChecklist = "- [x] Task 1\n- [ ] Task 2";
      updateChecklist(testChecklist);
      
      expect(hasChecklist()).toBe(true);
      expect(getCurrentChecklist()).toBe(testChecklist);
    });

    it("should clear checklist", () => {
      updateChecklist("- [x] Task 1");
      expect(hasChecklist()).toBe(true);
      
      clearChecklist();
      expect(hasChecklist()).toBe(false);
      expect(getCurrentChecklist()).toBe(null);
    });
  });

  describe("updateChecklistFromToolResult", () => {
    it("should update checklist when Checklist tool is used", () => {
      const toolResult = "Task list status:\n- [x] Complete task 1\n- [ ] Start task 2";
      updateChecklistFromToolResult(toolResult, "Checklist");
      
      expect(hasChecklist()).toBe(true);
      expect(getCurrentChecklist()).toBe("- [x] Complete task 1\n- [ ] Start task 2");
    });

    it("should not update checklist for other tools", () => {
      updateChecklistFromToolResult("File written successfully", "Write");
      
      expect(hasChecklist()).toBe(false);
      expect(getCurrentChecklist()).toBe(null);
    });

    it("should not update if result doesn't have expected prefix", () => {
      updateChecklistFromToolResult("Some other checklist content", "Checklist");
      
      expect(hasChecklist()).toBe(false);
      expect(getCurrentChecklist()).toBe(null);
    });

    it("should handle empty checklist content", () => {
      updateChecklistFromToolResult("Task list status:\n", "Checklist");
      
      expect(hasChecklist()).toBe(true);
      expect(getCurrentChecklist()).toBe("");
    });
  });
});