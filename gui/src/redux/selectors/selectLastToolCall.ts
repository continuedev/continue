import { createSelector } from "@reduxjs/toolkit";
import { ToolCallState } from "core";
import { RootState } from "../store";

export const selectLastToolCall = createSelector(
  [(store: RootState) => store.session.history],
  (history): ToolCallState | null => {
    let lastToolCallHistoryItem = null;
    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i];
      if (item.message.role === "assistant" && item.message.toolCalls?.length) {
        lastToolCallHistoryItem = item;
        break;
      }
    }
    if (!lastToolCallHistoryItem) return null;
    return lastToolCallHistoryItem.toolCallState;
  },
);
