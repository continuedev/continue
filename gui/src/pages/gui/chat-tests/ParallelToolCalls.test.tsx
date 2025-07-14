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
      content: "I'll call both tools in parallel.",
    },
    {
      role: "assistant",
      content: "",
      toolCalls: [
        {
          id: "tool-call-1",
          type: "function",
          function: {
            name: "read_file",
            arguments: JSON.stringify({ filepath: "test.js" }),
          },
        },
        {
          id: "tool-call-2",
          type: "function",
          function: {
            name: "write_file",
            arguments: JSON.stringify({
              filepath: "output.js",
              content: "test",
            }),
          },
        },
      ],
    },
  ];

  test("should handle assistant message with multiple tool calls", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    await sendInputWithMockedResponse(
      ideMessenger,
      "Use both tools",
      PARALLEL_TOOL_CALL_RESPONSE,
    );

    // Wait for streaming to complete and tool calls to be set to generated
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    const state = store.getState();
    const history = state.session.history;

    // Should have user message and assistant message
    expect(history).toHaveLength(2);

    // Find assistant message with tool calls
    const assistantMessage = history.find(
      (item) =>
        item.message.role === "assistant" && item.toolCallStates?.length,
    );

    expect(assistantMessage).toBeDefined();
    expect(assistantMessage!.toolCallStates).toHaveLength(2);
    expect(assistantMessage!.toolCallStates![0].toolCallId).toBe("tool-call-1");
    expect(assistantMessage!.toolCallStates![1].toolCallId).toBe("tool-call-2");
  });

  test("should handle individual tool call actions without breaking other calls", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    await sendInputWithMockedResponse(
      ideMessenger,
      "Use multiple tools",
      PARALLEL_TOOL_CALL_RESPONSE,
    );

    // Wait for streaming to complete and tool calls to be set to generated
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    const { findAllCurToolCallsByStatus } = await import("../../../redux/util");
    const { cancelToolCall } = await import(
      "../../../redux/slices/sessionSlice"
    );

    // Verify we have multiple pending tool calls
    let state = store.getState();
    let pendingToolCalls = findAllCurToolCallsByStatus(
      state.session.history,
      "generated",
    );
    expect(pendingToolCalls).toHaveLength(2);

    // Cancel the first tool call
    await act(async () => {
      store.dispatch(cancelToolCall({ toolCallId: "tool-call-1" }));
    });

    // Check state after canceling first tool call
    state = store.getState();
    pendingToolCalls = findAllCurToolCallsByStatus(
      state.session.history,
      "generated",
    );

    // The second tool call should still be pending
    expect(pendingToolCalls).toHaveLength(1);
    expect(pendingToolCalls[0].toolCallId).toBe("tool-call-2");

    // The first tool call should now be canceled
    const canceledToolCalls = findAllCurToolCallsByStatus(
      state.session.history,
      "canceled",
    );
    expect(canceledToolCalls).toHaveLength(1);
    expect(canceledToolCalls[0].toolCallId).toBe("tool-call-1");
  });

  test("should handle streaming deltas for multiple tool calls", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Simulate streaming behavior with deltas
    const STREAMING_RESPONSE: ChatMessage[] = [
      {
        role: "assistant",
        content: "I'll call both tools in parallel.",
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool-call-1",
            type: "function",
            function: {
              name: "read_file",
              arguments: "",
            },
          },
        ],
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool-call-1",
            type: "function",
            function: {
              name: "read_file",
              arguments: '{"filepath": "test.js"}',
            },
          },
        ],
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tool-call-2",
            type: "function",
            function: {
              name: "write_file",
              arguments: '{"filepath": "output.js", "content": "test"}',
            },
          },
        ],
      },
    ];

    await sendInputWithMockedResponse(
      ideMessenger,
      "Use both tools with streaming",
      STREAMING_RESPONSE,
    );

    // Wait for streaming to complete and tool calls to be set to generated
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    const state = store.getState();
    const history = state.session.history;

    // Should have only one assistant message after streaming
    const assistantMessages = history.filter(
      (item) => item.message.role === "assistant",
    );
    expect(assistantMessages).toHaveLength(1);

    const assistantMessage = assistantMessages[0];

    // Should preserve original content
    expect(assistantMessage.message.content).toContain(
      "I'll call both tools in parallel",
    );

    // Should have both tool calls after streaming completes
    expect(assistantMessage.toolCallStates).toHaveLength(2);

    // Verify tool calls are properly constructed
    const toolCallIds = assistantMessage.toolCallStates!.map(
      (tc) => tc.toolCallId,
    );
    expect(toolCallIds).toContain("tool-call-1");
    expect(toolCallIds).toContain("tool-call-2");
  });
});
