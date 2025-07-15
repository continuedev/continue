import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { renderContextItems } from "core/util/messageContent";
import {
  resetNextCodeBlockToApplyIndex,
  streamUpdate,
} from "../slices/sessionSlice";
import { AppThunkDispatch, RootState, ThunkApiType } from "../store";
import { findToolCallById } from "../util";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";

/**
 * Finds the assistant message that contains the specified tool call.
 */
function findAssistantMessageWithToolCall(
  history: RootState["session"]["history"],
  toolCallId: string,
) {
  return history.find(
    (item) =>
      item.message.role === "assistant" &&
      item.toolCallStates?.some((tc) => tc.toolCallId === toolCallId),
  );
}

/**
 * Checks if all parallel tool calls in an assistant message are complete.
 */
function areAllToolCallsComplete(
  toolCallStates: NonNullable<
    ReturnType<typeof findAssistantMessageWithToolCall>
  >["toolCallStates"],
): boolean {
  if (!toolCallStates) return false;

  const completedToolCalls = toolCallStates.filter(
    (tc) => tc.status === "done",
  );

  return completedToolCalls.length === toolCallStates.length;
}

/**
 * Determines if we should continue streaming based on tool call completion status.
 */
function shouldContinueStreaming(
  assistantMessage: ReturnType<typeof findAssistantMessageWithToolCall>,
): boolean {
  if (!assistantMessage?.toolCallStates) {
    return false; // No assistant message found - don't stream
  }

  const totalToolCalls = assistantMessage.toolCallStates.length;

  // Single tool call - always continue streaming
  if (totalToolCalls === 1) {
    return true;
  }

  // Multiple tool calls - only continue if all are complete
  return areAllToolCallsComplete(assistantMessage.toolCallStates);
}

/**
 * Creates and dispatches a tool message for the completed tool call.
 */
function createAndDispatchToolMessage(
  dispatch: AppThunkDispatch,
  toolCallId: string,
  toolOutput: any[],
): void {
  const newMessage: ChatMessage = {
    role: "tool",
    content: renderContextItems(toolOutput),
    toolCallId,
  };
  dispatch(streamUpdate([newMessage]));
}

export const streamResponseAfterToolCall = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>(
  "chat/streamAfterToolCall",
  async ({ toolCallId }, { dispatch, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();

        const toolCallState = findToolCallById(
          state.session.history,
          toolCallId,
        );

        if (!toolCallState) {
          return; // in cases where edit tool is cancelled mid apply, this will be triggered
        }

        const toolOutput = toolCallState.output ?? [];

        dispatch(resetNextCodeBlockToApplyIndex());
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Create and dispatch the tool message
        createAndDispatchToolMessage(dispatch, toolCallId, toolOutput);

        // Check if we should continue streaming based on tool call completion
        const history = getState().session.history;
        const assistantMessage = findAssistantMessageWithToolCall(
          history,
          toolCallId,
        );

        if (shouldContinueStreaming(assistantMessage)) {
          unwrapResult(await dispatch(streamNormalInput({})));
        }
      }),
    );
  },
);
