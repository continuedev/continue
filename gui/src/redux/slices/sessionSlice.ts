import {
  ActionReducerMapBuilder,
  AsyncThunk,
  PayloadAction,
  createSelector,
  createSlice,
} from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ApplyState,
  ChatHistoryItem,
  ChatMessage,
  ContextItemWithId,
  FileSymbolMap,
  Session,
  PromptLog,
  CodeToEdit,
  ToolCall,
  ContextItem,
} from "core";
import { incrementalParseJson } from "core/util/incrementalParseJson";
import { renderChatMessage } from "core/util/messageContent";
import { v4 as uuidv4 } from "uuid";
import { streamResponseThunk } from "../thunks/streamResponse";
import { findCurrentToolCall } from "../util";
import { RootState } from "../store";

// We need this to handle reorderings (e.g. a mid-array deletion) of the messages array.
// The proper fix is adding a UUID to all chat messages, but this is the temp workaround.
type ChatHistoryItemWithMessageId = ChatHistoryItem & {
  message: ChatMessage & { id: string };
};

type SessionState = {
  messages: ChatHistoryItemWithMessageId[];
  isStreaming: boolean;
  title: string;
  id: string;
  selectedProfileId: string;
  streamAborter: AbortController;
  codeToEdit: CodeToEdit[];
  curCheckpointIndex: number;
  mainEditorContent?: JSONContent;
  symbols: FileSymbolMap;
  codeBlockApplyStates: {
    states: ApplyState[];
    curIndex: number;
  };
};

function isCodeToEditEqual(a: CodeToEdit, b: CodeToEdit) {
  return a.filepath === b.filepath && a.contents === b.contents;
}

function getDefaultMessage(): ChatHistoryItemWithMessageId {
  return {
    message: {
      id: uuidv4(),
      role: "assistant",
      content: "",
    },
    contextItems: [],
    mode: "chat",
    isGatheringContext: false,
    checkpoint: {},
    isBeforeCheckpoint: false,
  };
}

const initialState: SessionState = {
  messages: [],
  isStreaming: false,
  title: "New Session",
  id: uuidv4(),
  selectedProfileId: "local",
  curCheckpointIndex: 0,
  streamAborter: new AbortController(),
  codeToEdit: [],
  symbols: {},
  codeBlockApplyStates: {
    states: [],
    curIndex: 0,
  },
};

