import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";

import { logger } from "./logger.js";

/**
 * Generate a descriptive branch name using an LLM based on a user prompt
 * Returns a kebab-case branch name without random suffix
 */
export async function generateBranchName(
  llmApi: BaseLlmApi,
  prompt: string,
): Promise<string> {
  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a helpful assistant that generates concise, descriptive git branch names. " +
          "Generate a short kebab-case branch name (e.g., 'fix-login-bug', 'add-user-profile') based on the user's prompt. " +
          "The name should be 2-5 words maximum, lowercase, and use hyphens. " +
          "Do not include prefixes like 'feature/', 'fix/', etc. " +
          "Only respond with the branch name, nothing else.",
      },
      {
        role: "user",
        content: `Generate a git branch name for this task: ${prompt}`,
      },
    ];

    logger.debug("Generating branch name with LLM", {
      promptLength: prompt.length,
    });

    const response = await llmApi.chatCompletion({
      model: "gpt-4", // This will be overridden by the actual model config
      messages,
      temperature: 0.7,
      max_tokens: 50,
    });

    let branchName =
      response.choices?.[0]?.message?.content?.trim() || "ai-generated-branch";

    // Clean up the branch name
    branchName = branchName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-") // Replace non-alphanumeric chars with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length

    logger.debug("Generated branch name", { branchName });

    return branchName;
  } catch (error) {
    logger.error("Failed to generate branch name with LLM", error);
    // Fallback to a simple timestamp-based name
    return "ai-task";
  }
}

/**
 * Generate a full branch name with random suffix
 * Format: <llm-generated-name>-<4-random-digits>
 */
export async function generateBranchNameWithSuffix(
  llmApi: BaseLlmApi,
  prompt: string,
): Promise<string> {
  const baseName = await generateBranchName(llmApi, prompt);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4 random digits
  return `${baseName}-${randomSuffix}`;
}
