import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { renderContextItems } from "core/util/messageContent";
import { streamUpdate } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCallById } from "../util";
import { resetStateForNewMessage } from "./resetStateForNewMessage";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";

export const streamResponseAfterToolCall = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>(
  "chat/streamAfterToolCall",
  async ({ toolCallId }, { dispatch, getState }) => {
    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();

        const toolCallState = findToolCallById(
          state.session.history,
          toolCallId,
        );
        if (!toolCallState) {
          return; // in cases where edit tool is cancelled mid apply, this will be triggered
        }

        const toolOutput = toolCallState.output ?? [];

        resetStateForNewMessage();

        await new Promise((resolve) => setTimeout(resolve, 0));

        // TODO parallel tool calls - dispatch one tool message per tool call
        const newMessage: ChatMessage = {
          role: "tool",
          content: renderContextItems(toolOutput),
          toolCallId,
        };
        dispatch(streamUpdate([newMessage]));

        // Check if all parallel tool calls are complete before continuing (original logic adaptation)
        const history = getState().session.history;
        const assistantMessage = history.find(item => 
          item.message.role === "assistant" && 
          item.toolCallStates?.some(tc => tc.toolCallId === toolCallId)
        );
        
        if (assistantMessage && assistantMessage.toolCallStates) {
          const totalToolCalls = assistantMessage.toolCallStates.length;
          const completedToolCalls = assistantMessage.toolCallStates.filter(tc => tc.status === "done");
          
          // Only continue streaming if ALL parallel tool calls are complete (like original logic)
          if (completedToolCalls.length === totalToolCalls) {
            unwrapResult(await dispatch(streamNormalInput({})));
          }
        } else {
          // Fallback: use original logic for single tool call
          unwrapResult(await dispatch(streamNormalInput({})));
        }
      }),
    );
  },
);
