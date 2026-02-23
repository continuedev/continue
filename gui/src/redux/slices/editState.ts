import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import { ApplyState, MessageModes, SetCodeToEditPayload } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";

export interface EditState {
  // Array because of previous multi-file edit functionality
  // Keeping array to not break persisted redux for now
  codeToEdit: SetCodeToEditPayload[];
  applyState: ApplyState;
  returnToMode: MessageModes;
  lastNonEditSessionWasEmpty: boolean;
  previousModeEditorContent: JSONContent | undefined;
}

export const INITIAL_EDIT_APPLY_STATE: ApplyState = {
  streamId: EDIT_MODE_STREAM_ID,
  status: "not-started",
};

export const INITIAL_EDIT_STATE: EditState = {
  applyState: INITIAL_EDIT_APPLY_STATE,
  codeToEdit: [],
  returnToMode: "chat",
  lastNonEditSessionWasEmpty: false,
  previousModeEditorContent: undefined,
};

export const editStateSlice = createSlice({
  name: "editState",
  initialState: INITIAL_EDIT_STATE,
  reducers: {
    setReturnToModeAfterEdit: (
      state,
      { payload }: PayloadAction<MessageModes>,
    ) => {
      state.returnToMode = payload;
    },
    updateEditStateApplyState: (
      state,
      { payload }: PayloadAction<ApplyState>,
    ) => {
      state.applyState = {
        ...state.applyState,
        ...payload,
      };
    },
    setCodeToEdit: (
      state,
      {
        payload,
      }: PayloadAction<{
        codeToEdit: SetCodeToEditPayload | SetCodeToEditPayload[];
      }>,
    ) => {
      state.codeToEdit = Array.isArray(payload.codeToEdit)
        ? payload.codeToEdit
        : [payload.codeToEdit];
    },
    clearCodeToEdit: (state) => {
      state.codeToEdit = [];
    },
    setLastNonEditSessionEmpty: (
      state,
      { payload }: PayloadAction<boolean>,
    ) => {
      state.lastNonEditSessionWasEmpty = payload;
    },
    setPreviousModeEditorContent: (
      state,
      { payload }: PayloadAction<JSONContent | undefined>,
    ) => {
      state.previousModeEditorContent = payload;
    },
  },
  selectors: {},
});

export const {
  setReturnToModeAfterEdit,
  clearCodeToEdit,
  setCodeToEdit,
  updateEditStateApplyState,
  setLastNonEditSessionEmpty,
  setPreviousModeEditorContent,
} = editStateSlice.actions;
export default editStateSlice.reducer;
