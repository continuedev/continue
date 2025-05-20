import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  abortStream,
  setInactive,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamAssistantMessage } from "./streamAssistantMessage";
import { clearLastEmptyResponse } from "./clearLastEmptyResponse";

export const cancelButton = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/cancelButton",
  async (messages, { dispatch, extra, getState }) => {
    await dispatch(setInactive());
    await dispatch(abortStream());
    await dispatch(clearLastEmptyResponse());
    await dispatch(streamAssistantMessage({ content: "The request has been cancelled." }));
  }
);