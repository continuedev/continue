import { unwrapResult } from "@reduxjs/toolkit";
import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { selectCurrentToolCall } from "../redux/selectors/selectCurrentToolCall";
import { callCurrentTool } from "../redux/thunks/callCurrentTool";

/**
 * Hook that watches for completed streaming and ready tool calls,
 * then automatically triggers tool execution when appropriate.
 * This prevents race conditions between streaming completion and tool call processing.
 */
export const useToolCallTrigger = () => {
  const dispatch = useAppDispatch();
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const toolCallState = useAppSelector(selectCurrentToolCall);
  const toolSettings = useAppSelector((state) => state.ui.toolSettings);
  const wasStreamingRef = useRef(false);
  const executingRef = useRef(false);

  useEffect(() => {
    // Track streaming state changes
    if (isStreaming) {
      wasStreamingRef.current = true;
    }
  }, [isStreaming]);

  useEffect(() => {
    // Only trigger when streaming has stopped and we have a ready tool call
    // Also ensure we actually transitioned from streaming to not streaming
    if (!isStreaming && wasStreamingRef.current && toolCallState?.status === "generated") {
      // Check if it should auto-execute based on user settings
      const toolName = toolCallState.toolCall.function.name;
      if (toolSettings[toolName] === "allowedWithoutPermission") {
        // Reset the streaming flag
        wasStreamingRef.current = false;
        
        // Prevent multiple concurrent executions
        if (executingRef.current) {
          console.warn("Tool call already executing, skipping");
          return;
        }
        
        // Use a minimal delay to ensure state is settled but prevent overlapping streams
        const timeoutId = setTimeout(() => {
          if (executingRef.current) {
            console.warn("Tool call already executing, skipping delayed execution");
            return;
          }
          
          executingRef.current = true;
          
          dispatch(callCurrentTool())
            .then(unwrapResult)
            .catch((error) => {
              console.error("Failed to execute tool call:", error);
            })
            .finally(() => {
              executingRef.current = false;
            });
        }, 50); // Reduced delay to minimize time window for concurrency issues

        return () => clearTimeout(timeoutId);
      }
      // If not auto-allowed, the tool call will remain in "generated" state
      // and wait for user approval in the UI
    }
  }, [isStreaming, toolCallState?.status, toolCallState?.toolCallId, toolSettings, dispatch]);
};
