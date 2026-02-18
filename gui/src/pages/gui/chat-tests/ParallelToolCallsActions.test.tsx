import { act } from "@testing-library/react";
import { ChatMessage } from "core";
import { renderWithProviders } from "../../../util/test/render";
import { sendInputWithMockedResponse } from "../../../util/test/utils";
import { Chat } from "../Chat";
import { findAllCurToolCallsByStatus } from "../../../redux/util";
import { cancelToolCall } from "../../../redux/slices/sessionSlice";
import { updateConfig } from "../../../redux/slices/configSlice";

describe("Parallel Tool Calls - Actions", () => {
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

  test("should handle individual tool call actions without breaking other calls", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Mock required responses
    ideMessenger.responses["tools/evaluatePolicy"] = {
      policy: "allowedWithPermission",
    };
    ideMessenger.responses["context/getSymbolsForFiles"] = {};

    // Setup mock model with direct Redux dispatch
    const currentConfig = store.getState().config.config;
    store.dispatch(
      updateConfig({
        ...currentConfig,
        selectedModelByRole: {
          ...currentConfig.selectedModelByRole,
          chat: {
            model: "mock",
            provider: "mock",
            title: "Mock LLM",
            underlyingProviderName: "mock",
          },
        },
        modelsByRole: {
          ...currentConfig.modelsByRole,
          chat: [
            ...(currentConfig.modelsByRole.chat || []),
            {
              model: "mock",
              provider: "mock",
              title: "Mock LLM",
              underlyingProviderName: "mock",
            },
          ],
        },
      }),
    );

    await sendInputWithMockedResponse(
      ideMessenger,
      "Use multiple tools",
      PARALLEL_TOOL_CALL_RESPONSE,
    );

    // Wait for streaming to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

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
});
