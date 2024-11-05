import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ChatHistory,
  ChatHistoryItem,
  ChatMessage,
  ContextItemId,
  ContextItemWithId,
  PersistedSessionInfo,
  PromptLog,
} from "core";
import { BrowserSerializedContinueConfig } from "core/config/load";
import { stripImages } from "core/llm/images";
import { createSelector } from "reselect";
import { v4 } from "uuid";
import { RootState } from "../store";
import { getLocalStorage } from "@/util/localStorage";
import { AiderState } from "core/llm/llms/Aider";

export const memoizedContextItemsSelector = createSelector(
  [(state: RootState) => state.state.history],
  (history) => {
    return history.reduce<ContextItemWithId[]>((acc, item) => {
      acc.push(...item.contextItems);
      return acc;
    }, []);
  },
);

const integrationStatesMap = {
  'perplexity': {
    history: 'perplexityHistory',
    active: 'perplexityActive'
  },
  'aider': {
    history: 'aiderHistory',
    active: 'aiderActive'
  },
  'continue': {
    history: 'history',
    active: 'active'
  }
} as const;

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
  perplexityHistory: ChatHistory;
  aiderHistory: ChatHistory;
  contextItems: ContextItemWithId[];
  active: boolean;
  perplexityActive: boolean;
  aiderActive: boolean;
  config: BrowserSerializedContinueConfig;
  title: string;
  sessionId: string;
  defaultModelTitle: string;
  mainEditorContent?: JSONContent;
  selectedProfileId: string;
  directoryItems: string;
  showInteractiveContinueTutorial: boolean;
  aiderProcessState: AiderState;
};

const initialState: State = {
  history: [],
  perplexityHistory: [],
  aiderHistory: [],
  contextItems: [],
  active: false,
  aiderProcessState: { state: "starting" },
  perplexityActive: false,
  aiderActive: false,
  config: {
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
        description: "Export the current chat session to markdown",
      },
      {
        name: "cmd",
        description: "Generate a shell command",
      },
    ],
    contextProviders: [],
    models: [],
    isBetaAccess: false,
  },
  title: "New Session",
  sessionId: v4(),
  defaultModelTitle: "GPT-4",
  selectedProfileId: "local",
  directoryItems: "",
  showInteractiveContinueTutorial: getLocalStorage("showTutorialCard") ?? false,
};

