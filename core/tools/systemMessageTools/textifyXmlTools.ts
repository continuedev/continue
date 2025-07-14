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
function toolCallStateToSystemToolCall(state: ToolCallState): string {
  let parts = ["```tool"];
  parts.push(`TOOL_NAME: ${state.toolCall.function.name}`);
  try {
    for (const arg of state.parsedArgs) {
      parts.push(`BEGIN_ARG: ${arg}`);
      parts.push(JSON.stringify(state.parsedArgs[arg]));
      parts.push(`END_ARG`);
    }
  } catch (e) {}
  // TODO - include tool call id for parrallel. Confuses dumb models
  parts.push("```");
  return parts.join("\n");
}
export function convertToolCallStateToXmlCallsAndOutput(
  originalAssistantMessage: AssistantChatMessage,
  toolCallState: ToolCallState,
): {
  assistantMessage: AssistantChatMessage;
  userMessage: UserChatMessage;
} {
  const parts = normalizeToMessageParts(originalAssistantMessage);
  if (toolCallState) {
    const toolCallParts: MessagePart[] = [
      {
        type: "text",
        text: toolCallStateToSystemToolCall(toolCallState),
      },
    ];
    parts.push(...toolCallParts);
  }

  // new message with tool calls moved to content
  const assistantMessage: AssistantChatMessage = {
    ...originalAssistantMessage,
    content: parts,
    toolCalls: undefined, // remove tool calls from the assistant message
  };

  let toolResultContent = `Tool output for tool call ${toolCallState.toolCallId} (${toolCallState.toolCall.function.name}):\n\n`;
  if (toolCallState.output?.length) {
    toolResultContent += renderContextItems(toolCallState.output);
  } else {
    toolResultContent += "No output";
  }
  const userMessage: UserChatMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: toolResultContent,
      },
    ],
  };

  return {
    assistantMessage,
    userMessage,
  };
}
