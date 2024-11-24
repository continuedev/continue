import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { findLastToolCall } from "../util";

export const selectLastToolCall = createSelector(
  (store: RootState) => store.state.history,
  (history) => {
    return findLastToolCall(history);
  },
);
