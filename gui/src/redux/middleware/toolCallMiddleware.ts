import { Middleware, unwrapResult } from "@reduxjs/toolkit";
import { selectCurrentToolCalls } from "../selectors/selectToolCalls";
import { setToolGenerated } from "../slices/sessionSlice";
import { AppThunkDispatch, RootState } from "../store";
import { callToolById } from "../thunks/callToolById";

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
      const toolSettings = state.ui.toolSettings;
      const allToolCallStates = selectCurrentToolCalls(state);

      // Only process tool calls that are in "generating" status (newly created during this streaming session)
      const toolCallStates = allToolCallStates.filter(
        (toolCallState) => toolCallState.status === "generating",
      );

      // If no generating tool calls, nothing to process
      if (toolCallStates.length === 0) {
        return result;
      }

      // Check if ALL tool calls are auto-approved - if not, wait for user approval
      const allAutoApproved = toolCallStates.every(
        (toolCallState) =>
          toolSettings[toolCallState.toolCall.function.name] ===
          "allowedWithoutPermission",
      );

      // Set all tools as generated first
      toolCallStates.forEach((toolCallState) => {
        (store.dispatch as AppThunkDispatch)(
          setToolGenerated({
            toolCallId: toolCallState.toolCallId,
            tools: state.config.config.tools,
          }),
        );
      });

      // Only run if we have auto-approve for all
      if (allAutoApproved && toolCallStates.length > 0) {
        // Execute all tool calls in parallel
        const toolCallPromises = toolCallStates.map(async (toolCallState) => {
          const response = await (store.dispatch as AppThunkDispatch)(
            callToolById({ toolCallId: toolCallState.toolCallId }),
          );
          unwrapResult(response);
        });

        Promise.all(toolCallPromises).catch((error) => {
          console.error("Error executing parallel tool calls:", error);
        });
      }
    }

    return result;
  };
