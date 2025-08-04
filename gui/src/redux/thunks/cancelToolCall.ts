import { createAsyncThunk } from "@reduxjs/toolkit";
import posthog from "posthog-js";
import { cancelToolCall as cancelToolCallAction } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCallById } from "../util";

export const cancelToolCallThunk = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>("chat/cancelToolCall", async ({ toolCallId }, { dispatch, getState }) => {
  const state = getState();
  const toolCallState = findToolCallById(state.session.history, toolCallId);

  if (toolCallState) {
    // Track tool call rejection
    posthog.capture("gui_tool_call_decision", {
      decision: "reject",
      toolName: toolCallState.toolCall.function.name,
      toolCallId: toolCallId,
    });
  }

  // Dispatch the actual cancel action
  dispatch(cancelToolCallAction({ toolCallId }));
});
