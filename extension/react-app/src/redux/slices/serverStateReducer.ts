import { createSlice } from "@reduxjs/toolkit";
import { FullState } from "../../../../schema/FullState";

const initialState: FullState = {
  history: {
    timeline: [
      {
        step: {
          name: "Welcome to Continue",
          hide: false,
          description: `- Highlight code section and ask a question or give instructions
- Use \`cmd+m\` (Mac) / \`ctrl+m\` (Windows) to open Continue
- Use \`/help\` to ask questions about how to use Continue
- [Customize Continue](https://continue.dev/docs/customization) (e.g. use your own API key) by typing '/config'.`,
          system_message: null,
          chat_context: [],
          manage_own_chat_context: false,
          message: "",
        },
        depth: 0,
        deleted: false,
        active: false,
      },
    ],
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
