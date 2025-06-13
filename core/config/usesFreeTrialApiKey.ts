import { decodeSecretLocation, SecretType } from "@continuedev/config-yaml";
import { BrowserSerializedContinueConfig } from "..";

/**
 * Helper function to determine if the config uses a free trial API key
 * @param config The serialized config object
 * @returns true if the config is using any free trial models
 */
export function usesFreeTrialApiKey(
  config: BrowserSerializedContinueConfig | null,
): boolean {
  if (!config) {
    return false;
  }

  // Check if the currently selected chat model uses free-trial provider
  const modelsByRole = config.modelsByRole;
  const allModels = [...Object.values(modelsByRole)].flat();

  // Check if any of the chat models use free-trial provider
  try {
    const hasFreeTrial = allModels?.some(
      (model) =>
        model.apiKeyLocation &&
        decodeSecretLocation(model.apiKeyLocation).secretType ===
          SecretType.FreeTrial,
    );

    return hasFreeTrial;
  } catch (e) {
    console.error("Error checking for free trial API key:", e);
  }

  return false;
}
