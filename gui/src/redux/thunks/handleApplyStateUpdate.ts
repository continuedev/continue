import { createAsyncThunk } from "@reduxjs/toolkit";
import { ApplyState } from "core";
import { EDIT_MODE_STREAM_ID } from "core/edit/constants";
import { WebviewSingleProtocolMessage } from "core/protocol/util";
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
            const accepted = toolCallState.status !== "canceled";

            logToolUsage(toolCallState, accepted, true, extra.ideMessenger);

            // Log edit outcome for Agent Mode
            const newState =
              getState().session.codeBlockApplyStates.states.find(
                (s) => s.streamId === applyState.streamId,
              );

            if (newState) {
              void logAgentModeEditOutcome(
                toolCallState,
                newState,
                accepted,
                extra.ideMessenger,
              );
            }

            if (accepted) {
              dispatch(
                acceptToolCall({
                  toolCallId: applyState.toolCallId,
                }),
              );
              void dispatch(
                streamResponseAfterToolCall({
                  toolCallId: applyState.toolCallId,
                }),
              );
            }
          }
          // const output: ContextItem = {
          //   name: "Edit tool output",
          //   content: "Completed edit",
          //   description: "",
          // };
          // dispatch(setToolCallOutput([]));
        }
      }
    }
  },
);

export const handleEditToolApplyResponse = createAsyncThunk<
  void,
  { response: WebviewSingleProtocolMessage<"applyToFile">; toolCallId: string },
  ThunkApiType
>(
  "apply/handleEditResponse",
  async ({ response, toolCallId }, { dispatch, getState, extra }) => {
    if (response.status === "error") {
      const state = getState();
      const toolCallState = selectToolCallById(state, toolCallId);
      const applyState = selectApplyStateByToolCallId(state, toolCallId);
      if (
        toolCallState &&
        applyState &&
        applyState.status !== "closed" &&
        toolCallState.status === "generated"
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
                content: `Error editing file: failed to apply changes to file."\n\nPlease try again/something else or request further instructions.`,
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
    }
  },
);
