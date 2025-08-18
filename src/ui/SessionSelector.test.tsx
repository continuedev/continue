import { 
  subDays, 
  subMonths, 
  subYears,
  startOfDay,
  addHours 
} from "date-fns";
import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { SessionMetadata } from "../session.js";

import { SessionSelector } from "./SessionSelector.js";

describe("SessionSelector", () => {
  const mockOnSelect = vi.fn();
  const mockOnExit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats timestamps correctly for different time periods", () => {
    const now = new Date();
    const today = addHours(startOfDay(now), 14); // 2 PM today
    const yesterday = subDays(today, 1);
    const thisWeek = subDays(today, 3); // 3 days ago (this week)
    const thisYear = subMonths(today, 2); // 2 months ago (this year)
    const lastYear = subYears(today, 1); // 1 year ago

    const sessions: SessionMetadata[] = [
      {
        id: "session-1",
        path: "/test/session-1.json",
        timestamp: today,
        messageCount: 10,
        firstUserMessage: "Today's session",
      },
      {
        id: "session-2", 
        path: "/test/session-2.json",
        timestamp: yesterday,
        messageCount: 5,
        firstUserMessage: "Yesterday's session",
      },
      {
        id: "session-3",
        path: "/test/session-3.json",
        timestamp: thisWeek, 
        messageCount: 8,
        firstUserMessage: "This week's session",
      },
      {
        id: "session-4",
        path: "/test/session-4.json",
        timestamp: thisYear,
        messageCount: 12,
        firstUserMessage: "This year's session", 
      },
      {
        id: "session-5",
        path: "/test/session-5.json",
        timestamp: lastYear,
        messageCount: 3,
        firstUserMessage: "Last year's session",
      },
    ];

    const { lastFrame } = render(
      <SessionSelector 
        sessions={sessions}
        onSelect={mockOnSelect}
        onExit={mockOnExit}
      />
    );

    // Check that the output contains expected date formats
    expect(lastFrame()).toContain("2:00 PM"); // Today should show time
    expect(lastFrame()).toContain("yesterday"); // Yesterday should show "yesterday"
    
    // This week should show day name (we can't predict exact day without knowing when test runs)
    // but we can check it doesn't contain "ago" which was the old format
    expect(lastFrame()).not.toContain("days ago");
    
    // This year should show month/day format like "Oct 18" (no "ago")
    expect(lastFrame()).toMatch(/[A-Z][a-z]{2} \d{1,2}/); // MMM d format
    
    // Last year should include the year
    expect(lastFrame()).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/); // MMM d, yyyy format
  });

  it("handles empty sessions gracefully", () => {
    const { lastFrame } = render(
      <SessionSelector 
        sessions={[]}
        onSelect={mockOnSelect}
        onExit={mockOnExit}
      />
    );

    expect(lastFrame()).toContain("No previous sessions found");
    expect(lastFrame()).toContain("Start a new conversation with: cn");
  });

  it("handles sessions without first user message", () => {
    const sessions: SessionMetadata[] = [
      {
        id: "session-1",
        path: "/test/session-1.json",
        timestamp: new Date(),
        messageCount: 0,
        firstUserMessage: undefined,
      },
    ];

    const { lastFrame } = render(
      <SessionSelector 
        sessions={sessions}
        onSelect={mockOnSelect}
        onExit={mockOnExit}
      />
    );

    expect(lastFrame()).toContain("(no messages)");
  });
});