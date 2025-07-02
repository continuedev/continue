import { XMLBuilder } from "fast-xml-parser";
import {
  AssistantChatMessage,
  ToolCallDelta,
  ToolCallState,
  UserChatMessage,
} from "../..";
import {
  normalizeToMessageParts,
  renderContextItems,
} from "../../util/messageContent";
function toolCallsToXml(toolCall: ToolCallDelta) {
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    suppressEmptyNode: true,
  });
  return builder.build({
    name: toolCall.function?.name,
    id: toolCall.id,
    args: toolCall.function?.arguments,
  });
}
export function convertToolCallStateToXmlCallsAndOutput(
  originalAssistantMessage: AssistantChatMessage,
  toolCallState: ToolCallState,
): {
  assistantMessage: AssistantChatMessage;
  userMessage: UserChatMessage;
} {
  const parts = normalizeToMessageParts(originalAssistantMessage);
  if (originalAssistantMessage.toolCalls?.length) {
    parts.push(...originalAssistantMessage.toolCalls.map(toolCallsToXml));
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
