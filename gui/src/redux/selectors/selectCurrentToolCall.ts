import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { findCurrentToolCall } from "../util";

export const selectCurrentToolCall = createSelector(
  (store: RootState) => store.state.history,
  (history) => {
    return findCurrentToolCall(history);
  },
);
