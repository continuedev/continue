import type { ChatHistoryItem, ToolStatus } from "core/index.js";
import { convertFromUnifiedHistory } from "core/util/messageConversion.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { services } from "../services/index.js";

// eslint-disable-next-line
import { handleToolCalls } from "./handleToolCalls.js"; // for some reason can't resolve import groups here

// Mock the services
vi.mock("../services/index.js", () => ({
  services: {
    chatHistory: {
      isReady: vi.fn(),
      addAssistantMessage: vi.fn(),
      addToolResult: vi.fn(),
      addHistoryItem: vi.fn(),
    },
    toolPermissions: {
      getState: vi.fn().mockReturnValue({
        permissions: { defaultPermission: "allow" },
      }),
    },
  },
  serviceContainer: {
    get: vi.fn().mockResolvedValue({
      permissions: { defaultPermission: "allow" },
    }),
  },
  SERVICE_NAMES: {
    TOOL_PERMISSIONS: "toolPermissions",
  },
}));

// Mock the helper functions
vi.mock("./streamChatResponse.helpers.js", () => ({
  preprocessStreamedToolCalls: vi.fn(),
  executeStreamedToolCalls: vi.fn(),
}));

// Import the mocked modules
import {
  executeStreamedToolCalls,
  preprocessStreamedToolCalls,
} from "./streamChatResponse.helpers.js";

const mockPreprocess = vi.mocked(preprocessStreamedToolCalls);
const mockExecute = vi.mocked(executeStreamedToolCalls);

