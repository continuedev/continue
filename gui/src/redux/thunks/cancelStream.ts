import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  clearDanglingMessages,
  setInactive,
  setQueuePaused,
  setSteeredMessages,
} from "../slices/sessionSlice";
import { interruptLoop, stopLoop } from "core/util/loopMode";
import { ThunkApiType } from "../store";
import { commitLoop } from "../util/loopCommit";

/**
 * What this cancel means for Loop mode. Without options it is the person's
 * Stop. keep: the request is being retried, or the run was ended on purpose,
 * so the loop carries on. error: the request failed for good.
 */
export interface CancelStreamOptions {
  loop?: "keep" | "error";
  detail?: string;
}

export const cancelStream = createAsyncThunk<
  void,
  CancelStreamOptions | undefined,
  ThunkApiType
>("chat/cancelStream", async (options, { dispatch, extra, getState }) => {
  dispatch(setInactive());
  dispatch(abortStream());
  // Whoever stopped the agent decides what to send next
  if (getState().session.queuedMessages?.length) {
    dispatch(setQueuePaused(true));
    dispatch(setSteeredMessages([]));
  }

  // Stop during Loop mode stops the loop too; the item goes back to pending
  const loop = getState().session.loop;
  if (loop?.current && options?.loop !== "keep") {
    commitLoop(
      dispatch,
      getState,
      options?.loop === "error"
        ? stopLoop(
            loop,
            "error",
            `The model request failed: ${options.detail ?? "unknown error"}`,
          )
        : interruptLoop(loop),
    );
  }

  // Clear any dangling incomplete tool calls, thinking messages, etc.
  dispatch(clearDanglingMessages());
});

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
