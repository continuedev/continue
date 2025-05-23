import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { cancelToolCall, updateToolCallOutput } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const cancelCurrentToolCall = createAsyncThunk<
  void,
  undefined,
  ThunkApiType
>("chat/cancelTool", async (_, { dispatch, extra, getState }) => {
  const state = getState();
  const toolCallState = selectCurrentToolCall(state);

  if (!toolCallState) {
    return;
  }

  const { toolCallId } = toolCallState;
  await dispatch(
    cancelToolCall({
      toolCallId,
    }),
  );

  await dispatch(
    updateToolCallOutput({
      toolCallId,
      contextItems: [
        {
          name: "Tool Cancelled",
          description: "Tool Cancelled",
          content:
            "The tool call was cancelled by the user. Ask for further instructions.",
          hidden: true,
        },
      ],
    }),
  );
  const output = await dispatch(
    streamResponseAfterToolCall({
      toolCallId,
    }),
  );
  unwrapResult(output);
});
