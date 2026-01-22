import { createSelector } from "@reduxjs/toolkit";
import { ToolStatus } from "core";
import { RootState } from "../store";
import {
  findAllCurToolCalls,
  findAllCurToolCallsByStatus,
  findToolCallById,
  hasCurrentToolCalls,
} from "../util";

// Primary selectors for tool calls
export const selectCurrentToolCalls = createSelector(
  (store: RootState) => store.session.history,
  (history) => findAllCurToolCalls(history),
);

export const selectHasCurrentToolCalls = createSelector(
  (store: RootState) => store.session.history,
  (history) => hasCurrentToolCalls(history),
);

export const selectToolCallsByStatus = createSelector(
  [
    (store: RootState) => store.session.history,
    (_store: RootState, status: ToolStatus) => status,
  ],
  (history, status) => findAllCurToolCallsByStatus(history, status),
);

export const selectFirstPendingToolCall = createSelector(
  (store: RootState) => store.session.history,
  (history) => {
    const pendingToolCalls = findAllCurToolCallsByStatus(history, "generated");
    return pendingToolCalls[0] || undefined;
  },
);

// ID-based selectors for specific tool calls
export const selectToolCallById = createSelector(
  [
    (store: RootState) => store.session.history,
    (_store: RootState, toolCallId: string) => toolCallId,
  ],
  (history, toolCallId) => findToolCallById(history, toolCallId),
);

export const selectApplyStateByToolCallId = createSelector(
  [
    (store: RootState) => store.session.codeBlockApplyStates,
    (_store: RootState, toolCallId: string) => toolCallId,
  ],
  (applyStates, toolCallId) => {
    return applyStates.states.findLast(
      (state) => state.toolCallId === toolCallId,
    );
  },
);

// Status-specific convenience selectors
export const selectPendingToolCalls = createSelector(
  (store: RootState) => store.session.history,
  (history) => findAllCurToolCallsByStatus(history, "generated"),
);

export const selectDoneApplyStates = createSelector(
  (store: RootState) => store.session.codeBlockApplyStates.states,
  (states) => states.filter((applyState) => applyState.status === "done"),
);
