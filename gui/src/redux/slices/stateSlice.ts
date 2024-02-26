import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ChatHistory,
  ChatHistoryItem,
  ChatMessage,
  ContextItemId,
  ContextItemWithId,
  PersistedSessionInfo,
} from "core";
import { BrowserSerializedContinueConfig } from "core/config/load";
import { stripImages } from "core/llm/countTokens";
import { v4 } from "uuid";

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

type State = {
  history: ChatHistory;
  contextItems: ContextItemWithId[];
  active: boolean;
  config: BrowserSerializedContinueConfig;
  title: string;
  sessionId: string;
  defaultModelTitle: string;
};

const initialState: State = {
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
      { payload: config }: PayloadAction<BrowserSerializedContinueConfig>
    ) => {
      const defaultModelTitle =
        config.models.find((model) => model.title === state.defaultModelTitle)
          ?.title || config.models[0].title;
      state.config = config;
      state.defaultModelTitle = defaultModelTitle;
    },
    addLogs: (state, { payload }: PayloadAction<[string, string][]>) => {
      if (!state.history.length) {
        return;
      }
      const lastHistory = state.history[state.history.length - 1];

      lastHistory.promptLogs = lastHistory.promptLogs
        ? lastHistory.promptLogs.concat(payload)
        : payload;
    },
    setActive: (state) => {
      state.active = true;
    },
    setContextItemsAtIndex: (
      state,
      {
        payload: { index, contextItems },
      }: PayloadAction<{
        index: number;
        contextItems: ChatHistoryItem["contextItems"];
      }>
    ) => {
      if (state.history[index]) {
        state.history[index].contextItems = contextItems;
      }
    },
    setEditingContextItemAtIndex: (
      state,
      {
        payload: { index, item },
      }: PayloadAction<{ index?: number; item: ContextItemWithId }>
    ) => {
      if (index === undefined) {
        const isFirstContextItem =
          state.contextItems[0]?.id.itemId === item.id.itemId;

        state.contextItems = isFirstContextItem
          ? []
          : [{ ...item, editing: true }];
        return;
      }
      // TODO
    },
    addContextItems: (state, action: PayloadAction<ContextItemWithId[]>) => {
      state.contextItems = state.contextItems.concat(action.payload);
    },
    resubmitAtIndex: (
      state,
      {
        payload,
      }: PayloadAction<{
        index: number;
        editorState: JSONContent;
      }>
    ) => {
      const historyItem = state.history[payload.index];
      if (!historyItem) {
        return;
      }
      historyItem.message.content = "";
      historyItem.editorState = payload.editorState;

      // Cut off history after the resubmitted message
      state.history = state.history.slice(0, payload.index + 1).concat({
        message: {
          role: "assistant",
          content: "",
        },
        contextItems: [],
      });

      state.contextItems = [];
      state.active = true;
    },
    initNewActiveMessage: (
      state,
      {
        payload,
      }: PayloadAction<{
        editorState: JSONContent;
      }>
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
      }: PayloadAction<{
        message: ChatMessage;
        index: number;
        contextItems?: ContextItemWithId[];
      }>
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
      }: PayloadAction<{
        index: number;
        contextItems: ContextItemWithId[];
      }>
    ) => {
      const historyItem = state.history[payload.index];
      if (!historyItem) {
        return;
      }
      historyItem.contextItems.push(...payload.contextItems);
    },
    setInactive: (state) => {
      state.active = false;
    },
    streamUpdate: (state, action: PayloadAction<string>) => {
      if (state.history.length) {
        state.history[state.history.length - 1].message.content +=
          action.payload;
      }
    },
    newSession: (
      state,
      { payload }: PayloadAction<PersistedSessionInfo | undefined>
    ) => {
      if (payload) {
        state.history = payload.history;
        state.title = payload.title;
        state.sessionId = payload.sessionId;
      } else {
        state.history = [];
        state.contextItems = [];
        state.active = false;
        state.title = "New Session";
        state.sessionId = v4();
      }
    },
    deleteContextWithIds: (
      state,
      {
        payload,
      }: PayloadAction<{ ids: ContextItemId[]; index: number | undefined }>
    ) => {
      const getKey = (id: ContextItemId) => `${id.providerTitle}-${id.itemId}`;
      const ids = new Set(payload.ids.map(getKey));

      if (payload.index === undefined) {
        state.contextItems = state.contextItems.filter(
          (item) => !ids.has(getKey(item.id))
        );
      } else {
        state.history[payload.index].contextItems = state.history[
          payload.index
        ].contextItems.filter((item) => !ids.has(getKey(item.id)));
      }
    },
    addHighlightedCode: (
      state,
      {
        payload,
      }: PayloadAction<{ rangeInFileWithContents: any; edit: boolean }>
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
      }: PayloadAction<{ ids: ContextItemId[]; index: number | undefined }>
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
    setDefaultModel: (state, { payload }: PayloadAction<string>) => {
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
