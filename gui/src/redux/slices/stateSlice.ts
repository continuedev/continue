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
import { v4 as uuidv4 } from "uuid";
import { ConfigValidationError } from "core/config/validation";

export const memoizedContextItemsSelector = createSelector(
  [(state: RootState) => state.state.history],
  (history) => {
    return history.reduce<ContextItemWithId[]>((acc, item) => {
      acc.push(...item.contextItems);
      return acc;
    }, []);
  },
);

// We need this to handle reorderings (e.g. a mid-array deletion) of the messages array.
// The proper fix is adding a UUID to all chat messages, but this is the temp workaround.
type ChatHistoryItemWithMessageId = ChatHistoryItem & {
  message: ChatMessage & { id: string };
};

type State = {
  history: ChatHistoryItemWithMessageId[];
  contextItems: ContextItemWithId[];
  ttsActive: boolean;
  active: boolean;
  isGatheringContext: boolean;
  config: BrowserSerializedContinueConfig;
  title: string;
  sessionId: string;
  defaultModelTitle: string;
  mainEditorContent?: JSONContent;
  selectedProfileId: string;
  configError: ConfigValidationError[] | undefined;
};

const initialState: State = {
  history: [],
  contextItems: [],
  ttsActive: false,
  active: false,
  isGatheringContext: false,
  configError: undefined,
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
  },
  title: "New Session",
  sessionId: v4(),
  defaultModelTitle: "GPT-4",
  selectedProfileId: "local",
};

export const stateSlice = createSlice({
  name: "state",
  initialState,
  reducers: {
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
    setConfigError: (
      state,
      { payload: error }: PayloadAction<ConfigValidationError[] | undefined>,
    ) => {
      state.configError = error;
    },
    addPromptCompletionPair: (
      state,
      { payload }: PayloadAction<PromptLog[]>,
    ) => {
      if (!state.history.length) {
        return;
      }
      const lastHistory = state.history[state.history.length - 1];

      lastHistory.promptLogs = lastHistory.promptLogs
        ? lastHistory.promptLogs.concat(payload)
        : payload;
    },
    setTTSActive: (state, { payload }: PayloadAction<boolean>) => {
      state.ttsActive = payload;
    },
    setActive: (state) => {
      state.active = true;
    },
    setIsGatheringContext: (state, { payload }: PayloadAction<boolean>) => {
      state.isGatheringContext = payload;
    },
    clearLastResponse: (state) => {
      if (state.history.length < 2) {
        return;
      }
      state.mainEditorContent =
        state.history[state.history.length - 2].editorState;
      state.history = state.history.slice(0, -2);
    },
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
      }>,
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
          id: uuidv4(),
          role: "assistant",
          content: "",
        },
        contextItems: [],
      });

      // https://github.com/continuedev/continue/pull/1021
      // state.contextItems = [];
      state.active = true;
    },
    deleteMessage: (state, action: PayloadAction<number>) => {
      // Deletes the current assistant message and the previous user message
      state.history.splice(action.payload - 1, 2);
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
        message: { role: "user", content: "", id: uuidv4() },
        contextItems: state.contextItems,
        editorState: payload.editorState,
      });
      state.history.push({
        message: {
          id: uuidv4(),
          role: "assistant",
          content: "",
        },
        contextItems: [],
      });
      // https://github.com/continuedev/continue/pull/1021
      // state.contextItems = [];
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
      }>,
    ) => {
      if (payload.index >= state.history.length) {
        state.history.push({
          message: { ...payload.message, id: uuidv4() },
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
      state.history[payload.index].message = {
        ...payload.message,
        id: uuidv4(),
      };
      state.history[payload.index].contextItems = payload.contextItems || [];
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
      state.isGatheringContext = false;
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
      { payload }: PayloadAction<PersistedSessionInfo | undefined>,
    ) => {
      if (payload) {
        state.history = payload.history as any;
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
  setConfigError,
  addPromptCompletionPair,
  setTTSActive,
  setActive,
  setEditingContextItemAtIndex,
  initNewActiveMessage,
  setMessageAtIndex,
  clearLastResponse,
  consumeMainEditorContent,
  setSelectedProfileId,
  deleteMessage,
  setIsGatheringContext,
} = stateSlice.actions;

export default stateSlice.reducer;
