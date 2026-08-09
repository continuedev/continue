/**
 * Determines if a model is recommended for use with `cn`
 */
export function isModelCapable(
  provider: string,
  name: string,
  model?: string,
): boolean {
  // Check both name and model properties
  const normalizedName = name.toLowerCase();
  const normalizedModel = model ? model.toLowerCase() : "";

  const patterns = [
    /gemini/,
    /claude/,
    /gpt/,
    /o\d/,
    /kimi/,
    /qwen/,
    /llama/,
    /nemotron/,
    /grok/,
    /mistral/,
  ];

  // If either name OR model matches any of the patterns, consider it capable
  if (patterns.some((pattern) => pattern.test(normalizedName))) {
    return true;
  }

  if (model && patterns.some((pattern) => pattern.test(normalizedModel))) {
    return true;
  }

  return false;
}
