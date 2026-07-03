import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const renderState = vi.hoisted(() => ({
  element: undefined as
    | { props?: { onSelect?: (sessionId: string) => Promise<void> } }
    | undefined,
}));

import * as sessionModule from "../session.js";

import { chat } from "./chat.js";
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
  render: vi.fn((element) => {
    renderState.element = element;
    return { unmount: vi.fn() };
  }),
}));

// Mock react with createContext
vi.mock("react", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    createElement: vi.fn((type: any, props: any, ...children: any[]) => ({
      type,
      props,
      children,
    })),
    createContext: vi.fn(() => ({ Provider: vi.fn(), Consumer: vi.fn() })),
  };
});

// Mock the chat command
vi.mock("./chat.js", () => ({
  chat: vi.fn(),
}));

// Mock the remote command
vi.mock("./remote.js", () => ({
  remote: vi.fn(),
}));

describe("listSessionsCommand", () => {
  const mockListSessions = vi.mocked(sessionModule.listSessions);
  const mockLoadSessionById = vi.mocked(sessionModule.loadSessionById);
  const mockChat = vi.mocked(chat);

  beforeEach(() => {
    vi.clearAllMocks();
    renderState.element = undefined;
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
        isRemote: false,
      },
      {
        sessionId: "session-2",
        title: "Session 2",
        dateCreated: "2023-01-01T09:00:00.000Z",
        workspaceDirectory: "/workspace",
        firstUserMessage: "Test message",
        isRemote: true,
        remoteId: "agent-123",
      },
    ];

    mockListSessions.mockResolvedValue(mockSessions);

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
              isRemote: false,
              remoteId: undefined,
            },
            {
              id: "session-2",
              timestamp: "2023-01-01T09:00:00.000Z",
              workspaceDirectory: "/workspace",
              title: "Session 2",
              firstUserMessage: "Test message",
              isRemote: true,
              remoteId: "agent-123",
            },
          ],
        },
        null,
        2,
      ),
    );

    consoleSpy.mockRestore();
  });

  it("should call listSessions without limit restrictions", async () => {
    mockListSessions.mockResolvedValue([]);

    // JSON mode - should call listSessions (implementation decides limit)
    await listSessionsCommand({ format: "json" });
    expect(mockListSessions).toHaveBeenCalled();

    // TUI mode - should call listSessions (implementation decides limit)
    await listSessionsCommand({});
    expect(mockListSessions).toHaveBeenCalled();

    // Verify it was called twice total
    expect(mockListSessions).toHaveBeenCalledTimes(2);
  });

  it("should handle empty sessions gracefully in JSON mode", async () => {
    mockListSessions.mockResolvedValue([]);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await listSessionsCommand({ format: "json" });

    expect(consoleSpy).toHaveBeenCalledWith(
      JSON.stringify({ sessions: [] }, null, 2),
    );

    consoleSpy.mockRestore();
  });

  it("should handle empty sessions gracefully in TUI mode", async () => {
    mockListSessions.mockResolvedValue([]);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await listSessionsCommand({});

    expect(consoleSpy).toHaveBeenCalledWith(
      "No previous sessions found. Start a new conversation with: cn",
    );

    consoleSpy.mockRestore();
  });

  it("should pass the selected session id to chat resume", async () => {
    const mockSessions = [
      {
        sessionId: "older-session",
        title: "Older session",
        dateCreated: "2023-01-01T09:00:00.000Z",
        workspaceDirectory: "/workspace",
        firstUserMessage: "Older message",
        isRemote: false,
      },
      {
        sessionId: "newer-session",
        title: "Newer session",
        dateCreated: "2023-01-01T10:00:00.000Z",
        workspaceDirectory: "/workspace",
        firstUserMessage: "Newer message",
        isRemote: false,
      },
    ];
    mockListSessions.mockResolvedValue(mockSessions);
    mockLoadSessionById.mockReturnValue({
      sessionId: "older-session",
      title: "Older session",
      workspaceDirectory: "/workspace",
      history: [],
    } as any);

    const commandPromise = listSessionsCommand({});
    await new Promise((resolve) => setImmediate(resolve));

    const onSelect = renderState.element?.props?.onSelect;
    expect(onSelect).toBeDefined();
    await onSelect!("older-session");
    await commandPromise;

    expect(mockLoadSessionById).toHaveBeenCalledWith("older-session");
    expect(mockChat).toHaveBeenCalledWith(undefined, {
      resume: true,
      resumeSessionId: "older-session",
      headless: false,
    });
  });
});
