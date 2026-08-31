import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  clearDanglingMessages,
  setInactive,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

export const cancelStream = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/cancelStream",
  async (messages, { dispatch, extra, getState }) => {
    // Tools already executing in Core aren't reachable from `abortStream` -
    // `tools/call` is a plain request, not a stream, so the `abort` message
    // (keyed on a streaming request's messageId) never reaches them. Without
    // this, a long-running tool - a subagent above all - keeps going after Stop
    // and then restarts the whole agent loop when it finally resolves.
    for (const item of getState().session.history) {
      for (const toolCallState of item.toolCallStates ?? []) {
        if (toolCallState.status === "calling") {
          extra.ideMessenger.post("tools/cancel", {
            toolCallId: toolCallState.toolCallId,
          });
        }
      }
    }

    dispatch(setInactive());
    dispatch(abortStream());

    // Clear any dangling incomplete tool calls, thinking messages, etc.
    dispatch(clearDanglingMessages());
  },
);
