import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ApplyState, ApplyStateStatus, CodeToEdit, MessageModes } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
export interface EditModeState {
  // Array because of previous multi-file edit functionality
  // Keeping array to not break persisted redux for now
  codeToEdit: CodeToEdit[];
  applyState: ApplyState;
  returnCursorToEditorAfterEdit: boolean;
  returnToMode: MessageModes;
}

const initialState: EditModeState = {
  applyState: {
    streamId: EDIT_MODE_STREAM_ID,
  },
  codeToEdit: [],
  returnCursorToEditorAfterEdit: false,
  returnToMode: "chat",
};

export const editModeStateSlice = createSlice({
  name: "editModeState",
  initialState,
  reducers: {
    setReturnCursorToEditorAfterEdit: (
      state,
      { payload }: PayloadAction<boolean>,
    ) => {
      state.returnCursorToEditorAfterEdit = payload;
    },
    setReturnToModeAfterEdit: (
      state,
      { payload }: PayloadAction<MessageModes>,
    ) => {
      state.returnToMode = payload;
    },
    setEditStateApplyStatus: (
      state,
      { payload }: PayloadAction<ApplyStateStatus>,
    ) => {
      state.applyState.status = payload;
    },
    setEditStateApplyState: (state, { payload }: PayloadAction<ApplyState>) => {
      state.applyState = payload;
    },
    setCodeToEdit: (
      state,
      {
        payload,
      }: PayloadAction<{
        fromEditor: boolean;
        codeToEdit: CodeToEdit | CodeToEdit[];
      }>,
    ) => {
      state.returnCursorToEditorAfterEdit = payload.fromEditor;
      state.codeToEdit = Array.isArray(payload.codeToEdit)
        ? payload.codeToEdit
        : [payload.codeToEdit];
    },
    clearCodeToEdit: (state) => {
      state.codeToEdit = [];
    },
  },
  selectors: {},
});

export const {
  setReturnToModeAfterEdit,
  setReturnCursorToEditorAfterEdit,
  clearCodeToEdit,
  setCodeToEdit,
  setEditStateApplyStatus,
  setEditStateApplyState,
} = editModeStateSlice.actions;
export default editModeStateSlice.reducer;
