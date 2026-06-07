/**
 * Validates an Anthropic API key format
 * @param apiKey The API key to validate
 * @returns true if the API key is valid, false otherwise
 */
export function isValidAnthropicApiKey(
  apiKey: string | null | undefined,
): boolean {
  if (!apiKey || typeof apiKey !== "string") {
    return false;
  }

  // Anthropic API keys must start with "sk-ant-" and have additional characters
  return apiKey.startsWith("sk-ant-") && apiKey.length > "sk-ant-".length;
}

/**
 * Validates an OpenAI API key format
 * @param apiKey The API key to validate
 * @returns true if the API key is valid, false otherwise
 */
export function isValidOpenAIApiKey(
  apiKey: string | null | undefined,
): boolean {
  if (!apiKey || typeof apiKey !== "string") {
    return false;
  }

  return apiKey.startsWith("sk-") && apiKey.length > "sk-".length;
}

/**
 * Gets a user-friendly error message for invalid API keys
 * @param apiKey The API key that failed validation
 * @param provider The provider name (e.g., "Anthropic", "OpenAI")
 * @returns A descriptive error message
 */
export function getApiKeyValidationError(
  apiKey: string | null | undefined,
  provider: "anthropic" | "openai" = "anthropic",
): string {
  if (!apiKey || typeof apiKey !== "string") {
    return "API key is required";
  }

  if (provider === "anthropic") {
    if (!apiKey.startsWith("sk-ant-")) {
      return 'API key must start with "sk-ant-"';
    }

    if (apiKey.length <= "sk-ant-".length) {
      return "API key is too short";
    }
  } else if (provider === "openai") {
    if (!apiKey.startsWith("sk-")) {
      return 'API key must start with "sk-"';
    }

    if (apiKey.length <= "sk-".length) {
      return "API key is too short";
    }
  }

  return "Invalid API key format";
}
