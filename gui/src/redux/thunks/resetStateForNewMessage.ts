import { createAsyncThunk } from "@reduxjs/toolkit";
import { resetNextCodeBlockToApplyIndex } from "../slices/stateSlice";
import { ThunkApiType } from "../store";

export const resetStateForNewMessage = createAsyncThunk<
  void,
  undefined,
  ThunkApiType
>("chat/resetStateForNewMessage", async (_, { dispatch }) => {
  dispatch(resetNextCodeBlockToApplyIndex());
});
