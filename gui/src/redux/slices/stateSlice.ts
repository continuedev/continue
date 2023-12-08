import { createSlice } from "@reduxjs/toolkit";
import { RootStore } from "../store";
import { ContextItemId } from "../../../../core/llm/types";

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
        return {
          ...state,
          history: state.history.map((historyItem, i) => {
            if (i === action.payload.index) {
              return {
                ...historyItem,
                contextItems: [
                  ...historyItem.contextItems,
                  action.payload.contextItem,
                ],
              };
            }
            return historyItem;
          }),
        };
      }
    },
    appendMessage: (state, action) => {
      return {
        ...state,
        history: [...state.history, action.payload],
      };
    },
    addContextItem: (state, action) => {
      return {
        ...state,
        contextItems: [...state.contextItems, action.payload],
      };
    },
    resubmitAtIndex: (state, action) => {
      if (action.payload.index < state.history.length) {
        state.history[action.payload.index].message.content =
          action.payload.content;

        // Cut off history after the resubmitted message
        state.history = state.history.slice(0, action.payload.index + 1);
        state.contextItems = [];
      }
    },
    submitMessage: (state, action) => {
      state.history.push({
        message: action.payload,
        contextItems: state.contextItems,
      });
      state.history.push({
        message: {
          role: "assistant",
          content: "",
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
    newSession: (state) => {
      state.history = [];
      state.contextItems = [];
      state.active = false;
    },
    deleteContextWithIds: (
      state,
      {
        payload,
      }: { payload: { ids: ContextItemId[]; index: number | undefined } }
    ) => {
      const ids = payload.ids.map((id) => `${id.providerTitle}-${id.itemId}`);
      if (typeof payload.index === "undefined") {
        return {
          ...state,
          contextItems: state.contextItems.filter(
            (item) =>
              !ids.includes(`${item.id.providerTitle}-${item.id.itemId}`)
          ),
        };
      } else {
        return {
          ...state,
          history: state.history.map((historyItem, i) => {
            if (i === payload.index) {
              return {
                ...historyItem,

                contextItems: historyItem.contextItems.filter(
                  (item) =>
                    !ids.includes(`${item.id.providerTitle}-${item.id.itemId}`)
                ),
              };
            }
            return historyItem;
          }),
        };
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
  newSession,
  deleteContextWithIds,
  resubmitAtIndex,
} = stateSlice.actions;
export default stateSlice.reducer;
