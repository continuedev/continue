import { unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage, ToolCallState, ToolPolicy } from "core";
import { renderContextItems } from "core/util/messageContent";
import {
  setInactive,
  setToolGenerated,
  streamUpdate,
} from "../slices/sessionSlice";
import { AppThunkDispatch } from "../store";
import { callToolById } from "./callToolById";
import { streamNormalInput } from "./streamNormalInput";

/**
 * Handles the execution of tool calls that may be automatically accepted.
 * Sets all tools as generated first, then executes auto-approved tool calls.
 */
export async function executeToolCalls(
  dispatch: AppThunkDispatch,
  generatingToolCalls: ToolCallState[],
  evaluatedPolicies: Record<string, ToolPolicy>,
): Promise<{
  continueStreaming: boolean;
}> {
  const state = getState();

  // We will stop streaming only if any need approval
  const anyNeedApproval = Object.values(policies);
  // Set all tools as generated first
  generatingToolCalls.forEach((toolCallState) => {
    dispatch(
      setToolGenerated({
        toolCallId: toolCallState.toolCallId,
        tools: state.config.config.tools,
      }),
    );
  });

  // Case 1: No tool calls OR tool calls require approval -> stop streaming
  // This prevents UI flashing for auto-approved tools while still showing approval UI for others
  if (toolCalls.length === 0 || anyNeedApproval) {
    dispatch(setInactive());
  } else if (generatingToolCalls.length > 0) {
    // Case 2: All auto approved -> call them!
    const toolCallPromises = generatingToolCalls.map(async ({ toolCallId }) => {
      const response = await dispatch(
        callToolById({ toolCallId, autoApproved: true }),
      );
      unwrapResult(response);
    });
    await Promise.all(toolCallPromises);
  } else {
    // Case 3: All errored -> stream on!
    for (const { output, toolCallId } of toolCalls) {
      const newMessage: ChatMessage = {
        role: "tool",
        content: output ? renderContextItems(output) : "",
        toolCallId,
      };
      dispatch(streamUpdate([newMessage]));
    }
    unwrapResult(await dispatch(streamNormalInput({})));
  }

  return allAutoApproved;
}
