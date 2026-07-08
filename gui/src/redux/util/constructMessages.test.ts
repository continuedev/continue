import {
  AssistantChatMessage,
  ChatHistoryItem,
  ChatMessage,
  ContextItemWithId,
  RuleWithSource,
  ThinkingChatMessage,
  ToolCall,
  ToolResultChatMessage,
  UserChatMessage,
} from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  CANCELLED_TOOL_CALL_MESSAGE,
  NO_TOOL_CALL_OUTPUT_MESSAGE,
} from "core/tools/constants";
import { renderChatMessage } from "core/util/messageContent";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { constructMessages } from "./constructMessages";

// For these tests we will mock the rules to simulate different scenarios
const CONTEXT_RULE: RuleWithSource = {
  source: "rules-block",
  rule: "CONTEXT_RULE",
  description: "CONTEXT_TRIGGER",
};
const LAST_MESSAGE_RULE: RuleWithSource = {
  source: "rules-block",
  rule: "LAST_MESSAGE_RULE",
  description: "LAST_MESSAGE_TRIGGER",
};
const NORMAL_RULE: RuleWithSource = {
  source: "rules-block",
  rule: "Always apply rule",
};

vi.mock("core/llm/rules/getSystemMessageWithRules", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    getSystemMessageWithRules: ({
      baseSystemMessage,
      availableRules,
      userMessage,
      contextItems,
      rulePolicies,
    }: {
      baseSystemMessage: string;
      availableRules: RuleWithSource[];
      userMessage?: UserChatMessage | ToolResultChatMessage;
      contextItems: ContextItemWithId[];
      rulePolicies?: Record<string, any>;
    }) => {
      // Filter rules based on our mock logic
      const appliedRules = availableRules.filter((rule) => {
        if (rule.rule === LAST_MESSAGE_RULE.rule) {
          if (userMessage) {
            return renderChatMessage(userMessage).includes(
              LAST_MESSAGE_RULE.description!,
            );
          } else {
            return false;
          }
        }
        if (rule.rule === CONTEXT_RULE.rule) {
          return contextItems.some((item) =>
            item.content.includes(CONTEXT_RULE.description!),
          );
        }
        return true;
      });

      // Build the system message with applied rules
      let systemMessage = baseSystemMessage || "";
      if (appliedRules.length > 0) {
        systemMessage += "\n\nRules to follow:\n";
        for (const rule of appliedRules) {
          systemMessage += `- ${rule.rule}\n`;
        }
      }

      return { systemMessage, appliedRules };
    },
  };
});

