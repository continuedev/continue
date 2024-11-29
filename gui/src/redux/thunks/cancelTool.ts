import { createAsyncThunk } from "@reduxjs/toolkit";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import {
  cancelToolCall,
  setCalling,
  setToolCallOutput,
} from "../slices/stateSlice";
import { ThunkApiType } from "../store";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const cancelTool = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/callTool",
  async (_, { dispatch, extra, getState }) => {
    const state = getState();
    const toolCallState = selectCurrentToolCall(state);

    if (!toolCallState) {
      return;
    }

    if (toolCallState.status !== "generated") {
      return;
    }

    dispatch(cancelToolCall());

    dispatch(
      streamResponseAfterToolCall({
        toolCallId: toolCallState.toolCallId,
        toolOutput: [],
      }),
    );
  },
);

export const callTool = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/callTool",
  async (_, { dispatch, extra, getState }) => {
    const state = getState();
    const toolCallState = selectCurrentToolCall(state);

    console.log("calling tool", toolCallState.toolCall);
    if (!toolCallState) {
      return;
    }

    if (toolCallState.status !== "generated") {
      return;
    }

    dispatch(setCalling());

    const result = await extra.ideMessenger.request("tools/call", {
      toolCall: toolCallState.toolCall,
    });

    if (result.status === "success") {
      const contextItems = result.content.contextItems;
      dispatch(setToolCallOutput(contextItems));

      // Send to the LLM to continue the conversation
      dispatch(
        streamResponseAfterToolCall({
          toolCallId: toolCallState.toolCall.id,
          toolOutput: contextItems,
        }),
      );
    }
  },
);
