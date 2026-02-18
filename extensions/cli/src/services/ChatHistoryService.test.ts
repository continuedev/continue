import type { ChatHistoryItem } from "core/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatHistoryService } from "./ChatHistoryService.js";

// Mock the dependencies
vi.mock("../session.js", () => ({
  updateSessionHistory: vi.fn(),
  loadSession: vi.fn(),
  createSession: vi.fn((history) => ({
    sessionId: "test-session-id",
    history: history || [],
    title: "Test Session",
    workspaceDirectory: "/test",
  })),
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ChatHistoryService", () => {
  let service: ChatHistoryService;

  beforeEach(() => {
    service = new ChatHistoryService();
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with empty state", async () => {
      const state = await service.initialize();

      expect(state.history).toEqual([]);
      expect(state.compactionIndex).toBeNull();
      expect(state.sessionId).toBe("test-session-id");
      expect(state.isRemoteMode).toBe(false);
    });

    it("should initialize with provided session", async () => {
      const mockHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "Hello" },
          contextItems: [],
        },
      ];

      const mockSession = {
        sessionId: "custom-session",
        history: mockHistory,
        title: "Custom Session",
        workspaceDirectory: "/custom",
      };

      const state = await service.initialize(mockSession);

      expect(state.history).toEqual(mockHistory);
      expect(state.sessionId).toBe("custom-session");
    });

    it("should detect compaction index on initialization", async () => {
      const mockHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "First message" },
          contextItems: [],
        },
        {
          message: { role: "assistant", content: "Summary here" },
          contextItems: [],
          conversationSummary: "Summary here",
        },
        {
          message: { role: "user", content: "After compaction" },
          contextItems: [],
        },
      ];

      const mockSession = {
        sessionId: "session-with-compaction",
        history: mockHistory,
        title: "Compacted Session",
        workspaceDirectory: "/compacted",
      };

      const state = await service.initialize(mockSession);

      expect(state.compactionIndex).toBe(1);
    });

    it("should set remote mode on initialization", async () => {
      const state = await service.initialize(undefined, true);

      expect(state.isRemoteMode).toBe(true);
    });
  });

  describe("addUserMessage", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should add a user message to history", () => {
      const message = service.addUserMessage("Hello, world!");

      expect(message.message.role).toBe("user");
      expect(message.message.content).toBe("Hello, world!");

      const state = service.getState();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]).toBe(message);
    });

    it("should include context items", () => {
      const contextItems = [
        { content: "file.txt", name: "File", description: "A text file" },
      ];

      const message = service.addUserMessage("Check this file", contextItems);

      expect(message.contextItems).toEqual(contextItems);
    });

    it("should emit state change event", () => {
      const listener = vi.fn();
      service.on("stateChanged", listener);

      service.addUserMessage("Test message");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({
                role: "user",
                content: "Test message",
              }),
            }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it("should not save to session in remote mode", async () => {
      const { updateSessionHistory } = await import("../session.js");

      await service.initialize(undefined, true);
      service.addUserMessage("Remote message");

      expect(updateSessionHistory).not.toHaveBeenCalled();
    });
  });

  describe("addAssistantMessage", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should add an assistant message without tool calls", () => {
      const message = service.addAssistantMessage("I can help with that");

      expect(message.message.role).toBe("assistant");
      expect(message.message.content).toBe("I can help with that");
      expect(message.toolCallStates).toBeUndefined();
    });

    it("should add an assistant message with tool calls", () => {
      const toolCalls = [
        {
          id: "tool-123",
          name: "readFile",
          arguments: { path: "test.txt" },
        },
      ];

      const message = service.addAssistantMessage(
        "Let me read that file",
        toolCalls,
      );

      expect(message.message.role).toBe("assistant");
      expect(message.toolCallStates).toHaveLength(1);
      expect(message.toolCallStates![0].toolCallId).toBe("tool-123");
      expect(message.toolCallStates![0].status).toBe("generated");
    });
  });

  describe("addSystemMessage", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should add a system message", () => {
      const message = service.addSystemMessage("System notification");

      expect(message.message.role).toBe("system");
      expect(message.message.content).toBe("System notification");
    });
  });

  describe("updateToolCallState", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should update tool call state", () => {
      // Add assistant message with tool call
      const toolCalls = [
        {
          id: "tool-456",
          name: "writeFile",
          arguments: { path: "output.txt", content: "data" },
        },
      ];

      service.addAssistantMessage("Writing file", toolCalls);

      // Update the tool call state
      service.updateToolCallState(0, "tool-456", {
        status: "done",
        output: [
          {
            content: "File written successfully",
            name: "Result",
            description: "",
          },
        ],
      });

      const state = service.getState();
      const toolState = state.history[0].toolCallStates![0];

      expect(toolState.status).toBe("done");
      expect(toolState.output).toHaveLength(1);
      expect(toolState.output![0].content).toBe("File written successfully");
    });

    it("should handle missing tool call gracefully", () => {
      service.addAssistantMessage("No tools here");

      // Should not throw
      service.updateToolCallState(0, "non-existent", {
        status: "done",
      });

      // State should remain unchanged
      const state = service.getState();
      expect(state.history[0].toolCallStates).toBeUndefined();
    });
  });

  describe("addToolResult", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should add tool result to the correct message", () => {
      // Add messages with tool calls
      service.addUserMessage("Do something");
      service.addAssistantMessage("Using tool", [
        { id: "tool-789", name: "search", arguments: { query: "test" } },
      ]);

      // Add tool result
      service.addToolResult("tool-789", "Search results: found 5 items");

      const state = service.getState();
      const assistantMessage = state.history[1];
      const toolState = assistantMessage.toolCallStates![0];

      expect(toolState.status).toBe("done");
      expect(toolState.output![0].content).toBe(
        "Search results: found 5 items",
      );
    });
  });

  describe("compact", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should compact history and update index", () => {
      // Add initial messages
      service.addUserMessage("Message 1");
      service.addAssistantMessage("Response 1");
      service.addUserMessage("Message 2");
      service.addAssistantMessage("Response 2");

      // Create compacted history
      const compactedHistory: ChatHistoryItem[] = [
        {
          message: {
            role: "system",
            content: "[Compacted] Summary of messages 1-2",
          },
          contextItems: [],
        },
        {
          message: { role: "user", content: "Message 3" },
          contextItems: [],
        },
      ];

      service.compact(compactedHistory, 0);

      const state = service.getState();
      expect(state.history).toEqual(compactedHistory);
      expect(state.compactionIndex).toBe(0);
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should clear all history", () => {
      service.addUserMessage("Message");
      service.addAssistantMessage("Response");

      service.clear();

      const state = service.getState();
      expect(state.history).toEqual([]);
      expect(state.compactionIndex).toBeNull();
    });
  });

  describe("getHistory and getHistoryForLLM", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should return immutable copy of history", () => {
      service.addUserMessage("Test");

      const history1 = service.getHistory();
      const history2 = service.getHistory();

      expect(history1).not.toBe(history2); // Different arrays
      expect(history1).toEqual(history2); // Same content
    });

    it("should return full history when no compaction", () => {
      service.addUserMessage("Message 1");
      service.addAssistantMessage("Response 1");

      const historyForLLM = service.getHistoryForLLM();
      const fullHistory = service.getHistory();

      expect(historyForLLM).toEqual(fullHistory);
    });

    it("should return history after compaction index", () => {
      const history: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "Old message" },
          contextItems: [],
        },
        {
          message: { role: "system", content: "[Compacted] Summary" },
          contextItems: [],
        },
        {
          message: { role: "user", content: "New message" },
          contextItems: [],
        },
      ];

      service.setHistory(history);
      service.setCompactionIndex(1);

      const historyForLLM = service.getHistoryForLLM();

      expect(historyForLLM).toHaveLength(2); // Compacted message + new message
      expect(historyForLLM[0].message.content).toBe("[Compacted] Summary");
      expect(historyForLLM[1].message.content).toBe("New message");
    });
  });

  describe("setHistory", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should set entire history", () => {
      const newHistory: ChatHistoryItem[] = [
        {
          message: { role: "user", content: "Imported message" },
          contextItems: [],
        },
      ];

      service.setHistory(newHistory);

      const state = service.getState();
      expect(state.history).toEqual(newHistory);
    });

    it("should detect compaction index when setting history", () => {
      const historyWithCompaction: ChatHistoryItem[] = [
        {
          message: { role: "assistant", content: "old summary" },
          contextItems: [],
          conversationSummary: "old summary",
        },
        {
          message: { role: "user", content: "Recent message" },
          contextItems: [],
        },
      ];

      service.setHistory(historyWithCompaction);

      const state = service.getState();
      expect(state.compactionIndex).toBe(0);
    });
  });

  describe("undo/redo", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should undo last change and redo it", () => {
      service.addUserMessage("A");
      service.addAssistantMessage("B");

      expect(service.getState().history.map((m) => m.message.content)).toEqual([
        "A",
        "B",
      ]);

      expect(service.canUndo()).toBe(true);
      service.undo();
      expect(service.getState().history.map((m) => m.message.content)).toEqual([
        "A",
      ]);

      expect(service.canRedo()).toBe(true);
      service.redo();
      expect(service.getState().history.map((m) => m.message.content)).toEqual([
        "A",
        "B",
      ]);
    });

    it("should support undoing tool state updates", () => {
      service.addAssistantMessage("Using tool", [
        { id: "t1", name: "Read", arguments: { path: "file" } },
      ]);
      const before = service.getHistory();
      service.addToolResult("t1", "ok", "done");
      const after = service.getHistory();

      expect(after[0].toolCallStates?.[0].status).toBe("done");
      service.undo();
      const undone = service.getHistory();
      expect(undone[0].toolCallStates?.[0].status).toBe(
        before[0].toolCallStates?.[0].status,
      );
    });
  });

  describe("immutability", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should not allow external mutation of state", () => {
      service.addUserMessage("Test");

      const state = service.getState();
      const originalLength = state.history.length;

      // Try to mutate
      state.history.push({
        message: { role: "user", content: "Hacked!" },
        contextItems: [],
      });

      // Check that internal state wasn't affected
      const newState = service.getState();
      expect(newState.history).toHaveLength(originalLength);
    });

    it("should not allow mutation through getHistory", () => {
      service.addUserMessage("Test");

      const history = service.getHistory();
      const originalLength = history.length;

      // Try to mutate
      history.push({
        message: { role: "user", content: "Hacked!" },
        contextItems: [],
      });

      // Check that internal state wasn't affected
      const newHistory = service.getHistory();
      expect(newHistory).toHaveLength(originalLength);
    });
  });

  describe("event emissions", () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it("should emit stateChanged on every update", () => {
      const listener = vi.fn();
      service.on("stateChanged", listener);

      service.addUserMessage("Message 1");
      service.addAssistantMessage("Response 1");
      service.addSystemMessage("System");
      service.clear();

      expect(listener).toHaveBeenCalledTimes(4);
    });

    it("should provide old and new state in event", () => {
      const listener = vi.fn();
      service.on("stateChanged", listener);

      service.addUserMessage("Test");

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({ content: "Test" }),
            }),
          ]),
        }),
        expect.objectContaining({
          history: [],
        }),
      );
    });
  });
});
