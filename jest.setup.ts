// Disable telemetry for tests
process.env.CONTINUE_CLI_ENABLE_TELEMETRY = "0";

// Mock the useService hooks at the top level
import { jest } from "@jest/globals";

// Mock the hooks module with proper jest functions
jest.mock("./src/hooks/useService.js", () => ({
  useService: jest.fn().mockReturnValue({
    value: null,
    state: "idle",
    error: null,
    reload: jest.fn(),
  }),
  useServices: jest.fn().mockReturnValue({
    services: {},
    loading: true,
    error: null,
    allReady: false,
  }),
}));

// Mock the service container module
jest.mock("./src/services/ServiceContainer.js", () => {
  const mockServiceContainer = {
    getSync: jest.fn((serviceName: string) => ({
      state: "error",
      value: null,
      error: new Error(`Service '${serviceName}' not registered`),
    })),
    isReady: jest.fn(() => false),
    on: jest.fn(),
    off: jest.fn(),
    load: jest.fn(() => Promise.resolve()),
    reload: jest.fn(() => Promise.resolve()),
    emit: jest.fn(),
    setMaxListeners: jest.fn(),
  };

  return {
    ServiceContainer: jest.fn().mockImplementation(() => mockServiceContainer),
    serviceContainer: mockServiceContainer,
  };
});

// Mock the useChat hook to prevent intervals in tests
jest.mock("./src/ui/hooks/useChat.js", () => ({
  useChat: jest.fn().mockReturnValue({
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
  }),
}));

// Set up global afterEach hook to clear all timers
afterEach(() => {
  // Clear jest timers only if they're available
  if (typeof jest !== "undefined" && jest.clearAllTimers) {
    try {
      jest.clearAllTimers();
    } catch (e) {
      // Ignore errors when clearing timers
    }
  }
});
