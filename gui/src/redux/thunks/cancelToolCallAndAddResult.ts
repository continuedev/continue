import { createAsyncThunk } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { findToolCall } from '../util';
import { RootState } from '../store';
import { ToolResultChatMessageWithId } from 'core';

/**
 * Thunk to handle cancellation of tool calls and add appropriate tool result messages
 */
export const cancelToolCallAndAddResult = createAsyncThunk(
  'session/cancelToolCallAndAddResult',
  async (toolCallId: string, { getState, dispatch }) => {
    const state = getState() as RootState;

    // Step 1: Find the tool call and update its status
    const toolCallState = findToolCall(
      state.session.history,
      toolCallId
    );

    if (!toolCallState) {
      console.warn(`No tool call found with ID: ${toolCallId}`);
      return;
    }

    // Step 2: Check if a tool result already exists for this call
    const hasToolResult = state.session.history.some(item =>
      item.message.role === "tool" &&
      item.message.toolCallId === toolCallId
    );

    if (hasToolResult) {
      console.log(`Tool result already exists for tool call ${toolCallId}`);
      return;
    }

    // Step 3: Create a new message object for the tool result
    const toolResultMessage = {
      message: {
        id: uuidv4(),
        role: "tool",
        content: "Tool use was cancelled.",
        toolCallId: toolCallId
      } as ToolResultChatMessageWithId,
      contextItems: [],
    };

    // Return the payload for the reducer
    return {
      toolCallId,
      toolResultMessage
    };
  }
);
