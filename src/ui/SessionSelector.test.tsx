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

});