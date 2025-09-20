import type {
  ChatMessage,
  CompletionOptions,
  ContextProviderExtras,
  ILLM,
} from "../../index.js";
import { LLMConfigurationStatuses } from "../../llm/constants.js";
import HttpContextProvider from "./HttpContextProvider";

// Create a mock LLM that implements all required methods
const mockLLM: ILLM = {
  model: "test-model",
  contextLength: 2048,
  embeddingId: "test-embed",
  maxEmbeddingChunkSize: 1000,
  maxEmbeddingBatchSize: 10,
  completionOptions: {
    model: "test-model",
    temperature: 0.7,
    maxTokens: 2048,
  },
  uniqueId: "test-id",
  providerName: "test",
  underlyingProviderName: "test",
  complete: async () => "test",
  streamComplete: async function* (
    _prompt: string,
    _signal: AbortSignal,
    _options?: CompletionOptions,
  ) {
    yield "test";
    return {
      prompt: "test",
      response: "test",
      modelTitle: "test",
      modelProvider: "test",
      completion: "test",
      usage: undefined,
      thinkingText: "test",
    };
  },
  streamFim: async function* (
    _prefix: string,
    _suffix: string,
    _signal: AbortSignal,
    _options?: CompletionOptions,
  ) {
    yield "test";
    return {
      prompt: "test",
      response: "test",
      modelTitle: "test",
      modelProvider: "test",
      completion: "test",
      usage: undefined,
      thinkingText: "test",
    };
  },
  chat: async (
    _messages: ChatMessage[],
    _signal: AbortSignal,
    _options?: CompletionOptions,
  ) => ({ role: "assistant", content: "test" }),
  streamChat: async function* (
    _messages: ChatMessage[],
    _signal: AbortSignal,
    _options?: CompletionOptions,
  ) {
    yield { role: "assistant", content: "test" };
    return {
      prompt: "test",
      response: "test",
      modelTitle: "test",
      modelProvider: "test",
      completion: "test",
      usage: undefined,
      thinkingText: "test",
    };
  },
  embed: async () => [[0, 0]],
  rerank: async () => [0],
  countTokens: () => 0,
  supportsImages: () => false,
  supportsCompletions: () => true,
  supportsPrefill: () => false,
  supportsFim: () => true,
  listModels: async () => ["test-model"],
  compileChatMessages: () => ({ text: "" }),
  renderPromptTemplate: () => "",
  getConfigurationStatus: () => LLMConfigurationStatuses.VALID,
};

describe("HttpContextProvider", () => {
  let provider: HttpContextProvider;
  let mockFetch: jest.Mock;
  let mockExtras: ContextProviderExtras;

  beforeEach(() => {
    mockFetch = jest.fn();

    const mockIde = {
      getIdeInfo: jest.fn().mockResolvedValue({
        name: "test",
        version: "1.0.0",
        machineId: "test",
      }),
      getIdeSettings: jest.fn().mockResolvedValue({}),
      getDiff: jest.fn().mockResolvedValue([]),
      getClipboardContent: jest
        .fn()
        .mockResolvedValue({ text: "", copiedAt: new Date().toISOString() }),
      isTelemetryEnabled: jest.fn().mockResolvedValue(true),
      isWorkspaceRemote: jest.fn().mockResolvedValue(false),
    };

    const config = {
      models: [mockLLM],
      contextProviders: [],
      slashCommands: [],
      tools: [],
      mcpServerStatuses: [],
      rules: [],
      env: {},
      defaultContextProviderOptions: {},
      modelsByRole: {
        chat: [mockLLM],
        autocomplete: [mockLLM],
        embed: [mockLLM],
        rerank: [mockLLM],
        edit: [mockLLM],
        apply: [mockLLM],
        summarize: [mockLLM],
      },
      selectedModelByRole: {
        chat: mockLLM,
        autocomplete: mockLLM,
        embed: mockLLM,
        rerank: mockLLM,
        edit: mockLLM,
        apply: mockLLM,
        summarize: mockLLM,
      },
    };

    mockExtras = {
      fetch: mockFetch,
      ide: mockIde,
      fullInput: "test input",
      config,
      embeddingsProvider: mockLLM,
      reranker: mockLLM,
      llm: mockLLM,
      selectedCode: [],
      isInAgentMode: false,
      hideSelf: false,
      useCache: false,
    } as unknown as ContextProviderExtras;

    provider = new HttpContextProvider({
      url: "http://example.com/api",
      title: "TestAPI",
      displayTitle: "Test API",
    });
  });

  describe("getContextItems", () => {
    it("should handle response with uri field correctly", async () => {
      const mockResponse = {
        description: "Test Description",
        content: "Test Content",
        name: "Test Name",
        uri: {
          type: "file",
          value: "/test/file.txt",
        },
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: "Test Description",
        content: "Test Content",
        name: "Test Name",
        uri: {
          type: "file",
          value: "/test/file.txt",
        },
      });
    });

    it("should handle response with missing uri field", async () => {
      const mockResponse = {
        description: "Test Description",
        content: "Test Content",
        name: "Test Name",
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: "Test Description",
        content: "Test Content",
        name: "Test Name",
        uri: undefined,
      });
    });

    it("should handle response with null uri field", async () => {
      const mockResponse = {
        description: "Test Description",
        content: "Test Content",
        name: "Test Name",
        uri: null,
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        description: "Test Description",
        content: "Test Content",
        name: "Test Name",
        uri: undefined,
      });
    });

    it("should handle array response", async () => {
      const mockResponse = [
        {
          description: "Item 1",
          content: "Content 1",
          name: "Name 1",
          uri: { type: "file", value: "/test/1.txt" },
        },
        {
          description: "Item 2",
          content: "Content 2",
          name: "Name 2",
        },
      ];

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.getContextItems("test query", mockExtras);

      expect(result).toHaveLength(2);
      expect(result[0].uri).toBeDefined();
      expect(result[1].uri).toBeUndefined();
    });
  });
});
