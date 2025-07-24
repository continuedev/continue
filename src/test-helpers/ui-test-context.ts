import { jest } from "@jest/globals";

export interface UITestContext {
  mockUseService: jest.MockedFunction<any>;
  mockUseServices: jest.MockedFunction<any>;
  mockUseChat: jest.MockedFunction<any>;
  mockServiceContainer: any;
  cleanup: () => void;
}

/**
 * Creates a test context with common UI mocks for TUI components
 */
export function createUITestContext(options: {
  serviceValue?: any;
  serviceState?: "idle" | "loading" | "ready" | "error";
  services?: Record<string, any>;
  allServicesReady?: boolean;
  chatMessages?: any[];
  isWaitingForResponse?: boolean;
} = {}): UITestContext {
  const {
    serviceValue = null,
    serviceState = "idle",
    services = {},
    allServicesReady = false,
    chatMessages = [],
    isWaitingForResponse = false,
  } = options;

  // Mock useService hook
  const mockUseService = jest.fn().mockReturnValue({
    value: serviceValue,
    state: serviceState,
    error: null,
    reload: jest.fn(),
  });

  // Mock useServices hook
  const mockUseServices = jest.fn().mockReturnValue({
    services,
    loading: !allServicesReady,
    error: null,
    allReady: allServicesReady,
  });

  // Mock useChat hook
  const mockUseChat = jest.fn().mockReturnValue({
    messages: chatMessages,
    setMessages: jest.fn(),
    chatHistory: [],
    setChatHistory: jest.fn(),
    isWaitingForResponse,
    responseStartTime: null,
    inputMode: true,
    attachedFiles: [],
    handleUserMessage: jest.fn(),
    handleInterrupt: jest.fn(),
    handleFileAttached: jest.fn(),
    resetChatHistory: jest.fn(),
  });

  // Mock service container
  const mockServiceContainer = {
    getSync: jest.fn((serviceName: string) => ({
      state: "error",
      value: null,
      error: new Error(`Service '${serviceName}' not registered`),
    })),
    isReady: jest.fn(() => allServicesReady),
    on: jest.fn(),
    off: jest.fn(),
    load: jest.fn(() => Promise.resolve()),
    reload: jest.fn(() => Promise.resolve()),
    emit: jest.fn(),
    setMaxListeners: jest.fn(),
  };

  // Note: Jest mocks need to be hoisted, so they can't be called inside functions
  // The actual mocking should be done at the top of test files

  const cleanup = () => {
    jest.clearAllMocks();
  };

  return {
    mockUseService,
    mockUseServices,
    mockUseChat,
    mockServiceContainer,
    cleanup,
  };
}

/**
 * Creates a minimal test context for unit tests that don't need UI mocks
 */
export function createMinimalTestContext(): { cleanup: () => void } {
  const cleanup = () => {
    jest.clearAllMocks();
  };

  return { cleanup };
}