import { createAsyncThunk } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { cancelToolCallAndAddResult } from './cancelToolCallAndAddResult';
import { removeLastHistoryItem, removeHistoryItemById } from '../slices/sessionSlice';
import { ToolResultChatMessage } from 'core';

/**
 * Thunk to handle cleaning up empty responses and managing tool call results
 */
export const clearLastEmptyResponse = createAsyncThunk(
  'session/clearLastEmptyResponse',
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const history = state.session.history;

    if (history.length < 2) {
      return;
    }

    const lastItem = history[history.length - 1];

    // Handle empty assistant/thinking messages
    if (lastItem.message.role === "assistant" || lastItem.message.role === "thinking") {
      dispatch(removeLastHistoryItem());
      return;
    }

    // Handle tool calls without results
    const toolCalls = history.filter(
      item => item.message.role === "assistant" && item.message.toolCalls
    );

    // Process each tool call that needs a result message
    for (const toolCall of toolCalls) {
      const toolCallId = toolCall.toolCallState?.toolCallId;
      if (!toolCallId) continue;

      const hasResult = history.some(
        item => item.message.role === "tool" && item.message.toolCallId === toolCallId
      );

      if (!hasResult) {
        await dispatch(cancelToolCallAndAddResult(toolCallId));
      }
    }

    // Clean up orphaned tool results
    const toolResults = history.filter(item => item.message.role === "tool");
    for (const result of toolResults) {
      const toolCallId = (result.message as ToolResultChatMessage).toolCallId;
      if (!toolCallId) continue;

      const hasToolCall = history.some(
        item => item.message.role === "assistant" &&
               item.toolCallState?.toolCallId === toolCallId
      );

      if (!hasToolCall) {
        dispatch(removeHistoryItemById(result.message.id));
      }
    }
  }
);