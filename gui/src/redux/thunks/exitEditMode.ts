import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  clearCodeToEdit,
  selectIsInEditMode,
  selectIsSingleRangeEditOrInsertion,
  setMode,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { setEditDone } from "../slices/editModeState";

export const exitEditMode = createAsyncThunk<void, undefined, ThunkApiType>(
  "edit/complete",
  async (_, { dispatch, extra, getState }) => {
    const state = getState();
    const isInEditMode = selectIsInEditMode(state);
    const isSingleRangeEditOrInsertion =
      selectIsSingleRangeEditOrInsertion(state);

    if (!isInEditMode) {
      return;
    }

    dispatch(setMode("chat"));
    dispatch(clearCodeToEdit());
    dispatch(setEditDone());

    extra.ideMessenger.post("edit/exit", {
      shouldFocusEditor: isSingleRangeEditOrInsertion,
    });
  },
);
