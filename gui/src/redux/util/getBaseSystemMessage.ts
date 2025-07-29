import { ModelDescription } from "core";
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";

export function getBaseSystemMessage(
  messageMode: string,
  model: ModelDescription,
): string {
  if (messageMode === "agent") {
    return model.baseAgentSystemMessage ?? DEFAULT_AGENT_SYSTEM_MESSAGE;
  } else if (messageMode === "plan") {
    return model.basePlanSystemMessage ?? DEFAULT_PLAN_SYSTEM_MESSAGE;
  } else {
    return model.baseChatSystemMessage ?? DEFAULT_CHAT_SYSTEM_MESSAGE;
  }
}
