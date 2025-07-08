import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { findCurrentToolCalls, hasCurrentToolCalls, findCurrentToolCallsByStatus } from "../util";

// New selectors for parallel tool call support
export const selectCurrentToolCalls = createSelector(
  (store: RootState) => store.session.history,
  (history) => {
    return findCurrentToolCalls(history);
  },
);

export const selectHasCurrentToolCalls = createSelector(
  (store: RootState) => store.session.history,
  (history) => {
    return hasCurrentToolCalls(history);
  },
);

export const selectCurrentToolCallsByStatus = createSelector(
  [
    (store: RootState) => store.session.history,
    (store: RootState, status: string) => status,
  ],
  (history, status) => {
    return findCurrentToolCallsByStatus(history, status);
  },
);

// Legacy selector - returns first tool call for backward compatibility
// This will eventually be removed when all usages are migrated
export const selectCurrentToolCall = createSelector(
  (store: RootState) => store.session.history,
  (history) => {
    const toolCalls = findCurrentToolCalls(history);
    return toolCalls.length > 0 ? toolCalls[0] : undefined;
  },
);

export const selectCurrentToolCallApplyState = createSelector(
  [
    (store: RootState) => store.session.history,
    (store: RootState) => store.session.codeBlockApplyStates,
  ],
  (history, applyStates) => {
    const toolCalls = findCurrentToolCalls(history);
    if (toolCalls.length === 0) {
      return undefined;
    }
    // For now, return apply state for first tool call
    // TODO: Handle multiple apply states for parallel tool calls
    const firstToolCall = toolCalls[0];
    return applyStates.states.find(
      (state) =>
        state.toolCallId && state.toolCallId === firstToolCall.toolCallId,
    );
  },
);
