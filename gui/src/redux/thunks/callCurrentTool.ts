import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ContextItem } from "core";
import { CLIENT_TOOLS } from "core/tools/builtIn";
import { callClientTool } from "../../util/clientTools/callClientTool";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  acceptToolCall,
  errorToolCall,
  setToolCallCalling,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const callCurrentTool = createAsyncThunk<void, undefined, ThunkApiType>(
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

    const { toolCallId } = toolCallState;

    dispatch(
      setToolCallCalling({
        toolCallId,
      }),
    );

    let output: ContextItem[] | undefined = undefined;
    let errorMessage: string | undefined = undefined;
    let streamResponse: boolean;

    // IMPORTANT:
    // Errors that occur while calling tool call implementations
    // Are caught and passed in output as context items
    // Errors that occur outside specifically calling the tool
    // Should not be caught here - should be handled as normal stream errors
    if (
      CLIENT_TOOLS.find(
        (toolName) => toolName === toolCallState.toolCall.function.name,
      )
    ) {
      // Tool is called on client side
      const {
        output: clientToolOuput,
        respondImmediately,
        errorMessage: clientToolError,
      } = await callClientTool(toolCallState.toolCall, {
        dispatch,
        ideMessenger: extra.ideMessenger,
        streamId: state.session.codeBlockApplyStates.states.find(
          (state) =>
            state.toolCallId && state.toolCallId === toolCallState.toolCallId,
        )?.streamId,
        getState,
      });
      output = clientToolOuput;
      errorMessage = clientToolError;
      streamResponse = respondImmediately;
    } else {
      // Tool is called on core side
      const result = await extra.ideMessenger.request("tools/call", {
        toolCall: toolCallState.toolCall,
      });
      if (result.status === "error") {
        throw new Error(result.error);
      } else {
        output = result.content.contextItems;
        errorMessage = result.content.errorMessage;
      }
      streamResponse = true;
    }

    if (errorMessage) {
      dispatch(
        updateToolCallOutput({
          toolCallId,
          contextItems: [
            {
              icon: "problems",
              name: "Tool Call Error",
              description: "Tool Call Failed",
              content: `${toolCallState.toolCall.function.name} failed with the message: ${errorMessage}\n\nPlease try something else or request further instructions.`,
              hidden: false,
            },
          ],
        }),
      );
    } else if (output?.length) {
      dispatch(
        updateToolCallOutput({
          toolCallId,
          contextItems: output,
        }),
      );
    }

    if (streamResponse) {
      if (errorMessage) {
        dispatch(
          errorToolCall({
            toolCallId,
          }),
        );
      } else {
        dispatch(
          acceptToolCall({
            toolCallId,
          }),
        );
      }

      // Send to the LLM to continue the conversation
      const wrapped = await dispatch(
        streamResponseAfterToolCall({
          toolCallId,
        }),
      );
      unwrapResult(wrapped);
    }
  },
);
