// Importing a bunch of tokenizers can be very resource intensive (MB-scale per tokenizer)
// Using token counting APIs (e.g. for anthropic) can be complicated and unreliable in many environments
// So for now we will just use super fast gpt-tokenizer and apply safety buffers
// I'm using rough estimates from this article to apply safety buffers to common tokenizers
// which will have HIGHER token counts than gpt. Roughly using token ratio from article + 10%
// https://medium.com/@disparate-ai/not-all-tokens-are-created-equal-7347d549af4d
const ANTHROPIC_TOKEN_MULTIPLIER = 1.23;
const GEMINI_TOKEN_MULTIPLIER = 1.18;
const MISTRAL_TOKEN_MULTIPLIER = 1.26;

/**
 * Adjusts token count based on model-specific tokenizer differences.
 * Since we use llama tokenizer (~= gpt tokenizer) for all models, we apply
 * multipliers for models known to have higher token counts.
 *
 * @param baseTokens - Token count from llama/gpt tokenizer
 * @param modelName - Name of the model
 * @returns Adjusted token count with safety buffer
 */
export function getAdjustedTokenCountFromModel(
  baseTokens: number,
  modelName: string,
): number {
  let multiplier = 1;
  const lowerModelName = modelName?.toLowerCase() ?? "";
  if (lowerModelName.includes("claude")) {
    multiplier = ANTHROPIC_TOKEN_MULTIPLIER;
  } else if (lowerModelName.includes("gemini")) {
    multiplier = GEMINI_TOKEN_MULTIPLIER;
  } else if (
    lowerModelName.includes("mistral") ||
    lowerModelName.includes("mixtral") ||
    lowerModelName.includes("codestral") ||
    lowerModelName.includes("devstral")
  ) {
    // Mistral family models: mistral, mixtral, codestral, devstral, etc
    multiplier = MISTRAL_TOKEN_MULTIPLIER;
  }
  return Math.ceil(baseTokens * multiplier);
}