describe("constructMessages", () => {
  // Setup mock data
  let mockHistory: ChatHistoryItem[];
  const mockRules: RuleWithSource[] = [
    CONTEXT_RULE,
    LAST_MESSAGE_RULE,
    NORMAL_RULE,
  ];

  const createContextItem = (
    id: string,
    content: string,
  ): ContextItemWithId => ({
    id: {
      providerTitle: "test-provider",
      itemId: id,
    },
    content,
    name: `Context Item ${id}`,
    description: `Description for ${id}`,
  });

  beforeEach(() => {
    // Reset mock history before each test
    mockHistory = [];
  });

  test("should ignore empty, tool, and system messages that go in", () => {
    // Setup history with various message types including ones to be ignored
    mockHistory = [
      {
        message: {
          role: "system",
          content: "I should be ignored",
        } as ChatMessage,
        contextItems: [],
      },
      {
        message: {
          role: "tool",
          content: "I should be ignored",
          toolCallId: "123",
        } as ToolResultChatMessage,
        contextItems: [],
      },
      {
        message: { role: "user", content: "" } as ChatMessage, // Empty message
        contextItems: [],
      },
      {
        message: { role: "user", content: "Valid user message" } as ChatMessage,
        contextItems: [],
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Should only contain a system message (added by the function) and the valid user message
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toEqual([
      { type: "text", text: "Valid user message" },
    ]);
    expect(messages.some((msg) => msg.content === "I should be ignored")).toBe(
      false,
    );
  });

  test("should convert user messages to message parts arrays with context items", () => {
    const contextItems = [
      createContextItem("1", "Context content 1"),
      createContextItem("2", "Context content 2"),
    ];

    mockHistory = [
      {
        message: {
          role: "user",
          content: "User message with context",
        } as ChatMessage,
        contextItems,
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Check that user message was converted to parts array with context items first
    expect(messages.length).toBe(2); // System message + user message
    expect(messages[1].role).toBe("user");

    // Check content structure
    const content = messages[1].content as any[];
    expect(content.length).toBe(3); // 2 context items + original message
    expect(content[0].text).toContain("Context content 1");
    expect(content[1].text).toContain("Context content 2");
    expect(content[2].text).toBe("User message with context");
  });

  test("should inject thinking messages with no changes", () => {
    const thinkingMessage: ThinkingChatMessage = {
      role: "thinking",
      content: "Thinking process...",
    };

    mockHistory = [
      {
        message: thinkingMessage,
        contextItems: [],
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Should have system message + thinking message
    expect(messages.length).toBe(2);
    expect(messages[1].role).toBe("thinking");
    expect(messages[1].content).toBe("Thinking process...");
  });

  test("should inject assistant messages with no changes", () => {
    const assistantMessage: AssistantChatMessage = {
      role: "assistant",
      content: "Assistant response",
    };

    mockHistory = [
      {
        message: assistantMessage,
        contextItems: [],
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Should have system message + assistant message
    expect(messages.length).toBe(2);
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("Assistant response");
  });

  test("should follow assistant messages with tool calls by tool messages containing the tool output", () => {
    const assistantWithToolCall: AssistantChatMessage = {
      role: "assistant",
      content: "I will search for that",
      toolCalls: [
        {
          id: "tool-call-1",
          type: "function",
          function: {
            name: "search",
            arguments: '{"query": "test"}',
          },
        },
      ],
    };

    // With tool output
    mockHistory = [
      {
        message: {
          role: "user",
          content: "Can you search for something?",
        } as UserChatMessage,
        contextItems: [],
      },
      {
        message: assistantWithToolCall,
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tool-call-1",
            toolCall: {
              id: "tool-call-1",
              type: "function",
              function: {
                name: "search",
                arguments: '{"query": "test"}',
              },
            },
            status: "done",
            parsedArgs: { query: "test" },
            output: [
              createContextItem("search-result", "Search result content"),
            ],
          },
        ],
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Should have: system + user + assistant + tool messages
    expect(messages.length).toBe(4);
    expect(messages[2].role).toBe("assistant");
    expect(messages[3].role).toBe("tool");
    const toolMessage = messages[3] as ToolResultChatMessage;
    expect(toolMessage.toolCallId).toBe("tool-call-1");
    expect(toolMessage.content).toContain("Search result content");
  });

  test("should show cancelled message for cancelled tool calls", () => {
    const assistantWithToolCall: AssistantChatMessage = {
      role: "assistant",
      content: "I will search for that",
      toolCalls: [
        {
          id: "tool-call-1",
          type: "function",
          function: {
            name: "search",
            arguments: '{"query": "test"}',
          },
        },
      ],
    };

    // With cancelled tool call
    mockHistory = [
      {
        message: assistantWithToolCall,
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tool-call-1",
            toolCall: {
              id: "tool-call-1",
              type: "function",
              function: {
                name: "search",
                arguments: '{"query": "test"}',
              },
            },
            status: "canceled",
            parsedArgs: { query: "test" },
          },
        ],
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Should have system + assistant + tool message with cancelled message
    expect(messages.length).toBe(3);
    expect(messages[2].role).toBe("tool");
    const toolMessage = messages[2] as ToolResultChatMessage;
    expect(toolMessage.toolCallId).toBe("tool-call-1");
    expect(toolMessage.content).toBe(CANCELLED_TOOL_CALL_MESSAGE);
  });

  test('should show "No tool output" for tool calls without output', () => {
    const assistantWithToolCall: AssistantChatMessage = {
      role: "assistant",
      content: "I will search for that",
      toolCalls: [
        {
          id: "tool-call-1",
          type: "function",
          function: {
            name: "search",
            arguments: '{"query": "test"}',
          },
        },
      ],
    };

    // With tool call but no output
    mockHistory = [
      {
        message: assistantWithToolCall,
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tool-call-1",
            toolCall: {
              id: "tool-call-1",
              type: "function",
              function: {
                name: "search",
                arguments: '{"query": "test"}',
              },
            },
            status: "generating", // Not done yet
            parsedArgs: { query: "test" },
          },
        ],
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Should have system + assistant + tool message with "No tool output"
    expect(messages.length).toBe(3);
    expect(messages[2].role).toBe("tool");
    expect(messages[2].content).toBe(NO_TOOL_CALL_OUTPUT_MESSAGE);
  });

  test("should start with system message using base message if provided", () => {
    mockHistory = [
      {
        message: { role: "user", content: "Hello" } as UserChatMessage,
        contextItems: [],
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Custom Base System Message",
      mockRules,
      {},
    );

    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Custom Base System Message");
  });

  test("should handle multiple tool calls in a single assistant message", () => {
    const toolCall1: ToolCall = {
      id: "tool-call-1",
      type: "function",
      function: {
        name: "search",
        arguments: '{"query": "test"}',
      },
    };
    const toolCall2: ToolCall = {
      id: "tool-call-2",
      type: "function",
      function: {
        name: "weather",
        arguments: '{"location": "New York"}',
      },
    };
    const assistantWithMultipleToolCalls: AssistantChatMessage = {
      role: "assistant",
      content: "I will search and check the weather",
      toolCalls: [toolCall1, toolCall2],
    };

    // Only the first tool call has output
    mockHistory = [
      {
        message: assistantWithMultipleToolCalls,
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: toolCall1.id,
            toolCall: toolCall1,
            status: "done",
            parsedArgs: { query: "test" },
            output: [
              createContextItem("search-result", "Search result content"),
            ],
          },
          {
            toolCallId: toolCall2.id,
            toolCall: toolCall2,
            status: "done",
            parsedArgs: { location: "New York" },
          },
        ],
      },
    ];

    const { messages } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Should have: system + assistant + 2 tool messages
    expect(messages.length).toBe(4);
    expect(messages[1].role).toBe("assistant");

    // First tool message should have output
    expect(messages[2].role).toBe("tool");
    expect(messages[3].role).toBe("tool");

    const toolMessage1 = messages[2] as ToolResultChatMessage;
    const toolMessage2 = messages[3] as ToolResultChatMessage;
    expect(toolMessage1.toolCallId).toBe("tool-call-1");
    expect(toolMessage1.content).toContain("Search result content");

    // Second tool message should have "No tool output"
    expect(toolMessage2.toolCallId).toBe("tool-call-2");
    expect(toolMessage2.content).toBe(NO_TOOL_CALL_OUTPUT_MESSAGE);
  });

  test("should handle messages with array content", () => {
    // User message with array content (including an image)
    const userMessageWithArray: UserChatMessage = {
      role: "user",
      content: [
        { type: "text", text: "Here is some text" },
        {
          type: "imageUrl",
          imageUrl: { url: "https://example.com/image.jpg" },
        },
      ],
    };

    mockHistory = [
      {
        message: userMessageWithArray,
        contextItems: [createContextItem("ctx", "Context text")],
      },
    ];

    const { messages, appliedRules } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Check the user message content structure
    expect(messages.length).toBe(2);
    expect(messages[1].role).toBe("user");

    const content = messages[1].content as any[];
    // Should have context item + original 2 parts
    expect(content.length).toBe(3);
    expect(content[0].type).toBe("text");
    expect(content[0].text).toContain("Context text");
    expect(content[1].type).toBe("text");
    expect(content[1].text).toBe("Here is some text");
    expect(content[2].type).toBe("imageUrl");
    expect(content[2].imageUrl.url).toBe("https://example.com/image.jpg");

    // This also verifies that rules are NOT applied if the triggers are not present
    expect(appliedRules).toHaveLength(1);
    expect(appliedRules).toContainEqual(NORMAL_RULE);
  });

  test("system message should include rules triggered by context items from the last user message forward", () => {
    // Create context item that should trigger the CONTEXT_RULE
    const triggeringContextItem = createContextItem(
      "trigger",
      `Some content with ${CONTEXT_RULE.description} in it`,
    );

    mockHistory = [
      // First user message with non-triggering context
      {
        message: { role: "user", content: "First message" } as UserChatMessage,
        contextItems: [createContextItem("normal", "Normal context")],
      },
      // Assistant response
      {
        message: {
          role: "assistant",
          content: "Assistant response",
        } as AssistantChatMessage,
        contextItems: [],
      },
      // Last user message with triggering context
      {
        message: { role: "user", content: "Last message" } as UserChatMessage,
        contextItems: [triggeringContextItem],
      },
    ];

    const { messages, appliedRules } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Verify context rule was applied in the system message
    expect(appliedRules).toHaveLength(2);
    expect(appliedRules).toContainEqual(NORMAL_RULE);
    expect(appliedRules).toContainEqual(CONTEXT_RULE);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Base System Message");
    expect(messages[0].content).toContain(CONTEXT_RULE.rule);
  });

  test("system message should include rules triggered by tool output after the last user message", () => {
    // Create a history with a user message, assistant with tool call, and tool output containing triggering content
    const assistantWithToolCall: AssistantChatMessage = {
      role: "assistant",
      content: "I will search for that",
      toolCalls: [
        {
          id: "tool-call-1",
          type: "function",
          function: {
            name: "search",
            arguments: '{"query": "test"}',
          },
        },
      ],
    };

    // Tool output containing the trigger for CONTEXT_RULE
    const triggeringToolOutput = createContextItem(
      "search-result",
      `Search result with ${CONTEXT_RULE.description} trigger`,
    );

    mockHistory = [
      {
        message: {
          role: "user",
          content: "Can you search for something?",
        } as UserChatMessage,
        contextItems: [],
      },
      {
        message: assistantWithToolCall,
        contextItems: [],
        toolCallStates: [
          {
            toolCallId: "tool-call-1",
            toolCall: {
              id: "tool-call-1",
              type: "function",
              function: {
                name: "search",
                arguments: '{"query": "test"}',
              },
            },
            status: "done",
            parsedArgs: { query: "test" },
            output: [triggeringToolOutput],
          },
        ],
      },
    ];

    const { messages, appliedRules } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // Verify context rule was applied in the system message due to the tool output
    expect(appliedRules).toHaveLength(2);
    expect(appliedRules).toContainEqual(NORMAL_RULE);
    expect(appliedRules).toContainEqual(CONTEXT_RULE);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Base System Message");
    expect(messages[0].content).toContain(CONTEXT_RULE.rule);
  });

  test("system message should only apply rules triggered by the last user message", () => {
    // First user message with trigger for LAST_MESSAGE_RULE
    const firstUserMessage = {
      role: "user",
      content: `This contains ${LAST_MESSAGE_RULE.description}`,
    } as UserChatMessage;

    // Last user message without any triggers
    const lastUserMessage = {
      role: "user",
      content: "This is a normal message",
    } as UserChatMessage;

    mockHistory = [
      {
        message: firstUserMessage,
        contextItems: [],
      },
      {
        message: {
          role: "assistant",
          content: "First response",
        } as AssistantChatMessage,
        contextItems: [],
      },
      {
        message: lastUserMessage,
        contextItems: [],
      },
    ];

    const { messages, appliedRules } = constructMessages(
      mockHistory,
      "Base System Message",
      mockRules,
      {},
    );

    // LAST_MESSAGE_RULE should not be applied since the trigger is not in the last message
    expect(appliedRules).toHaveLength(1);
    expect(appliedRules).toContainEqual(NORMAL_RULE); // Normal rule should always apply
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Base System Message");
    expect(messages[0].content).not.toContain(LAST_MESSAGE_RULE.rule);
  });

  // Tests for the specific block in lines 135-142 handling toolCallState.output
  describe("toolCallState.output handling (lines 135-142)", () => {
    test("should use CANCELLED_TOOL_CALL_MESSAGE for cancelled tool calls", () => {
      const assistantWithToolCall: AssistantChatMessage = {
        role: "assistant",
        content: "I'll run a command",
        toolCalls: [
          {
            id: "tool-call-1",
            type: "function",
            function: {
              name: "some_tool",
              arguments: '{"command": "ls"}',
            },
          },
        ],
      };

      mockHistory = [
        {
          message: assistantWithToolCall,
          contextItems: [],
          toolCallStates: [
            {
              toolCallId: "tool-call-1",
              toolCall: {
                id: "tool-call-1",
                type: "function",
                function: {
                  name: "some_tool",
                  arguments: '{"command": "ls"}',
                },
              },
              status: "canceled",
              parsedArgs: { command: "ls" },
              output: [
                createContextItem(
                  "result",
                  "This should be ignored due to cancelled status",
                ),
              ],
            },
          ],
        },
      ];

      const { messages } = constructMessages(
        mockHistory,
        "Base System Message",
        mockRules,
        {},
      );

      const toolMessage = messages[2] as ToolResultChatMessage;
      expect(toolMessage.role).toBe("tool");
      expect(toolMessage.content).toBe(CANCELLED_TOOL_CALL_MESSAGE);
      expect(toolMessage.content).not.toContain("This should be ignored");
    });

    test("should use renderContextItemsWithStatus for RunTerminalCommand with output", () => {
      const assistantWithTerminalCall: AssistantChatMessage = {
        role: "assistant",
        content: "I'll run a terminal command",
        toolCalls: [
          {
            id: "terminal-call-1",
            type: "function",
            function: {
              name: BuiltInToolNames.RunTerminalCommand,
              arguments: '{"command": "ls -la"}',
            },
          },
        ],
      };

      const terminalOutputWithStatus = [
        {
          ...createContextItem("terminal-output", "file1.txt\nfile2.txt"),
          status: "completed",
        },
        {
          ...createContextItem("terminal-error", "Warning: deprecated flag"),
          status: "warning",
        },
      ];

      mockHistory = [
        {
          message: assistantWithTerminalCall,
          contextItems: [],
          toolCallStates: [
            {
              toolCallId: "terminal-call-1",
              toolCall: {
                id: "terminal-call-1",
                type: "function",
                function: {
                  name: BuiltInToolNames.RunTerminalCommand,
                  arguments: '{"command": "ls -la"}',
                },
              },
              status: "done",
              parsedArgs: { command: "ls -la" },
              output: terminalOutputWithStatus,
            },
          ],
        },
      ];

      const { messages } = constructMessages(
        mockHistory,
        "Base System Message",
        mockRules,
        {},
      );

      const toolMessage = messages[2] as ToolResultChatMessage;
      expect(toolMessage.role).toBe("tool");
      expect(toolMessage.toolCallId).toBe("terminal-call-1");
      // Should contain content with status appended
      expect(toolMessage.content).toContain("file1.txt\nfile2.txt");
      expect(toolMessage.content).toContain("[Status: completed]");
      expect(toolMessage.content).toContain("Warning: deprecated flag");
      expect(toolMessage.content).toContain("[Status: warning]");
      // Should use renderContextItemsWithStatus format with double newlines between items
      expect(toolMessage.content).toMatch(
        /file1\.txt\nfile2\.txt\n\[Status: completed\]\n\nWarning: deprecated flag\n\[Status: warning\]/,
      );
    });

    test("should use renderContextItems for non-RunTerminalCommand tools with output", () => {
      const assistantWithSearchCall: AssistantChatMessage = {
        role: "assistant",
        content: "I'll search for that",
        toolCalls: [
          {
            id: "search-call-1",
            type: "function",
            function: {
              name: "search", // Not RunTerminalCommand
              arguments: '{"query": "test"}',
            },
          },
        ],
      };

      const searchOutput = [
        createContextItem("result1", "First search result"),
        createContextItem("result2", "Second search result"),
      ];

      mockHistory = [
        {
          message: assistantWithSearchCall,
          contextItems: [],
          toolCallStates: [
            {
              toolCallId: "search-call-1",
              toolCall: {
                id: "search-call-1",
                type: "function",
                function: {
                  name: "search",
                  arguments: '{"query": "test"}',
                },
              },
              status: "done",
              parsedArgs: { query: "test" },
              output: searchOutput,
            },
          ],
        },
      ];

      const { messages } = constructMessages(
        mockHistory,
        "Base System Message",
        mockRules,
        {},
      );

      const toolMessage = messages[2] as ToolResultChatMessage;
      expect(toolMessage.role).toBe("tool");
      expect(toolMessage.toolCallId).toBe("search-call-1");
      // Should use renderContextItems format (no status, double newlines between items)
      expect(toolMessage.content).toBe(
        "First search result\n\nSecond search result",
      );
      expect(toolMessage.content).not.toContain("[Status:");
    });

    test("should use NO_TOOL_CALL_OUTPUT_MESSAGE when no output exists", () => {
      const assistantWithToolCall: AssistantChatMessage = {
        role: "assistant",
        content: "I'll search for that",
        toolCalls: [
          {
            id: "search-call-1",
            type: "function",
            function: {
              name: "search",
              arguments: '{"query": "test"}',
            },
          },
        ],
      };

      mockHistory = [
        {
          message: assistantWithToolCall,
          contextItems: [],
          toolCallStates: [
            {
              toolCallId: "search-call-1",
              toolCall: {
                id: "search-call-1",
                type: "function",
                function: {
                  name: "search",
                  arguments: '{"query": "test"}',
                },
              },
              status: "generating",
              parsedArgs: { query: "test" },
              // No output field
            },
          ],
        },
      ];

      const { messages } = constructMessages(
        mockHistory,
        "Base System Message",
        mockRules,
        {},
      );

      const toolMessage = messages[2] as ToolResultChatMessage;
      expect(toolMessage.role).toBe("tool");
      expect(toolMessage.toolCallId).toBe("search-call-1");
      expect(toolMessage.content).toBe(NO_TOOL_CALL_OUTPUT_MESSAGE);
    });

    test("should use NO_TOOL_CALL_OUTPUT_MESSAGE when toolCallState output is undefined", () => {
      const toolCall: ToolCall = {
        id: "search-call-1",
        type: "function",
        function: {
          name: "search",
          arguments: '{"query": "test"}',
        },
      };
      const assistantWithToolCall: AssistantChatMessage = {
        role: "assistant",
        content: "I'll search for that",
        toolCalls: [toolCall],
      };

      mockHistory = [
        {
          message: assistantWithToolCall,
          contextItems: [],
          toolCallStates: [
            {
              toolCall,
              parsedArgs: {
                query: "test",
              },
              status: "generated",
              toolCallId: toolCall.id,
              // no output defined
            },
          ],
        },
      ];

      const { messages } = constructMessages(
        mockHistory,
        "Base System Message",
        mockRules,
        {},
      );

      const toolMessage = messages[2] as ToolResultChatMessage;
      expect(toolMessage.role).toBe("tool");
      expect(toolMessage.toolCallId).toBe("search-call-1");
      expect(toolMessage.content).toBe(NO_TOOL_CALL_OUTPUT_MESSAGE);
    });

    test("should prioritize cancelled status over output content", () => {
      const assistantWithTerminalCall: AssistantChatMessage = {
        role: "assistant",
        content: "I'll run a command",
        toolCalls: [
          {
            id: "terminal-call-1",
            type: "function",
            function: {
              name: BuiltInToolNames.RunTerminalCommand,
              arguments: '{"command": "ls"}',
            },
          },
        ],
      };

      mockHistory = [
        {
          message: assistantWithTerminalCall,
          contextItems: [],
          toolCallStates: [
            {
              toolCallId: "terminal-call-1",
              toolCall: {
                id: "terminal-call-1",
                type: "function",
                function: {
                  name: BuiltInToolNames.RunTerminalCommand,
                  arguments: '{"command": "ls"}',
                },
              },
              status: "canceled", // Cancelled status
              parsedArgs: { command: "ls" },
              output: [
                createContextItem(
                  "terminal-output",
                  "This output should be ignored",
                ),
              ], // Has output but is cancelled
            },
          ],
        },
      ];

      const { messages } = constructMessages(
        mockHistory,
        "Base System Message",
        mockRules,
        {},
      );

      const toolMessage = messages[2] as ToolResultChatMessage;
      expect(toolMessage.role).toBe("tool");
      expect(toolMessage.toolCallId).toBe("terminal-call-1");
      // Should use cancelled message, not the output content
      expect(toolMessage.content).toBe(CANCELLED_TOOL_CALL_MESSAGE);
      expect(toolMessage.content).not.toContain(
        "This output should be ignored",
      );
    });
  });
});
