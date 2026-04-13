import { parseDate, groupSessionsByDate, SessionGroup } from "./util";
import { BaseSessionMetadata } from "core";

describe("History utilities", () => {
  describe("parseDate", () => {
    it("should parse ISO date string", () => {
      const dateStr = "2024-01-15T10:30:00.000Z";
      const result = parseDate(dateStr);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(dateStr);
    });

    it("should parse timestamp string", () => {
      const timestamp = "1705315800000"; // Jan 15, 2024
      const result = parseDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(1705315800000);
    });

    it("should handle date string formats", () => {
      const dateStr = "2024-01-15";
      const result = parseDate(dateStr);
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January is 0
      expect(result.getDate()).toBe(15);
    });

    it("should fallback to timestamp parsing for invalid date strings", () => {
      // When passed an invalid date string, it tries parseInt
      const invalidButNumericStr = "1705315800000";
      const result = parseDate(invalidButNumericStr);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(1705315800000);
    });
  });

  describe("groupSessionsByDate", () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 1000 * 60 * 60).toISOString();
    const twoDaysAgo = new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString();
    const fiveDaysAgo = new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString();
    const tenDaysAgo = new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString();
    const fortyDaysAgo = new Date(now - 1000 * 60 * 60 * 24 * 40).toISOString();

    const createSession = (
      id: string,
      dateCreated: string,
    ): BaseSessionMetadata => ({
      sessionId: id,
      dateCreated,
      title: `Session ${id}`,
      workspaceDirectory: "/test",
    });

    it("should return empty array for empty input", () => {
      const result = groupSessionsByDate([]);
      expect(result).toEqual([]);
    });

    it("should group sessions from today", () => {
      const sessions = [createSession("1", oneHourAgo)];
      const result = groupSessionsByDate(sessions);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Today");
      expect(result[0].sessions).toHaveLength(1);
    });

    it("should group sessions from this week", () => {
      const sessions = [createSession("1", twoDaysAgo)];
      const result = groupSessionsByDate(sessions);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("This Week");
      expect(result[0].sessions).toHaveLength(1);
    });

    it("should group sessions from this month", () => {
      const sessions = [createSession("1", tenDaysAgo)];
      const result = groupSessionsByDate(sessions);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("This Month");
      expect(result[0].sessions).toHaveLength(1);
    });

    it("should group older sessions", () => {
      const sessions = [createSession("1", fortyDaysAgo)];
      const result = groupSessionsByDate(sessions);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Older");
      expect(result[0].sessions).toHaveLength(1);
    });

    it("should correctly group multiple sessions across all time periods", () => {
      const sessions = [
        createSession("today1", oneHourAgo),
        createSession("today2", oneHourAgo),
        createSession("week1", twoDaysAgo),
        createSession("week2", fiveDaysAgo),
        createSession("month1", tenDaysAgo),
        createSession("older1", fortyDaysAgo),
      ];
      const result = groupSessionsByDate(sessions);

      expect(result).toHaveLength(4);

      const todayGroup = result.find((g) => g.label === "Today");
      expect(todayGroup?.sessions).toHaveLength(2);

      const weekGroup = result.find((g) => g.label === "This Week");
      expect(weekGroup?.sessions).toHaveLength(2);

      const monthGroup = result.find((g) => g.label === "This Month");
      expect(monthGroup?.sessions).toHaveLength(1);

      const olderGroup = result.find((g) => g.label === "Older");
      expect(olderGroup?.sessions).toHaveLength(1);
    });

    it("should only include groups that have sessions", () => {
      const sessions = [
        createSession("today1", oneHourAgo),
        createSession("older1", fortyDaysAgo),
      ];
      const result = groupSessionsByDate(sessions);

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("Today");
      expect(result[1].label).toBe("Older");
    });

    it("should preserve session data in groups", () => {
      const session = createSession("test-id", oneHourAgo);
      const result = groupSessionsByDate([session]);

      expect(result[0].sessions[0]).toEqual(session);
    });

    it("should handle sessions at boundary times", () => {
      // Session exactly 24 hours ago should be in "This Week"
      const exactlyYesterday = new Date(
        now - 1000 * 60 * 60 * 24,
      ).toISOString();
      const sessions = [createSession("1", exactlyYesterday)];
      const result = groupSessionsByDate(sessions);

      // Note: The boundary is "yesterday" which is 24 hours ago
      // Sessions <= yesterday go to "This Week" or later
      expect(result[0].label).toBe("This Week");
    });

    it("should handle sessions exactly at week boundary", () => {
      // Session exactly 7 days ago should be in "This Month"
      const exactlyLastWeek = new Date(
        now - 1000 * 60 * 60 * 24 * 7,
      ).toISOString();
      const sessions = [createSession("1", exactlyLastWeek)];
      const result = groupSessionsByDate(sessions);

      expect(result[0].label).toBe("This Month");
    });

    it("should handle sessions exactly at month boundary", () => {
      // Session exactly 30 days ago should be in "Older"
      const exactlyLastMonth = new Date(
        now - 1000 * 60 * 60 * 24 * 30,
      ).toISOString();
      const sessions = [createSession("1", exactlyLastMonth)];
      const result = groupSessionsByDate(sessions);

      expect(result[0].label).toBe("Older");
    });
  });
});
