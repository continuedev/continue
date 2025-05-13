import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  UpdateApplyStatePayload,
  SetCodeToEditPayload,
  MessageModes,
} from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";

export interface EditModeState {
  // Array because of previous multi-file edit functionality
  // Keeping array to not break persisted redux for now
  codeToEdit: SetCodeToEditPayload[];
  applyState: UpdateApplyStatePayload;
  returnToMode: MessageModes;
  lastNonEditSessionWasEmpty: boolean;
}

export const INITIAL_EDIT_APPLY_STATE: UpdateApplyStatePayload = {
  streamId: EDIT_MODE_STREAM_ID,
  status: "not-started",
};

const initialState: EditModeState = {
  applyState: INITIAL_EDIT_APPLY_STATE,
  codeToEdit: [],
  returnToMode: "chat",
  lastNonEditSessionWasEmpty: false,
};

export const editModeStateSlice = createSlice({
  name: "editModeState",
  initialState,
  reducers: {
    setReturnToModeAfterEdit: (
      state,
      { payload }: PayloadAction<MessageModes>,
    ) => {
      state.returnToMode = payload;
    },
    updateEditStateApplyState: (
      state,
      { payload }: PayloadAction<UpdateApplyStatePayload>,
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
  },
  selectors: {},
});

export const {
  setReturnToModeAfterEdit,
  clearCodeToEdit,
  setCodeToEdit,
  updateEditStateApplyState,
  setLastNonEditSessionEmpty,
} = editModeStateSlice.actions;
export default editModeStateSlice.reducer;
