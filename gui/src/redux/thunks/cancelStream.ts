import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  clearDanglingMessages,
  setInactive,
  setQueuePaused,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

export const cancelStream = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/cancelStream",
  async (messages, { dispatch, extra, getState }) => {
    dispatch(setInactive());
    dispatch(abortStream());
    // Whoever stopped the agent decides what to send next
    if (getState().session.queuedMessages?.length) {
      dispatch(setQueuePaused(true));
    }

    // Clear any dangling incomplete tool calls, thinking messages, etc.
    dispatch(clearDanglingMessages());
  },
);
