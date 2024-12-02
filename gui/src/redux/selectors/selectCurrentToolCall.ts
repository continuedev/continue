import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { findCurrentToolCall } from "../util";

export const selectCurrentToolCall = createSelector(
  (store: RootState) => store.session.history,
  (history) => {
    return findCurrentToolCall(history);
  },
);
