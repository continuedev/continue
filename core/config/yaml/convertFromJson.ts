import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";

import { SerializedContinueConfig } from "../..";

export function convertConfigJsonToConfigYaml(
  configJson: SerializedContinueConfig,
): AssistantUnrolled {
  return {
    name: "Local Assistant",
    version: "1.0.0",
    schema: "v1",
    models: [
      ...configJson.models.map(
        (model): ModelConfig => ({
          model: model.model,
          name: model.title,
          // defaultCompletionOptions: model.completionOptions,
          provider: model.provider,
          roles: ["chat", "edit", "apply", "summarize"],
        }),
      ),
      // TODO
      // tabAutocompleteModels
      // embeddingsModels
      // rerankModels
    ],
    context: configJson.contextProviders?.map((provider) => ({
      provider: provider.name,
      params: provider.params,
    })),
  };
}
