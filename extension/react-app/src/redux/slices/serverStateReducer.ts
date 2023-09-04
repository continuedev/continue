import { createSlice } from "@reduxjs/toolkit";
import { FullState } from "../../../../schema/FullState";

const initialState: FullState = {
  history: {
    timeline: [],
    current_index: 3,
  } as any,
  user_input_queue: [],
  active: false,
  slash_commands: [],
  adding_highlighted_code: false,
  selected_context_items: [],
  config: {
    system_message: "",
    temperature: 0.5,
  },
};

export const serverStateSlice = createSlice({
  name: "serverState",
  initialState,
  reducers: {
    setServerState: (state, action) => {
      state.selected_context_items = [];
      state.user_input_queue = [];
      state.slash_commands = [];
      Object.assign(state, action.payload);
    },
    temporarilyPushToUserInputQueue: (state, action) => {
      state.user_input_queue = [...state.user_input_queue, action.payload];
    },
  },
});

export const { setServerState, temporarilyPushToUserInputQueue } =
  serverStateSlice.actions;
export default serverStateSlice.reducer;
