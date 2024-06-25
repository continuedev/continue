import { SerializedContinueConfig } from "..";
import { ControlPlaneSettings } from "./client";

export function applySettingsToSerializedConfig(
  serializedConfig: SerializedContinueConfig,
  controlPlaneSettings: ControlPlaneSettings,
): SerializedContinueConfig {
  const newConfig: SerializedContinueConfig = {
    ...serializedConfig,
    models: [
      ...(controlPlaneSettings.models ?? []),
      ...serializedConfig.models,
    ],
    embeddingsProvider:
      controlPlaneSettings.embeddingsProvider ??
      serializedConfig.embeddingsProvider,
    reranker: controlPlaneSettings.reranker ?? serializedConfig.reranker,
    tabAutocompleteModel:
      controlPlaneSettings.tabAutocompleteModel ??
      serializedConfig.tabAutocompleteModel,
  };

  return newConfig;
}
