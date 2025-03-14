import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { cancelToolCall } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const cancelTool = createAsyncThunk<void, undefined, ThunkApiType>(
  "chat/cancelTool",
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

    const output = await dispatch(
      streamResponseAfterToolCall({
        toolCallId: toolCallState.toolCallId,
        toolOutput: [
          {
            name: "Tool Cancelled",
            description: "Tool Cancelled",
            content:
              "The tool call was cancelled by the user. Please try something else or request further instructions.",
            hidden: true,
          },
        ],
      }),
    );
    unwrapResult(output);
  },
);
