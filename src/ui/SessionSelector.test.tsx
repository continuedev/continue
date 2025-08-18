import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { SessionMetadata } from "../session.js";

import { SessionSelector } from "./SessionSelector.js";

describe("SessionSelector", () => {
  const mockSessions: SessionMetadata[] = [
    {
      id: "session-1",
      path: "/path/1.json",
      timestamp: new Date("2023-01-01T10:00:00Z"),
      messageCount: 5,
      firstUserMessage: "Hello world",
    },
    {
      id: "session-2",
      path: "/path/2.json", 
      timestamp: new Date("2023-01-01T09:00:00Z"),
      messageCount: 3,
      firstUserMessage: "Test message",
    },
  ];

  it("should render sessions with first user message", () => {
    const onSelect = vi.fn();
    const onExit = vi.fn();

    const { lastFrame } = render(
      <SessionSelector
        sessions={mockSessions}
        onSelect={onSelect}
        onExit={onExit}
      />
    );

    expect(lastFrame()).toContain("Hello world");
    expect(lastFrame()).toContain("Test message");
    expect(lastFrame()).toContain("Recent Sessions");
  });

  it("should handle empty sessions", () => {
    const onSelect = vi.fn();
    const onExit = vi.fn();

    const { lastFrame } = render(
      <SessionSelector
        sessions={[]}
        onSelect={onSelect}
        onExit={onExit}
      />
    );

    expect(lastFrame()).toContain("No previous sessions found");
  });

  it("should limit sessions based on terminal height", () => {
    // Mock a small terminal height
    const originalRows = process.stdout.rows;
    process.stdout.rows = 10; // Small height

    // Create many sessions
    const manySessions = Array.from({ length: 20 }, (_, i) => ({
      id: `session-${i}`,
      path: `/path/${i}.json`,
      timestamp: new Date(`2023-01-01T${10 + i}:00:00Z`),
      messageCount: 5,
      firstUserMessage: `Message ${i}`,
    }));

    const onSelect = vi.fn();
    const onExit = vi.fn();

    const { lastFrame } = render(
      <SessionSelector
        sessions={manySessions}
        onSelect={onSelect}
        onExit={onExit}
      />
    );

    const output = lastFrame();
    
    // Should show truncation message when limited
    expect(output).toContain("Showing");
    expect(output).toContain("of 20 sessions");
    
    // Should not show all 20 sessions
    expect(output).not.toContain("Message 10");

    // Restore original rows
    process.stdout.rows = originalRows;
  });
});