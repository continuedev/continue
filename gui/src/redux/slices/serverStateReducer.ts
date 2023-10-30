import { createSlice } from "@reduxjs/toolkit";
import { ContextItem } from "../../schema/ContextItem";
import { RootStore } from "../store";

const TEST_TIMELINE = [
  {
    description: "Hi, please write bubble sort in python",
    name: "User Input",
  },
  {
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
  {
    description: "Now write it in Rust",
    name: "User Input",
  },
  {
    description: "Hello! This is a test...\n\n1, 2, 3, testing...",
    name: "Testing",
  },
  {
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

const initialState: RootStore["serverState"] = {
  meilisearchUrl: undefined,
  userInputQueue: [],
  slashCommands: [],
  selectedContextItems: [],
  config: {
    system_message: "",
    temperature: 0.5,
  },
  contextProviders: [],
  savedContextGroups: [],
};

export const serverStateSlice = createSlice({
  name: "serverState",
  initialState,
  reducers: {
    temporarilyPushToUserInputQueue: (state, action) => {
      return {
        ...state,
        userInputQueue: [...state.userInputQueue, action.payload],
      };
    },
    setSlashCommands: (state, action) => {
      return {
        ...state,
        slashCommands: action.payload,
      };
    },
    setContextProviders: (state, action) => {
      return {
        ...state,
        contextProviders: action.payload,
      };
    },
    setConfig: (state, action) => {
      return {
        ...state,
        config: action.payload,
      };
    },
  },
});

export const {
  temporarilyPushToUserInputQueue,
  setContextProviders,
  setSlashCommands,
  setConfig,
} = serverStateSlice.actions;
export default serverStateSlice.reducer;
