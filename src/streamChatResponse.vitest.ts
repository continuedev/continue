import { describe, expect, it, vi, beforeEach } from "vitest";
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions.mjs";
import {
  preprocessStreamedToolCalls,
  executeStreamedToolCalls,
  processStreamingResponse,
} from "./streamChatResponse.js";
import { ToolCall } from "./tools/index.js";
import { PreprocessedToolCall } from "./tools/types.js";
import { toolPermissionManager } from "./permissions/permissionManager.js";
import { readFileTool } from "./tools/readFile.js";
import { searchCodeTool } from "./tools/searchCode.js";
import { writeFileTool } from "./tools/writeFile.js";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { ModelConfig } from "@continuedev/config-yaml";

vi.mock("./util/logger");
vi.mock("./telemetry/telemetryService");

// Test the chunk processing logic that was identified as buggy
describe("processStreamingResponse - content preservation", () => {
  // Mock dependencies
  let mockLlmApi: BaseLlmApi;
  let mockAbortController: AbortController;
  let mockModel: ModelConfig;
  let chunks: ChatCompletionChunk[];
  let chatHistory: ChatCompletionMessageParam[];

  // Helper to create a content chunk
  function contentChunk(content: string): ChatCompletionChunk {
    return {
      id: "test",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          delta: { content },
          finish_reason: null,
        },
      ],
    };
  }

  // Helper to create a tool call chunk
  function toolCallChunk(
    id: string,
    name?: string,
    args?: string
  ): ChatCompletionChunk {
    return {
      id: "test",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id,
                type: "function",
                function: {
                  name: name || undefined,
                  arguments: args || undefined,
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    };
  }

  // Helper to create a tool call chunk with optional ID
  function toolCallChunkWithIndex(
    index: number,
    id?: string,
    name?: string,
    args?: string
  ): ChatCompletionChunk {
    const toolCall: any = {
      index,
      type: "function" as const,
      function: {},
    };

    if (id) toolCall.id = id;
    if (name) toolCall.function.name = name;
    if (args !== undefined) toolCall.function.arguments = args;

    return {
      id: "test",
      object: "chat.completion.chunk" as const,
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          delta: { tool_calls: [toolCall] },
          finish_reason: null,
        },
      ],
    };
  }

  beforeEach(() => {
    // Reset chunks for each test
    chunks = [];
    chatHistory = [{ role: "user", content: "Test prompt" }];

    // Create a mock LLM API that returns our predefined chunks
    mockLlmApi = {
      chatCompletionStream: vi.fn().mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      }),
    } as unknown as BaseLlmApi;

    // Mock abort controller
    mockAbortController = {
      signal: { aborted: false },
    } as unknown as AbortController;

    // Mock model config
    mockModel = {
      model: "test-model",
      provider: "test-provider",
    } as unknown as ModelConfig;
  });

  it("content after tool calls is preserved", async () => {
    chunks = [
      contentChunk(""),
      toolCallChunk("call_123", "read_file", '{"filepath": "/README.md"}'),
      contentChunk(""),
      contentChunk("I'll read the README file for you."),
    ];

    const result = await processStreamingResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController
    );

    expect(result.content).toBe("I'll read the README file for you.");
    expect(result.toolCalls.length).toBe(1);

    // Fixed: finalContent should preserve the content
    expect(result.finalContent).toBe("I'll read the README file for you.");
  });

  it("content before tool calls is preserved", async () => {
    chunks = [
      contentChunk("Let me search for that. "),
      toolCallChunk("call_123", "search_code", '{"pattern": "test"}'),
    ];

    const result = await processStreamingResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController
    );

    expect(result.content).toBe("Let me search for that. ");
    expect(result.toolCalls.length).toBe(1);

    // Fixed: finalContent preserves content before tool calls
    expect(result.finalContent).toBe("Let me search for that. ");
  });

  it("handles the exact problematic sequence from the logs", async () => {
    chunks = [
      contentChunk(""),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", "read_file", ""),
      toolCallChunk(
        "toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A",
        undefined,
        '{"filepath'
      ),
      toolCallChunk(
        "toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A",
        undefined,
        '": "/Use'
      ),
      toolCallChunk(
        "toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A",
        undefined,
        "rs/nate/gh/c"
      ),
      toolCallChunk(
        "toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A",
        undefined,
        "ontinuede"
      ),
      toolCallChunk(
        "toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A",
        undefined,
        "v/cli/README"
      ),
      toolCallChunk("toolu_vrtx_01Jj9m9VbtwVZwcU6A311g6A", undefined, '.md"}'),
      contentChunk(""),
      contentChunk("I'll read the README file for you."),
    ];

    const result = await processStreamingResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController
    );

    expect(result.content).toBe("I'll read the README file for you.");
    expect(result.toolCalls.length).toBe(1);

    // Fixed: content is preserved
    expect(result.finalContent).toBe("I'll read the README file for you.");

    // Verify the tool call was assembled correctly
    expect(result.toolCalls[0].name).toBe("read_file");
    expect(result.toolCalls[0].argumentsStr).toBe(
      '{"filepath": "/Users/nate/gh/continuedev/cli/README.md"}'
    );
  });

  it("shows content works fine without tool calls", async () => {
    chunks = [contentChunk("Hello "), contentChunk("world!")];

    const result = await processStreamingResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController
    );

    expect(result.content).toBe("Hello world!");
    expect(result.toolCalls.length).toBe(0);

    // Without tool calls, finalContent is correct
    expect(result.finalContent).toBe("Hello world!");
  });

  it("handles provider that only sends tool ID in first chunk then uses index", async () => {
    chunks = [
      contentChunk("I'll read the README.md file for you and then say hello!"),
      // First chunk has ID
      toolCallChunkWithIndex(
        0,
        "toolu_vrtx_01ULx6UjdJ7B7bjf5WPHTXGz",
        "read_file",
        ""
      ),
      // Subsequent chunks only have index, no ID
      toolCallChunkWithIndex(
        0,
        undefined,
        undefined,
        '{"filepath": "/Users/nate/gh/continuedev/cli/README.md"}'
      ),
    ];

    const result = await processStreamingResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController
    );

    // Content is captured correctly
    expect(result.content).toBe(
      "I'll read the README.md file for you and then say hello!"
    );
    expect(result.toolCalls.length).toBe(1);

    // Fixed: finalContent preserves content
    expect(result.finalContent).toBe(
      "I'll read the README.md file for you and then say hello!"
    );

    // Tool call arguments are preserved using index mapping
    expect(result.toolCalls[0].name).toBe("read_file");
    expect(result.toolCalls[0].argumentsStr).toBe(
      '{"filepath": "/Users/nate/gh/continuedev/cli/README.md"}'
    );
  });

  it("handles realistic fragmented arguments from index-based provider", async () => {
    // Simulate the exact sequence from the user's logs with fragmented JSON
    chunks = [
      contentChunk("I'll read the README.md file for you and then say hello!"),
      // First chunk has ID
      toolCallChunkWithIndex(
        0,
        "toolu_vrtx_01ULx6UjdJ7B7bjf5WPHTXGz",
        "read_file",
        ""
      ),
      // Subsequent chunks fragment the JSON arguments
      toolCallChunkWithIndex(0, undefined, undefined, '{"filepa'),
      toolCallChunkWithIndex(0, undefined, undefined, 'th"'),
      toolCallChunkWithIndex(0, undefined, undefined, ": "),
      toolCallChunkWithIndex(0, undefined, undefined, '"/U'),
      toolCallChunkWithIndex(0, undefined, undefined, "sers/nate/gh"),
      toolCallChunkWithIndex(0, undefined, undefined, "/c"),
      toolCallChunkWithIndex(0, undefined, undefined, "onti"),
      toolCallChunkWithIndex(0, undefined, undefined, "nuedev/cli"),
      toolCallChunkWithIndex(0, undefined, undefined, "/READ"),
      toolCallChunkWithIndex(0, undefined, undefined, "ME.m"),
      toolCallChunkWithIndex(0, undefined, undefined, 'd"}'),
    ];

    const result = await processStreamingResponse(
      chatHistory,
      mockModel,
      mockLlmApi,
      mockAbortController
    );

    // Fixed: Both issues are resolved
    // 1. Content is preserved
    expect(result.finalContent).toBe(
      "I'll read the README.md file for you and then say hello!"
    );

    // 2. Tool call arguments are assembled correctly
    expect(result.toolCalls[0].name).toBe("read_file");
    expect(result.toolCalls[0].argumentsStr).toBe(
      '{"filepath": "/Users/nate/gh/continuedev/cli/README.md"}'
    );
  });
});

