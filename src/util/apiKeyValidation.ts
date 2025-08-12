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
 * Gets a user-friendly error message for invalid API keys
 * @param apiKey The API key that failed validation
 * @returns A descriptive error message
 */
export function getApiKeyValidationError(
  apiKey: string | null | undefined,
): string {
  if (!apiKey || typeof apiKey !== "string") {
    return "API key is required";
  }

  if (!apiKey.startsWith("sk-ant-")) {
    return 'API key must start with "sk-ant-"';
  }

  if (apiKey.length <= "sk-ant-".length) {
    return "API key is too short";
  }

  return "Invalid API key format";
}
