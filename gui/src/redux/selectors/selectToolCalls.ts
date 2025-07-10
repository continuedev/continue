import { createSelector } from "@reduxjs/toolkit";
import { ToolStatus } from "core";
import { RootState } from "../store";
import {
  findAllCurToolCalls,
  findAllCurToolCallsByStatus,
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

// Convenience selectors for single tool calls
export const selectCurrentToolCall = createSelector(
  selectCurrentToolCalls,
  (toolCalls) => toolCalls[0] || undefined,
);

export const selectFirstPendingToolCall = createSelector(
  (store: RootState) => store.session.history,
  (history) => {
    const pendingToolCalls = findAllCurToolCallsByStatus(history, "generated");
    return pendingToolCalls[0] || undefined;
  },
);

// Apply state selectors
export const selectCurrentToolCallApplyState = createSelector(
  [
    selectCurrentToolCalls,
    (store: RootState) => store.session.codeBlockApplyStates,
  ],
  (toolCalls, applyStates) => {
    if (toolCalls.length === 0) {
      return undefined;
    }
    const firstToolCall = toolCalls[0];
    return applyStates.states.find(
      (state) => state.toolCallId === firstToolCall.toolCallId,
    );
  },
);

// Status-specific convenience selectors
export const selectPendingToolCalls = createSelector(
  (store: RootState) => store.session.history,
  (history) => findAllCurToolCallsByStatus(history, "generated"),
);
