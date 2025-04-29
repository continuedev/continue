import { createAsyncThunk } from "@reduxjs/toolkit";
import { clearCodeToEdit, setEditDone } from "../slices/editModeState";
import { setMainEditorContentTrigger, setMode } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";

export const exitEditMode = createAsyncThunk<void, undefined, ThunkApiType>(
  "edit/complete",
  async (_, { dispatch, extra, getState }) => {
    const state = getState();
    const codeToEdit = state.editModeState.codeToEdit;
    const enteredEditModeFromEditor =
      state.editModeState.enteredEditModeFromEditor;

    if (state.session.mode !== "edit") {
      return;
    }

    dispatch(setMode("chat"));

    for (const code of codeToEdit) {
      extra.ideMessenger.post("rejectDiff", {
        filepath: code.filepath,
      });
    }

    dispatch(clearCodeToEdit());
    dispatch(setEditDone());
    dispatch(setMainEditorContentTrigger(undefined));

    extra.ideMessenger.post("edit/exit", {
      shouldFocusEditor: enteredEditModeFromEditor,
    });
  },
);
