import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { renderContextItems } from "core/util/messageContent";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import {
  ChatHistoryItemWithMessageId,
  resetNextCodeBlockToApplyIndex,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";

/**
 * Determines if we should continue streaming based on tool call completion status.
 */
function areAllToolsDoneStreaming(
  assistantMessage: ChatHistoryItemWithMessageId,
  continueAfterToolRejection: boolean | undefined,
): boolean {
  // This might occur because of race conditions, if so, the tools are completed
  if (!assistantMessage.toolCallStates) {
    return true;
  }

  // Only continue if all tool calls are complete
  const completedToolCalls = assistantMessage.toolCallStates.filter(
    (tc) =>
      tc.status === "done" ||
      tc.status === "errored" ||
      (continueAfterToolRejection && tc.status === "canceled"),
  );

  return completedToolCalls.length === assistantMessage.toolCallStates.length;
}

export const streamResponseAfterToolCall = createAsyncThunk<
  void,
  { toolCallId: string; depth?: number },
  ThunkApiType
>(
  "chat/streamAfterToolCall",
  async ({ toolCallId, depth = 0 }, { dispatch, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();
        const currentToolCalls = selectCurrentToolCalls(state);
        const toolCallState = currentToolCalls.find(
          (tc) => tc.toolCallId === toolCallId,
        );

        if (!toolCallState) {
          return; // in cases where edit tool is cancelled mid apply, this will be triggered
        }

        const toolOutput = toolCallState.output ?? [];

        dispatch(resetNextCodeBlockToApplyIndex());

        // Create and dispatch the tool message
        const newMessage: ChatMessage = {
          role: "tool",
          content: renderContextItems(toolOutput),
          toolCallId,
        };
        dispatch(streamUpdate([newMessage]));

        // Check if we should continue streaming based on tool call completion
        const history = getState().session.history;
        const assistantMessage = history.findLast(
          (item) =>
            item.message.role === "assistant" &&
            item.toolCallStates?.some((tc) => tc.toolCallId === toolCallId),
        );

        if (
          assistantMessage &&
          areAllToolsDoneStreaming(
            assistantMessage,
            state.config.config.ui?.continueAfterToolRejection,
          )
        ) {
          unwrapResult(await dispatch(streamNormalInput({ depth: depth + 1 })));
        }
      }),
    );
  },
);
