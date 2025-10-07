import { describe, expect, it } from "vitest";

import {
  AGENT_STATUS_ORDER,
  compareAgentStatus,
  compareAlphabetical,
  comparePRStatus,
  getAgentStatusSortIndex,
  getPRStatusSortIndex,
  PR_STATUS_ORDER,
} from "./agent-session-ordering.js";

describe("agent-session-ordering", () => {
  describe("PR_STATUS_ORDER", () => {
    it("should have the correct order", () => {
      expect(PR_STATUS_ORDER).toEqual([
        "No PR",
        "Draft",
        "Open",
        "Merged",
        "Closed",
      ]);
    });
  });

  describe("AGENT_STATUS_ORDER", () => {
    it("should have the correct order", () => {
      expect(AGENT_STATUS_ORDER).toEqual([
        "Planning",
        "Working",
        "Blocked",
        "Done",
      ]);
    });
  });

  describe("getPRStatusSortIndex", () => {
    it("should return correct indices for known statuses", () => {
      expect(getPRStatusSortIndex("No PR")).toBe(0);
      expect(getPRStatusSortIndex("Draft")).toBe(1);
      expect(getPRStatusSortIndex("Open")).toBe(2);
      expect(getPRStatusSortIndex("Merged")).toBe(3);
      expect(getPRStatusSortIndex("Closed")).toBe(4);
    });

    it("should return Infinity for unknown statuses", () => {
      expect(getPRStatusSortIndex("Unknown")).toBe(Infinity);
      expect(getPRStatusSortIndex("Pending")).toBe(Infinity);
    });
  });

  describe("getAgentStatusSortIndex", () => {
    it("should return correct indices for known statuses", () => {
      expect(getAgentStatusSortIndex("Planning")).toBe(0);
      expect(getAgentStatusSortIndex("Working")).toBe(1);
      expect(getAgentStatusSortIndex("Blocked")).toBe(2);
      expect(getAgentStatusSortIndex("Done")).toBe(3);
    });

    it("should be case-insensitive", () => {
      expect(getAgentStatusSortIndex("PLANNING")).toBe(0);
      expect(getAgentStatusSortIndex("planning")).toBe(0);
      expect(getAgentStatusSortIndex("PlAnNiNg")).toBe(0);
      expect(getAgentStatusSortIndex("WORKING")).toBe(1);
      expect(getAgentStatusSortIndex("working")).toBe(1);
    });

    it("should return Infinity for unknown statuses", () => {
      expect(getAgentStatusSortIndex("Unknown")).toBe(Infinity);
      expect(getAgentStatusSortIndex("Pending")).toBe(Infinity);
    });
  });

  describe("comparePRStatus", () => {
    it("should sort PR statuses in the correct order", () => {
      const statuses = ["Closed", "No PR", "Open", "Draft", "Merged"];
      const sorted = statuses.sort(comparePRStatus);
      expect(sorted).toEqual(["No PR", "Draft", "Open", "Merged", "Closed"]);
    });

    it("should place unknown statuses at the end", () => {
      const statuses = ["Open", "Unknown", "Draft", "Pending"];
      const sorted = statuses.sort(comparePRStatus);
      expect(sorted.slice(0, 2)).toEqual(["Draft", "Open"]);
      // Unknown statuses should be at the end, alphabetically sorted
      expect(sorted.slice(2)).toEqual(["Pending", "Unknown"]);
    });

    it("should sort unknown statuses alphabetically", () => {
      const statuses = ["Zebra", "Apple", "No PR"];
      const sorted = statuses.sort(comparePRStatus);
      expect(sorted).toEqual(["No PR", "Apple", "Zebra"]);
    });
  });

  describe("compareAgentStatus", () => {
    it("should sort agent statuses in the correct order", () => {
      const statuses = ["Done", "Planning", "Blocked", "Working"];
      const sorted = statuses.sort(compareAgentStatus);
      expect(sorted).toEqual(["Planning", "Working", "Blocked", "Done"]);
    });

    it("should handle case-insensitive sorting", () => {
      const statuses = ["DONE", "planning", "BLOCKED", "Working"];
      const sorted = statuses.sort(compareAgentStatus);
      expect(sorted).toEqual(["planning", "Working", "BLOCKED", "DONE"]);
    });

    it("should place unknown statuses at the end", () => {
      const statuses = ["Working", "Unknown", "Planning", "Pending"];
      const sorted = statuses.sort(compareAgentStatus);
      expect(sorted.slice(0, 2)).toEqual(["Planning", "Working"]);
      // Unknown statuses should be at the end, alphabetically sorted
      expect(sorted.slice(2)).toEqual(["Pending", "Unknown"]);
    });
  });

  describe("compareAlphabetical", () => {
    it("should sort strings alphabetically", () => {
      const items = ["Zebra", "Apple", "Banana"];
      const sorted = items.sort(compareAlphabetical);
      expect(sorted).toEqual(["Apple", "Banana", "Zebra"]);
    });

    it("should be case-sensitive by default", () => {
      const items = ["zebra", "Apple", "banana"];
      const sorted = items.sort(compareAlphabetical);
      expect(sorted).toEqual(["Apple", "banana", "zebra"]);
    });
  });
});
