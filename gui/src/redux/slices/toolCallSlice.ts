import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ToolCall } from "core";
import { ToolState } from "../../pages/gui/ToolCallDiv/types";

interface CurrentToolCallState {
  currentToolCallId?: string;
  currentToolCallState?: ToolState;
  toolCall?: ToolCall;
}

const initialState: CurrentToolCallState = {};
export const toolCallStateSlice = createSlice({
  name: "editModeState",
  initialState,
  reducers: {
    registerCurrentToolCall: (state, { payload }: PayloadAction<string>) => {
      state.currentToolCallId = payload;
      state.currentToolCallState = "generating";
    },
    cancelToolCall: (state) => {
      state.currentToolCallId = undefined;
      state.currentToolCallState = undefined;
    },
    acceptToolCall: (state) => {
      state.currentToolCallId = undefined;
      state.currentToolCallState = undefined;
    },
    setGeneratedOutput: (state, { payload }: PayloadAction<ToolCall>) => {
      state.currentToolCallState = "generated";
      state.toolCall = payload;
    },
    setCalling: (state) => {
      state.currentToolCallState = "calling";
    },
  },
});

export const {
  registerCurrentToolCall,
  setGeneratedOutput,
  cancelToolCall,
  acceptToolCall,
  setCalling,
} = toolCallStateSlice.actions;
export default toolCallStateSlice.reducer;
