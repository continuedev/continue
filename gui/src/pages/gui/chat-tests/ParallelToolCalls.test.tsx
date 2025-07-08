import { act } from "@testing-library/react";
import { ChatMessage } from "core";
import { addAndSelectMockLlm } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  getElementByText,
  sendInputWithMockedResponse,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

describe("Parallel Tool Calls", () => {
  const PARALLEL_TOOL_CALL_RESPONSE: ChatMessage[] = [
    {
      role: "assistant",
      content: "I'll call the get_weather function in parallel for both San Francisco and Monterey, California.",
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
      await new Promise(resolve => setTimeout(resolve, 100));
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
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for any state updates to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify multiple tool calls are stored in Redux state
    const state = store.getState();
    const history = state.session.history;
    
    // Find the assistant message (might not be at index 1 if tool messages were created)
    const assistantMessage = history.find(item => 
      item.message.role === "assistant" && (item.message as any).toolCalls?.length
    );
    
    expect(assistantMessage).toBeDefined();
    expect((assistantMessage!.message as any).toolCalls).toHaveLength(2);
    expect(assistantMessage!.toolCallStates).toHaveLength(2);
    
    // Verify each tool call has correct ID and function name
    expect(assistantMessage!.toolCallStates![0].toolCallId).toBe("toolu_0112JmA95qW6WhAsvkKb7Avp");
    expect(assistantMessage!.toolCallStates![0].toolCall.function.name).toBe("get_weather");
    expect(assistantMessage!.toolCallStates![1].toolCallId).toBe("toolu_01UFK4ZUmbpkeFJGg7mdoT6T");
    expect(assistantMessage!.toolCallStates![1].toolCall.function.name).toBe("get_weather");
    
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
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Test our utility functions work with the new state
    const state = store.getState();
    
    // Import the utility functions to test them
    const { findCurrentToolCalls, hasCurrentToolCalls, findToolCall } = await import("../../../redux/util");
    
    // Test findCurrentToolCalls finds both tool calls
    const currentToolCalls = findCurrentToolCalls(state.session.history);
    expect(currentToolCalls).toHaveLength(2);
    expect(currentToolCalls[0].toolCallId).toBe("toolu_0112JmA95qW6WhAsvkKb7Avp");
    expect(currentToolCalls[1].toolCallId).toBe("toolu_01UFK4ZUmbpkeFJGg7mdoT6T");
    
    // Test hasCurrentToolCalls returns true
    expect(hasCurrentToolCalls(state.session.history)).toBe(true);
    
    // Test findToolCall can find specific tool calls by ID
    const toolCall1 = findToolCall(state.session.history, "toolu_0112JmA95qW6WhAsvkKb7Avp");
    const toolCall2 = findToolCall(state.session.history, "toolu_01UFK4ZUmbpkeFJGg7mdoT6T");
    expect(toolCall1?.toolCall.function.name).toBe("get_weather");
    expect(toolCall2?.toolCall.function.name).toBe("get_weather");
    expect(toolCall1?.toolCall.function.arguments).toContain("San Francisco");
    expect(toolCall2?.toolCall.function.arguments).toContain("Monterey");
  });
});