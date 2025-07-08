import { ToolCallDelta, ToolCallState } from "core";
import { incrementalParseJson } from "core/util/incrementalParseJson";

// Merge streamed tool calls
// See example of data coming in here:
// https://platform.openai.com/docs/guides/function-calling?api-mode=chat#streaming
export function addToolCallDeltaToState(
  toolCallDelta: ToolCallDelta,
  currentState: ToolCallState | undefined,
): ToolCallState {
  // For parallel tool calls, we no longer ignore new tool call IDs
  // Each tool call delta should be processed separately
  // This preserves backward compatibility for single tool calls
  if (
    toolCallDelta.id &&
    currentState?.toolCallId &&
    toolCallDelta.id !== currentState?.toolCallId
  ) {
    // For parallel tool calls, we should create a new state for the new tool call
    // instead of ignoring it, but for now we'll return the current state to maintain
    // backward compatibility. The parallel logic will be handled at a higher level.
    return currentState;
  }

  const currentCall = currentState?.toolCall;

  // These will/should not be partially streamed
  const callType = toolCallDelta.type ?? "function";
  const callId = currentCall?.id || toolCallDelta.id || "";

  // These may be streamed in chunks
  const currentName = currentCall?.function.name ?? "";
  const currentArgs = currentCall?.function.arguments ?? "";

  const nameDelta = toolCallDelta.function?.name ?? "";
  const argsDelta = toolCallDelta.function?.arguments ?? "";

  let mergedName = currentName;
  if (nameDelta.startsWith(currentName)) {
    // Case where model progresssively streams name but full name each time e.g. "readFi" -> "readFil" -> "readFile"
    mergedName = nameDelta;
  } else if (currentName.startsWith(nameDelta)) {
    // Case where model streams in full name each time e.g. readFile -> readFile -> readFile
    // do nothing
  } else {
    // Case where model streams in name in parts e.g. "read" -> "File"
    mergedName = currentName + nameDelta;
  }

  const mergedArgs = currentArgs + argsDelta;

  const [_, parsedArgs] = incrementalParseJson(mergedArgs || "{}");

  return {
    status: "generating",
    toolCall: {
      id: callId,
      type: callType,
      function: {
        name: mergedName,
        arguments: mergedArgs,
      },
    },
    toolCallId: callId,
    parsedArgs,
  };
}
