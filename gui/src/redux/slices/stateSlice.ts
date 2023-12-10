import { createSlice } from "@reduxjs/toolkit";
import defaultConfig from "core/config/default";
import { loadSerializedConfig } from "core/config/load";
import { ChatMessage, ContextItem, ContextItemId } from "core/llm/types";
import { PersistedSessionInfo } from "core/types";
import { v4 } from "uuid";
import { RootStore } from "../store";

const TEST_CONTEXT_ITEMS: ContextItem[] = [
  {
    content: "def add(a, b):\n  return a + b",
    description: "test.py",
    name: "test.py",

    id: {
      itemId: "test.py",
      providerTitle: "file",
    },
  },
  {
    content: "function add(a, b) {\n  return a + b\n}",

    description: "test.js",
    name: "test.js",
    id: {
      itemId: "test.js",
      providerTitle: "file",
    },
  },
];

const TEST_TIMELINE = [
  {
    description: "Hi, please write bubble sort in python",
    name: "User Input",
    params: { context_items: TEST_CONTEXT_ITEMS },
    hide: false,
    depth: 0,
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
    params: {},
    hide: false,
    depth: 0,
  },
  {
    description: "Now write it in Rust",
    name: "User Input",
    params: {},
  },
  {
    description: "Hello! This is a test...\n\n1, 2, 3, testing...",
    name: "Testing",
    hide: false,
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
    depth: 0,
  },
];

const initialState: RootStore["state"] = {
  history: [],
  contextItems: [],
  active: false,
  config: loadSerializedConfig(defaultConfig),
  title: "New Session",
  sessionId: v4(),
  defaultModelTitle: "GPT-4",
};

export const stateSlice = createSlice({
  name: "state",
  initialState,
  reducers: {
    setConfig: (state, action) => {
      return {
        ...state,
        config: action.payload,
      };
    },
    addContextItemsAtIndex: (state, action) => {
      if (action.payload.index < state.history.length) {
        return {
          ...state,
          history: state.history.map((historyItem, i) => {
            if (i === action.payload.index) {
              return {
                ...historyItem,
                contextItems: [
                  ...historyItem.contextItems,
                  ...action.payload.contextItems,
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
    addContextItems: (state, action) => {
      return {
        ...state,
        contextItems: [...state.contextItems, ...action.payload],
      };
    },
    resubmitAtIndex: (state, action) => {
      if (action.payload.index < state.history.length) {
        state.history[action.payload.index].message.content =
          action.payload.content;

        // Cut off history after the resubmitted message
        state.history = [
          ...state.history.slice(0, action.payload.index + 1),
          {
            message: {
              role: "assistant",
              content: "",
            },
            contextItems: [],
          },
        ];

        state.contextItems = [];
        state.active = true;
      }
    },
    submitMessage: (state, { payload }: { payload: ChatMessage }) => {
      state.history.push({
        message: payload,
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
      return {
        ...state,
        active: false,
      };
    },
    streamUpdate: (state, action) => {
      if (state.history.length > 0) {
        state.history[state.history.length - 1].message.content +=
          action.payload;
      }
    },
    newSession: (
      state,
      { payload }: { payload: PersistedSessionInfo | undefined }
    ) => {
      if (payload) {
        return {
          ...state,
          history: payload.history,
          title: payload.title,
          sessionId: payload.sessionId,
        };
      }
      return {
        ...state,
        history: [],
        contextItems: [],
        active: false,
        title: "New Session",
        sessionId: v4(),
      };
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
    addHighlightedCode: (
      state,
      {
        payload,
      }: {
        payload: { rangeInFileWithContents: any; edit: boolean };
      }
    ) => {
      let contextItems = [...state.contextItems].map((item) => {
        return { ...item, editing: false };
      });
      const base = payload.rangeInFileWithContents.filepath
        .split(/[\\/]/)
        .pop();

      // Merge if there is overlap
      for (let i = 0; i < contextItems.length; i++) {
        const item = contextItems[i];
        if (item.description === payload.rangeInFileWithContents.filepath) {
          let newStart = payload.rangeInFileWithContents.range.start.line;
          let newEnd = payload.rangeInFileWithContents.range.end.line;
          let [oldStart, oldEnd] = item.name
            .split("(")[1]
            .split(")")[0]
            .split("-")
            .map((x: string) => parseInt(x) - 1);
          if (newStart > oldEnd || newEnd < oldStart) {
            continue;
          }
          const startLine = Math.min(newStart, oldStart);
          const endLine = Math.max(newEnd, oldEnd);

          // const oldContents = item.content.split("\n");
          // const newContents =
          //   payload.rangeInFileWithContents.contents.split("\n");
          // const finalContents = [];

          contextItems[i] = {
            ...item,
            name: `${base} (${startLine + 1}-${endLine + 1})`,
            content: payload.rangeInFileWithContents.contents,
            editing: true,
            editable: true,
          };
          return { ...state, contextItems };
        }
      }

      const lineNums = `(${
        payload.rangeInFileWithContents.range.start.line + 1
      }-${payload.rangeInFileWithContents.range.end.line + 1})`;
      contextItems.push({
        name: `${base} ${lineNums}`,
        description: payload.rangeInFileWithContents.filepath,
        id: {
          providerTitle: "code",
          itemId: v4(),
        },
        content: payload.rangeInFileWithContents.contents,
        editing: true,
        editable: true,
      });

      return { ...state, contextItems };
    },
    setEditingAtIds: (
      state,
      {
        payload,
      }: { payload: { ids: ContextItemId[]; index: number | undefined } }
    ) => {
      const ids = payload.ids.map((id) => id.itemId);

      if (typeof payload.index === "undefined") {
        return {
          ...state,
          contextItems: state.contextItems.map((item) => {
            return {
              ...item,
              editing: ids.includes(item.id.itemId),
            };
          }),
        };
      } else {
        return {
          ...state,
          history: state.history.map((step, i) => {
            if (i === payload.index) {
              return {
                ...step,
                contextItems: step.contextItems.map((item) => {
                  return {
                    ...item,
                    editing: ids.includes(item.id.itemId),
                  };
                }),
              };
            }
            return step;
          }),
        };
      }
    },
    setDefaultModel: (state, { payload }: { payload: string }) => {
      const model = state.config.models.find(
        (model) => model.title === payload
      );
      if (!model) return;
      return {
        ...state,
        defaultModelTitle: payload,
      };
    },
  },
});

export const {
  addContextItemsAtIndex,
  appendMessage,
  addContextItems,
  submitMessage,
  setInactive,
  streamUpdate,
  newSession,
  deleteContextWithIds,
  resubmitAtIndex,
  addHighlightedCode,
  setEditingAtIds,
  setDefaultModel,
} = stateSlice.actions;
export default stateSlice.reducer;
