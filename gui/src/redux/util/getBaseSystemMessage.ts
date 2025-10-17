import { ModelDescription, Tool } from "core";
import { DEFAULT_AWS_SDK_EXPERT_SYSTEM_MESSAGE } from "core/llm/defaultSystemMessages";

export const NO_TOOL_WARNING =
  "\n\nTHE USER HAS NOT PROVIDED ANY TOOLS, DO NOT ATTEMPT TO USE ANY TOOLS. STOP AND LET THE USER KNOW THAT THERE ARE NO TOOLS AVAILABLE. The user can provide tools by enabling them in the Tool Policies section of the notch (wrench icon)";

export function getBaseSystemMessage(
  messageMode: string,
  model: ModelDescription,
  activeTools?: Tool[],
): string {
  // Always use AWS SDK Expert system message since it's the only mode
  let baseMessage = DEFAULT_AWS_SDK_EXPERT_SYSTEM_MESSAGE;

  // Add no-tools warning when no tools are available
  if (!activeTools || activeTools.length === 0) {
    baseMessage += NO_TOOL_WARNING;
  }

  return baseMessage;
}