describe("handleToolCalls - duplicate tool_result prevention", () => {
  let chatHistory: ChatHistoryItem[];

  beforeEach(() => {
    vi.clearAllMocks();
    chatHistory = [
      {
        message: { role: "user", content: "Test prompt" },
        contextItems: [],
      },
    ];

    // Default: service is ready
    vi.mocked(services.chatHistory.isReady).mockReturnValue(true);
  });

  /**
   * This test verifies that preprocessing errors are stored in toolCallStates
   * (on the assistant message) rather than as separate tool history items.
   *
   * If errors were added as separate history items, convertFromUnifiedHistory
   * would generate duplicate tool_result messages - one from the standalone
   * tool history item and one from the toolCallStates.
   */
  it("should store preprocessing errors in toolCallStates, not as separate history items", async () => {
    const toolCalls = [
      {
        id: "tool-call-1",
        name: "invalid_tool",
        arguments: {},
        argumentsStr: "{}",
        startNotified: false,
      },
    ];

    // Simulate preprocessing error
    mockPreprocess.mockResolvedValue({
      preprocessedCalls: [],
      errorChatEntries: [
        {
          role: "tool",
          tool_call_id: "tool-call-1",
          content: "Tool invalid_tool not found",
        },
      ],
    });

    mockExecute.mockResolvedValue({
      hasRejection: false,
      chatHistoryEntries: [],
    });

    await handleToolCalls({
      toolCalls,
      chatHistory,
      content: "Let me try that tool",
      callbacks: undefined,
      isHeadless: false,
    });

    // CRITICAL: addToolResult should be called to update the toolCallState
    expect(services.chatHistory.addToolResult).toHaveBeenCalledWith(
      "tool-call-1",
      "Tool invalid_tool not found",
      "errored",
    );

    // CRITICAL: addHistoryItem should NOT be called
    // (previously, errors were added as separate history items which caused duplicates)
    expect(services.chatHistory.addHistoryItem).not.toHaveBeenCalled();
  });

  /**
   * This test verifies that when converting history to API format,
   * we get exactly one tool_result per tool call - not duplicates.
   */
  it("should produce exactly one tool_result per tool call when converting to API format", async () => {
    // Simulate history with an assistant message that has toolCallStates with output
    const historyWithToolResults: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "Run a command" },
        contextItems: [],
      },
      {
        message: {
          role: "assistant",
          content: "I'll run that for you",
          toolCalls: [
            {
              id: "tool-call-1",
              type: "function",
              function: { name: "run_command", arguments: '{"cmd":"ls"}' },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tool-call-1",
            toolCall: {
              id: "tool-call-1",
              type: "function",
              function: { name: "run_command", arguments: '{"cmd":"ls"}' },
            },
            status: "done" as ToolStatus,
            parsedArgs: { cmd: "ls" },
            output: [
              {
                content: "file1.txt\nfile2.txt",
                name: "Tool Result",
                description: "Tool execution result",
              },
            ],
          },
        ],
      },
    ];

    const messages = convertFromUnifiedHistory(historyWithToolResults);

    // Count tool messages
    const toolMessages = messages.filter((m) => m.role === "tool");

    // Should have exactly ONE tool message, not duplicates
    expect(toolMessages).toHaveLength(1);
    expect(toolMessages[0]).toEqual({
      role: "tool",
      content: "file1.txt\nfile2.txt",
      tool_call_id: "tool-call-1",
    });
  });

  /**
   * This test simulates the bug that was occurring:
   * If tool errors are added as separate history items AND stored in toolCallStates,
   * convertFromUnifiedHistory would produce duplicate tool_result messages.
   */
  it("should NOT produce duplicate tool_results even with errored tool calls", async () => {
    // Simulate history where error is stored in toolCallStates (correct approach)
    const historyWithErroredTool: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "Use invalid tool" },
        contextItems: [],
      },
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tool-call-error",
              type: "function",
              function: { name: "nonexistent", arguments: "{}" },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tool-call-error",
            toolCall: {
              id: "tool-call-error",
              type: "function",
              function: { name: "nonexistent", arguments: "{}" },
            },
            status: "errored" as ToolStatus,
            parsedArgs: {},
            output: [
              {
                content: "Tool nonexistent not found",
                name: "Tool Result",
                description: "Tool execution result",
              },
            ],
          },
        ],
      },
    ];

    const messages = convertFromUnifiedHistory(historyWithErroredTool);

    // Count tool messages with this specific ID
    const toolMessagesForCall = messages.filter(
      (m) => m.role === "tool" && (m as any).tool_call_id === "tool-call-error",
    );

    // Should have exactly ONE tool message for this tool call
    expect(toolMessagesForCall).toHaveLength(1);
    expect(toolMessagesForCall[0]).toEqual({
      role: "tool",
      content: "Tool nonexistent not found",
      tool_call_id: "tool-call-error",
    });
  });

  /**
   * This test verifies the problematic pattern that WOULD cause duplicates
   * (for documentation purposes - this is what we're preventing).
   */
  it("demonstrates the duplicate bug when tool messages are stored separately", () => {
    // BAD PATTERN: Having both a standalone tool message AND toolCallStates
    // This is what the old code did, and it caused the duplicate tool_result error
    const badHistoryWithDuplicates: ChatHistoryItem[] = [
      {
        message: { role: "user", content: "Run command" },
        contextItems: [],
      },
      {
        message: {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "duplicate-call",
              type: "function",
              function: { name: "run_command", arguments: '{"cmd":"ls"}' },
            },
          ],
        },
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "duplicate-call",
            toolCall: {
              id: "duplicate-call",
              type: "function",
              function: { name: "run_command", arguments: '{"cmd":"ls"}' },
            },
            status: "done" as ToolStatus,
            parsedArgs: { cmd: "ls" },
            output: [
              {
                content: "Result from toolCallStates",
                name: "Tool Result",
                description: "Tool execution result",
              },
            ],
          },
        ],
      },
      // BAD: Standalone tool message that should NOT exist
      // (This is what the old buggy code was adding)
      {
        message: {
          role: "tool",
          content: "Result from standalone message",
          toolCallId: "duplicate-call",
        },
        contextItems: [],
      },
    ];

    const messages = convertFromUnifiedHistory(badHistoryWithDuplicates);

    // Count tool messages with this ID - this demonstrates the bug
    const toolMessagesForCall = messages.filter(
      (m) => m.role === "tool" && (m as any).tool_call_id === "duplicate-call",
    );

    // With the bad pattern, we get TWO tool messages (the bug!)
    // This would cause: "each tool_use must have a single result"
    expect(toolMessagesForCall).toHaveLength(2);

    // The fix ensures we never create this bad pattern in the first place
  });

  /**
   * Test that the fallback path (when service is not ready) also
   * updates toolCallStates instead of adding separate items.
   */
  it("should update toolCallStates in fallback mode for preprocessing errors", async () => {
    // Service not ready - use fallback path
    vi.mocked(services.chatHistory.isReady).mockReturnValue(false);

    const toolCalls = [
      {
        id: "fallback-tool-1",
        name: "broken_tool",
        arguments: { arg: "value" },
        argumentsStr: '{"arg":"value"}',
        startNotified: false,
      },
    ];

    // Simulate preprocessing error
    mockPreprocess.mockResolvedValue({
      preprocessedCalls: [],
      errorChatEntries: [
        {
          role: "tool",
          tool_call_id: "fallback-tool-1",
          content: "Tool broken_tool not found",
        },
      ],
    });

    mockExecute.mockResolvedValue({
      hasRejection: false,
      chatHistoryEntries: [],
    });

    await handleToolCalls({
      toolCalls,
      chatHistory,
      content: "",
      callbacks: undefined,
      isHeadless: false,
    });

    // In fallback mode, service methods should NOT be called for adding results
    expect(services.chatHistory.addToolResult).not.toHaveBeenCalled();
    expect(services.chatHistory.addHistoryItem).not.toHaveBeenCalled();

    // The local chatHistory should have the assistant message with toolCallStates
    // (handleToolCalls adds this via createHistoryItem in fallback mode)
    const assistantItem = chatHistory.find(
      (item) =>
        item.message.role === "assistant" && item.toolCallStates?.length,
    );

    expect(assistantItem).toBeDefined();
    const toolState = assistantItem!.toolCallStates!.find(
      (ts) => ts.toolCallId === "fallback-tool-1",
    );

    // The toolState should be updated with the error
    expect(toolState).toBeDefined();
    expect(toolState!.status).toBe("errored");
    expect(toolState!.output).toEqual([
      {
        content: "Tool broken_tool not found",
        name: "Tool Result",
        description: "Tool execution result",
      },
    ]);

    // CRITICAL: No separate tool message should be added to chatHistory
    const separateToolMessages = chatHistory.filter(
      (item) => item.message.role === "tool",
    );
    expect(separateToolMessages).toHaveLength(0);
  });
});
