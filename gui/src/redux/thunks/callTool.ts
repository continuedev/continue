import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ContextItem } from "core";
import { CLIENT_TOOLS } from "core/tools/builtIn";
import { callClientTool } from "../../util/clientTools/callClientTool";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../slices/configSlice";
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

    const selectedChatModel = selectSelectedChatModel(state);

    if (!selectedChatModel) {
      throw new Error("No model selected");
    }

    dispatch(setCalling());

    let errorMessage: string | undefined = "";
    let output: ContextItem[] | undefined = undefined;

    if (
      CLIENT_TOOLS.find(
        (toolName) => toolName === toolCallState.toolCall.function.name,
      )
    ) {
      // Tool is called on client side
      const { errorMessage: clientErrorMessage, output: clientOutput } =
        await callClientTool(toolCallState.toolCall, {
          dispatch,
          ideMessenger: extra.ideMessenger,
          activeToolStreamId: state.session.activeToolStreamId?.[0],
        });
      output = clientOutput;
      errorMessage = clientErrorMessage;
    } else {
      // Tool is called on core side
      const result = await extra.ideMessenger.request("tools/call", {
        toolCall: toolCallState.toolCall,
      });
      if (result.status === "error") {
        errorMessage = result.error;
      } else {
        output = result.content.contextItems;
      }
    }

    if (errorMessage) {
      dispatch(cancelToolCall());

      const wrapped = await dispatch(
        streamResponseAfterToolCall({
          toolCallId: toolCallState.toolCallId,
          toolOutput: [],
        }),
      );
      unwrapResult(wrapped);
    } else if (output) {
      dispatch(setToolCallOutput(output));
      dispatch(acceptToolCall());

      // Send to the LLM to continue the conversation
      const wrapped = await dispatch(
        streamResponseAfterToolCall({
          toolCallId: toolCallState.toolCall.id,
          toolOutput: output,
        }),
      );
      unwrapResult(wrapped);
    }
    // okay for a tool to have no output and need some GUI trigger or other to trigger response e.g. edit tool
  },
);
