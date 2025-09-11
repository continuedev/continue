import { act } from "@testing-library/react";
import { ChatMessage } from "core";
import { renderWithProviders } from "../../../util/test/render";
import { sendInputWithMockedResponse } from "../../../util/test/utils";
import { Chat } from "../Chat";
import { updateConfig } from "../../../redux/slices/configSlice";

describe("Parallel Tool Calls - Streaming", () => {
  test("should handle streaming deltas for multiple tool calls", async () => {
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

    // Wait for streaming to complete
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
