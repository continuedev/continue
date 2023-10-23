import { createSlice } from "@reduxjs/toolkit";
import { FullState } from "../../schema/FullState";
import { ContextItem } from "../../schema/ContextItem";

const TEST_TIMELINE = [
  {
    step: {
      description: "Hi, please write bubble sort in python",
      name: "User Input",
    },
  },
  {
    step: {
      description: `\`\`\`python
def bubble_sort(arr):
  n = len(arr)
  for i in range(n):
      for j in range(0, n - i - 1):
          if arr[j] > arr[j + 1]:
              arr[j], arr[j + 1] = arr[j + 1], arr[j]
              return arr
\`\`\``,
      name: "Bubble Sort in Python",
    },
  },
  {
    step: {
      description: "Now write it in Rust",
      name: "User Input",
    },
  },
  {
    step: {
      description: "Hello! This is a test...\n\n1, 2, 3, testing...",
      name: "Testing",
    },
  },
  {
    step: {
      description: `Sure, here's bubble sort written in rust: \n\`\`\`rust
fn bubble_sort<T: Ord>(values: &mut[T]) {
  let len = values.len();
  for i in 0..len {
      for j in 0..(len - i - 1) {
          if values[j] > values[j + 1] {
              values.swap(j, j + 1);
          }
      }
  }
}
\`\`\`\nIs there anything else I can answer?`,
      name: "Rust Bubble Sort",
    },
    active: true,
  },
];

const TEST_SLASH_COMMANDS = [
  {
    name: "edit",
    description: "Edit the code",
  },
  {
    name: "cmd",
    description: "Generate a command",
  },
  {
    name: "help",
    description: "Get help using Continue",
  },
];

const TEST_CONTEXT_ITEMS: ContextItem[] = [
  {
    content: "def add(a, b):\n  return a + b",
    description: {
      description: "test.py",
      name: "test.py",
      id: {
        item_id: "test.py",
        provider_title: "file",
      },
    },
  },
  {
    content: "function add(a, b) {\n  return a + b\n}",
    description: {
      description: "test.js",
      name: "test.js",
      id: {
        item_id: "test.js",
        provider_title: "file",
      },
    },
  },
];

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
    temporarilyCreateNewUserInput: (state, action) => {
      state.history.timeline = [
        ...state.history.timeline,
        {
          step: {
            description: action.payload,
            name: "User Input",
            hide: false,
          },
          depth: 0,
          active: false,
          context_used: state.selected_context_items,
        },
      ];
    },
    temporarilyClearSession: (state, action) => {
      state.history.timeline = [];
      state.selected_context_items = [];
      state.session_info = {
        title: action.payload ? "Loading session..." : "New Session",
        session_id: "",
        date_created: "",
      };
    },
  },
});

export const {
  setServerState,
  temporarilyPushToUserInputQueue,
  temporarilyClearSession,
  temporarilyCreateNewUserInput,
} = serverStateSlice.actions;
export default serverStateSlice.reducer;
