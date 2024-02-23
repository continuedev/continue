import { createSlice } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ChatHistory,
  ChatMessage,
  ContextItemId,
  ContextItemWithId,
  PersistedSessionInfo,
} from "core";
import { BrowserSerializedContinueConfig } from "core/config/load";
import { stripImages } from "core/llm/countTokens";
import { v4 } from "uuid";
import { RootStore } from "../store";

const TEST_CONTEXT_ITEMS: ContextItemWithId[] = [
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

const TEST_TIMELINE: ChatHistory = [
  {
    message: {
      role: "user",
      content: "Hi, please write bubble sort in python",
    },
    contextItems: [],
  },
  {
    message: {
      role: "assistant",
      content: `\`\`\`python
def bubble_sort(arr):
  n = len(arr)
  for i in range(n):
      for j in range(0, n - i - 1):
          if arr[j] > arr[j + 1]:
              arr[j], arr[j + 1] = arr[j + 1], arr[j]
              return arr
\`\`\``,
    },
    contextItems: [],
  },
  {
    message: { role: "user", content: "Now write it in Rust" },
    contextItems: [],
  },
  {
    message: {
      role: "assistant",
      content: `Sure, here's bubble sort written in rust: \n\`\`\`rust
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
    },
    contextItems: [],
  },
];

const initialState: RootStore["state"] = {
  history: [],
  contextItems: [],
  active: false,
  config: {
    models: [
      {
        title: "GPT-4 (Free Trial)",
        model: "gpt-4",
        provider: "free-trial",
      },
      {
        title: "GPT-3.5-Turbo (Free Trial)",
        model: "gpt-3.5-turbo",
        provider: "free-trial",
      },
    ],
    slashCommands: [
      {
        name: "edit",
        description: "Edit selected code",
      },
      {
        name: "comment",
        description: "Write comments for the selected code",
      },
      {
        name: "share",
        description: "Download and share this session",
      },
      {
        name: "cmd",
        description: "Generate a shell command",
      },
    ],
    contextProviders: [],
  },
  title: "New Session",
  sessionId: v4(),
  defaultModelTitle: "GPT-4",
};

export const stateSlice = createSlice({
  name: "state",
  initialState,
  reducers: {
    setConfig: (
      state,
      { payload }: { payload: BrowserSerializedContinueConfig }
    ) => {
      const config = payload;
      const defaultModelTitle = config.models.find(
        (model) => model.title === state.defaultModelTitle
      )
        ? state.defaultModelTitle
        : config.models[0].title;
      return {
        ...state,
        config,
        defaultModelTitle,
      };
    },
    addLogs: (state, { payload }: { payload: [string, string][] }) => {
      if (state.history.length === 0) {
        return;
      }

      if (state.history[state.history.length - 1].promptLogs) {
        state.history[state.history.length - 1].promptLogs.push(...payload);
      } else {
        state.history[state.history.length - 1].promptLogs = payload;
      }
    },
    setActive: (state) => {
      return {
        ...state,
        active: true,
      };
    },
    setContextItemsAtIndex: (state, action) => {
      if (action.payload.index < state.history.length) {
        return {
          ...state,
          history: state.history.map((historyItem, i) => {
            if (i === action.payload.index) {
              return {
                ...historyItem,
                contextItems: action.payload.contextItems,
              };
            }
            return historyItem;
          }),
        };
      }
    },
    setEditingContextItemAtIndex: (
      state,
      {
        payload: { index, item },
      }: {
        payload: { index?: number; item: ContextItemWithId };
      }
    ) => {
      if (index === undefined) {
        if (state.contextItems[0]?.id.itemId === item.id.itemId) {
          return {
            ...state,
            contextItems: [],
          };
        } else {
          return {
            ...state,
            contextItems: [{ ...item, editing: true }],
          };
        }
      } else {
        // TODO
      }
    },
    addContextItems: (state, action) => {
      return {
        ...state,
        contextItems: [...state.contextItems, ...action.payload],
      };
    },
    resubmitAtIndex: (
      state,
      {
        payload,
      }: {
        payload: {
          index: number;
          editorState: JSONContent;
        };
      }
    ) => {
      if (payload.index < state.history.length) {
        state.history[payload.index].message.content = "";
        state.history[payload.index].editorState = payload.editorState;

        // Cut off history after the resubmitted message
        state.history = [
          ...state.history.slice(0, payload.index + 1),
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
    initNewActiveMessage: (
      state,
      {
        payload,
      }: {
        payload: {
          editorState: JSONContent;
        };
      }
    ) => {
      state.history.push({
        message: { role: "user", content: "" },
        contextItems: state.contextItems,
        editorState: payload.editorState,
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
    setMessageAtIndex: (
      state,
      {
        payload,
      }: {
        payload: {
          message: ChatMessage;
          index: number;
          contextItems?: ContextItemWithId[];
        };
      }
    ) => {
      if (payload.index >= state.history.length) {
        state.history.push({
          message: payload.message,
          editorState: {
            type: "doc",
            content: stripImages(payload.message.content)
              .split("\n")
              .map((line) => ({
                type: "paragraph",
                content: line === "" ? [] : [{ type: "text", text: line }],
              })),
          },
          contextItems: [],
        });
        return;
      }
      state.history[payload.index].message = payload.message;
      state.history[payload.index].contextItems = payload.contextItems || [];
    },
    addContextItemsAtIndex: (
      state,
      {
        payload,
      }: {
        payload: {
          index: number;
          contextItems: ContextItemWithId[];
        };
      }
    ) => {
      if (payload.index < state.history.length) {
        state.history[payload.index].contextItems.push(...payload.contextItems);
      }
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
  setContextItemsAtIndex,
  addContextItems,
  addContextItemsAtIndex,
  setInactive,
  streamUpdate,
  newSession,
  deleteContextWithIds,
  resubmitAtIndex,
  addHighlightedCode,
  setEditingAtIds,
  setDefaultModel,
  setConfig,
  addLogs,
  setActive,
  setEditingContextItemAtIndex,
  initNewActiveMessage,
  setMessageAtIndex,
} = stateSlice.actions;
export default stateSlice.reducer;
