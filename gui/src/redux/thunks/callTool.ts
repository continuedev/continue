import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ContextItem } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { EditToolArgs } from "core/tools/definitions/editFile";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuidv4 } from "uuid";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { selectDefaultModel } from "../slices/configSlice";
import {
  acceptToolCall,
  cancelToolCall,
  setCalling,
  setLastToolApplyStreamId,
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

    let errorMessage = "";
    let output: ContextItem[] | undefined = undefined;

    if (
      toolCallState.toolCall.function.name === BuiltInToolNames.EditExistingFile
    ) {
      const newToolStreamId = uuidv4();
      dispatch(setLastToolApplyStreamId(newToolStreamId));
      const args = JSON.parse(
        toolCallState.toolCall.function.arguments || "{}",
      );
      try {
        await customGuiEditImpl(
          args,
          extra.ideMessenger,
          newToolStreamId,
          defaultModel.title,
        );
      } catch (e) {
        errorMessage = "Failed to call edit tool";
        if (e instanceof Error) {
          errorMessage = e.message;
        }
      }
    } else {
      const result = await extra.ideMessenger.request("tools/call", {
        toolCall: toolCallState.toolCall,
        selectedModelTitle: defaultModel.title,
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
              content: `The tool call failed with the message:\n\n${errorMessage}\n\nPlease try something else or request further instructions.`,
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
  modelTitle: string,
) {
  const firstUriMatch = await resolveRelativePathInDir(
    args.filepath,
    ideMessenger.ide,
  );
  if (!firstUriMatch) {
    return [
      {
        name: "Edit failure",
        description: `editing ${args.filepath}`,
        content: `Failed to edit ${args.filepath}: does not exist`,
      },
    ];
  }
  ideMessenger.post("applyToFile", {
    streamId,
    text: args.new_contents,
    curSelectedModelTitle: modelTitle,
  });
}
