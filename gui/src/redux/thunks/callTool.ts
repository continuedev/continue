import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectDefaultModel } from "../slices/configSlice";
import {
  acceptToolCall,
  cancelToolCall,
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

    const defaultModel = selectDefaultModel(state);
    if (!defaultModel) {
      throw new Error("No model selected");
    }

    dispatch(setCalling());

    const result = await extra.ideMessenger.request("tools/call", {
      toolCall: toolCallState.toolCall,
      selectedModelTitle: defaultModel.title,
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
      dispatch(cancelToolCall());

      const output = await dispatch(
        streamResponseAfterToolCall({
          toolCallId: toolCallState.toolCallId,
          toolOutput: [
            {
              icon: "problems",
              name: "Tool Call Error",
              description: "Tool Call Failed",
              content: `The tool call failed with the message:\n\n${result.error}\n\nPlease try something else or request further instructions.`,
              hidden: false,
            },
          ],
        }),
      );
      unwrapResult(output);
    }
  },
);