export const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    addPromptCompletionPair: (
      state,
      { payload }: PayloadAction<PromptLog[]>,
    ) => {
      if (!state.messages.length) {
        return;
      }

      const lastMessage = state.messages[state.messages.length - 1];

      lastMessage.promptLogs = lastMessage.promptLogs
        ? lastMessage.promptLogs.concat(payload)
        : payload;
    },
    setActive: (state) => {
      state.isStreaming = true;
    },
    setIsGatheringContext: (state, { payload }: PayloadAction<boolean>) => {
      state.messages.at(-1).isGatheringContext = payload;
    },
    clearLastEmptyResponse: (state) => {
      if (state.messages.length < 2) {
        return;
      }

      const lastMessage = state.messages[state.messages.length - 1];

      // Only clear in the case of an empty message
      if (!lastMessage.message.content.length) {
        state.mainEditorContent =
          state.messages[state.messages.length - 2].editorState;
        state.messages = state.messages.slice(0, -2);
      }
    },
    updateFileSymbols: (state, action: PayloadAction<FileSymbolMap>) => {
      state.symbols = {
        ...state.symbols,
        ...action.payload,
      };
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
      if (state.messages[index]) {
        state.messages[index].contextItems = contextItems;
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
      const historyItem = state.messages[payload.index];

      if (!historyItem) {
        return;
      }

      historyItem.message.content = "";
      historyItem.editorState = payload.editorState;

      // Cut off history after the resubmitted message
      state.messages = state.messages
        .slice(0, payload.index + 1)
        .concat(getDefaultMessage());

      state.isStreaming = true;
    },
    deleteMessage: (state, action: PayloadAction<number>) => {
      // Deletes the current assistant message and the previous user message
      state.messages.splice(action.payload - 1, 2);
    },
    initNewActiveMessage: (
      state,
      {
        payload,
      }: PayloadAction<{
        editorState: JSONContent;
      }>,
    ) => {
      state.messages.push({
        ...getDefaultMessage(),
        message: { role: "user", ...getDefaultMessage().message },
        editorState: payload.editorState,
      });

      state.messages.push({
        ...getDefaultMessage(),
        message: { role: "assistant", ...getDefaultMessage().message },
        editorState: payload.editorState,
      });

      state.isStreaming = true;
      state.curCheckpointIndex = state.curCheckpointIndex + 1;
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
      if (payload.index >= state.messages.length) {
        state.messages.push({
          ...getDefaultMessage(),
          message: { ...getDefaultMessage().message, ...payload.message },
          editorState: {
            type: "doc",
            content: renderChatMessage(payload.message)
              .split("\n")
              .map((line) => ({
                type: "paragraph",
                content: line === "" ? [] : [{ type: "text", text: line }],
              })),
          },
        });
      }

      state.messages[payload.index].message = {
        ...payload.message,
        id: uuidv4(),
      };

      state.messages[payload.index].contextItems = payload.contextItems || [];
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
      const historyItem = state.messages[payload.index];

      if (!historyItem) {
        return;
      }

      historyItem.contextItems = [
        ...historyItem.contextItems,
        ...payload.contextItems,
      ];
    },
    setInactive: (state) => {
      const curMessage = state.messages.at(-1);

      if (curMessage) {
        curMessage.isGatheringContext = false;
      }

      state.isStreaming = false;
    },
    abortStream: (state) => {
      state.streamAborter.abort();
      state.streamAborter = new AbortController();
    },
    streamUpdate: (state, action: PayloadAction<ChatMessage>) => {
      if (state.messages.length) {
        const lastMessage = state.messages[state.messages.length - 1];

        if (
          action.payload.role &&
          (lastMessage.message.role !== action.payload.role ||
            // This is when a tool call comes after assistant text
            (lastMessage.message.content !== "" &&
              action.payload.role === "assistant" &&
              action.payload.toolCalls?.length))
        ) {
          // Create a new message
          const historyItem: ChatHistoryItemWithMessageId = {
            contextItems: [],
            message: { id: uuidv4(), ...action.payload },
          };

          if (action.payload.role === "assistant" && action.payload.toolCalls) {
            const [_, parsedArgs] = incrementalParseJson(
              action.payload.toolCalls[0].function.arguments,
            );
            historyItem.toolCallState = {
              status: "generating",
              toolCall: action.payload.toolCalls[0] as ToolCall,
              toolCallId: action.payload.toolCalls[0].id,
              parsedArgs,
            };
          }

          state.messages.push(historyItem);
        } else {
          // Add to the existing message
          const msg = state.messages[state.messages.length - 1].message;
          if (action.payload.content) {
            msg.content += renderChatMessage(action.payload);
          } else if (
            action.payload.role === "assistant" &&
            action.payload.toolCalls &&
            msg.role === "assistant"
          ) {
            if (!msg.toolCalls) {
              msg.toolCalls = [];
            }
            action.payload.toolCalls.forEach((toolCall, i) => {
              if (msg.toolCalls.length <= i) {
                msg.toolCalls.push(toolCall);
              } else {
                msg.toolCalls[i].function.arguments +=
                  toolCall.function.arguments;

                const [_, parsedArgs] = incrementalParseJson(
                  msg.toolCalls[i].function.arguments,
                );

                state.messages[
                  state.messages.length - 1
                ].toolCallState.parsedArgs = parsedArgs;
                state.messages[
                  state.messages.length - 1
                ].toolCallState.toolCall.function.arguments +=
                  toolCall.function.arguments;
              }
            });
          }
        }
      }
    },
    newSession: (state, { payload }: PayloadAction<Session | undefined>) => {
      state.streamAborter.abort();
      state.streamAborter = new AbortController();

      state.isStreaming = false;
      state.symbols = {};

      if (payload) {
        state.messages = payload.history as any;
        state.title = payload.title;
        state.id = payload.sessionId;
        state.curCheckpointIndex = 0;
      } else {
        state.messages = [];
        state.title = "New Session";
        state.id = uuidv4();
        state.curCheckpointIndex = 0;
      }
    },
    updateSessionTitle: (state, { payload }: PayloadAction<string>) => {
      state.title = payload;
    },
    addHighlightedCode: (
      state,
      {
        payload,
      }: PayloadAction<{ rangeInFileWithContents: any; edit: boolean }>,
    ) => {
      let contextItems =
        state.messages[state.messages.length - 1].contextItems ?? [];

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
          itemId: uuidv4(),
        },
        content: payload.rangeInFileWithContents.contents,
        editing: true,
        editable: true,
      });

      state.messages[state.messages.length - 1].contextItems = contextItems;
    },
    setSelectedProfileId: (state, { payload }: PayloadAction<string>) => {
      return {
        ...state,
        selectedProfileId: payload,
      };
    },
    setCurCheckpointIndex: (state, { payload }: PayloadAction<number>) => {
      state.curCheckpointIndex = payload;
    },
    updateCurCheckpoint: (
      state,
      { payload }: PayloadAction<{ filepath: string; content: string }>,
    ) => {
      state.messages[state.curCheckpointIndex].checkpoint[payload.filepath] =
        payload.content;
    },
    updateApplyState: (state, { payload }: PayloadAction<ApplyState>) => {
      const applyState = state.codeBlockApplyStates.states.find(
        (state) => state.streamId === payload.streamId,
      );

      if (!applyState) {
        state.codeBlockApplyStates.states.push(payload);
      } else {
        applyState.status = payload.status ?? applyState.status;
        applyState.numDiffs = payload.numDiffs ?? applyState.numDiffs;
        applyState.filepath = payload.filepath ?? applyState.filepath;
      }

      if (payload.status === "done") {
        state.codeBlockApplyStates.curIndex++;
      }
    },
    resetNextCodeBlockToApplyIndex: (state) => {
      state.codeBlockApplyStates.curIndex = 0;
    },
    addCodeToEdit: (
      state,
      { payload }: PayloadAction<CodeToEdit | CodeToEdit[]>,
    ) => {
      const entries = Array.isArray(payload) ? payload : [payload];

      const newEntries = entries.filter(
        (entry) =>
          !state.codeToEdit.some((existingEntry) =>
            isCodeToEditEqual(existingEntry, entry),
          ),
      );

      if (newEntries.length > 0) {
        state.codeToEdit.push(...newEntries);
      }
    },
    removeCodeToEdit: (state, { payload }: PayloadAction<CodeToEdit>) => {
      state.codeToEdit = state.codeToEdit.filter(
        (entry) => !isCodeToEditEqual(entry, payload),
      );
    },
    clearCodeToEdit: (state) => {
      state.codeToEdit = [];
    },
    // Related to currentToolCallState
    setToolGenerated: (state) => {
      const toolCallState = findCurrentToolCall(state.messages);
      if (!toolCallState) return;

      toolCallState.status = "generated";
    },
    setToolCallOutput: (state, action: PayloadAction<ContextItem[]>) => {
      const toolCallState = findCurrentToolCall(state.messages);
      if (!toolCallState) return;

      toolCallState.output = action.payload;
    },
    cancelToolCall: (state) => {
      const toolCallState = findCurrentToolCall(state.messages);
      if (!toolCallState) return;

      toolCallState.status = "canceled";
    },
    acceptToolCall: (state) => {
      const toolCallState = findCurrentToolCall(state.messages);
      if (!toolCallState) return;

      toolCallState.status = "done";
    },
    setCalling: (state) => {
      const toolCallState = findCurrentToolCall(state.messages);
      if (!toolCallState) return;

      toolCallState.status = "calling";
    },
  },
  selectors: {
    selectIsGatheringContext: (state) => {
      const curMessage = state.messages.at(-1);
      return curMessage?.isGatheringContext || false;
    },
  },
  extraReducers: (builder) => {
    addPassthroughCases(builder, [streamResponseThunk]);
  },
});

