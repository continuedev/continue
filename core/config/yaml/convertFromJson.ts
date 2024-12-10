import { ModelConfig } from "@continuedev/config-yaml";
import { ConfigYaml } from "@continuedev/config-yaml/dist/schemas";

import { SerializedContinueConfig } from "../..";

export function convertConfigJsonToConfigYaml(
  configJson: SerializedContinueConfig,
): ConfigYaml {
  return {
    name: "Local Config",
    models: [
      ...configJson.models.map(
        (model): ModelConfig => ({
          model: model.model,
          name: model.title,
          // defaultCompletionOptions: model.completionOptions,
          provider: model.provider,
          roles: ["chat"],
        }),
      ),
      //   ... tabAutocompleteModels
      // embeddingsModels
      // rerankModels
    ],
    context: configJson.contextProviders?.map((provider) => ({
      uses: provider.name,
      with: provider.params,
    })),
  };
}
