import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ApplyState, CodeToEdit, MessageContent, MessageModes } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
export interface EditModeState {
  codeToEdit: CodeToEdit[];
  applyState: ApplyState;
  previousInputs: MessageContent[];
  returnCursorToEditorAfterEdit: boolean;
  returnToMode: MessageModes;
}

const initialState: EditModeState = {
  applyState: {
    streamId: EDIT_MODE_STREAM_ID,
  },
  previousInputs: [],
  codeToEdit: [],
  returnCursorToEditorAfterEdit: false,
  returnToMode: "chat",
};

export const editModeStateSlice = createSlice({
  name: "editModeState",
  initialState,
  reducers: {
    focusEdit: (state) => {
      state.applyState.status = "not-started";
      state.previousInputs = [];
    },
    submitEdit: (state, { payload }: PayloadAction<MessageContent>) => {
      state.previousInputs.push(payload);
      state.applyState.status = "streaming";
    },
    setEditDone: (state) => {
      state.applyState.status = "done";
      state.previousInputs = [];
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
  setEditDone,
  submitEdit,
  focusEdit,
  clearCodeToEdit,
  addCodeToEdit,
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

// export const {  } = editModeStateSlice.selectors;

// selectIsSingleRangeEditOrInsertion: (state) => {
//   if (state.mode !== "edit") {
//     return false;
//   }

//   const isInsertion = state.codeToEdit.length === 0;
//   const selectIsSingleRangeEdit =
//     state.codeToEdit.length === 1 && "range" in state.codeToEdit[0];

//   return selectIsSingleRangeEdit || isInsertion;
// },
