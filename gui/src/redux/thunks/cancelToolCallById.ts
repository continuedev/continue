import { createAsyncThunk } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { cancelToolCall } from "../slices/sessionSlice";

export const cancelToolCallById = createAsyncThunk<
  void,
  { toolCallId: string },
  { state: RootState }
>("session/cancelToolCallById", async ({ toolCallId }, { dispatch }) => {
  // Cancel the specific tool call
  dispatch(cancelToolCall({ toolCallId }));
  
  // Note: We don't need to manage streaming state here since streaming should 
  // already be complete when tool calls are pending user approval
});