// Tests for preprocessStreamedToolCalls function
describe("preprocessStreamedToolCalls", () => {
  // Mock dependencies
  beforeEach(async () => {
    // Spy on the functions we need to mock
    vi.spyOn(
      await import("./tools/index.js"),
      "getAvailableTools"
    ).mockResolvedValue([readFileTool, searchCodeTool]);
    vi.spyOn(
      await import("./tools/index.js"),
      "validateToolCallArgsPresent"
    ).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preprocesses valid tool calls correctly", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_123",
        name: "read_file",
        arguments: { filepath: "/path/to/file.txt" },
        argumentsStr: '{"filepath": "/path/to/file.txt"}',
        startNotified: false,
      },
    ];

    const callbacks = {
      onToolStart: vi.fn(),
      onToolError: vi.fn(),
    };

    const { preprocessedCalls, errorChatEntries } =
      await preprocessStreamedToolCalls(toolCalls, callbacks);

    // Should have one preprocessed call and no errors
    expect(preprocessedCalls).toHaveLength(1);
    expect(errorChatEntries).toHaveLength(0);
    expect(preprocessedCalls[0].name).toBe("read_file");
    expect(preprocessedCalls[0].tool).toBeDefined();
    expect(preprocessedCalls[0].preprocessResult).toBeDefined();

    // Callbacks should not be called for successful preprocessing
    expect(callbacks.onToolStart).not.toHaveBeenCalled();
    expect(callbacks.onToolError).not.toHaveBeenCalled();
  });

  it("handles tool preprocessing errors correctly", async () => {
    // Set the spy to throw an error
    const toolsModule = await import("./tools/index.js");
    vi.spyOn(toolsModule, "validateToolCallArgsPresent").mockImplementationOnce(
      () => {
        throw new Error("Missing required argument");
      }
    );

    const toolCalls: ToolCall[] = [
      {
        id: "call_456",
        name: "read_file",
        arguments: {}, // Missing required filepath
        argumentsStr: "{}",
        startNotified: false,
      },
    ];

    const callbacks = {
      onToolStart: vi.fn(),
      onToolError: vi.fn(),
    };

    const { preprocessedCalls, errorChatEntries } =
      await preprocessStreamedToolCalls(toolCalls, callbacks);

    // Should have no preprocessed calls and one error
    expect(preprocessedCalls).toHaveLength(0);
    expect(errorChatEntries).toHaveLength(1);
    expect(errorChatEntries[0].content).toContain("Missing required argument");

    // Callbacks should be called for errors
    expect(callbacks.onToolStart).toHaveBeenCalledWith("read_file", {});
    expect(callbacks.onToolError).toHaveBeenCalledWith(
      expect.stringContaining("Missing required argument"),
      "read_file"
    );
  });

  it("handles tool not found errors", async () => {
    const toolCalls: ToolCall[] = [
      {
        id: "call_789",
        name: "nonexistent_tool",
        arguments: { some: "arg" },
        argumentsStr: '{"some": "arg"}',
        startNotified: false,
      },
    ];

    const { preprocessedCalls, errorChatEntries } =
      await preprocessStreamedToolCalls(toolCalls);

    // Should have no preprocessed calls and one error
    expect(preprocessedCalls).toHaveLength(0);
    expect(errorChatEntries).toHaveLength(1);
    expect(errorChatEntries[0].content).toContain(
      "Tool nonexistent_tool not found"
    );
  });
});

