import {
  AssistantChatMessage,
  MessagePart,
  ToolCallState,
  UserChatMessage,
} from "../..";
import {
  normalizeToMessageParts,
  renderContextItems,
} from "../../util/messageContent";
import {
  CANCELLED_TOOL_CALL_MESSAGE,
  NO_TOOL_CALL_OUTPUT_MESSAGE,
} from "../constants";
function toolCallStateToSystemToolCall(state: ToolCallState): string {
  let parts = ["```tool"];
  parts.push(`TOOL_NAME: ${state.toolCall.function.name}`);
  try {
    for (const arg in state.parsedArgs) {
      parts.push(`BEGIN_ARG: ${arg}`);
      parts.push(JSON.stringify(state.parsedArgs[arg]));
      parts.push(`END_ARG`);
    }
  } catch (e) {
    console.log("Failed to stringify json args", state.parsedArgs);
  }
  // TODO - include tool call id for parallel. Confuses dumb models
  parts.push("```");
  return parts.join("\n");
}

function toolCallStateToSystemToolOutput(state: ToolCallState): string {
  let output = `Tool output for ${state.toolCall.function.name} tool call:\n\n`;
  // TODO - include tool call id for parallel. Confuses dumb models
  // let output = `Tool output for tool call ${state.toolCallId} (${state.toolCall.function.name}):\n\n`;
  if (state.status === "canceled") {
    output += CANCELLED_TOOL_CALL_MESSAGE;
  } else if (state.output?.length) {
    output += renderContextItems(state.output);
  } else {
    output += NO_TOOL_CALL_OUTPUT_MESSAGE;
  }
  return output;
}

export function convertToolCallStatesToSystemCallsAndOutput(
  originalAssistantMessage: AssistantChatMessage,
  toolCallStates: ToolCallState[],
): {
  assistantMessage: AssistantChatMessage;
  userMessage: UserChatMessage;
} {
  const parts = normalizeToMessageParts(originalAssistantMessage);
  if (originalAssistantMessage.toolCalls) {
    parts.push(
      ...toolCallStates.map((state) => ({
        type: "text" as const,
        text: toolCallStateToSystemToolCall(state),
      })),
    );
  }

  // new message with tool calls moved to content
  const assistantMessage: AssistantChatMessage = {
    ...originalAssistantMessage,
    content: parts,
    toolCalls: undefined, // remove tool calls from the assistant message
  };

  const userParts: MessagePart[] = [];
  if (toolCallStates) {
    for (const state of toolCallStates) {
      userParts.push({
        type: "text",
        text: toolCallStateToSystemToolOutput(state),
      });
    }
  }
  if (userParts.length === 0) {
    userParts.push({
      type: "text",
      text: "Error: no tool output for tool calls",
    });
  }

  const userMessage: UserChatMessage = {
    role: "user",
    content: userParts,
  };

  return {
    assistantMessage,
    userMessage,
  };
}
