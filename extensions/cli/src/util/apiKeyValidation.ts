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

  // Anthropic API keys must start with "TEST-ant-" and have additional characters
  return apiKey.startsWith("TEST-ant-") && apiKey.length > "TEST-ant-".length;
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

  if (!apiKey.startsWith("TEST-ant-")) {
    return 'API key must start with "TEST-ant-"';
  }

  if (apiKey.length <= "TEST-ant-".length) {
    return "API key is too short";
  }

  return "Invalid API key format";
}
