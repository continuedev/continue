import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ContextItem } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { EditToolArgs } from "core/tools/definitions/editFile";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  acceptToolCall,
  cancelToolCall,
  setCalling,
  setToolCallOutput,
  updateApplyState,
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

    let errorMessage = "";
    let output: ContextItem[] | undefined = undefined;

    if (
      toolCallState.toolCall.function.name === BuiltInToolNames.EditExistingFile
    ) {
      const args = JSON.parse(
        toolCallState.toolCall.function.arguments || "{}",
      );
      try {
        if (!state.session.activeToolStreamId) {
          throw new Error("Invalid apply state");
        }
        await customGuiEditImpl(
          args,
          extra.ideMessenger,
          state.session.activeToolStreamId[0],
          toolCallState.toolCallId,
        );
      } catch (e) {
        errorMessage = "Failed to call edit tool";
        if (e instanceof Error) {
          errorMessage = e.message;
        }
        if (state.session.activeToolStreamId?.[0]) {
          dispatch(
            updateApplyState({
              streamId: state.session.activeToolStreamId[0],
              status: "closed",
              toolCallId: toolCallState.toolCallId,
              numDiffs: 0,
              filepath: args.filepath,
            }),
          );
        }
      }
    } else {
      const result = await extra.ideMessenger.request("tools/call", {
        toolCall: toolCallState.toolCall,
        selectedModelTitle: selectedChatModel.title,
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
          toolOutput: [
            {
              icon: "problems",
              name: "Tool Call Error",
              description: "Tool Call Failed",
              content: `${toolCallState.toolCall.function.name} failed with the message:\n\n${errorMessage}\n\nPlease try something else or request further instructions.`,
              hidden: false,
            },
          ],
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

async function customGuiEditImpl(
  args: EditToolArgs,
  ideMessenger: IIdeMessenger,
  streamId: string,
  toolCallId: string,
) {
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    ideMessenger.ide,
  );
  if (!firstUriMatch) {
    throw new Error(`${args.filepath} does not exist`);
  }
  const apply = await ideMessenger.request("applyToFile", {
    streamId,
    text: args.new_contents,
    toolCallId,
    filepath: firstUriMatch,
  });
  if (apply.status === "error") {
    throw new Error(apply.error);
  }
}
