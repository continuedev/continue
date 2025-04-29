import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CodeToEdit, EditStatus, MessageContent } from "core";

export interface EditModeState {
  codeToEdit: CodeToEdit[];
  editStatus: EditStatus;
  previousInputs: MessageContent[];
  fileAfterEdit?: string;
  enteredEditModeFromEditor: boolean;
}

const initialState: EditModeState = {
  editStatus: "not-started",
  previousInputs: [],
  codeToEdit: [],
  enteredEditModeFromEditor: false,
};

export const editModeStateSlice = createSlice({
  name: "editModeState",
  initialState,
  reducers: {
    focusEdit: (state) => {
      state.editStatus = "not-started";
      state.previousInputs = [];
      state.fileAfterEdit = undefined;
    },
    submitEdit: (state, { payload }: PayloadAction<MessageContent>) => {
      state.previousInputs.push(payload);
      state.editStatus = "streaming";
    },
    setEditStatus: (
      state,
      {
        payload,
      }: PayloadAction<{ status: EditStatus; fileAfterEdit?: string }>,
    ) => {
      // Only allow valid transitions
      const currentStatus = state.editStatus;
      if (currentStatus === "not-started" && payload.status === "streaming") {
        state.editStatus = payload.status;
      } else if (
        currentStatus === "streaming" &&
        payload.status === "accepting"
      ) {
        state.editStatus = payload.status;
        state.fileAfterEdit = payload.fileAfterEdit;
      } else if (currentStatus === "accepting" && payload.status === "done") {
        state.editStatus = payload.status;
      } else if (
        currentStatus === "accepting:full-diff" &&
        payload.status === "done"
      ) {
        state.editStatus = payload.status;
      } else if (
        currentStatus === "accepting" &&
        payload.status === "accepting:full-diff"
      ) {
        state.editStatus = payload.status;
      } else if (
        currentStatus === "accepting:full-diff" &&
        payload.status === "accepting"
      ) {
        state.editStatus = payload.status;
      } else if (currentStatus === "done" && payload.status === "not-started") {
        state.editStatus = payload.status;
      }
    },
    addPreviousInput: (state, { payload }: PayloadAction<MessageContent>) => {
      state.previousInputs.push(payload);
    },
    setEditDone: (state) => {
      state.editStatus = "done";
      state.previousInputs = [];
    },
    addCodeToEdit: (
      state,
      { payload }: PayloadAction<CodeToEdit | CodeToEdit[]>,
    ) => {
      const entries = Array.isArray(payload) ? payload : [payload];

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
    removeCodeToEdit: (state, { payload }: PayloadAction<CodeToEdit>) => {
      state.codeToEdit = state.codeToEdit.filter(
        (entry) => !isCodeToEditEqual(entry, payload),
      );
    },
    clearCodeToEdit: (state) => {
      state.codeToEdit = [];
    },
  },
  selectors: {
    selectHasCodeToEdit: (state) => {
      return state.codeToEdit.length > 0;
    },
  },
});

export const {
  setEditStatus,
  addPreviousInput,
  setEditDone,
  submitEdit,
  focusEdit,
  clearCodeToEdit,
  addCodeToEdit,
  removeCodeToEdit,
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

export const { selectHasCodeToEdit } = editModeStateSlice.selectors;

// selectIsSingleRangeEditOrInsertion: (state) => {
//   if (state.mode !== "edit") {
//     return false;
//   }

//   const isInsertion = state.codeToEdit.length === 0;
//   const selectIsSingleRangeEdit =
//     state.codeToEdit.length === 1 && "range" in state.codeToEdit[0];

//   return selectIsSingleRangeEdit || isInsertion;
// },
