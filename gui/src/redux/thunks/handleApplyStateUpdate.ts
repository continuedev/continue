import { createAsyncThunk } from "@reduxjs/toolkit";
import { ApplyState, ContextItem } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import { logAgentModeEditOutcome } from "../../util/editOutcomeLogger";
import {
  selectApplyStateByToolCallId,
  selectToolCallById,
} from "../selectors/selectToolCalls";
import { updateEditStateApplyState } from "../slices/editState";
import {
  acceptToolCall,
  errorToolCall,
  updateApplyState,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCallById, logToolUsage } from "../util";
import { exitEdit } from "./edit";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const handleApplyStateUpdate = createAsyncThunk<
  void,
  ApplyState,
  ThunkApiType
>(
  "apply/handleStateUpdate",
  async (applyState, { dispatch, getState, extra }) => {
    if (applyState.streamId === EDIT_MODE_STREAM_ID) {
      dispatch(updateEditStateApplyState(applyState));

      if (applyState.status === "closed") {
        const toolCallState = findToolCallById(
          getState().session.history,
          applyState.toolCallId!,
        );
        if (toolCallState) {
          logToolUsage(toolCallState, true, true, extra.ideMessenger);
        }
        void dispatch(exitEdit({}));
      }
    } else {
      // chat or agent
      dispatch(updateApplyState(applyState));

      // Handle apply status updates - use toolCallId from event payload
      if (applyState.toolCallId) {
        if (
          applyState.status === "done" &&
          getState().config.config?.ui?.autoAcceptEditToolDiffs
        ) {
          extra.ideMessenger.post("acceptDiff", {
            streamId: applyState.streamId,
            filepath: applyState.filepath,
          });
        }
        if (applyState.status === "closed") {
          // Find the tool call to check if it was canceled
          const toolCallState = findToolCallById(
            getState().session.history,
            applyState.toolCallId,
          );

          if (toolCallState) {
            // If we reach here with status "closed", the apply process completed
            // Don't consider it "canceled" just because diffs were rejected
            const wasCanceled = toolCallState.status === "canceled";
            const accepted = !wasCanceled;

            logToolUsage(toolCallState, accepted, true, extra.ideMessenger);

            // Log edit outcome for Agent Mode
            const newApplyState =
              getState().session.codeBlockApplyStates.states.find(
                (s) => s.streamId === applyState.streamId,
              );
            const newState = getState();
            if (newApplyState) {
              void logAgentModeEditOutcome(
                newState.session.history,
                newState.config.config,
                toolCallState,
                newApplyState,
                accepted,
                extra.ideMessenger,
              );
            }

            // Generate feedback based on diff acceptance status (only for final "closed" status)
            let shouldStreamResponse = false;
            if (
              toolCallState.status !== "errored" &&
              applyState.status === "closed"
            ) {
              const feedbackContextItem =
                generateDiffAcceptanceFeedback(applyState);
              if (feedbackContextItem) {
                dispatch(
                  updateToolCallOutput({
                    toolCallId: applyState.toolCallId,
                    contextItems: [feedbackContextItem],
                  }),
                );
                shouldStreamResponse = true; // We have feedback to respond to
              }
            }

            // If the apply process completed (status is "closed"), mark tool as accepted
            // The feedback will communicate the actual diff acceptance outcome
            if (accepted && toolCallState.status !== "errored") {
              dispatch(
                acceptToolCall({
                  toolCallId: applyState.toolCallId,
                }),
              );
            }

            // Stream response if we have feedback or if tool was accepted
            if (
              shouldStreamResponse ||
              (accepted && toolCallState.status !== "errored")
            ) {
              void dispatch(
                streamResponseAfterToolCall({
                  toolCallId: applyState.toolCallId,
                }),
              );
            }
          }
          // TODO return output from edit tools so the model knows the result
        }
      }
    }
  },
);

function generateDiffAcceptanceFeedback(
  applyState: ApplyState,
): ContextItem | null {
  const acceptedDiffs = applyState.numAccepted || 0;
  const rejectedDiffs = applyState.numRejected || 0;
  const totalProcessedDiffs = acceptedDiffs + rejectedDiffs;

  if (totalProcessedDiffs === 0) {
    return null;
  }

  let contextItem: ContextItem;

  if (acceptedDiffs === totalProcessedDiffs) {
    // All diffs accepted
    contextItem = {
      name: "Edit Result - Accepted All",
      description: `All proposed changes were accepted by the user`,
      content: "User accepted all proposed changes",
      status: "user_accepted_all",
    };
  } else if (acceptedDiffs === 0) {
    // No diffs accepted
    contextItem = {
      name: "Edit Result - Rejected All",
      description:
        "Tool succeeded but user rejected all changes - LLM must stop and consult user",
      content:
        "The search and replace tool executed successfully, but the user rejected ALL proposed changes. This means:\n\n1. DO NOT attempt any more file modifications\n2. DO NOT try different changes\n3. STOP and ask the user for clarification\n\nYou must now ask the user: 'I see you rejected all my proposed changes. Could you help me understand what you're looking for instead? What specific changes would you like me to make to the file?'",
      status: "user_rejected_all",
    };
  } else {
    // Partial acceptance
    contextItem = {
      name: "Edit Result - Partial Acceptance",
      description:
        "Partial acceptance of changes - LLM should ask user for next steps",
      content:
        "User partially accepted changes. Some of your proposed changes were accepted while others were rejected.\n\nPlease ask the user what they would like to do next. For example:\n- Do they want you to try different approaches for the rejected changes?\n- Are they satisfied with the current state?\n- Do they have specific feedback about what they want instead?",
      status: "user_accepted_partial",
    };
  }

  return contextItem;
}

export const handleEditToolApplyError = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>(
  "apply/handleEditError",
  async ({ toolCallId }, { dispatch, getState, extra }) => {
    const state = getState();

    const toolCallState = selectToolCallById(state, toolCallId);
    const applyState = selectApplyStateByToolCallId(state, toolCallId);
    if (
      toolCallState &&
      applyState &&
      applyState.status !== "closed" &&
      toolCallState.status === "calling"
    ) {
      dispatch(
        errorToolCall({
          toolCallId,
        }),
      );
      dispatch(
        updateToolCallOutput({
          toolCallId,
          contextItems: [
            {
              icon: "problems",
              name: "Apply Error",
              description: "Failed to apply changes",
              content: `Error editing file: failed to apply changes to file.\n\nPlease try again with correct args or notify the user and request further instructions.`,
              hidden: false,
            },
          ],
        }),
      );
      void dispatch(
        handleApplyStateUpdate({
          status: "closed",
          streamId: applyState.streamId,
          toolCallId,
        }),
      );
    }
  },
);
