import { createSlice } from "@reduxjs/toolkit";
import { RootStore } from "../store";

const initialState: RootStore["state"] = {
  history: [],
  contextItems: [],
  active: false,
};

export const stateSlice = createSlice({
  name: "state",
  initialState,
  reducers: {
    addContextItemAtIndex: (state, action) => {
      if (action.payload.index < state.history.length) {
        state.history[action.payload.index].contextItems.push(
          action.payload.contextItem
        );
      }
    },
    appendMessage: (state, action) => {
      state.history.push(action.payload);
    },
    addContextItem: (state, action) => {
      state.contextItems.push(action.payload);
    },
    submitMessage: (state, action) => {
      state.history.push({
        message: {
          role: "user",
          content: action.payload,
          summary: action.payload,
        },
        contextItems: state.contextItems,
      });
      state.history.push({
        message: {
          role: "assistant",
          content: "",
          summary: "",
        },
        contextItems: [],
      });
      state.contextItems = [];
      state.active = true;
    },
    setInactive: (state) => {
      state.active = false;
    },
    streamUpdate: (state, action) => {
      if (state.history.length > 0) {
        state.history[state.history.length - 1].message.content +=
          action.payload;
      }
    },
  },
});

export const {
  addContextItemAtIndex,
  appendMessage,
  addContextItem,
  submitMessage,
  setInactive,
  streamUpdate,
} = stateSlice.actions;
export default stateSlice.reducer;
