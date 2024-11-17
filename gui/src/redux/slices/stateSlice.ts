import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ChatHistoryItem,
  ChatMessage,
  ContextItemId,
  ContextItemWithId,
  PersistedSessionInfo,
  PromptLog,
} from "core";
import { BrowserSerializedContinueConfig } from "core/config/load";
import { ConfigValidationError } from "core/config/validation";
import { stripImages } from "core/llm/images";
import { createSelector } from "reselect";
import { v4 as uuidv4, v4 } from "uuid";
import { RootState } from "../store";

// We need this to handle reorderings (e.g. a mid-array deletion) of the messages array.
// The proper fix is adding a UUID to all chat messages, but this is the temp workaround.
type ChatHistoryItemWithMessageId = ChatHistoryItem & {
  message: ChatMessage & { id: string };
};

type State = {
  history: ChatHistoryItemWithMessageId[];
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
  isInMultifileEdit: boolean;
};

const initialState: State = {
  history: [],
  ttsActive: false,
  active: false,
  isGatheringContext: false,
  configError: undefined,
  config: {
    slashCommands: [
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
  isInMultifileEdit: false,
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
        contextItems: [],
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
        state.active = false;
        state.title = "New Session";
        state.sessionId = v4();
        state.isInMultifileEdit = false;
      }
    },
    addHighlightedCode: (
      state,
      {
        payload,
      }: PayloadAction<{ rangeInFileWithContents: any; edit: boolean }>,
    ) => {
      let contextItems =
        state.history[state.history.length - 1].contextItems ?? [];
      contextItems = contextItems.map((item) => {
        return { ...item, editing: false };
      });
      const base = payload.rangeInFileWithContents.filepath
        .split(/[\\/]/)
        .pop();

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
      state.history[state.history.length - 1].contextItems = contextItems;
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
    setIsInMultifileEdit: (state, action: PayloadAction<boolean>) => {
      state.isInMultifileEdit = action.payload;
    },
  },
});

export const {
  setContextItemsAtIndex,
  addContextItemsAtIndex,
  setInactive,
  streamUpdate,
  newSession,
  resubmitAtIndex,
  addHighlightedCode,
  setDefaultModel,
  setConfig,
  setConfigError,
  addPromptCompletionPair,
  setTTSActive,
  setActive,
  initNewActiveMessage,
  setMessageAtIndex,
  clearLastResponse,
  consumeMainEditorContent,
  setSelectedProfileId,
  deleteMessage,
  setIsGatheringContext,
  setIsInMultifileEdit,
} = stateSlice.actions;

export default stateSlice.reducer;
