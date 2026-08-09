import { act } from "@testing-library/react";
import { ChatMessage } from "core";
import { renderWithProviders } from "../../../util/test/render";
import { sendInputWithMockedResponse } from "../../../util/test/utils";
import { Chat } from "../Chat";
import { updateConfig } from "../../../redux/slices/configSlice";

describe("Parallel Tool Calls - Basic", () => {
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
      "Use both tools",
      PARALLEL_TOOL_CALL_RESPONSE,
    );

    // Wait for streaming to complete
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
});
