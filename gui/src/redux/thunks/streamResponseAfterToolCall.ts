import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { renderContextItems } from "core/util/messageContent";
import { mergeQueuedMessages } from "../../components/mainInput/util/queuedMessages";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import {
  ChatHistoryItemWithMessageId,
  removeQueuedMessage,
  requestQueuedMessagesSend,
  resetNextCodeBlockToApplyIndex,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { addUserInputToHistory } from "./addUserInputToHistory";
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
  async ({ toolCallId, depth = 0 }, { dispatch, extra, getState }) => {
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

        if (!assistantMessage) return;

        if (
          areAllToolsDoneStreaming(
            assistantMessage,
            state.config.config.ui?.continueAfterToolRejection,
          )
        ) {
          // Steering: messages sent with "Send now" while the tools ran go in
          // here, after the tool results and before the next request, so the
          // model reads them in this turn. The providers merge the tool
          // results and this text into one user turn.
          const steered = (getState().session.queuedMessages ?? []).filter(
            (m) => m.steer,
          );
          const merged = mergeQueuedMessages(steered);
          if (merged) {
            steered.forEach((m) => dispatch(removeQueuedMessage(m.id)));
            await addUserInputToHistory({
              ...merged,
              index: getState().session.history.length,
              dispatch,
              getState,
              ideMessenger: extra.ideMessenger,
            });
          }
          unwrapResult(await dispatch(streamNormalInput({ depth: depth + 1 })));
        } else if (
          !assistantMessage.toolCallStates?.some(
            (tc) =>
              tc.status === "generating" ||
              tc.status === "generated" ||
              tc.status === "calling",
          )
        ) {
          // A rejected tool ends the turn without another request: the
          // queue goes now, as at any other turn end
          dispatch(requestQueuedMessagesSend());
        }
      }),
    );
  },
);
