import { SDK_CONFIG } from "./sdkConfig";

/**
 * Replace template variables in system messages with actual values
 * @param message - The system message containing template variables (e.g., {{SDK_NAME}})
 * @returns The message with all template variables replaced with actual values
 */
export function replaceSystemMessageVariables(message: string): string {
  return message.replace(/\{\{SDK_NAME\}\}/g, SDK_CONFIG.SDK_NAME);
}
