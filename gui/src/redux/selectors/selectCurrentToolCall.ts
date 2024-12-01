import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { findCurrentToolCall } from "../util";

export const selectCurrentToolCall = createSelector(
  (store: RootState) => store.session.messages,
  (history) => {
    return findCurrentToolCall(history);
  },
);
