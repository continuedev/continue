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
  ThinkingMessagePart,
  ToolCallDelta,
  ToolCallState,
} from "core";
import { ProfileDescription } from "core/config/ConfigHandler";
import { OrganizationDescription } from "core/config/ProfileLifecycleManager";
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
  /** null indicates loading state */
  availableProfiles: ProfileDescription[] | null;
  selectedProfile: ProfileDescription | null;
  organizations: OrganizationDescription[];
  selectedOrganizationId: string | null;
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
  newestCodeblockForInput: Record<string, string>;
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
  selectedProfile: null,
  availableProfiles: null,
  organizations: [],
  selectedOrganizationId: "",
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
  newestCodeblockForInput: {},
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
          // Simplified condition to keep thinking blocks and tool calls together in the same message
          // Only create a new message when:
          // 1. There is no previous message
          // 2. Roles are different (e.g., user vs assistant)
          // 3. For tool role messages, always create new ones
          if (
            !lastItem ||
            lastMessage.role !== message.role ||
            message.role === "tool"
          ) {
            // Create a new message - pass the message directly without modifying content
            const historyItem: ChatHistoryItemWithMessageId = {
              message: {
                ...message,
                id: uuidv4(),
              },
              contextItems: [],
            };
            if (message.role === "assistant" && message.toolCalls?.[0]) {
              const toolCallDelta = message.toolCalls[0];
              if (
                toolCallDelta.id &&
                toolCallDelta.function?.arguments &&
                toolCallDelta.function?.name &&
                toolCallDelta.type
              ) {
                console.warn(
                  "Received streamed tool call without required fields",
                  toolCallDelta,
                );
              }
              historyItem.toolCallState = toolCallDeltaToState(toolCallDelta);
            }
            state.history.push(historyItem);
          } else {
            // Add to the existing message
            if (message.content) {
              // Check if the message content is an array with parts
              if (
                Array.isArray(message.content) &&
                message.content.length > 0
              ) {
                // Process each part in the array separately
                let handledAllParts = true;

                for (const part of message.content) {
                  if (part.type === "thinking") {
                    // Initialize reasoning if it doesn't exist
                    if (!lastItem.reasoning) {
                      lastItem.reasoning = {
                        startAt: Date.now(),
                        active: true,
                        text: "",
                        endAt: undefined,
                      };
                    }

                    // Check if this is a completion signal for thinking (signature present)
                    if (part.signature) {
                      // Add signature to the thinking part
                      if (Array.isArray(lastMessage.content)) {
                        let thinkingPart = lastMessage.content.find(
                          (p) => p.type === "thinking",
                        );
                        if (thinkingPart) {
                          (thinkingPart as ThinkingMessagePart).signature =
                            part.signature;
                        } else {
                          lastMessage.content.push(part);
                        }
                      } else {
                        lastMessage.content = [part];
                      }
                      // Mark thinking as complete
                      if (lastItem.reasoning) {
                        lastItem.reasoning.active = false;
                        lastItem.reasoning.endAt = Date.now();
                      }
                    } else if (part.thinking) {
                      if (Array.isArray(lastMessage.content)) {
                        // Append thinking delta to the last thinking part
                        let thinkingPart = lastMessage.content.find(
                          (p) => p.type === "thinking",
                        );
                        if (thinkingPart) {
                          (thinkingPart as ThinkingMessagePart).thinking +=
                            part.thinking;
                        } else {
                          lastMessage.content.push(part);
                        }
                      } else {
                        lastMessage.content = [part];
                      }
                      // Append the thinking delta to the reasoning text
                      lastItem.reasoning.text += part.thinking;
                    }
                    continue;
                  } else if (part.type === "redacted_thinking") {
                    // Initialize reasoning if it doesn't exist
                    if (!lastItem.reasoning) {
                      lastItem.reasoning = {
                        startAt: Date.now(),
                        active: true,
                        text: "",
                        endAt: undefined,
                      };
                    }

                    // Add a placeholder for redacted thinking
                    lastItem.reasoning.text =
                      "[Some thinking content has been redacted for safety reasons]";

                    // Mark thinking as complete if it's been redacted
                    lastItem.reasoning.active = false;
                    lastItem.reasoning.endAt = Date.now();

                    // IMPORTANT: Preserve ALL redacted_thinking parts in the message content array
                    if (Array.isArray(lastMessage.content)) {
                      lastMessage.content.push(part);
                    } else {
                      lastMessage.content = [part];
                    }
                    continue;
                  } else if (part.type === "text") {
                    // For text parts, add directly to the message content
                    if (
                      typeof lastMessage.content === "string" &&
                      lastMessage.content.length > 0
                    ) {
                      lastMessage.content += part.text;
                    } else if (Array.isArray(lastMessage.content)) {
                      // Find existing text part or add a new one
                      const textPart = lastMessage.content.find(
                        (p) => p.type === "text",
                      );
                      if (textPart && textPart.type === "text") {
                        textPart.text += part.text;
                      } else {
                        lastMessage.content.push({
                          type: "text",
                          text: part.text,
                        });
                      }
                    } else {
                      // Initialize with an array containing this text part
                      lastMessage.content = [{ type: "text", text: part.text }];
                    }
                    continue;
                  } else {
                    handledAllParts = false;
                  }
                }

                // Only if we couldn't handle all parts, fall back to the default handling
                if (handledAllParts) {
                  continue;
                }

                // For other content types, use renderChatMessage
                const messageContent = renderChatMessage(message);
                if (typeof lastMessage.content === "string") {
                  lastMessage.content += messageContent;
                }
              } else {
                // Reasoning is streamed before the regular content, so if we had any, end it.
                if (lastItem.reasoning) {
                  lastItem.reasoning.active = false;
                  lastItem.reasoning.endAt = Date.now();
                }

                // Handle string content or legacy format
                const messageContent = renderChatMessage(message);

                // Make sure message content is a string
                if (typeof lastMessage.content !== "string") {
                  lastMessage.content = "";
                }

                // Add the message content to the existing content
                lastMessage.content += messageContent;

                // Current full content
                const fullContent = lastMessage.content as string;

                // If we find <think> tags, extract the content for the reasoning field
                if (
                  fullContent.includes("<think>") &&
                  fullContent.includes("</think>")
                ) {
                  // Extract content between <think> and </think>
                  const thinkMatches = fullContent.match(
                    /<think>(.*?)<\/think>/s,
                  );

                  if (thinkMatches && thinkMatches[1]) {
                    // Initialize or update the reasoning
                    if (!lastItem.reasoning) {
                      lastItem.reasoning = {
                        startAt: Date.now(),
                        active: false, // Set to false since we have a complete thinking block
                        text: thinkMatches[1],
                        endAt: Date.now(),
                      };
                    } else {
                      // Update existing reasoning with complete content
                      lastItem.reasoning.text = thinkMatches[1];
                      lastItem.reasoning.active = false;
                      lastItem.reasoning.endAt = Date.now();
                    }
                  }
                } else if (
                  fullContent.includes("<think>") &&
                  !fullContent.includes("</think>")
                ) {
                  // We have an incomplete thinking block
                  // Initialize reasoning if we don't have one yet
                  if (!lastItem.reasoning) {
                    lastItem.reasoning = {
                      startAt: Date.now(),
                      active: true,
                      text: "",
                      endAt: undefined,
                    };
                  }

                  // Extract content after <think> tag for reasoning field
                  const afterThinkTag = fullContent.split("<think>")[1];
                  if (afterThinkTag) {
                    lastItem.reasoning.text = afterThinkTag;
                  }
                }
              }
            } else if (
              message.role === "assistant" &&
              message.reasoning_content
            ) {
              // Initialize reasoning if it doesn't exist
              if (!lastItem.reasoning) {
                lastItem.reasoning = {
                  startAt: Date.now(),
                  active: true,
                  text: message.reasoning_content,
                  endAt: undefined,
                };
              } else {
                // Append to existing reasoning
                lastItem.reasoning.text += message.reasoning_content;
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
    // Important: these reducers don't handle selected profile/organization fallback logic
    // That is done in thunks
    setSelectedProfile: (
      state,
      { payload }: PayloadAction<ProfileDescription | null>,
    ) => {
      state.selectedProfile = payload;
    },
    setAvailableProfiles: (
      state,
      { payload }: PayloadAction<ProfileDescription[] | null>,
    ) => {
      state.availableProfiles = payload;
    },
    setOrganizations: (
      state,
      { payload }: PayloadAction<OrganizationDescription[]>,
    ) => {
      state.organizations = payload;
    },
    setSelectedOrganizationId: (
      state,
      { payload }: PayloadAction<string | null>,
    ) => {
      state.selectedOrganizationId = payload;
    },
    ///////////////

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
    cancelToolCall: (state) => {
      const toolCallState = findCurrentToolCall(state.history);
      if (!toolCallState) return;

      toolCallState.status = "canceled";
    },
    acceptToolCall: (state) => {
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
    setNewestCodeblocksForInput: (
      state,
      {
        payload,
      }: PayloadAction<{
        inputId: string;
        contextItemId: string;
      }>,
    ) => {
      state.newestCodeblockForInput[payload.inputId] = payload.contextItemId;
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
  setMode,
  setAllSessionMetadata,
  addSessionMetadata,
  updateSessionMetadata,
  deleteSessionMetadata,
  setNewestCodeblocksForInput,

  setAvailableProfiles,
  setSelectedProfile,
  setOrganizations,
  setSelectedOrganizationId,
} = sessionSlice.actions;

export const {
  selectIsGatheringContext,
  selectIsInEditMode,
  selectIsSingleRangeEditOrInsertion,
  selectHasCodeToEdit,
} = sessionSlice.selectors;

export default sessionSlice.reducer;
