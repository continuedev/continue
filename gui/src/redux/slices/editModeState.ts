import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { FileWithContents, MessageContent } from "core";
import { RangeInFileWithContents } from "core/commands/util";
import { EditStatus } from "core/protocol/ideWebview";

export type CodeToEdit = RangeInFileWithContents | FileWithContents;

interface EditModeState {
  editStatus: EditStatus;
  previousInputs: MessageContent[];
  fileAfterEdit?: string;
  codeToEdit: CodeToEdit[];
  isInEditMode: boolean;
}

const initialState: EditModeState = {
  editStatus: "not-started",
  previousInputs: [],
  codeToEdit: [],
  isInEditMode: false,
};

export const editModeStateSlice = createSlice({
  name: "editModeState",
  initialState,
  reducers: {
    addCodeToEdit: (state, { payload }: PayloadAction<CodeToEdit>) => {
      state.codeToEdit.push(payload);
      state.editStatus = "not-started";
      state.previousInputs = [];
      state.fileAfterEdit = undefined;
    },
    focusEdit: (state) => {
      state.isInEditMode = true;
      state.editStatus = "not-started";
      state.previousInputs = [];
      state.fileAfterEdit = undefined;
    },
    submitEdit: (state, { payload }: PayloadAction<MessageContent>) => {
      state.previousInputs.push(payload);
      state.editStatus = "streaming";
    },
    removeCodeToEdit: (state, { payload }: PayloadAction<CodeToEdit>) => {
      state.codeToEdit = state.codeToEdit.filter(
        (entry) =>
          !(
            entry.filepath === payload.filepath &&
            entry.contents === payload.contents
          ),
      );
    },
    clearCodeToEdit: (state) => {
      state.codeToEdit = [];
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
  },
});

export const {
  addCodeToEdit,
  setEditStatus,
  addPreviousInput,
  setEditDone,
  submitEdit,
  removeCodeToEdit,
  focusEdit,
  clearCodeToEdit,
} = editModeStateSlice.actions;
export default editModeStateSlice.reducer;
