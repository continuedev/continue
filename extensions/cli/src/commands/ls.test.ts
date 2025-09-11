import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as sessionModule from "../session.js";

import { listSessionsCommand } from "./ls.js";

// Mock the session module
vi.mock("../session.js", () => ({
  listSessions: vi.fn(),
  loadSessionById: vi.fn(),
}));

// Mock the TUI components
vi.mock("../ui/SessionSelector.js", () => ({
  SessionSelector: () => null,
}));

// Mock ink
vi.mock("ink", () => ({
  render: vi.fn(() => ({ unmount: vi.fn() })),
}));

// Mock react
vi.mock("react", () => ({
  createElement: vi.fn(),
}));

// Mock the chat command
vi.mock("./chat.js", () => ({
  chat: vi.fn(),
}));

describe("listSessionsCommand", () => {
  const mockListSessions = vi.mocked(sessionModule.listSessions);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should output JSON format when format is json", async () => {
    const mockSessions = [
      {
        sessionId: "session-1",
        title: "Session 1",
        dateCreated: "2023-01-01T10:00:00.000Z",
        workspaceDirectory: "/workspace",
        firstUserMessage: "Hello world",
      },
      {
        sessionId: "session-2",
        title: "Session 2",
        dateCreated: "2023-01-01T09:00:00.000Z",
        workspaceDirectory: "/workspace",
        firstUserMessage: "Test message",
      },
    ];

    mockListSessions.mockReturnValue(mockSessions);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await listSessionsCommand({ format: "json" });

    expect(consoleSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          sessions: [
            {
              id: "session-1",
              timestamp: "2023-01-01T10:00:00.000Z",
              workspaceDirectory: "/workspace",
              title: "Session 1",
              firstUserMessage: "Hello world",
            },
            {
              id: "session-2",
              timestamp: "2023-01-01T09:00:00.000Z",
              workspaceDirectory: "/workspace",
              title: "Session 2",
              firstUserMessage: "Test message",
            },
          ],
        },
        null,
        2,
      ),
    );

    consoleSpy.mockRestore();
  });

  it("should use limit of 10 for JSON and 20 for TUI", async () => {
    mockListSessions.mockReturnValue([]);

    // JSON mode should fetch 10
    await listSessionsCommand({ format: "json" });
    expect(mockListSessions).toHaveBeenCalledWith(10);

    // TUI mode should fetch 20 (so UI can choose how many to display)
    await listSessionsCommand({});
    expect(mockListSessions).toHaveBeenCalledWith(20);
  });

  it("should handle empty sessions gracefully in JSON mode", async () => {
    mockListSessions.mockReturnValue([]);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await listSessionsCommand({ format: "json" });

    expect(consoleSpy).toHaveBeenCalledWith(
      JSON.stringify({ sessions: [] }, null, 2),
    );

    consoleSpy.mockRestore();
  });

  it("should handle empty sessions gracefully in TUI mode", async () => {
    mockListSessions.mockReturnValue([]);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await listSessionsCommand({});

    expect(consoleSpy).toHaveBeenCalledWith(
      "No previous sessions found. Start a new conversation with: cn",
    );

    consoleSpy.mockRestore();
  });
});
