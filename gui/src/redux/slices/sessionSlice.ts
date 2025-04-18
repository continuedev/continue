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
  CodeToEdit,
  ContextItem,
  ContextItemWithId,
  FileSymbolMap,
  MessageModes,
  PromptLog,
  Session,
  SessionMetadata,
  ToolCallDelta,
  ToolCallState,
} from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { NEW_SESSION_TITLE } from "core/util/constants";
import { incrementalParseJson } from "core/util/incrementalParseJson";
import { renderChatMessage } from "core/util/messageContent";
import { findUriInDirs, getUriPathBasename } from "core/util/uri";
import { v4 as uuidv4 } from "uuid";
import { RootState } from "../store";
import { streamResponseThunk } from "../thunks/streamResponse";
import { findCurrentToolCall } from "../util";

// We need this to handle reorderings (e.g. a mid-array deletion) of the messages array.
// The proper fix is adding a UUID to all chat messages, but this is the temp workaround.
type ChatHistoryItemWithMessageId = ChatHistoryItem & {
  message: ChatMessage & { id: string };
};

type SessionState = {
  lastSessionId?: string;
  allSessionMetadata: SessionMetadata[];
  history: ChatHistoryItemWithMessageId[];
  isStreaming: boolean;
  title: string;
  id: string;
  streamAborter: AbortController;
  codeToEdit: CodeToEdit[];
  curCheckpointIndex: number;
  mainEditorContentTrigger?: JSONContent | undefined;
  symbols: FileSymbolMap;
  mode: MessageModes;
  codeBlockApplyStates: {
    states: ApplyState[];
    curIndex: number;
  };
  activeToolStreamId?: [string, string];
  newestToolbarPreviewForInput: Record<string, string>;
};

function isCodeToEditEqual(a: CodeToEdit, b: CodeToEdit) {
  if (a.filepath !== b.filepath || a.contents !== b.contents) {
    return false;
  }

  if ("range" in a && "range" in b) {
    const rangeA = a.range;
    const rangeB = b.range;

    return (
      rangeA.start.line === rangeB.start.line &&
      rangeA.end.line === rangeB.end.line
    );
  }

  // If neither has a range, they are considered equal in this context
  return !("range" in a) && !("range" in b);
}

const initialState: SessionState = {
  allSessionMetadata: [],
  history: [],
  isStreaming: false,
  title: NEW_SESSION_TITLE,
  id: uuidv4(),
  curCheckpointIndex: 0,
  streamAborter: new AbortController(),
  codeToEdit: [],
  symbols: {},
  mode: "chat",
  codeBlockApplyStates: {
    states: [],
    curIndex: 0,
  },
  lastSessionId: undefined,
  newestToolbarPreviewForInput: {},
};

