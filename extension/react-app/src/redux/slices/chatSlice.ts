import { createSlice } from "@reduxjs/toolkit";
import { ChatMessage, RootStore } from "../store";

export const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
    isStreaming: false,
  } as RootStore["chat"],
  reducers: {
    addMessage: (
      state,
      action: {
        type: string;
        payload: ChatMessage;
      }
    ) => {
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    },
    setIsStreaming: (state, action) => {
      return {
        ...state,
        isStreaming: action.payload,
      };
    },
    streamUpdate: (state, action) => {
      if (!state.isStreaming) {
        return {
          ...state,
          messages: [
            ...state.messages,
            {
              role: "assistant",
              content: action.payload,
            },
          ],
          isStreaming: true,
        };
      } else {
        let lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage.role !== "assistant") {
          return {
            ...state,
            messages: [
              ...state.messages,
              {
                role: "assistant",
                content: action.payload,
              },
            ],
            isStreaming: true,
          };
        }
        return {
          ...state,
          messages: [
            ...state.messages.slice(0, state.messages.length - 1),
            {
              ...lastMessage,
              content: lastMessage.content + action.payload,
            },
          ],
          isStreaming: true,
        };
      }
    },
    closeStream: (state) => {
      return {
        ...state,
        isStreaming: false,
      };
    },
    clearChat: (state) => {
      return {
        ...state,
        messages: [],
        isStreaming: false,
      };
    },
  },
});

export const {
  addMessage,
  streamUpdate,
  closeStream,
  clearChat,
  setIsStreaming,
} = chatSlice.actions;
export default chatSlice.reducer;
