import { Middleware } from "@reduxjs/toolkit";
import { selectCurrentToolCall } from "../selectors/selectCurrentToolCall";
import { AppThunkDispatch, RootState } from "../store";
import { callCurrentTool } from "../thunks/callCurrentTool";

/**
 * Middleware that automatically executes tool calls when streaming completes.
 * This provides a deterministic, race-condition-free approach by executing
 * exactly when the Redux state transitions to inactive.
 */
export const toolCallMiddleware: Middleware<{}, RootState> =
  (store) => (next) => (action: any) => {
    const result = next(action);

    // Listen for when streaming becomes inactive
    if (action && action.type === "session/setInactive") {
      const state = store.getState();
      const toolCallState = selectCurrentToolCall(state);
      const toolSettings = state.ui.toolSettings;

      if (toolCallState?.status === "generated") {
        const toolName = toolCallState.toolCall.function.name;

        // Check if this tool should be auto-executed
        if (toolSettings[toolName] === "allowedWithoutPermission") {
          // Execute immediately - no delays needed since we're in the Redux action flow
          (store.dispatch as AppThunkDispatch)(callCurrentTool());
        }
      }
    }

    return result;
  };