function addPassthroughCases(
  builder: ActionReducerMapBuilder<SessionState>,
  thunks: AsyncThunk<any, any, any>[],
) {
  thunks.forEach((thunk) => {
    builder
      .addCase(thunk.fulfilled, (state, action) => {})
      .addCase(thunk.rejected, (state, action) => {})
      .addCase(thunk.pending, (state, action) => {});
  });
}

export const selectCurrentToolCall = createSelector(
  (store: RootState) => store.session.messages,
  (history) => {
    return findCurrentToolCall(history);
  },
);

export const selectApplyStateByStreamId = createSelector(
  [
    (state: RootState) => state.session.codeBlockApplyStates.states,
    (state: RootState, streamId: string) => streamId,
  ],
  (states, streamId) => {
    return states.find((state) => state.streamId === streamId);
  },
);

export const {
  updateFileSymbols,
  setContextItemsAtIndex,
  addContextItemsAtIndex,
  setInactive,
  streamUpdate,
  newSession,
  updateSessionTitle,
  resubmitAtIndex,
  addHighlightedCode,
  addPromptCompletionPair,
  setActive,
  initNewActiveMessage,
  setMessageAtIndex,
  clearLastEmptyResponse,
  setSelectedProfileId,
  deleteMessage,
  setIsGatheringContext,
  updateCurCheckpoint,
  setCurCheckpointIndex,
  resetNextCodeBlockToApplyIndex,
  updateApplyState,
  abortStream,
  clearCodeToEdit,
  addCodeToEdit,
  removeCodeToEdit,
  setCalling,
  cancelToolCall,
  acceptToolCall,
  setToolGenerated,
  setToolCallOutput,
} = sessionSlice.actions;

export const { selectIsGatheringContext } = sessionSlice.selectors;

export default sessionSlice.reducer;
