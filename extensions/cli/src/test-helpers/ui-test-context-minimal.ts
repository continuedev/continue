import { vi } from "vitest";

// Create mock objects that will be used by tests
export const mockUseService = vi.fn();
export const mockUseServices = vi.fn();
export const mockUseChat = vi.fn();
export const mockServiceContainer = {
  getSync: vi.fn(),
  isReady: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  load: vi.fn(),
  reload: vi.fn(),
  emit: vi.fn(),
  setMaxListeners: vi.fn(),
};

export function createMinimalTestContext() {
  // Reset mock implementations
  mockUseService.mockReturnValue({
    value: null,
    state: "idle",
    error: null,
    reload: vi.fn(),
  });

  mockUseServices.mockReturnValue({
    services: {},
    loading: false,
    error: null,
    allReady: true,
  });

  mockUseChat.mockReturnValue({
    messages: [],
    setMessages: vi.fn(),
    chatHistory: [],
    setChatHistory: vi.fn(),
    isWaitingForResponse: false,
    responseStartTime: null,
    inputMode: true,
    attachedFiles: [],
    handleUserMessage: vi.fn(),
    handleInterrupt: vi.fn(),
    handleFileAttached: vi.fn(),
    resetChatHistory: vi.fn(),
  });

  mockServiceContainer.getSync.mockReturnValue({
    state: "ready",
    value: {},
    error: null,
  });
  mockServiceContainer.isReady.mockReturnValue(true);

  return {
    cleanup: () => {
      vi.clearAllMocks();
    },
  };
}
