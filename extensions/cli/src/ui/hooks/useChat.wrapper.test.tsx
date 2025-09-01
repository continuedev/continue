/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ChatHistoryService } from "../../services/ChatHistoryService.js";
import { services, initializeServices } from "../../services/index.js";
import { mockLlmApi } from "../../test-helpers/ui-test-context.js";

import { useChat } from "./useChat.js";

// Mock dependencies
vi.mock("ink", () => ({
  useApp: () => ({ exit: vi.fn() }),
}));

vi.mock("../../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../session.js", () => ({
  createSession: (history: any[] = []) => ({
    sessionId: "test-session",
    history,
  }),
  loadSession: vi.fn(() => null),
  updateSessionHistory: vi.fn(),
  loadSessionById: vi.fn(),
}));

vi.mock("../../slashCommands.js", () => ({
  handleSlashCommands: vi.fn(() => null),
}));

vi.mock("../../telemetry/telemetryService.js", () => ({
  telemetryService: {
    startActiveTime: vi.fn(),
    stopActiveTime: vi.fn(),
    addEventProperties: vi.fn(),
    trackUserMessage: vi.fn(),
  },
}));

vi.mock("../../permissions/permissionManager.js", () => ({
  toolPermissionManager: {
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
  },
}));

vi.mock("./useChat.helpers.js", () => ({
  formatMessageWithFiles: vi.fn((message: string, files: any[]) => ({
    messageText: message,
    contextItems: [],
  })),
  handleAutoCompaction: vi.fn(async ({ chatHistory }: any) => ({
    currentChatHistory: chatHistory,
    currentCompactionIndex: null,
  })),
  handleCompactCommand: vi.fn(async () => {}),
  handleSpecialCommands: vi.fn(async () => false),
  initChatHistory: vi.fn(async () => [
    {
      message: { role: "system", content: "Test system message" },
      contextItems: [],
    },
  ]),
  processSlashCommandResult: vi.fn(() => null),
  trackUserMessage: vi.fn(),
}));

vi.mock("./useChat.remote.helpers.js", () => ({
  handleRemoteMessage: vi.fn(async () => {}),
  setupRemotePolling: vi.fn(() => () => {}),
}));

vi.mock("./useChat.stream.helpers.js", () => ({
  createStreamCallbacks: vi.fn(() => ({
    onContent: vi.fn(),
    onFinalMessage: vi.fn(),
  })),
  executeStreaming: vi.fn(async () => {}),
}));

describe("useChat with ChatHistoryServiceWrapper", () => {
  let chatHistoryService: ChatHistoryService;

  beforeEach(async () => {
    // Initialize services
    await initializeServices({
      skipOnboarding: true,
      headless: true,
    });

    // Get the service instance
    chatHistoryService = services.chatHistory;
    
    // Ensure service is initialized
    if (!chatHistoryService.isReady()) {
      await chatHistoryService.initialize();
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize ChatHistoryService and sync with React state", async () => {
    const { result } = renderHook(() =>
      useChat({
        model: undefined,
        llmApi: mockLlmApi,
        assistant: undefined,
        onShowConfigSelector: vi.fn(),
        onShowMCPSelector: vi.fn(),
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify service is initialized
    expect(chatHistoryService.isReady()).toBe(true);
    
    // Verify initial history includes system message
    expect(result.current.chatHistory).toHaveLength(1);
    expect(result.current.chatHistory[0].message.role).toBe("system");
  });

  it("should sync React state updates to ChatHistoryService", async () => {
    const { result } = renderHook(() =>
      useChat({
        model: undefined,
        llmApi: mockLlmApi,
        assistant: undefined,
        onShowConfigSelector: vi.fn(),
        onShowMCPSelector: vi.fn(),
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Update chat history through React setter
    const newMessage = {
      message: { role: "user" as const, content: "Hello" },
      contextItems: [],
    };

    act(() => {
      result.current.setChatHistory((prev) => [...prev, newMessage]);
    });

    // Verify service was updated
    const serviceHistory = chatHistoryService.getHistory();
    expect(serviceHistory).toHaveLength(2);
    expect(serviceHistory[1]).toEqual(newMessage);

    // Verify React state was updated
    expect(result.current.chatHistory).toHaveLength(2);
    expect(result.current.chatHistory[1]).toEqual(newMessage);
  });

  it("should sync ChatHistoryService updates to React state", async () => {
    const { result } = renderHook(() =>
      useChat({
        model: undefined,
        llmApi: mockLlmApi,
        assistant: undefined,
        onShowConfigSelector: vi.fn(),
        onShowMCPSelector: vi.fn(),
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Update service directly
    act(() => {
      chatHistoryService.addUserMessage("Hello from service");
    });

    // Wait for state propagation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Verify React state was updated
    expect(result.current.chatHistory).toHaveLength(2);
    expect(result.current.chatHistory[1].message.content).toBe("Hello from service");
  });

  it("should prevent infinite loops during bidirectional sync", async () => {
    const { result } = renderHook(() =>
      useChat({
        model: undefined,
        llmApi: mockLlmApi,
        assistant: undefined,
        onShowConfigSelector: vi.fn(),
        onShowMCPSelector: vi.fn(),
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Spy on setHistory to count calls
    const setHistorySpy = vi.spyOn(chatHistoryService, "setHistory");

    // Update through React state
    act(() => {
      result.current.setChatHistory((prev) => [
        ...prev,
        {
          message: { role: "user" as const, content: "Test" },
          contextItems: [],
        },
      ]);
    });

    // Wait for any potential propagation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Should be called only once (from React to service)
    expect(setHistorySpy).toHaveBeenCalledTimes(1);

    // Now update through service
    setHistorySpy.mockClear();
    act(() => {
      chatHistoryService.addUserMessage("Service update");
    });

    // Wait for propagation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // setHistory should not be called (update originated from service)
    expect(setHistorySpy).not.toHaveBeenCalled();
  });

  it("should handle function updates to setState", async () => {
    const { result } = renderHook(() =>
      useChat({
        model: undefined,
        llmApi: mockLlmApi,
        assistant: undefined,
        onShowConfigSelector: vi.fn(),
        onShowMCPSelector: vi.fn(),
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Use function form of setState
    act(() => {
      result.current.setChatHistory((prev) => {
        const filtered = prev.filter((item) => item.message.role !== "system");
        return [
          ...filtered,
          {
            message: { role: "assistant" as const, content: "Response" },
            contextItems: [],
          },
        ];
      });
    });

    // Verify both React state and service were updated correctly
    expect(result.current.chatHistory).toHaveLength(1);
    expect(result.current.chatHistory[0].message.role).toBe("assistant");

    const serviceHistory = chatHistoryService.getHistory();
    expect(serviceHistory).toHaveLength(1);
    expect(serviceHistory[0].message.role).toBe("assistant");
  });

  it("should clean up wrapper on unmount", async () => {
    const { unmount } = renderHook(() =>
      useChat({
        model: undefined,
        llmApi: mockLlmApi,
        assistant: undefined,
        onShowConfigSelector: vi.fn(),
        onShowMCPSelector: vi.fn(),
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Unmount should cleanup without errors
    expect(() => unmount()).not.toThrow();
  });
});