export const stateSlice = createSlice({
  name: "state",
  initialState,
  reducers: {
    setContextItems: (state, action: PayloadAction<ContextItemWithId[]>) => {
      state.contextItems = action.payload;
    },
    setConfig: (
      state,
      { payload: config }: PayloadAction<BrowserSerializedContinueConfig>,
    ) => {
      const defaultModelTitle =
        config.models.find((model) => model.title === state.defaultModelTitle)
          ?.title ||
        config.models[0]?.title ||
        "";
      state.config = config;
      state.defaultModelTitle = defaultModelTitle;
    },
    addPromptCompletionPair: (
      state,
      { payload }: PayloadAction<{promptLogs: PromptLog[], source: keyof typeof integrationStatesMap}>,
    ) => {
      const {promptLogs, source} = payload;
      const { history: historyKey } = integrationStatesMap[source];
      const currentHistory = state[historyKey];
      if (!currentHistory.length) {
        return;
      }
      const lastHistory = currentHistory[currentHistory.length - 1];

      lastHistory.promptLogs = lastHistory.promptLogs
        ? lastHistory.promptLogs.concat(promptLogs)
        : promptLogs;
    },
    setActive: (state) => {
      state.active = true;
    },
    updateAiderProcessState: (state, action: PayloadAction<AiderState>) => {
      state.aiderProcessState = action.payload;
    },
    setPerplexityActive: (state) => {
      state.perplexityActive = true;
    },
    setAiderActive: (state) => {
      state.aiderActive = true;
    },
    clearLastResponse: (state, action?: PayloadAction<'perplexity' | 'aider' | 'continue'>) => {
      if (action.payload === 'perplexity') {
        if (state.perplexityHistory.length < 2) return;
        state.mainEditorContent = state.perplexityHistory[state.perplexityHistory.length - 2].editorState;
        state.perplexityHistory = state.perplexityHistory.slice(0, -2);
      } else if (action.payload === 'aider') {
        if (state.aiderHistory.length < 2) return;
        state.mainEditorContent = state.aiderHistory[state.aiderHistory.length - 2].editorState;
        state.aiderHistory = state.aiderHistory.slice(0, -2);
      } else {
        if (state.history.length < 2) {
          return;
        }
        state.mainEditorContent =
          state.history[state.history.length - 2].editorState;
        state.history = state.history.slice(0, -2);
      }
    },
    // clearLastResponse: (state) => {
    //   if (state.history.length < 2) {
    //     return;
    //   }
    //   state.mainEditorContent =
    //     state.history[state.history.length - 2].editorState;
    //   state.history = state.history.slice(0, -2);
    // },
    consumeMainEditorContent: (state) => {
      state.mainEditorContent = undefined;
    },
    setContextItemsAtIndex: (
      state,
      {
        payload: { index, contextItems },
      }: PayloadAction<{
        index: number;
        contextItems: ChatHistoryItem["contextItems"];
      }>,
    ) => {
      if (state.history[index]) {
        state.history[index].contextItems = contextItems;
      }
    },
    setEditingContextItemAtIndex: (
      state,
      {
        payload: { index, item },
      }: PayloadAction<{ index?: number; item: ContextItemWithId }>,
    ) => {
      if (index === undefined) {
        const isFirstContextItem =
          state.contextItems[0]?.id.itemId === item.id.itemId;

        state.contextItems = isFirstContextItem
          ? []
          : [{ ...item, editing: true }];
        return;
      }
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
        source: keyof typeof integrationStatesMap;  // todo: put this into an interface
      }>,
    ) => {
      const source = payload.source || 'continue';
      const { history: historyKey } = integrationStatesMap[source];
      const currentHistory = state[historyKey];

      // Early return if invalid index
      const historyItem = currentHistory[payload.index];
      if (!historyItem) return;

      // Update history item
      historyItem.message.content = "";
      historyItem.editorState = payload.editorState;

      // Update history and set active
      state[historyKey] = currentHistory.slice(0, payload.index + 1).concat({
        message: { role: "assistant", content: "" },
        contextItems: [],
      });
      state[integrationStatesMap[source].active] = true;
    },
    // deleteMessage: (state, action: PayloadAction<number>) => {
    //   const index = action.payload + 1;

    //   if (index >= 0 && index < state.history.length) {
    //     // Delete the current message
    //     state.history.splice(index, 1);

    //     // If the next message is an assistant message, delete it too
    //     if (
    //       index < state.history.length &&
    //       state.history[index].message.role === "assistant"
    //     ) {
    //       state.history.splice(index, 1);
    //     }
    //   }
    // },
    deleteMessage: (
      state,
      action: PayloadAction<{
        index: number,
        source: keyof typeof integrationStatesMap}>
    ) => {
      const { index, source = 'continue' } = action.payload;
      const { history: historyKey } = integrationStatesMap[source];
      const currentHistory = state[historyKey];

      if (index >= 0 && index < currentHistory.length) {
        currentHistory.splice(index, 1);
          if (
            index < currentHistory.length &&
            currentHistory[index].message.role === "assistant"
          ) {
            currentHistory.splice(index, 1);
          }
      }
    },

    initNewActiveMessage: (
      state,
      {
        payload,
      }: PayloadAction<{
        editorState: JSONContent;
      }>,
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
      // https://github.com/continuedev/continue/pull/1021
      // state.contextItems = [];
      state.active = true;
    },
    initNewActivePerplexityMessage: (
      state,
      {
        payload,
      }: PayloadAction<{
        editorState: JSONContent;
      }>,
    ) => {
      state.perplexityHistory.push({
        message: { role: "user", content: "" },
        contextItems: state.contextItems,
        editorState: payload.editorState,
      });
      state.perplexityHistory.push({
        message: {
          role: "assistant",
          content: "",
        },
        contextItems: [],
      });
      state.perplexityActive = true;
    },
    initNewActiveAiderMessage: (
      state,
      {
        payload,
      }: PayloadAction<{
        editorState: JSONContent;
      }>,
    ) => {
      state.aiderHistory.push({
        message: { role: "user", content: "" },
        contextItems: state.contextItems,
        editorState: payload.editorState,
      });
      state.aiderHistory.push({
        message: {
          role: "assistant",
          content: "",
        },
        contextItems: [],
      });
      state.aiderActive = true;
    },
    setMessageAtIndex: (
      state,
      {
        payload,
      }: PayloadAction<{
        message: ChatMessage;
        index: number;
        contextItems?: ContextItemWithId[];
        source: keyof typeof integrationStatesMap;
      }>,
    ) => {
      const { history: historyKey } = integrationStatesMap[payload.source];
      const currentHistory = state[historyKey];
      if (payload.index >= currentHistory.length) {
        currentHistory.push({
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
      currentHistory[payload.index].message = payload.message;
      currentHistory[payload.index].contextItems = payload.contextItems || [];
    },
    addContextItemsAtIndex: (
      state,
      {
        payload,
      }: PayloadAction<{
        index: number;
        contextItems: ContextItemWithId[];
      }>,
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
    setPerplexityInactive: (state) => {
      state.perplexityActive = false;
    },
    setAiderInactive: (state) => {
      state.aiderActive = false;
    },
    streamUpdate: (state, action: PayloadAction<string>) => {
      if (state.history.length) {
        state.history[state.history.length - 1].message.content +=
          action.payload;
      }
    },
    streamPerplexityUpdate: (state, action: PayloadAction<string>) => {
      if (state.perplexityHistory.length) {
        state.perplexityHistory[state.perplexityHistory.length - 1].message.content +=
          action.payload;
      }
    },
    streamAiderUpdate: (state, action: PayloadAction<string>) => {
      if (state.aiderHistory.length) {
        state.aiderHistory[state.aiderHistory.length - 1].message.content +=
          action.payload;
      }
    },
    newSession: (
      state,
      { payload }: PayloadAction<{
        session: PersistedSessionInfo | undefined,
        source: keyof typeof integrationStatesMap}>,
    ) => {
      const {session, source} = payload;
      if (session) {
        state.history = session.history;
        state.perplexityHistory = session.perplexityHistory;
        state.aiderHistory = session.aiderHistory;
        state.title = session.title;
        state.sessionId = session.sessionId;
      } else {
        const { history: historyKey } = integrationStatesMap[source];
        state[historyKey] = [];
        state.contextItems = [];
        state.active = false;
        state.title = "New Session";
        state.sessionId = v4();
        state.directoryItems = "";
      }
    },
    deleteContextWithIds: (
      state,
      {
        payload,
      }: PayloadAction<{ ids: ContextItemId[]; index: number | undefined }>,
    ) => {
      const getKey = (id: ContextItemId) => `${id.providerTitle}-${id.itemId}`;
      const ids = new Set(payload.ids.map(getKey));

      if (payload.index === undefined) {
        state.contextItems = state.contextItems.filter(
          (item) => !ids.has(getKey(item.id)),
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
      }: PayloadAction<{ rangeInFileWithContents: any; edit: boolean }>,
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
    setDirectoryItems: (state, action: PayloadAction<string>) => {
      state.directoryItems = action.payload;
    },
    setEditingAtIds: (
      state,
      {
        payload,
      }: PayloadAction<{ ids: ContextItemId[]; index: number | undefined }>,
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
    setDefaultModel: (
      state,
      { payload }: PayloadAction<{ title: string; force?: boolean }>,
    ) => {
      const model = state.config.models.find(
        (model) => model.title === payload.title,
      );
      if (!model && !payload.force) return;
      return {
        ...state,
        defaultModelTitle: payload.title,
      };
    },
    setSelectedProfileId: (state, { payload }: PayloadAction<string>) => {
      return {
        ...state,
        selectedProfileId: payload,
      };
    },
    setShowInteractiveContinueTutorial: (state, action: PayloadAction<boolean>) => {
      state.showInteractiveContinueTutorial = action.payload;
    },
  },
});

export const {
  setContextItemsAtIndex,
  addContextItems,
  addContextItemsAtIndex,
  setInactive,
  setPerplexityInactive,
  setAiderInactive,
  streamUpdate,
  streamPerplexityUpdate,
  streamAiderUpdate,
  newSession,
  deleteContextWithIds,
  resubmitAtIndex,
  addHighlightedCode,
  setDirectoryItems,
  setEditingAtIds,
  setDefaultModel,
  setConfig,
  addPromptCompletionPair,
  setActive,
  updateAiderProcessState,
  setPerplexityActive,
  setAiderActive,
  setEditingContextItemAtIndex,
  initNewActiveMessage,
  initNewActivePerplexityMessage,
  initNewActiveAiderMessage,
  setMessageAtIndex,
  clearLastResponse,
  consumeMainEditorContent,
  setSelectedProfileId,
  deleteMessage,
  setContextItems,
  setShowInteractiveContinueTutorial,
} = stateSlice.actions;
export default stateSlice.reducer;
