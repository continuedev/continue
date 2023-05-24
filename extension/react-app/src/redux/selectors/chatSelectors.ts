import { RootStore } from "../store";

const selectChatMessages = (state: RootStore) => {
  return state.chat.messages;
};

const selectIsStreaming = (state: RootStore) => {
  return state.chat.isStreaming;
};

export { selectChatMessages, selectIsStreaming };