export const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    addPromptCompletionPair: (
      state,
      { payload }: PayloadAction<PromptLog[]>,
    ) => {
      if (!state.history.length) {
        return;
      }

      const lastMessage = state.history[state.history.length - 1];

      lastMessage.promptLogs = lastMessage.promptLogs
        ? lastMessage.promptLogs.concat(payload)
        : payload;

      // Inactive thinking for reasoning models when '</think>' tag is not received on request completion
      if (lastMessage.reasoning?.active) {
        lastMessage.reasoning.active = false;
        lastMessage.reasoning.endAt = Date.now();
      }
    },
    setActive: (state) => {
      state.isStreaming = true;
    },
    setIsGatheringContext: (state, { payload }: PayloadAction<boolean>) => {
      const curMessage = state.history.at(-1);
      if (curMessage) {
        curMessage.isGatheringContext = payload;
      }
    },
    clearLastEmptyResponse: (state) => {
      if (state.history.length < 2) {
        return;
      }
      const lastMessage = state.history[state.history.length - 1];

      // Only clear in the case of an empty message
      if (!lastMessage.message.content.length) {
        state.mainEditorContentTrigger =
          state.history[state.history.length - 2].editorState;
        state.history = state.history.slice(0, -2);
        // TODO is this logic correct for tool use conversations?
        // Maybe slice at last index of "user" role message?
      }
    },
    // Trigger value picked up by editor with isMainInput to set its content
    setMainEditorContentTrigger: (
      state,
      action: PayloadAction<JSONContent | undefined>,
    ) => {
      state.mainEditorContentTrigger = action.payload;
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
      if (state.history[index]) {
        state.history[index].contextItems = contextItems;
      }
    },
    submitEditorAndInitAtIndex: (
      state,
      {
        payload,
      }: PayloadAction<{
        index: number;
        editorState: JSONContent;
      }>,
    ) => {
      const { index, editorState } = payload;

      if (state.history.length && index < state.history.length) {
        // Resubmission - update input message, truncate history after resubmit with new empty response message
        if (index % 2 === 1) {
          console.warn(
            "Corrupted history: resubmitting at odd index, shouldn't happen",
          );
        }
        const historyItem = state.history[index];

        historyItem.message.content = ""; // IMPORTANT - this is quickly updated by resolveEditorContent based on editor state prior to streaming
        historyItem.editorState = payload.editorState;
        historyItem.contextItems = [];

        state.history = state.history.slice(0, index + 1).concat({
          message: {
            id: uuidv4(),
            role: "assistant",
            content: "", // IMPORTANT - this is subsequently updated by response streaming
          },
          contextItems: [],
        });

        state.curCheckpointIndex = Math.floor(index / 2);
      } else {
        // New input/response messages
        state.history = state.history.concat([
          {
            message: {
              id: uuidv4(),
              role: "user",
              content: "", // IMPORTANT - this is quickly updated by resolveEditorContent based on editor state prior to streaming
            },
            contextItems: [],
            editorState,
          },
          {
            message: {
              id: uuidv4(),
              role: "assistant",
              content: "", // IMPORTANT - this is subsequently updated by response streaming
            },
            contextItems: [],
          },
        ]);

        state.curCheckpointIndex = Math.floor((state.history.length - 1) / 2); // TODO this feels really fragile
      }

      state.isStreaming = true;
    },
    deleteMessage: (state, action: PayloadAction<number>) => {
      // Deletes the current assistant message and the previous user message
      state.history.splice(action.payload - 1, 2);
    },
    updateHistoryItemAtIndex: (
      state,
      {
        payload,
      }: PayloadAction<{
        index: number;
        updates: Partial<ChatHistoryItemWithMessageId>;
      }>,
    ) => {
      const { index, updates } = payload;
      if (index !== 0 && !state.history[index]) {
        console.error(
          `attempting to update history item at nonexistent index ${index}`,
          updates,
        );
        return;
      }
      state.history[index] = {
        ...state.history[index],
        ...updates,
      };
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

      historyItem.contextItems = [
        ...historyItem.contextItems,
        ...payload.contextItems,
      ];
    },
    setInactive: (state) => {
      const curMessage = state.history.at(-1);

      if (curMessage) {
        curMessage.isGatheringContext = false;
      }

      state.isStreaming = false;
    },
    abortStream: (state) => {
      state.streamAborter.abort();
      state.streamAborter = new AbortController();
    },
    streamUpdate: (state, action: PayloadAction<ChatMessage[]>) => {
      if (state.history.length) {
        function toolCallDeltaToState(
          toolCallDelta: ToolCallDelta,
        ): ToolCallState {
          const [_, parsedArgs] = incrementalParseJson(
            toolCallDelta.function?.arguments ?? "{}",
          );
          return {
            status: "generating",
            toolCall: {
              id: toolCallDelta.id ?? "",
              type: toolCallDelta.type ?? "function",
              function: {
                name: toolCallDelta.function?.name ?? "",
                arguments: toolCallDelta.function?.arguments ?? "",
              },
            },
            toolCallId: toolCallDelta.id ?? "",
            parsedArgs,
          };
        }

        for (const message of action.payload) {
          const lastItem = state.history[state.history.length - 1];
          const lastMessage = lastItem.message;

          if (message.role === "thinking" && message.redactedThinking) {
            console.log("add redacted_thinking blocks");

            state.history.push({
              message: {
                role: "thinking",
                content: "internal reasoning is hidden due to safety reasons",
                redactedThinking: message.redactedThinking,
                id: uuidv4(),
              },
              contextItems: [],
            });
            continue;
          }

          if (
            lastMessage.role !== message.role ||
            // This is for when a tool call comes immediately before/after tool call
            (lastMessage.role === "assistant" &&
              message.role === "assistant" &&
              // Last message isn't completely new
              !(!lastMessage.toolCalls?.length && !lastMessage.content) &&
              // And there's a difference in tool call presence
              (lastMessage.toolCalls?.length ?? 0) !==
                (message.toolCalls?.length ?? 0))
          ) {
            // Create a new message
            const historyItem: ChatHistoryItemWithMessageId = {
              message: {
                ...message,
                content: renderChatMessage(message),
                id: uuidv4(),
              },
              contextItems: [],
            };
            if (message.role === "assistant" && message.toolCalls?.[0]) {
              const toolCallDelta = message.toolCalls[0];
              if (
                !(
                  toolCallDelta.id &&
                  toolCallDelta.function?.arguments &&
                  toolCallDelta.function?.name &&
                  toolCallDelta.type
                )
              ) {
                console.warn(
                  "Received streamed tool call without required fields",
                  toolCallDelta,
                );
              }

              if (
                toolCallDelta.id &&
                toolCallDelta.function?.name ===
                  BuiltInToolNames.EditExistingFile
              ) {
                const streamId = uuidv4();
                state.codeBlockApplyStates.states.push({
                  streamId,
                  toolCallId: toolCallDelta.id,
                  status: "streaming",
                });
                state.activeToolStreamId = [streamId, toolCallDelta.id];
              }
              historyItem.toolCallState = toolCallDeltaToState(toolCallDelta);
            }
            state.history.push(historyItem);
          } else {
            // Add to the existing message
            if (message.content) {
              const messageContent = renderChatMessage(message);
              if (messageContent.includes("<think>")) {
                lastItem.reasoning = {
                  startAt: Date.now(),
                  active: true,
                  text: messageContent.replace("<think>", "").trim(),
                };
              } else if (
                lastItem.reasoning?.active &&
                messageContent.includes("</think>")
              ) {
                const [reasoningEnd, answerStart] =
                  messageContent.split("</think>");
                lastItem.reasoning.text += reasoningEnd.trimEnd();
                lastItem.reasoning.active = false;
                lastItem.reasoning.endAt = Date.now();
                lastMessage.content += answerStart.trimStart();
              } else if (lastItem.reasoning?.active) {
                lastItem.reasoning.text += messageContent;
              } else {
                // Note this only works because new message above
                // was already rendered from parts to string
                lastMessage.content += messageContent;
              }
            } else if (message.role === "thinking" && message.signature) {
              if (lastMessage.role === "thinking") {
                console.log("add signature", message.signature);
                lastMessage.signature = message.signature;
              }
            } else if (
              message.role === "assistant" &&
              message.toolCalls?.[0] &&
              lastMessage.role === "assistant"
            ) {
              // Intentionally only supporting one tool call for now.
              const toolCallDelta = message.toolCalls[0];

              // Update message tool call with delta data
              const newArgs =
                (lastMessage.toolCalls?.[0]?.function?.arguments ?? "") +
                (toolCallDelta.function?.arguments ?? "");
              if (lastMessage.toolCalls?.[0]) {
                lastMessage.toolCalls[0].function = {
                  name:
                    toolCallDelta.function?.name ??
                    lastMessage.toolCalls[0].function?.name ??
                    "",
                  arguments: newArgs,
                };
              } else {
                lastMessage.toolCalls = [toolCallDelta];
              }

              // Update current tool call state
              if (!lastItem.toolCallState) {
                console.warn(
                  "Received streamed tool call response prior to initial tool call delta",
                );
                lastItem.toolCallState = toolCallDeltaToState(toolCallDelta);
              }

              const [_, parsedArgs] = incrementalParseJson(newArgs);
              lastItem.toolCallState.parsedArgs = parsedArgs;
              lastItem.toolCallState.toolCall.function.arguments = newArgs;
            }
          }
        }
      }
    },
    newSession: (state, { payload }: PayloadAction<Session | undefined>) => {
      state.lastSessionId = state.id;

      state.streamAborter.abort();
      state.streamAborter = new AbortController();

      state.isStreaming = false;
      state.symbols = {};

      if (payload) {
        state.history = payload.history as any;
        state.title = payload.title;
        state.id = payload.sessionId;
        state.curCheckpointIndex = 0;
      } else {
        state.history = [];
        state.title = NEW_SESSION_TITLE;
        state.id = uuidv4();
        state.curCheckpointIndex = 0;
      }
    },
    updateSessionTitle: (state, { payload }: PayloadAction<string>) => {
      state.title = payload;
    },
    setAllSessionMetadata: (
      state,
      { payload }: PayloadAction<SessionMetadata[]>,
    ) => {
      state.allSessionMetadata = payload;
    },
    //////////////////////////////////////////////////////////////////////////////////
    // These are for optimistic session metadata updates, especially for History page
    addSessionMetadata: (
      state,
      { payload }: PayloadAction<SessionMetadata>,
    ) => {
      state.allSessionMetadata = [...state.allSessionMetadata, payload];
    },
    updateSessionMetadata: (
      state,
      {
        payload,
      }: PayloadAction<
        {
          sessionId: string;
        } & Partial<SessionMetadata>
      >,
    ) => {
      state.allSessionMetadata = state.allSessionMetadata.map((session) =>
        session.sessionId === payload.sessionId
          ? {
              ...session,
              ...payload,
            }
          : session,
      );
      if (payload.title && payload.sessionId === state.id) {
        state.title = payload.title;
      }
    },
    deleteSessionMetadata: (state, { payload }: PayloadAction<string>) => {
      // Note, should not be allowed to delete current session from chat session
      state.allSessionMetadata = state.allSessionMetadata.filter(
        (session) => session.sessionId !== payload,
      );
    },
    //////////////////////////////////////////////////////////////////////////////////
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

      const { relativePathOrBasename } = findUriInDirs(
        payload.rangeInFileWithContents.filepath,
        window.workspacePaths ?? [],
      );
      const fileName = getUriPathBasename(
        payload.rangeInFileWithContents.filepath,
      );

      const lineNums = `(${
        payload.rangeInFileWithContents.range.start.line + 1
      }-${payload.rangeInFileWithContents.range.end.line + 1})`;

      contextItems.push({
        name: `${fileName} ${lineNums}`,
        description: relativePathOrBasename,
        id: {
          providerTitle: "code",
          itemId: uuidv4(),
        },
        content: payload.rangeInFileWithContents.contents,
        editing: true,
        editable: true,
        uri: {
          type: "file",
          value: payload.rangeInFileWithContents.filepath,
        },
      });

      state.history[state.history.length - 1].contextItems = contextItems;
    },

    updateCurCheckpoint: (
      state,
      { payload }: PayloadAction<{ filepath: string; content: string }>,
    ) => {
      const checkpoint = state.history[state.curCheckpointIndex].checkpoint;
      if (checkpoint) {
        checkpoint[payload.filepath] = payload.content;
      }
    },
    setCurCheckpointIndex: (state, { payload }: PayloadAction<number>) => {
      state.curCheckpointIndex = payload;
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
      const toolCallState = findCurrentToolCall(state.history);
      if (!toolCallState) return;

      toolCallState.status = "generated";
    },
    setToolCallOutput: (state, action: PayloadAction<ContextItem[]>) => {
      const toolCallState = findCurrentToolCall(state.history);
      if (!toolCallState) return;

      toolCallState.output = action.payload;
    },
    updateToolCallOutput: (
      state,
      action: PayloadAction<{ toolCallId: string; contextItems: ContextItem[] }>,
    ) => {
      // Find the tool call with the given ID and update its output
      const { toolCallId, contextItems } = action.payload;

      // Find the history item containing the tool call
      const historyItem = state.history.find(
        (item) =>
          item.toolCallState?.toolCallId === toolCallId
      );

      if (historyItem && historyItem.toolCallState) {
        historyItem.toolCallState.output = contextItems;
      }
    },
    cancelToolCall: (state) => {
      const toolCallState = findCurrentToolCall(state.history);
      if (!toolCallState) return;

      toolCallState.status = "canceled";
    },
    acceptToolCall: (state) => {
      state.activeToolStreamId = undefined;
      const toolCallState = findCurrentToolCall(state.history);
      if (!toolCallState) return;

      toolCallState.status = "done";
    },
    setCalling: (state) => {
      const toolCallState = findCurrentToolCall(state.history);
      if (!toolCallState) return;

      toolCallState.status = "calling";
    },
    setMode: (state, action: PayloadAction<MessageModes>) => {
      state.mode = action.payload;
    },
    cycleMode: (state, action: PayloadAction<{ isJetBrains: boolean }>) => {
      const modes = action.payload.isJetBrains
        ? ["chat", "agent"]
        : ["chat", "edit", "agent"];
      const currentIndex = modes.indexOf(state.mode);
      const nextIndex = (currentIndex + 1) % modes.length;
      state.mode = modes[nextIndex] as MessageModes;
    },
    setNewestToolbarPreviewForInput: (
      state,
      {
        payload,
      }: PayloadAction<{
        inputId: string;
        contextItemId: string;
      }>,
    ) => {
      state.newestToolbarPreviewForInput[payload.inputId] =
        payload.contextItemId;
    },
  },
  selectors: {
    selectIsGatheringContext: (state) => {
      const curHistoryItem = state.history.at(-1);
      return curHistoryItem?.isGatheringContext || false;
    },
    selectIsInEditMode: (state) => {
      return state.mode === "edit";
    },
    selectCurrentMode: (state) => {
      return state.mode;
    },
    selectIsSingleRangeEditOrInsertion: (state) => {
      if (state.mode !== "edit") {
        return false;
      }

      const isInsertion = state.codeToEdit.length === 0;
      const selectIsSingleRangeEdit =
        state.codeToEdit.length === 1 && "range" in state.codeToEdit[0];

      return selectIsSingleRangeEdit || isInsertion;
    },
    selectHasCodeToEdit: (state) => {
      return state.codeToEdit.length > 0;
    },
    selectUseTools: (state) => {
      return state.mode === "agent";
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
  (store: RootState) => store.session.history,
  (history) => {
    return findCurrentToolCall(history);
  },
);

export const selectApplyStateByStreamId = createSelector(
  [
    (state: RootState) => state.session.codeBlockApplyStates.states,
    (state: RootState, streamId?: string) => streamId,
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
  addHighlightedCode,
  addPromptCompletionPair,
  setActive,
  submitEditorAndInitAtIndex,
  updateHistoryItemAtIndex,
  clearLastEmptyResponse,
  setMainEditorContentTrigger,
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
  updateToolCallOutput,
  setMode,
  setAllSessionMetadata,
  addSessionMetadata,
  updateSessionMetadata,
  deleteSessionMetadata,
  setNewestToolbarPreviewForInput,
  cycleMode,
} = sessionSlice.actions;

export const {
  selectIsGatheringContext,
  selectIsInEditMode,
  selectCurrentMode,
  selectIsSingleRangeEditOrInsertion,
  selectHasCodeToEdit,
  selectUseTools,
} = sessionSlice.selectors;

export default sessionSlice.reducer;
