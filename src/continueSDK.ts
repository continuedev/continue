import { Continue, ContinueClient } from "@continuedev/sdk";
import { env } from "./env.js";
import chalk from "chalk";

/**
 * Initialize the Continue SDK with the given parameters
 * @param apiKey - API key to use for authentication
 * @param assistantSlug - Slug of the assistant to use
 * @param organizationId - Optional organization ID
 * @returns Promise resolving to the Continue SDK instance
 */
export async function initializeContinueSDK(
  apiKey: string | undefined,
  assistantSlug: string,
  organizationId?: string
): Promise<ContinueClient> {
  if (!apiKey) {
    console.error(chalk.red("Error: No API key provided for Continue SDK"));
    throw new Error("No API key provided for Continue SDK");
  }

  try {
    return await Continue.from({
      apiKey,
      assistant: assistantSlug,
      organizationId,
      baseURL: env.apiBase,
    });
  } catch (error) {
    console.error(
      chalk.red("Error initializing Continue SDK:"),
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}
