/**
 * Determines if a model is recommended for use with `cn`
 */
export function isModelCapable(provider: string, model: string): boolean {
  const normalizedModel = model.toLowerCase();

  if (
    [/gemini/, /claude/, /gpt/, /o\d/g, /kimi/, /qwen/].some((pattern) =>
      pattern.test(normalizedModel)
    )
  ) {
    return true;
  }

  return false;
}
