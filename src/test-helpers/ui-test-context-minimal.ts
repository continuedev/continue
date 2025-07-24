import { jest } from "@jest/globals";

// Create mock objects that will be used by tests
export const mockUseService = jest.fn();
export const mockUseServices = jest.fn();
export const mockUseChat = jest.fn();
export const mockServiceContainer = {
  getSync: jest.fn(),
  isReady: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  load: jest.fn(),
  reload: jest.fn(),
  emit: jest.fn(),
  setMaxListeners: jest.fn(),
};

export function createMinimalTestContext() {
  // Reset mock implementations
  mockUseService.mockReturnValue({
    value: null,
    state: "idle",
    error: null,
    reload: jest.fn(),
  });

  mockUseServices.mockReturnValue({
    services: {},
    loading: false,
    error: null,
    allReady: true,
  });

  mockUseChat.mockReturnValue({
    messages: [],
    setMessages: jest.fn(),
    chatHistory: [],
    setChatHistory: jest.fn(),
    isWaitingForResponse: false,
    responseStartTime: null,
    inputMode: true,
    attachedFiles: [],
    handleUserMessage: jest.fn(),
    handleInterrupt: jest.fn(),
    handleFileAttached: jest.fn(),
    resetChatHistory: jest.fn(),
  });

  mockServiceContainer.getSync.mockReturnValue({
    state: "ready",
    value: {},
    error: null,
  });
  mockServiceContainer.isReady.mockReturnValue(true);

  return {
    cleanup: () => {
      jest.clearAllMocks();
    }
  };
}