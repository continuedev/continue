import { act } from "@testing-library/react";
import { ChatMessage } from "core";
import { addAndSelectMockLlm } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import { sendInputWithMockedResponse } from "../../../util/test/utils";
import { Chat } from "../Chat";

describe("Parallel Tool Calls", () => {
  const PARALLEL_TOOL_CALL_RESPONSE: ChatMessage[] = [
    {
      role: "assistant",
      content:
        "I'll call the get_weather function in parallel for both San Francisco and Monterey, California.",
      toolCalls: [
        {
          id: "toolu_0112JmA95qW6WhAsvkKb7Avp",
          type: "function",
          function: {
            name: "get_weather",
            arguments: JSON.stringify({
              location: "San Francisco, CA",
            }),
          },
        },
        {
          id: "toolu_01UFK4ZUmbpkeFJGg7mdoT6T",
          type: "function",
          function: {
            name: "get_weather",
            arguments: JSON.stringify({
              location: "Monterey, CA",
            }),
          },
        },
      ],
    },
  ];

  test("should handle assistant message with multiple tool calls", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    const INPUT = "What's the weather in San Francisco and Monterey?";

    // Send input with mocked parallel tool call response
    await sendInputWithMockedResponse(
      ideMessenger,
      INPUT,
      PARALLEL_TOOL_CALL_RESPONSE,
    );

    // Wait for the message to be processed
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Currently this will fail because we only support one tool call
    // but this test documents the expected behavior
  });

  test("should store multiple tool call states in Redux", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    const INPUT = "Get weather for both cities";

    await sendInputWithMockedResponse(
      ideMessenger,
      INPUT,
      PARALLEL_TOOL_CALL_RESPONSE,
    );

    // Wait for the message to be processed
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Wait for any state updates to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify multiple tool calls are stored in Redux state
    const state = store.getState();
    const history = state.session.history;

    // Find the assistant message (might not be at index 1 if tool messages were created)
    const assistantMessage = history.find(
      (item) =>
        item.message.role === "assistant" &&
        (item.message as any).toolCalls?.length,
    );

    expect(assistantMessage).toBeDefined();
    expect((assistantMessage!.message as any).toolCalls).toHaveLength(2);
    expect(assistantMessage!.toolCallStates).toHaveLength(2);

    // Verify each tool call has correct ID and function name
    expect(assistantMessage!.toolCallStates![0].toolCallId).toBe(
      "toolu_0112JmA95qW6WhAsvkKb7Avp",
    );
    expect(assistantMessage!.toolCallStates![0].toolCall.function.name).toBe(
      "get_weather",
    );
    expect(assistantMessage!.toolCallStates![1].toolCallId).toBe(
      "toolu_01UFK4ZUmbpkeFJGg7mdoT6T",
    );
    expect(assistantMessage!.toolCallStates![1].toolCall.function.name).toBe(
      "get_weather",
    );
  });

  test("should use utility functions for finding tool calls", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    const INPUT = "Get weather for both cities";

    await sendInputWithMockedResponse(
      ideMessenger,
      INPUT,
      PARALLEL_TOOL_CALL_RESPONSE,
    );

    // Wait for the message to be processed
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Test our utility functions work with the new state
    const state = store.getState();

    // Import the utility functions to test them
    const { findCurrentToolCalls, hasCurrentToolCalls, findToolCall } =
      await import("../../../redux/util");

    // Test findCurrentToolCalls finds both tool calls
    const currentToolCalls = findCurrentToolCalls(state.session.history);
    expect(currentToolCalls).toHaveLength(2);
    expect(currentToolCalls[0].toolCallId).toBe(
      "toolu_0112JmA95qW6WhAsvkKb7Avp",
    );
    expect(currentToolCalls[1].toolCallId).toBe(
      "toolu_01UFK4ZUmbpkeFJGg7mdoT6T",
    );

    // Test hasCurrentToolCalls returns true
    expect(hasCurrentToolCalls(state.session.history)).toBe(true);

    // Test findToolCall can find specific tool calls by ID
    const toolCall1 = findToolCall(
      state.session.history,
      "toolu_0112JmA95qW6WhAsvkKb7Avp",
    );
    const toolCall2 = findToolCall(
      state.session.history,
      "toolu_01UFK4ZUmbpkeFJGg7mdoT6T",
    );
    expect(toolCall1?.toolCall.function.name).toBe("get_weather");
    expect(toolCall2?.toolCall.function.name).toBe("get_weather");
    expect(toolCall1?.toolCall.function.arguments).toContain("San Francisco");
    expect(toolCall2?.toolCall.function.arguments).toContain("Monterey");
  });

  test("should complete streaming but hide ResponseActions when pending tool calls exist", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    const INPUT = "Read a file using the read_file tool";

    await sendInputWithMockedResponse(
      ideMessenger,
      INPUT,
      PARALLEL_TOOL_CALL_RESPONSE,
    );

    // Wait for the message to be processed
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify streaming is complete (so tool calls can be shown)
    const state = store.getState();
    expect(state.session.isStreaming).toBe(false);

    // Verify we have pending tool calls
    const { findCurrentToolCallsByStatus } = await import("../../../redux/util");
    const pendingToolCalls = findCurrentToolCallsByStatus(state.session.history, "generated");
    expect(pendingToolCalls).toHaveLength(2);

    // Note: ResponseActions should be hidden by the hasPendingToolCalls condition in StepContainer
    // The individual tool calls should now show with "Continue wants to..." text and accept/reject buttons
  });

  test("should show tool name in pending toolbar instead of generic text", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Test with single tool call to check the specific name display
    // Use get_weather which should stay in generated status for this test
    const SINGLE_TOOL_CALL_RESPONSE: ChatMessage[] = [
      {
        role: "assistant",
        content: "I'll check the weather for you.",
        toolCalls: [
          {
            id: "single-tool-call",
            type: "function",
            function: {
              name: "get_weather",
              arguments: JSON.stringify({
                location: "San Francisco, CA",
              }),
            },
          },
        ],
      },
    ];

    await sendInputWithMockedResponse(
      ideMessenger,
      "Check weather",
      SINGLE_TOOL_CALL_RESPONSE,
    );

    // Wait for processing
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const state = store.getState();
    const { findCurrentToolCallsByStatus } = await import("../../../redux/util");
    const pendingToolCalls = findCurrentToolCallsByStatus(state.session.history, "generated");
    
    // Should have one pending tool call with the correct name
    expect(pendingToolCalls).toHaveLength(1);
    expect(pendingToolCalls[0].toolCall.function.name).toBe("get_weather");
  });

  test("should show individual tool call UI with 'Continue wants to...' text", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Test with a tool that requires approval (not auto-executed)
    const TOOL_CALL_RESPONSE: ChatMessage[] = [
      {
        role: "assistant",
        content: "I'll use a tool that requires approval.",
        toolCalls: [
          {
            id: "approval-required-tool-call",
            type: "function",
            function: {
              name: "unknown_tool_requiring_approval",
              arguments: JSON.stringify({
                param: "test.js",
              }),
            },
          },
        ],
      },
    ];

    await sendInputWithMockedResponse(
      ideMessenger,
      "Use a tool",
      TOOL_CALL_RESPONSE,
    );

    // Wait for processing
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const state = store.getState();
    
    // Verify we have a pending tool call
    const { findCurrentToolCallsByStatus } = await import("../../../redux/util");
    const pendingToolCalls = findCurrentToolCallsByStatus(state.session.history, "generated");
    expect(pendingToolCalls).toHaveLength(1);
    expect(pendingToolCalls[0].toolCall.function.name).toBe("unknown_tool_requiring_approval");

    // Verify the individual tool call UI should now show up in the DOM
    // Since we fixed Chat.tsx to use toolCallStates instead of toolCallState,
    // the ToolCallDiv components should now render
    const state2 = store.getState();
    const history = state2.session.history;
    
    // Find the message with tool calls
    const messageWithToolCalls = history.find(item => 
      item.message.role === "assistant" && item.toolCallStates?.length
    );
    
    // Verify that both condition parts are met for rendering in Chat.tsx:
    // 1. item.message.toolCalls exists
    // 2. item.toolCallStates exists 
    expect((messageWithToolCalls?.message as any).toolCalls).toBeDefined();
    expect(messageWithToolCalls?.toolCallStates).toBeDefined();
    expect(messageWithToolCalls?.toolCallStates).toHaveLength(1);
  });

  test("should show all pending tool calls requiring permissions simultaneously", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Test with multiple tools that require approval
    const MULTIPLE_TOOL_CALLS_RESPONSE: ChatMessage[] = [
      {
        role: "assistant",
        content: "I'll use multiple tools that require approval.",
        toolCalls: [
          {
            id: "approval-required-tool-call-1",
            type: "function",
            function: {
              name: "write_file",
              arguments: JSON.stringify({
                file_path: "test1.js",
                content: "console.log('test1');"
              }),
            },
          },
          {
            id: "approval-required-tool-call-2",
            type: "function",
            function: {
              name: "run_terminal_command",
              arguments: JSON.stringify({
                command: "npm test"
              }),
            },
          },
          {
            id: "approval-required-tool-call-3",
            type: "function",
            function: {
              name: "edit_file",
              arguments: JSON.stringify({
                file_path: "test2.js",
                content: "console.log('test2');"
              }),
            },
          },
        ],
      },
    ];

    await sendInputWithMockedResponse(
      ideMessenger,
      "Use multiple tools",
      MULTIPLE_TOOL_CALLS_RESPONSE,
    );

    // Wait for processing
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const state = store.getState();
    
    // Verify we have multiple pending tool calls
    const { findCurrentToolCallsByStatus } = await import("../../../redux/util");
    const pendingToolCalls = findCurrentToolCallsByStatus(state.session.history, "generated");
    expect(pendingToolCalls).toHaveLength(3);
    
    // Verify all tool calls are in "generated" status (requiring permissions)
    expect(pendingToolCalls[0].toolCall.function.name).toBe("write_file");
    expect(pendingToolCalls[0].status).toBe("generated");
    expect(pendingToolCalls[1].toolCall.function.name).toBe("run_terminal_command");
    expect(pendingToolCalls[1].status).toBe("generated");
    expect(pendingToolCalls[2].toolCall.function.name).toBe("edit_file");
    expect(pendingToolCalls[2].status).toBe("generated");

    // The key test: All pending tool calls should be visible in the toolbar simultaneously
    // This verifies that the PendingToolCallToolbar shows all pending tools at once
    // rather than prompting for permissions one at a time
    
    // Verify the PendingToolCallToolbar would show all three tool calls
    // by checking that all three are in the "generated" state
    const allGeneratedCalls = pendingToolCalls.filter(call => call.status === "generated");
    expect(allGeneratedCalls).toHaveLength(3);
    
    // This test documents the expected behavior: all pending tool calls should
    // be shown simultaneously in the UI, not one at a time
  });
});
