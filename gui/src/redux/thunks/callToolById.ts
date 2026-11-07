import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ContextItem, IDE, McpUiState, ToolCallState } from "core";
import { CLIENT_TOOLS_IMPLS } from "core/tools/builtIn";
import { flagToolOutput } from "core/tools/permissions/injection";
import {
  CHECKPOINT_TOOL_NAMES,
  resolveCheckpointTargets,
  snapshotFile,
} from "core/util/checkpoints";
import { ContinueError, ContinueErrorReason } from "core/util/errors";

import { callClientTool } from "../../util/clientTools/callClientTool";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  acceptToolCall,
  addCheckpointSnapshot,
  errorToolCall,
  setInactive,
  setToolCallCalling,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { AppThunkDispatch, RootState, ThunkApiType } from "../store";
import { findToolCallById, logToolUsage } from "../util";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const callToolById = createAsyncThunk<
  void,
  { toolCallId: string; isAutoApproved?: boolean; depth?: number },
  ThunkApiType
>("chat/callTool", async (inputs, { dispatch, extra, getState }) => {
  const { toolCallId, isAutoApproved, depth = 0 } = inputs;

  const state = getState();
  const toolCallState = findToolCallById(state.session.history, toolCallId);
  if (!toolCallState) {
    console.warn(`Tool call with ID ${toolCallId} not found`);
    return;
  }

  if (toolCallState.status !== "generated") {
    return;
  }

  const selectedChatModel = selectSelectedChatModel(state);

  if (!selectedChatModel) {
    throw new Error("No model selected");
  }

  // Stop (or a new session) aborts this signal while the tool runs. The tool
  // itself is not interrupted, but its result must not restart the agent loop.
  const streamAbortSignal = state.session.streamAborter.signal;

  dispatch(
    setToolCallCalling({
      toolCallId,
    }),
  );

  // Snapshot the files this call may change, so the turn can be rolled back
  await snapshotBeforeEdit(toolCallState, state.session.history, {
    dispatch,
    ide: extra.ideMessenger.ide,
  });

  let output: ContextItem[] | undefined = undefined;
  let mcpUiState: McpUiState | undefined = undefined;
  let error: ContinueError | undefined = undefined;
  let streamResponse: boolean;

  // IMPORTANT:
  // Errors that occur while calling tool call implementations
  // Are caught and passed in output as context items
  // Errors that occur outside specifically calling the tool
  // Should not be caught here - should be handled as normal stream errors
  if (
    CLIENT_TOOLS_IMPLS.find(
      (toolName) => toolName === toolCallState.toolCall.function.name,
    )
  ) {
    // Tool is called on client side
    const {
      output: clientToolOutput,
      respondImmediately,
      error: clientToolError,
    } = await callClientTool(toolCallState, {
      dispatch,
      ideMessenger: extra.ideMessenger,
      getState,
    });
    output = clientToolOutput;
    error = clientToolError;
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
      mcpUiState = result.content.mcpUiState;
      error = result.content.errorMessage
        ? new ContinueError(
            result.content.errorReason || ContinueErrorReason.Unspecified,
            result.content.errorMessage,
          )
        : undefined;
    }
    streamResponse = true;
  }

  if (error) {
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: [
          {
            icon: "problems",
            name: "Tool Call Error",
            description: "Tool Call Failed",
            content: `${toolCallState.toolCall.function.name} failed with the message: ${error.message}\n\nPlease try something else or request further instructions.`,
            hidden: false,
          },
        ],
      }),
    );
  } else if (output?.length) {
    // Client-side injection hint (plan 7.4): tool output that reads like
    // instructions gets a reminder in front of it, so the model treats it as
    // data. The text is otherwise unchanged.
    const { items: checked } = flagToolOutput(output);
    output = checked;
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: checked,
        mcpUiState,
      }),
    );
  }

  if (streamResponse) {
    if (error) {
      logToolUsage(toolCallState, false, false, extra.ideMessenger, output);
      dispatch(
        errorToolCall({
          toolCallId,
        }),
      );
    } else {
      logToolUsage(toolCallState, true, true, extra.ideMessenger, output);
      dispatch(
        acceptToolCall({
          toolCallId,
        }),
      );
    }

    // The result stays on the tool call and is sent with the next request;
    // after Stop, do not start that request now
    if (streamAbortSignal.aborted) {
      return;
    }

    // Send to the LLM to continue the conversation
    const wrapped = await dispatch(
      streamResponseAfterToolCall({
        toolCallId,
        depth: depth + 1,
      }),
    );
    unwrapResult(wrapped);
  } else {
    dispatch(setInactive());
  }
});

/**
 * Record the prior contents of the file an edit tool is about to change,
 * under the turn (latest user message) it belongs to. Failures are logged and
 * never block the tool call.
 */
async function snapshotBeforeEdit(
  toolCallState: ToolCallState,
  history: RootState["session"]["history"],
  { dispatch, ide }: { dispatch: AppThunkDispatch; ide: IDE },
) {
  const toolName = toolCallState.toolCall.function.name;
  if (!CHECKPOINT_TOOL_NAMES.includes(toolName)) {
    return;
  }
  try {
    const turnId = history.findLast((item) => item.message.role === "user")
      ?.message.id;
    if (!turnId) {
      return;
    }
    const uris = await resolveCheckpointTargets(
      toolName,
      toolCallState.parsedArgs,
      ide,
    );
    for (const uri of uris) {
      dispatch(
        addCheckpointSnapshot({ turnId, file: await snapshotFile(ide, uri) }),
      );
    }
  } catch (e) {
    console.warn("Failed to snapshot file before edit", e);
  }
}
