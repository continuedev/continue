import { createAsyncThunk } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import posthog from "posthog-js";
import {
  cancelToolCall as cancelToolCallAction,
  streamUpdate,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCallById } from "../util";
import { streamNormalInput } from "./streamNormalInput";

const DEFAULT_USER_REJECTION_MESSAGE = `The user skipped the tool call.
If the tool call is optional or non-critical to the main goal, skip it and continue with the next step.
If the tool call is essential, try an alternative approach.
If no alternatives exist, offer to pause here.`;

export const cancelToolCallThunk = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>("chat/cancelToolCall", async ({ toolCallId }, { dispatch, getState }) => {
  const state = getState();
  const continueAfterToolRejection =
    state.config.config.ui?.continueAfterToolRejection ?? false;
  const toolCallState = findToolCallById(state.session.history, toolCallId);

  if (toolCallState) {
    // Track tool call rejection
    posthog.capture("gui_tool_call_decision", {
      decision: "reject",
      toolName: toolCallState.toolCall.function.name,
      toolCallId: toolCallId,
    });
  }

  if (continueAfterToolRejection) {
    // Update tool call output with rejection message
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: [
          {
            icon: "problems",
            name: "Tool Call Rejected",
            description: "User skipped the tool call",
            content: DEFAULT_USER_REJECTION_MESSAGE,
            hidden: false,
          },
        ],
      }),
    );
  }

  // Dispatch the actual cancel action
  dispatch(cancelToolCallAction({ toolCallId }));

  if (continueAfterToolRejection) {
    const rejectionMessage: ChatMessage = {
      role: "tool",
      content: "User skipped the tool call",
      toolCallId,
    };
    dispatch(streamUpdate([rejectionMessage]));

    // Continue the conversation by triggering a new LLM response
    void dispatch(streamNormalInput({}));
  }
});
