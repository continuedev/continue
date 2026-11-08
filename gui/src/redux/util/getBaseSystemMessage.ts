import { ModelDescription, Tool } from "core";
import {
  agentSystemMessageFor,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  planSystemMessageFor,
} from "core/llm/defaultSystemMessages";

export const NO_TOOL_WARNING =
  "\n\nTHE USER HAS NOT PROVIDED ANY TOOLS, DO NOT ATTEMPT TO USE ANY TOOLS. STOP AND LET THE USER KNOW THAT THERE ARE NO TOOLS AVAILABLE. The user can provide tools by enabling them in the Tool Policies section of the notch (wrench icon)";

export function getBaseSystemMessage(
  messageMode: string,
  model: ModelDescription,
  activeTools?: Tool[],
): string {
  let baseMessage: string;

  // The model's own text wins; otherwise the turn text its prompt profile
  // selects (short for Qwen, full elsewhere; core/llm/prompts/turns.ts).
  if (messageMode === "agent") {
    baseMessage =
      model.baseAgentSystemMessage ?? agentSystemMessageFor(model.model);
  } else if (messageMode === "plan") {
    baseMessage =
      model.basePlanSystemMessage ?? planSystemMessageFor(model.model);
  } else {
    baseMessage = model.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }

  // Add no-tools warning for agent/plan modes when no tools are available
  if (messageMode !== "chat" && (!activeTools || activeTools.length === 0)) {
    baseMessage += NO_TOOL_WARNING;
  }

  return baseMessage;
}
