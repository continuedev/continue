import { createAsyncThunk } from "@reduxjs/toolkit";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { setCalling } from "../slices/stateSlice";
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

    // If it goes "generated" -> "calling" -> "done" really quickly
    // we don't want an abrupt flash so just skip "calling"
    let setCallingState = true;

    const timer = setTimeout(() => {
      if (setCallingState) {
        dispatch(setCalling());
      }
    }, 800);

    if (toolCallState.status !== "generated") {
      return;
    }

    const result = await extra.ideMessenger.request("tools/call", {
      toolCall: toolCallState.toolCall,
    });

    setCallingState = false;
    clearTimeout(timer);

    if (result.status === "success") {
      const contextItems = result.content.contextItems;
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
