import type { ChatHistoryItem } from "core/index.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TOOL_RESULT_TOKEN_THRESHOLD } from "../constants/tokenization.js";
import { ToolCall } from "../tools/index.js";

import { handleToolCalls } from "./handleToolCalls.js";

// Mock all external dependencies
vi.mock("../services/index.js", () => ({
  getServiceSync: vi.fn(() => ({ value: { isHeadless: false } })),
  services: {
    chatHistory: {
      isReady: () => true,
      addAssistantMessage: vi.fn(),
      addHistoryItem: vi.fn(),
      addToolResult: vi.fn(),
    },
  },
  SERVICE_NAMES: { TOOL_PERMISSIONS: "TOOL_PERMISSIONS" },
}));

vi.mock("./streamChatResponse.helpers.js", () => ({
  executeStreamedToolCalls: vi.fn(),
  preprocessStreamedToolCalls: vi.fn(),
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("gpt-tokenizer", () => ({
  encode: (text: string) => new Array(Math.ceil(text.length / 4)), // 4 chars per token
}));

describe("handleToolCalls - Tool Results Analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockTool = (name: string) => ({
    name,
    displayName: name,
    description: `Mock ${name}`,
    parameters: {},
    run: vi.fn(),
    isBuiltIn: true,
  });

  const createMockToolCall = (id: string, name: string): ToolCall => ({
    id,
    name,
    arguments: {},
    argumentsStr: "{}",
    startNotified: false,
  });

  const createMockPreprocessedToolCall = (id: string, name: string) => ({
    ...createMockToolCall(id, name),
    tool: createMockTool(name),
  });

  const createMockChatHistory = (): ChatHistoryItem[] => [
    {
      message: { role: "user", content: "Test message" },
      contextItems: [],
    },
  ];

  it("should not check compaction for single tool result", async () => {
    const { executeStreamedToolCalls, preprocessStreamedToolCalls } = await import("./streamChatResponse.helpers.js");
    const { logger } = await import("../util/logger.js");
    
    vi.mocked(preprocessStreamedToolCalls).mockResolvedValue({
      preprocessedCalls: [createMockPreprocessedToolCall("call_1", "test_tool")],
      errorChatEntries: [],
    });

    vi.mocked(executeStreamedToolCalls).mockResolvedValue({
      chatHistoryEntries: [
        {
          role: "tool" as const,
          tool_call_id: "call_1", 
          content: "Small result", // ~3 tokens
        },
      ],
      hasRejection: false,
    });

    const toolCalls = [createMockToolCall("call_1", "test_tool")];
    const chatHistory = createMockChatHistory();

    await handleToolCalls(toolCalls, chatHistory, "Assistant response", undefined, false);

    // Should not log large tool results for single result
    expect(vi.mocked(logger.info)).not.toHaveBeenCalledWith(
      "Large tool results detected",
      expect.any(Object),
    );
  });

  it("should check compaction for multiple large tool results", async () => {
    const { executeStreamedToolCalls, preprocessStreamedToolCalls } = await import("./streamChatResponse.helpers.js");
    const { logger } = await import("../util/logger.js");
    
    // Create large content that exceeds threshold when combined
    const largeContent1 = "x".repeat(32000); // ~8K tokens
    const largeContent2 = "x".repeat(36000); // ~9K tokens
    // Total: ~17K tokens (exceeds 15K threshold)

    vi.mocked(preprocessStreamedToolCalls).mockResolvedValue({
      preprocessedCalls: [
        createMockPreprocessedToolCall("call_1", "read_tool"),
        createMockPreprocessedToolCall("call_2", "search_tool"),
      ],
      errorChatEntries: [],
    });

    vi.mocked(executeStreamedToolCalls).mockResolvedValue({
      chatHistoryEntries: [
        { role: "tool" as const, tool_call_id: "call_1", content: largeContent1 },
        { role: "tool" as const, tool_call_id: "call_2", content: largeContent2 },
      ],
      hasRejection: false,
    });

    const toolCalls = [
      createMockToolCall("call_1", "read_tool"),
      createMockToolCall("call_2", "search_tool"),
    ];
    const chatHistory = createMockChatHistory();

    await handleToolCalls(toolCalls, chatHistory, "Assistant response", undefined, false);

    // Should log large tool results detection
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      "Large tool results detected",
      expect.objectContaining({
        toolCount: 2,
        totalResultTokens: 17000,
        largestResultTokens: 9000,
        toolNames: ["read_tool", "search_tool"],
      }),
    );
  });

  it("should show user notification for large results in non-headless mode", async () => {
    const { executeStreamedToolCalls, preprocessStreamedToolCalls } = await import("./streamChatResponse.helpers.js");
    
    // Create content that exceeds threshold
    const largeContent = "x".repeat(TOOL_RESULT_TOKEN_THRESHOLD * 4 + 4); // Just over threshold

    vi.mocked(preprocessStreamedToolCalls).mockResolvedValue({
      preprocessedCalls: [
        createMockPreprocessedToolCall("call_1", "terminal_tool"),
        createMockPreprocessedToolCall("call_2", "search_tool"),
      ],
      errorChatEntries: [],
    });

    vi.mocked(executeStreamedToolCalls).mockResolvedValue({
      chatHistoryEntries: [
        { role: "tool" as const, tool_call_id: "call_1", content: largeContent },
        { role: "tool" as const, tool_call_id: "call_2", content: "Small result" },
      ],
      hasRejection: false,
    });

    const onSystemMessage = vi.fn();
    const callbacks = { onSystemMessage };

    const toolCalls = [
      createMockToolCall("call_1", "terminal_tool"),
      createMockToolCall("call_2", "search_tool"),
    ];
    const chatHistory = createMockChatHistory();

    await handleToolCalls(toolCalls, chatHistory, "Assistant response", callbacks, false);

    // Should show user notification
    expect(onSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining("Multiple tools returned") &&
      expect.stringContaining("tokens of results") &&
      expect.stringContaining("Consider using auto-compaction"),
    );
  });

  it("should not show user notification in headless mode", async () => {
    const { executeStreamedToolCalls, preprocessStreamedToolCalls } = await import("./streamChatResponse.helpers.js");
    
    const largeContent = "x".repeat(TOOL_RESULT_TOKEN_THRESHOLD * 4 + 4);

    vi.mocked(preprocessStreamedToolCalls).mockResolvedValue({
      preprocessedCalls: [
        createMockPreprocessedToolCall("call_1", "tool1"),
        createMockPreprocessedToolCall("call_2", "tool2"),
      ],
      errorChatEntries: [],
    });

    vi.mocked(executeStreamedToolCalls).mockResolvedValue({
      chatHistoryEntries: [
        { role: "tool" as const, tool_call_id: "call_1", content: largeContent },
        { role: "tool" as const, tool_call_id: "call_2", content: "Small result" },
      ],
      hasRejection: false,
    });

    const onSystemMessage = vi.fn();
    const callbacks = { onSystemMessage };

    const toolCalls = [
      createMockToolCall("call_1", "tool1"),
      createMockToolCall("call_2", "tool2"),
    ];
    const chatHistory = createMockChatHistory();

    // Test in headless mode
    await handleToolCalls(toolCalls, chatHistory, "Assistant response", callbacks, true);

    // Should NOT show user notification in headless mode
    expect(onSystemMessage).not.toHaveBeenCalled();
  });

  it("should not trigger for results below threshold", async () => {
    const { executeStreamedToolCalls, preprocessStreamedToolCalls } = await import("./streamChatResponse.helpers.js");
    const { logger } = await import("../util/logger.js");
    
    vi.mocked(preprocessStreamedToolCalls).mockResolvedValue({
      preprocessedCalls: [
        createMockPreprocessedToolCall("call_1", "tool1"),
        createMockPreprocessedToolCall("call_2", "tool2"),
      ],
      errorChatEntries: [],
    });

    vi.mocked(executeStreamedToolCalls).mockResolvedValue({
      chatHistoryEntries: [
        { role: "tool" as const, tool_call_id: "call_1", content: "Small result 1" }, // ~4 tokens
        { role: "tool" as const, tool_call_id: "call_2", content: "Small result 2" }, // ~4 tokens  
      ],
      hasRejection: false,
    });

    const toolCalls = [
      createMockToolCall("call_1", "tool1"),
      createMockToolCall("call_2", "tool2"),
    ];
    const chatHistory = createMockChatHistory();

    await handleToolCalls(toolCalls, chatHistory, "Assistant response", undefined, false);

    // Should not log or notify for small results
    expect(vi.mocked(logger.info)).not.toHaveBeenCalledWith(
      "Large tool results detected",
      expect.any(Object),
    );
  });
});