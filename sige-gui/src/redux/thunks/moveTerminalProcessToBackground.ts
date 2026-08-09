import { createAsyncThunk } from "@reduxjs/toolkit";
import { ContextItem } from "core";
import {
  abortStream,
  acceptToolCall,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCallById } from "../util";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

/**
 * This thunk is used to move a terminal command to the background
 * when the user clicks the "Move to background" link in the UI
 *
 * It preserves all existing terminal output, marks the command as
 * visually complete, and stops listening to further output from
 * the already running process
 */
export const moveTerminalProcessToBackground = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>(
  "chat/moveTerminalProcessToBackground",
  async ({ toolCallId }, { dispatch, getState, extra }) => {
    // Find the current tool call using utility function
    const state = getState();
    const toolCall = findToolCallById(state.session.history, toolCallId);

    if (!toolCall) {
      console.error("Could not find tool call with ID:", toolCallId);
      return;
    }

    // Find existing terminal output to preserve it
    const existingOutput = toolCall.output?.find(
      (item) => item.name === "Terminal",
    );
    const existingContent = existingOutput?.content || "";

    const status =
      "Command moved to background. Further output will be ignored.";

    const contextItems: ContextItem[] = [
      {
        name: "Terminal",
        description: "Terminal command output",
        content: existingContent,
        status: status,
      },
    ];

    // Abort any existing stream for this tool call
    dispatch(abortStream());

    // Update the tool call output
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems,
      }),
    );

    // Mark the process as backgrounded so we ignore future events
    await extra.ideMessenger.request("process/markAsBackgrounded", {
      toolCallId,
    });

    // Mark the tool call as "done" in the UI
    // This will set isRunning to false in RunTerminalCommand.tsx
    dispatch(acceptToolCall({ toolCallId }));

    // Trigger an LLM response about the command being moved to background
    dispatch(updateToolCallOutput({ toolCallId, contextItems }));
    dispatch(
      streamResponseAfterToolCall({
        toolCallId,
      }),
    );
  },
);
