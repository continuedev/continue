import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  setInactive,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { clearLastEmptyResponse } from "./clearLastEmptyResponse";

export const cancelStream = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/cancelStream",
  async (messages, { dispatch, extra, getState }) => {
    dispatch(setInactive());
    dispatch(abortStream());

    // In the case tool calls were being generated,
    // Replace them with
    // If the assistant message is empty, then remove it and the user message, placing the user input in the main text box
    dispatch(clearLastEmptyResponse());
  },
);
