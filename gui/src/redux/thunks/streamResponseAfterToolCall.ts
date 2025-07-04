import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { renderContextItems } from "core/util/messageContent";
import { streamUpdate } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCall } from "../util";
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

        const toolCallState = findToolCall(state.session.history, toolCallId);
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

        unwrapResult(await dispatch(streamNormalInput({})));
      }),
    );
  },
);
