import { createAsyncThunk } from "@reduxjs/toolkit";
<<<<<<< HEAD
import posthog from "posthog-js";
import { selectSelectedChatModel } from "../slices/configSlice";
=======

>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import {
  cancelToolCall as cancelToolCallAction,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
<<<<<<< HEAD
import { findToolCallById } from "../util";
=======

>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

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
<<<<<<< HEAD
  const selectedChatModel = selectSelectedChatModel(state);
  const continueAfterToolRejection =
    state.config.config.ui?.continueAfterToolRejection;
  const toolCallState = findToolCallById(state.session.history, toolCallId);

  if (toolCallState) {
    // Track tool call rejection
    posthog.capture("tool_call_decision", {
      model: selectedChatModel,
      decision: "reject",
      toolName: toolCallState.toolCall.function.name,
      toolCallId: toolCallId,
    });
  }
=======
  const continueAfterToolRejection =
    state.config.config.ui?.continueAfterToolRejection;
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))

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
            hidden: true,
          },
        ],
      }),
    );
  }

  // Dispatch the actual cancel action
  dispatch(cancelToolCallAction({ toolCallId }));

  void dispatch(streamResponseAfterToolCall({ toolCallId }));
});
