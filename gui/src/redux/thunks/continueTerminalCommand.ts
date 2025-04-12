import { createAsyncThunk } from "@reduxjs/toolkit";
import { ContextItem } from "core";
// Remove direct import of markProcessAsBackgrounded
import { abortStream, acceptToolCall, updateToolCallOutput } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

/**
 * This thunk is used to continue running a terminal command in the background
 * when the user clicks the "Continue" button in the UI
 * 
 * It marks the command as visually complete without re-running it or stopping
 * the already running process
 */
export const continueTerminalCommand = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>("chat/continueTerminalCommand", async ({ toolCallId }, { dispatch, getState, extra }) => {
  // Find the current tool call
  const state = getState();
  const toolCalls = state.session.history.filter(
    (item) => item.toolCallState?.toolCallId === toolCallId
  );
  
  if (toolCalls.length === 0) {
    console.error("Could not find tool call with ID:", toolCallId);
    return;
  }
  
  const toolCall = toolCalls[0].toolCallState;
  if (!toolCall) {
    console.error("Tool call state is missing");
    return;
  }
  
  // Update the tool call output to indicate it's running in background
  const currentOutput = toolCall.output?.[0]?.content || "";
  const updatedOutput = currentOutput + "\n[Command moved to background. Further output will be ignored.]";
  
  const contextItems: ContextItem[] = [
    {
      name: "Terminal",
      description: "Terminal command output",
      content: updatedOutput
    }
  ];
  
  // Abort any existing stream for this tool call
  dispatch(abortStream());

  // Update the tool call output
  dispatch(updateToolCallOutput({
    toolCallId,
    contextItems
  }));
  
  // Mark the process as backgrounded so we ignore future events
  await extra.ideMessenger.request("process/markAsBackgrounded", { toolCallId });
  
  // Mark the tool call as "done" in the UI
  // This will set isRunning to false in RunTerminalCommand.tsx
  dispatch(acceptToolCall());
  
  // Trigger an LLM response about the command being moved to background
  dispatch(streamResponseAfterToolCall({
    toolCallId,
    toolOutput: contextItems
  }));
});
