import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import {
  acceptToolCall,
  setCalling,
  setToolCallOutput,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const callTool = createAsyncThunk<void, undefined, ThunkApiType>(
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

    if (!state.config.defaultModelTitle) {
      throw new Error("No model selected");
    }

    dispatch(setCalling());

    const result = await extra.ideMessenger.request("tools/call", {
      toolCall: toolCallState.toolCall,
      selectedModelTitle: state.config.defaultModelTitle,
    });

    if (result.status === "success") {
      const contextItems = result.content.contextItems;
      dispatch(setToolCallOutput(contextItems));
      dispatch(acceptToolCall());

      // Send to the LLM to continue the conversation
      const response = await dispatch(
        streamResponseAfterToolCall({
          toolCallId: toolCallState.toolCall.id,
          toolOutput: contextItems,
        }),
      );
      unwrapResult(response);
    } else {
      throw new Error(
        `Failed to call tool ${toolCallState.toolCall.function.name}: ${result.error}`,
      );
    }
  },
);
