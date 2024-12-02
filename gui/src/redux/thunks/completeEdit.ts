import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  clearCodeToEdit,
  selectIsInEditMode,
  setMode,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { setEditDone } from "../slices/editModeState";

export const completeEdit = createAsyncThunk<void, undefined, ThunkApiType>(
  "edit/complete",
  async (_, { dispatch, extra, getState }) => {
    const state = getState();
    const isInEditMode = selectIsInEditMode(state);

    if (!isInEditMode) {
      return;
    }

    dispatch(setMode("chat"));
    dispatch(clearCodeToEdit());
    setEditDone();

    extra.ideMessenger.post("edit/escape", undefined);
  },
);
