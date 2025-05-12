import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { findCurrentToolCall } from "../util";

export const selectCurrentToolCall = createSelector(
  (store: RootState) => store.session.history,
  (history) => {
    return findCurrentToolCall(history);
  },
);

export const selectCurrentToolCallApplyState = createSelector(
  [
    (store: RootState) => store.session.history,
    (store: RootState) => store.session.codeBlockApplyStates,
  ],
  (history, applyStates) => {
    const currentToolCall = findCurrentToolCall(history);
    if (!currentToolCall) {
      return undefined;
    }
    return applyStates.states.find(
      (state) =>
        state.toolCallId && state.toolCallId === currentToolCall.toolCallId,
    );
  },
);
