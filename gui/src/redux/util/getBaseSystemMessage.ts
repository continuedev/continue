import { ModelDescription, Tool } from "core";
import {
  DEFAULT_AWS_SDK_EXPERT_SYSTEM_MESSAGE,
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_PLAN_SYSTEM_MESSAGE,
} from "core/llm/defaultSystemMessages";

export const NO_TOOL_WARNING =
  "\n\nTHE USER HAS NOT PROVIDED ANY TOOLS, DO NOT ATTEMPT TO USE ANY TOOLS. STOP AND LET THE USER KNOW THAT THERE ARE NO TOOLS AVAILABLE. The user can provide tools by enabling them in the Tool Policies section of the notch (wrench icon)";

/**
 * Helper to extract behavioral rules from mode prompts
 */
function extractModeRules(modePrompt: string): string {
  // Extract content between <important_rules> tags
  const match = modePrompt.match(
    /<important_rules>([\s\S]*?)<\/important_rules>/,
  );
  if (match && match[1]) {
    return `<mode_behavior>${match[1].trim()}</mode_behavior>`;
  }
  return "";
}

export function getBaseSystemMessage(
  messageMode: string,
  model: ModelDescription,
  activeTools?: Tool[],
): string {
  // Start with AWS SDK Expert as the base for all modes
  let baseMessage = DEFAULT_AWS_SDK_EXPERT_SYSTEM_MESSAGE;

  // Inject mode-specific behavior on top of AWS SDK Expert context
  switch (messageMode) {
    case "plan":
      baseMessage += "\n\n" + extractModeRules(DEFAULT_PLAN_SYSTEM_MESSAGE);
      break;
    case "agent":
      baseMessage += "\n\n" + extractModeRules(DEFAULT_AGENT_SYSTEM_MESSAGE);
      break;
    default:
      // Default to agent behavior if mode is unrecognized
      baseMessage += "\n\n" + extractModeRules(DEFAULT_AGENT_SYSTEM_MESSAGE);
  }

  // Add no-tools warning when no tools are available
  if (!activeTools || activeTools.length === 0) {
    baseMessage += NO_TOOL_WARNING;
  }

  return baseMessage;
}
