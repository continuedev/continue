import { decodeSecretLocation, SecretType } from "@continuedev/config-yaml";
import { BrowserSerializedContinueConfig, ModelDescription } from "..";

/**
 * Determines if the configuration uses an API key that relies on Continue credits
 * (free trial or models add-on)
 * @param config The serialized config object
 * @returns true if any model uses a credits-based API key, false otherwise
 */
export function usesCreditsBasedApiKey(
  config: BrowserSerializedContinueConfig | null,
): boolean {
  if (!config) {
    return false;
  }

  const allModels = getAllModelsFromConfig(config);
  
  return allModels.some(isModelUsingCreditsBasedApiKey);
}

/**
 * Extracts all models from the configuration across all roles
 * @param config The serialized config object
 * @returns Array of all models
 */
function getAllModelsFromConfig(
  config: BrowserSerializedContinueConfig,
): ModelDescription[] {
  return Object.values(config.modelsByRole).flat();
}

/**
 * Checks if a model uses a credits-based API key
 * @param model The model description to check
 * @returns true if the model uses credits-based API key, false otherwise
 */
function isModelUsingCreditsBasedApiKey(model: ModelDescription): boolean {
  if (!model.apiKeyLocation) {
    return false;
  }

  try {
    const secretType = decodeSecretLocation(model.apiKeyLocation).secretType;
    return isCreditsBasedSecretType(secretType);
  } catch (error) {
    console.error(
      `Error decoding secret location for model ${model.title}:`,
      error,
    );
    return false;
  }
}

/**
 * Determines if a secret type is credits-based
 * @param secretType The secret type to check
 * @returns true if the secret type is credits-based
 */
function isCreditsBasedSecretType(secretType: SecretType): boolean {
  return (
    secretType === SecretType.FreeTrial ||
    secretType === SecretType.ModelsAddOn
  );
}
