import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ApplyState, ApplyStateStatus, CodeToEdit, MessageModes } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
export interface EditModeState {
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
    addCodeToEdit: (
      state,
      {
        payload,
      }: PayloadAction<{
        fromEditor: boolean;
        codeToEdit: CodeToEdit | CodeToEdit[];
      }>,
    ) => {
      state.returnCursorToEditorAfterEdit = payload.fromEditor;
      const entries = Array.isArray(payload.codeToEdit)
        ? payload.codeToEdit
        : [payload.codeToEdit];

      const newEntries = entries.filter(
        (entry) =>
          !state.codeToEdit.some((existingEntry) =>
            isCodeToEditEqual(existingEntry, entry),
          ),
      );

      if (newEntries.length > 0) {
        state.codeToEdit.push(...newEntries);
      }
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
  addCodeToEdit,
  setEditStateApplyStatus,
  setEditStateApplyState,
} = editModeStateSlice.actions;
export default editModeStateSlice.reducer;

function isCodeToEditEqual(a: CodeToEdit, b: CodeToEdit) {
  if (a.filepath !== b.filepath || a.contents !== b.contents) {
    return false;
  }

  if ("range" in a && "range" in b) {
    const rangeA = a.range;
    const rangeB = b.range;

    return (
      rangeA.start.line === rangeB.start.line &&
      rangeA.end.line === rangeB.end.line
    );
  }

  // If neither has a range, they are considered equal in this context
  return !("range" in a) && !("range" in b);
}
