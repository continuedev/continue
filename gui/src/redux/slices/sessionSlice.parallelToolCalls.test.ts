import { fromChatCompletionChunk } from "core/llm/openaiTypeConverters";
import type { ChatCompletionChunk } from "openai/resources/index";
import { describe, expect, it } from "vitest";
import { ChatHistoryItemWithMessageId, sessionSlice } from "./sessionSlice";

// Regression test: OpenAI's streamed ToolCall type requires `index` while
// `id` is optional, so two interleaved parallel tool calls whose later
// fragments omit `id` must still be correlated by `index`, not by array
// position. Drives the real, unmocked chain: raw ChatCompletionChunk ->
// fromChatCompletionChunk() -> session/streamUpdate reducer ->
// applyToolCallDelta() -> addToolCallDeltaToState() -> final ToolCallState[].

function makeChunk(
  toolCalls: ChatCompletionChunk.Choice.Delta.ToolCall[],
): ChatCompletionChunk {
  return {
    id: "chatcmpl-regression-test",
    created: 0,
    model: "gpt-4-test",
    object: "chat.completion.chunk",
    choices: [
      {
        index: 0,
        finish_reason: null,
        delta: { tool_calls: toolCalls } as ChatCompletionChunk.Choice["delta"],
      } as ChatCompletionChunk.Choice,
    ],
  };
}

function createInitialState() {
  return {
    lastSessionId: undefined,
    allSessionMetadata: [],
    history: [
      {
        message: {
          role: "user" as const,
          content: "call tool_a and tool_b in parallel",
          id: "initial-user-message",
        },
        contextItems: [],
      },
    ] as ChatHistoryItemWithMessageId[],
    isStreaming: false,
    title: "Test Session",
    id: "test-session-id",
    streamAborter: new AbortController(),
    symbols: {},
    mode: "chat" as const,
    isInEdit: false,
    codeBlockApplyStates: { states: [], curIndex: 0 },
    newestToolbarPreviewForInput: {},
    isSessionMetadataLoading: false,
    compactionLoading: {},
  };
}

describe("REGRESSION: parallel OpenAI tool-call streaming identity", () => {
  it("correlates id-less continuation fragments by provider tool_call.index", () => {
    let state = createInitialState();

    const dispatchChunk = (raw: ChatCompletionChunk) => {
      const message = fromChatCompletionChunk(raw);
      expect(message).toBeDefined();
      state = sessionSlice.reducer(state, {
        type: "session/streamUpdate",
        payload: [message],
      }) as typeof state;
    };

    // A discovery: index 0 + id call_A
    dispatchChunk(
      makeChunk([
        {
          index: 0,
          id: "call_A",
          type: "function",
          function: { name: "tool_a", arguments: "" },
        },
      ]),
    );
    // B discovery: index 1 + id call_B
    dispatchChunk(
      makeChunk([
        {
          index: 1,
          id: "call_B",
          type: "function",
          function: { name: "tool_b", arguments: "" },
        },
      ]),
    );
    // A continuation: index 0, id absent
    dispatchChunk(
      makeChunk([{ index: 0, function: { arguments: '{"target":"A_ONLY"}' } }]),
    );
    // B continuation: index 1, id absent
    dispatchChunk(
      makeChunk([{ index: 1, function: { arguments: '{"target":"B_ONLY"}' } }]),
    );

    const finalStates =
      state.history[state.history.length - 1].toolCallStates ?? [];
    expect(finalStates).toHaveLength(2);

    const callA = finalStates.find((s) => s.toolCall.id === "call_A");
    const callB = finalStates.find((s) => s.toolCall.id === "call_B");

    expect(callA?.toolCall.function.arguments).toBe('{"target":"A_ONLY"}');
    expect(callB?.toolCall.function.arguments).toBe('{"target":"B_ONLY"}');
  });
});
