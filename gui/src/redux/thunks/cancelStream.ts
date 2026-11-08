import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  clearDanglingMessages,
  setInactive,
  setQueuePaused,
  setSteeredMessages,
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
      dispatch(setSteeredMessages([]));
    }

    // Clear any dangling incomplete tool calls, thinking messages, etc.
    dispatch(clearDanglingMessages());
  },
);

/**
 * End the model's reply where it is, keeping what it already wrote, as Stop
 * does, but leave the queue alone: "Steer now" sends the next message itself.
 * The running stream thunk sees its aborter fired and returns.
 */
export const interruptStream = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/interruptStream",
  async (_, { dispatch }) => {
    dispatch(setInactive());
    dispatch(abortStream());
    dispatch(clearDanglingMessages());
  },
);
