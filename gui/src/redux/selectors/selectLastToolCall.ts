import { createSelector } from "@reduxjs/toolkit";
import { ToolCallState } from "core";
import { RootState } from "../store";

export const selectLastToolCall = createSelector(
  [(store: RootState) => store.state.history],
  (history): ToolCallState | null => {
    const lastToolCallHistoryItem = history.findLast(
      (item) =>
        item.message.role === "assistant" && item.message.toolCalls?.length,
    );
    if (!lastToolCallHistoryItem) return null;
    return lastToolCallHistoryItem.toolCallState;
  },
);
