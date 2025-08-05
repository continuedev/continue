import { vi } from "vitest";

export interface UITestContext {
  mockUseService: ReturnType<typeof vi.fn>;
  mockUseServices: ReturnType<typeof vi.fn>;
  mockUseChat: ReturnType<typeof vi.fn>;
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
  const mockUseService = vi.fn().mockReturnValue({
    value: serviceValue,
    state: serviceState,
    error: null,
    reload: vi.fn(),
  });

  // Mock useServices hook
  const mockUseServices = vi.fn().mockReturnValue({
    services,
    loading: !allServicesReady,
    error: null,
    allReady: allServicesReady,
  });

  // Mock useChat hook
  const mockUseChat = vi.fn().mockReturnValue({
    messages: chatMessages,
    setMessages: vi.fn(),
    chatHistory: [],
    setChatHistory: vi.fn(),
    isWaitingForResponse,
    responseStartTime: null,
    inputMode: true,
    attachedFiles: [],
    handleUserMessage: vi.fn(),
    handleInterrupt: vi.fn(),
    handleFileAttached: vi.fn(),
    resetChatHistory: vi.fn(),
  });

  // Mock service container
  const mockServiceContainer = {
    getSync: vi.fn((serviceName: string) => ({
      state: "error",
      value: null,
      error: new Error(`Service '${serviceName}' not registered`),
    })),
    isReady: vi.fn(() => allServicesReady),
    on: vi.fn(),
    off: vi.fn(),
    load: vi.fn(() => Promise.resolve()),
    reload: vi.fn(() => Promise.resolve()),
    emit: vi.fn(),
    setMaxListeners: vi.fn(),
  };

  // Note: Jest mocks need to be hoisted, so they can't be called inside functions
  // The actual mocking should be done at the top of test files

  const cleanup = () => {
    vi.clearAllMocks();
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
    vi.clearAllMocks();
  };

  return { cleanup };
}