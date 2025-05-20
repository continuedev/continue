import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { constructMessages } from "core/llm/constructMessages";
import { getBaseSystemMessage } from "../../util";
import { selectSelectedChatModel } from "../slices/configSlice";
import { setActive, streamUpdate } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { resetStateForNewMessage } from "./resetStateForNewMessage";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";

/**
 * Thunk to stream a custom assistant message and get LLM response
 * This allows injecting a specific assistant message into the conversation
 */
export const streamAssistantMessage = createAsyncThunk<
  void,
  { content: string },
  ThunkApiType
>(
  "chat/streamAssistantMessage",
  async ({ content }, { dispatch, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();
        const initialHistory = state.session.history;
        const selectedChatModel = selectSelectedChatModel(state);

        // Guard clause: Exit if there is no user message in the history
        const hasUserMessage = initialHistory.some((historyItem) =>
          historyItem.message?.role === "user"
        );
        if (!hasUserMessage) {
          console.log("No user message found in history. Assistant message not added.");
          return;
        }

        if (!selectedChatModel) {
          throw new Error("No model selected");
        }

        resetStateForNewMessage();

        await new Promise((resolve) => setTimeout(resolve, 0));

        // Create and add assistant message to the stream
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content,
        };

        dispatch(streamUpdate([assistantMessage]));
        dispatch(setActive());

        // Get updated history after adding the message
        const updatedHistory = getState().session.history;
        const messageMode = getState().session.mode;

        const baseChatOrAgentSystemMessage = getBaseSystemMessage(
          selectedChatModel,
          messageMode
        );

        const messages = constructMessages(
          messageMode,
          [...updatedHistory],
          baseChatOrAgentSystemMessage,
          state.config.config.rules,
        );

        // Stream the next LLM response
        unwrapResult(await dispatch(streamNormalInput({ messages })));
      }),
    );
  },
);