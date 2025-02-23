import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  clearLastEmptyResponse,
  setInactive,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

export const cancelStream = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/cancelStream",
  async (messages, { dispatch, extra, getState }) => {
    dispatch(setInactive());
    dispatch(abortStream());

    // If the assistant message is empty, then remove it and the user message, placing the user input in the main text box
    // TODO: Waiting until next release
    dispatch(clearLastEmptyResponse());
  },
);
