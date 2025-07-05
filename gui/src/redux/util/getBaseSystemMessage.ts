import { ModelDescription, Tool } from "core";
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";
import { generateToolsSystemMessage } from "core/tools/systemMessageTools/buildXmlToolsSystemMessage";

export function getBaseSystemMessage(
  messageMode: string,
  model: ModelDescription,
  systemMessageTools: Tool[],
): string {
  if (messageMode === "agent") {
    let base = model.baseAgentSystemMessage ?? DEFAULT_AGENT_SYSTEM_MESSAGE;
    if (systemMessageTools.length > 0) {
      const toolsSystemMessage = generateToolsSystemMessage(systemMessageTools);
      base += `\n\n${toolsSystemMessage}`;
    }
    return base;
  } else {
    return model.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }
}
