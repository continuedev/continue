import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MessageContent } from "core";
import { RangeInFileWithContents } from "core/commands/util";
import { EditModeArgs } from "core/protocol/ideWebview";
type EditStatus = "not-started" | "streaming" | "accepting" | "done";
interface EditModeState {
  highlightedCode?: RangeInFileWithContents;
  editStatus: EditStatus;
  previousInputs: MessageContent[];
}

const initialState: EditModeState = {
  editStatus: "not-started",
  previousInputs: [],
};

export const editModeStateSlice = createSlice({
  name: "editModeState",
  initialState,
  reducers: {
    startEditMode: (state, { payload }: PayloadAction<EditModeArgs>) => {
      state.highlightedCode = payload.highlightedCode;
      state.editStatus = "not-started";
      state.previousInputs = [];
    },
    setEditStatus: (state, { payload }: PayloadAction<EditStatus>) => {
      // Only allow valid transitions
      const currentStatus = state.editStatus;
      if (currentStatus === "not-started" && payload === "streaming") {
        state.editStatus = payload;
      } else if (currentStatus === "streaming" && payload === "accepting") {
        state.editStatus = payload;
      } else if (currentStatus === "accepting" && payload === "done") {
        state.editStatus = payload;
      } else if (currentStatus === "done" && payload === "not-started") {
        state.editStatus = payload;
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

export const { startEditMode, setEditStatus, addPreviousInput, setEditDone } =
  editModeStateSlice.actions;
export default editModeStateSlice.reducer;
