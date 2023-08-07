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
    - Use \`/help\` to ask questions about how to use Continue`,
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
};

export const serverStateSlice = createSlice({
  name: "serverState",
  initialState,
  reducers: {
    setServerState: (state, action) => {
      return {
        ...action.payload,
        selected_context_items: action.payload.selected_context_items || [],
        user_input_queue: action.payload.user_input_queue || [],
        slash_commands: action.payload.slash_commands || [],
      };
    },
    temporarilySetUserInputQueue: (state, action) => {
      state.user_input_queue = action.payload;
    },
  },
});

export const { setServerState, temporarilySetUserInputQueue } =
  serverStateSlice.actions;
export default serverStateSlice.reducer;
