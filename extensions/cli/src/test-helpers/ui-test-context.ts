import { vi } from "vitest";

export interface UITestContext {
  mockUseService: ReturnType<typeof vi.fn>;
  mockUseServices: ReturnType<typeof vi.fn>;
  mockUseChat: ReturnType<typeof vi.fn>;
  mockServiceContainer: any;
  cleanup: () => void;
}

// Export a mock LLM API for testing
export const mockLlmApi = {
  chatCompletionNonStream: vi.fn(),
  chatCompletionStream: vi.fn(),
  completionNonStream: vi.fn(),
  completionStream: vi.fn(),
  embed: vi.fn(),
  rerank: vi.fn(),
  fimStream: vi.fn(),
  listModels: vi.fn(),
  completions: vi.fn(),
  stream: vi.fn(),
  abort: vi.fn(),
} as any;

/**
 * Creates a test context with common UI mocks for TUI components
 */
export function createUITestContext(
  options: {
    serviceValue?: any;
    serviceState?: "idle" | "loading" | "ready" | "error";
    services?: Record<string, any>;
    allServicesReady?: boolean;
    chatMessages?: any[];
    isWaitingForResponse?: boolean;
  } = {},
): UITestContext {
  const {
    serviceValue = null,
    serviceState = "idle",
    services: customServices = {},
    allServicesReady = false,
    chatMessages = [],
    isWaitingForResponse = false,
  } = options;

  // Default services with FileIndexService mock
  const defaultServices = {
    fileIndex: {
      files: [
        { path: "README.md", displayName: "README.md" },
        { path: "src/index.ts", displayName: "src/index.ts" },
        { path: "package.json", displayName: "package.json" },
      ],
      isIndexing: false,
      error: null,
    },
    ...customServices,
  };

  const services = { ...defaultServices, ...customServices };

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
    handleUserMessage: vi.fn().mockResolvedValue(undefined),
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
