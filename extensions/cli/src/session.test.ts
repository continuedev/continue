import fs from "fs";
import os from "os";

import type { ChatHistoryItem, Session } from "core/index.js";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSession,
  createSession,
  getCurrentSession,
  hasSession,
  loadOrCreateSessionById,
  loadSession,
  saveSession,
  startNewSession,
  updateSessionHistory,
  updateSessionTitle,
} from "./session.js";

// Mock dependencies first, before any imports
vi.mock("os", () => ({
  default: {
    homedir: vi.fn(() => "/home/test"),
  },
  homedir: vi.fn(() => "/home/test"),
}));
vi.mock("fs");
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-123"),
}));
vi.mock("./util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
const mockHistoryManager: any = vi.hoisted(() => ({
  save: vi.fn((session: any) => {
    // Mimic writing the session payload to disk so expectations on fs still work
    fs.writeFileSync(
      `/home/test/.continue/sessions/${session.sessionId}.json`,
      JSON.stringify(session),
    );
  }),
  load: vi.fn(() => ({
    sessionId: "test-session-id",
    title: "Test Session",
    workspaceDirectory: "/test/workspace",
    history: [],
  })),
  list: vi.fn(() => []),
}));
vi.mock("core/util/history.js", () => ({
  default: mockHistoryManager,
}));

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

describe("SessionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the singleton between tests
    // @ts-ignore - accessing private static property for testing
    const SessionManager = (globalThis as any).SessionManager;
    if (SessionManager) {
      SessionManager.instance = null;
    }

    // Default mocks
    mockOs.homedir.mockReturnValue("/home/test");
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);
    mockFs.readFileSync.mockReturnValue("[]");
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.statSync.mockReturnValue({ mtime: new Date() } as any);

    // Ensure each test starts with a fresh session
    clearSession();
  });

  describe("getCurrentSession", () => {
    it("should create a new session if none exists", () => {
      const session = getCurrentSession();

      expect(session).toEqual({
        sessionId: "test-uuid-123",
        title: "Untitled Session",
        workspaceDirectory: process.cwd(),
        history: [],
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalCost: 0,
          promptTokensDetails: {
            cachedTokens: 0,
            cacheWriteTokens: 0,
          },
        },
      });
    });

    it("should return the same session on subsequent calls", () => {
      const session1 = getCurrentSession();
      const session2 = getCurrentSession();

      expect(session1).toBe(session2); // Same reference
    });
  });

  describe("createSession", () => {
    it("should create a new session with default values", () => {
      const session = createSession();

      expect(session).toEqual({
        sessionId: "test-uuid-123",
        title: "Untitled Session",
        workspaceDirectory: process.cwd(),
        history: [],
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalCost: 0,
          promptTokensDetails: {
            cachedTokens: 0,
            cacheWriteTokens: 0,
          },
        },
      });
    });

    it("should create a session with provided history", () => {
      const history: ChatHistoryItem[] = [
        {
          message: {
            role: "user",
            content: "Hello",
          },
          contextItems: [],
        },
      ];

      const session = createSession(history);

      expect(session.history).toBe(history);
    });

    it("should set the created session as current", () => {
      const session = createSession();
      const currentSession = getCurrentSession();

      expect(currentSession).toBe(session);
    });

    it("should use provided sessionId when supplied", () => {
      const session = createSession([], "custom-session-id");

      expect(session.sessionId).toBe("custom-session-id");
      expect(uuidv4).not.toHaveBeenCalled();
    });
  });

  describe("updateSessionHistory", () => {
    it("should update the current session's history", () => {
      const session = getCurrentSession();
      const newHistory: ChatHistoryItem[] = [
        {
          message: {
            role: "user",
            content: "New message",
          },
          contextItems: [],
        },
      ];

      updateSessionHistory(newHistory);

      expect(session.history).toBe(newHistory);
    });
  });

  describe("updateSessionTitle", () => {
    it("should update the current session's title", () => {
      const session = getCurrentSession();

      updateSessionTitle("My New Title");

      expect(session.title).toBe("My New Title");
    });
  });

  describe("saveSession", () => {
    it("should save the current session to file", () => {
      const session = getCurrentSession();
      session.title = "Test Session";
      session.history = [
        {
          message: {
            role: "user",
            content: "Hello",
          },
          contextItems: [],
        },
      ];

      saveSession();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("test-uuid-123.json"),
        expect.stringContaining("Test Session"),
      );
    });

    it("should filter out system messages except the first one", () => {
      const session = getCurrentSession();
      session.history = [
        {
          message: {
            role: "system",
            content: "System message 1",
          },
          contextItems: [],
        },
        {
          message: {
            role: "user",
            content: "User message",
          },
          contextItems: [],
        },
        {
          message: {
            role: "system",
            content: "System message 2",
          },
          contextItems: [],
        },
      ];

      saveSession();

      const savedData = JSON.parse(
        (mockFs.writeFileSync as any).mock.calls[0][1],
      );
      // After modification, system messages are filtered out
      expect(savedData.history).toHaveLength(1);
      expect(savedData.history[0].message.role).toBe("user");
    });
  });

  describe("loadOrCreateSessionById", () => {
    it("should load an existing session and set it as current", () => {
      const existingSession: Session = {
        sessionId: "existing-id",
        title: "Existing",
        workspaceDirectory: "/test/workspace",
        history: [
          {
            message: { role: "user", content: "hi" },
            contextItems: [],
          },
        ],
      };

      mockHistoryManager.load.mockReturnValue(existingSession);

      const session = loadOrCreateSessionById("existing-id");

      expect(session).toBe(existingSession);
      expect(mockHistoryManager.load).toHaveBeenCalledWith("existing-id");
      expect(getCurrentSession()).toBe(existingSession);
    });

    it("should create a new session when none exists for the id", () => {
      mockHistoryManager.load.mockImplementation(() => {
        throw new Error("not found");
      });

      const session = loadOrCreateSessionById("new-id");

      expect(session.sessionId).toBe("new-id");
      expect(session.history).toEqual([]);
      expect(getCurrentSession()).toBe(session);
    });
  });

  describe("loadSession", () => {
    it("should return null if session directory doesn't exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = loadSession();

      expect(result).toBeNull();
    });

    it("should return null if no session files exist", () => {
      mockFs.readdirSync.mockReturnValue([]);

      const result = loadSession();

      expect(result).toBeNull();
    });

    it("should load the most recent session", () => {
      const mockSession: Session = {
        sessionId: "loaded-session-id",
        title: "Loaded Session",
        workspaceDirectory: "/test/workspace",
        history: [],
      };

      mockFs.readdirSync.mockReturnValue([
        "old-session.json" as any,
        "sessions.json" as any, // Should be filtered out
        "recent-session.json" as any,
      ]);

      mockFs.statSync
        .mockReturnValueOnce({ mtime: new Date("2023-01-01") } as any)
        .mockReturnValueOnce({ mtime: new Date("2023-01-02") } as any);

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSession));

      const result = loadSession();

      expect(result).toEqual(mockSession);
      expect(getCurrentSession()).toEqual(mockSession);
    });
  });

  describe("clearSession", () => {
    it("should delete session file if it exists", () => {
      // Set up a current session
      createSession();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockReturnValue(undefined);

      clearSession();

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining("test-uuid-123.json"),
      );
    });

    it("should not delete file if it doesn't exist", () => {
      createSession();
      mockFs.existsSync.mockReturnValue(false);

      clearSession();

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it("should clear the current session from memory", () => {
      createSession();

      clearSession();

      // Getting session after clear should create a new one
      const newSession = getCurrentSession();
      expect(newSession.sessionId).toBe("test-uuid-123"); // New UUID
    });
  });

  describe("hasSession", () => {
    it("should return false if no current session exists", () => {
      // Clear any existing session
      clearSession();

      const result = hasSession();

      expect(result).toBe(false);
    });

    it("should return false if session file doesn't exist", () => {
      createSession();
      mockFs.existsSync.mockReturnValue(false);

      const result = hasSession();

      expect(result).toBe(false);
    });

    it("should return true if session exists and file exists", () => {
      createSession();
      mockFs.existsSync.mockReturnValue(true);

      const result = hasSession();

      expect(result).toBe(true);
    });
  });

  describe("singleton behavior", () => {
    it("should maintain the same session across different function calls", () => {
      const session1 = getCurrentSession();
      updateSessionTitle("Modified Title");
      const session2 = getCurrentSession();

      expect(session1).toBe(session2);
      expect(session2.title).toBe("Modified Title");
    });

    it("should persist changes across session operations", () => {
      createSession();
      updateSessionTitle("Test Title");
      updateSessionHistory([
        {
          message: {
            role: "user",
            content: "Test message",
          },
          contextItems: [],
        },
      ]);

      const session = getCurrentSession();

      expect(session.title).toBe("Test Title");
      expect(session.history).toHaveLength(1);
      expect(session.history[0].message.content).toBe("Test message");
    });
  });

  describe("startNewSession", () => {
    it("should clear the current session and create a new one", () => {
      const firstSession = createSession();
      const firstSessionId = firstSession.sessionId;

      vi.mocked(uuidv4).mockReturnValue("new-uuid-456");

      const secondSession = startNewSession();

      expect(secondSession.sessionId).toBe("new-uuid-456");
      expect(secondSession.sessionId).not.toBe(firstSessionId);
      expect(secondSession.title).toBe("Untitled Session");
      expect(secondSession.history).toEqual([]);
    });

    it("should create a new session with provided history", () => {
      const history: ChatHistoryItem[] = [
        {
          message: {
            role: "system",
            content: "You are a helpful assistant",
          },
          contextItems: [],
        },
      ];

      vi.mocked(uuidv4).mockReturnValue("new-uuid-789");

      const session = startNewSession(history);

      expect(session.sessionId).toBe("new-uuid-789");
      expect(session.history).toBe(history);
    });

    it("should set the new session as current", () => {
      const originalSession = createSession();

      vi.mocked(uuidv4).mockReturnValue("new-session-id");

      const newSession = startNewSession();
      const currentSession = getCurrentSession();

      expect(currentSession).toBe(newSession);
      expect(currentSession).not.toBe(originalSession);
    });
  });

  describe("session isolation", () => {
    it("should not pollute new sessions with previous session history", () => {
      // Simulate first CLI session
      vi.mocked(uuidv4).mockReturnValue("session-1");
      const session1 = createSession();
      const history1: ChatHistoryItem[] = [
        {
          message: {
            role: "user",
            content: "Tell me about dogs",
          },
          contextItems: [],
        },
        {
          message: {
            role: "assistant",
            content: "Dogs are loyal companions...",
          },
          contextItems: [],
        },
      ];
      updateSessionHistory(history1);

      // Simulate starting a new CLI session (without --resume)
      vi.mocked(uuidv4).mockReturnValue("session-2");
      const session2 = startNewSession([]);

      // New session should have clean state
      expect(session2.sessionId).toBe("session-2");
      expect(session2.sessionId).not.toBe(session1.sessionId);
      expect(session2.history).toEqual([]);
      expect(session2.history.length).toBe(0);
    });

    it("should create independent sessions for concurrent operations", () => {
      // Create first session with some data
      vi.mocked(uuidv4).mockReturnValue("concurrent-1");
      const session1 = createSession();
      updateSessionTitle("Session 1");
      updateSessionHistory([
        {
          message: {
            role: "user",
            content: "First session message",
          },
          contextItems: [],
        },
      ]);

      // Start a new session
      vi.mocked(uuidv4).mockReturnValue("concurrent-2");
      const session2 = startNewSession([]);

      // Verify session2 is clean
      expect(session2.title).toBe("Untitled Session");
      expect(session2.history).toEqual([]);
      expect(session2.sessionId).not.toBe(session1.sessionId);
    });

    it("should properly clear session state when transitioning between sessions", () => {
      // First session with complex history
      vi.mocked(uuidv4).mockReturnValue("complex-session-1");
      const session1 = createSession();
      updateSessionTitle("Complex Session");
      const complexHistory: ChatHistoryItem[] = [
        {
          message: {
            role: "user",
            content: "What were we discussing?",
          },
          contextItems: [],
        },
        {
          message: {
            role: "assistant",
            content: "We were discussing dogs earlier.",
          },
          contextItems: [],
        },
      ];
      updateSessionHistory(complexHistory);

      // Verify first session has data
      expect(getCurrentSession().history.length).toBe(2);

      // Start fresh session
      vi.mocked(uuidv4).mockReturnValue("fresh-session-2");
      const session2 = startNewSession([]);

      // Verify clean state
      expect(session2.history.length).toBe(0);
      expect(session2.title).toBe("Untitled Session");
      expect(getCurrentSession().sessionId).toBe("fresh-session-2");
    });
  });
});