// Tests for executeStreamedToolCalls function
describe("executeStreamedToolCalls", () => {
  beforeEach(() => {
    // Reset spies
    vi.spyOn(toolPermissionManager, "requestPermission").mockReset();
    vi.spyOn(toolPermissionManager, "on").mockReset();
    vi.spyOn(toolPermissionManager, "off").mockReset();
  });

  it("executes tool calls with allowed permissions", async () => {
    // Setup spies instead of mocks
    const permissionsModule = await import("./permissions/index.js");
    vi.spyOn(permissionsModule, "checkToolPermission").mockReturnValue({
      permission: "allow",
    });

    const toolsModule = await import("./tools/index.js");
    const mockedExecuteToolCall = vi
      .spyOn(toolsModule, "executeToolCall")
      .mockResolvedValue("Tool execution successful");

    // Create preprocessed tool call
    const preprocessedCalls: PreprocessedToolCall[] = [
      {
        id: "call_123",
        name: "read_file",
        arguments: { filepath: "/test.txt" },
        argumentsStr: '{"filepath": "/test.txt"}',
        startNotified: false,
        tool: readFileTool,
      },
    ];

    const callbacks = {
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onToolError: vi.fn(),
    };

    const chatHistoryEntries = await executeStreamedToolCalls(
      preprocessedCalls,
      callbacks
    );

    // Verify results
    expect(chatHistoryEntries).toHaveLength(1);
    expect(chatHistoryEntries[0].content).toBe("Tool execution successful");
    expect(callbacks.onToolStart).toHaveBeenCalledWith("read_file", {
      filepath: "/test.txt",
    });
    expect(callbacks.onToolResult).toHaveBeenCalledWith(
      "Tool execution successful",
      "read_file"
    );
    expect(mockedExecuteToolCall).toHaveBeenCalledWith(preprocessedCalls[0]);
  });

  it("handles permission denied correctly", async () => {
    // Setup permission to ask
    const permissionsModule = await import("./permissions/index.js");
    vi.spyOn(permissionsModule, "checkToolPermission").mockReturnValue({
      permission: "ask",
    });

    // Spy on permission request to be denied
    vi.spyOn(toolPermissionManager, "requestPermission").mockResolvedValue({
      approved: false,
    });

    // Add event listener mock
    vi.spyOn(toolPermissionManager, "on").mockImplementation(
      (event, callback) => {
        if (event === "permissionRequested") {
          // Immediately trigger the callback to simulate event
          callback({
            requestId: "req_123",
            toolCall: {
              name: "write_file",
              arguments: {
                filepath: "/test.txt",
                content: "data",
              },
            },
          });
        }
        return toolPermissionManager;
      }
    );

    // Create preprocessed tool call
    const preprocessedCalls: PreprocessedToolCall[] = [
      {
        id: "call_456",
        name: "write_file",
        arguments: { filepath: "/test.txt", content: "data" },
        argumentsStr: '{"filepath": "/test.txt", "content": "data"}',
        startNotified: false,
        tool: writeFileTool,
      },
      {
        id: "call_457",
        name: "write_file",
        arguments: { filepath: "/test.txt", content: "data" },
        argumentsStr: '{"filepath": "/test.txt", "content": "data"}',
        startNotified: false,
        tool: writeFileTool,
      },
    ];

    const callbacks = {
      onToolStart: vi.fn(),
      onToolResult: vi.fn(),
      onToolPermissionRequest: vi.fn(),
    };

    const chatHistoryEntries = await executeStreamedToolCalls(
      preprocessedCalls,
      callbacks
    );

    // Verify results
    expect(chatHistoryEntries).toHaveLength(2);
    expect(chatHistoryEntries[0].content).toBe("Permission denied by user");
    expect(chatHistoryEntries[1].content).toBe(
      "Cancelled due to previous tool rejection"
    );
    expect(callbacks.onToolStart).toHaveBeenCalledWith("write_file", {
      filepath: "/test.txt",
      content: "data",
    });
    expect(callbacks.onToolResult).toHaveBeenCalledWith(
      "Permission denied by user",
      "write_file"
    );
    expect(callbacks.onToolPermissionRequest).toHaveBeenCalledWith(
      "write_file",
      { filepath: "/test.txt", content: "data" },
      "req_123",
      undefined
    );
  });

  it("handles tool execution errors", async () => {
    // Setup spies
    const permissionsModule = await import("./permissions/index.js");
    vi.spyOn(permissionsModule, "checkToolPermission").mockReturnValue({
      permission: "allow",
    });

    const toolsModule = await import("./tools/index.js");
    vi.spyOn(toolsModule, "executeToolCall").mockRejectedValue(
      new Error("Execution failed")
    );

    // Create preprocessed tool call
    const preprocessedCalls: PreprocessedToolCall[] = [
      {
        id: "call_789",
        name: "search_code",
        arguments: { pattern: "test" },
        argumentsStr: '{"pattern": "test"}',
        startNotified: false,
        tool: searchCodeTool,
      },
    ];

    const callbacks = {
      onToolStart: vi.fn(),
      onToolError: vi.fn(),
    };

    const chatHistoryEntries = await executeStreamedToolCalls(
      preprocessedCalls,
      callbacks
    );

    // Verify results
    expect(chatHistoryEntries).toHaveLength(1);
    expect(chatHistoryEntries[0].content).toContain(
      "Error executing tool search_code"
    );
    expect(chatHistoryEntries[0].content).toContain("Execution failed");
    expect(callbacks.onToolStart).toHaveBeenCalledWith("search_code", {
      pattern: "test",
    });
    expect(callbacks.onToolError).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error executing tool search_code: Execution failed"
      ),
      "search_code"
    );
  });
});
