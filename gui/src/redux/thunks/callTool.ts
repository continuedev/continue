import { createAsyncThunk } from "@reduxjs/toolkit";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import {
  acceptToolCall,
  setCalling,
  setToolCallOutput,
} from "../slices/stateSlice";
import { ThunkApiType } from "../store";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

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
      dispatch(acceptToolCall());

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
