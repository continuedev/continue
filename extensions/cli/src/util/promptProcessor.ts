import { processPromptOrRule } from "../args.js";

import { logger } from "./logger.js";

/**
 * Process additional prompts from --prompt flags and combine with initial prompt
 * @param additionalPrompts - Array of prompt specifications to process
 * @param initialPrompt - Optional initial prompt to combine with
 * @returns Combined prompt string or undefined if no prompts
 */
export async function processAndCombinePrompts(
  additionalPrompts?: string[],
  initialPrompt?: string,
): Promise<string | undefined> {
  if (!additionalPrompts || additionalPrompts.length === 0) {
    return initialPrompt;
  }

  const processedPrompts: string[] = [];

  for (const promptSpec of additionalPrompts) {
    try {
      const processed = await processPromptOrRule(promptSpec);
      processedPrompts.push(processed);
    } catch (error: any) {
      logger.warn(`Failed to process prompt "${promptSpec}": ${error.message}`);
    }
  }

  if (processedPrompts.length === 0) {
    return initialPrompt;
  }

  const combinedPrompts = processedPrompts.join("\n\n");
  return initialPrompt
    ? `${combinedPrompts}\n\n${initialPrompt}`
    : combinedPrompts;
}
