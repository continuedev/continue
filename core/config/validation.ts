import { ConfigValidationError } from "@continuedev/config-yaml";

import { ModelDescription, SerializedContinueConfig } from "../";
import { Telemetry } from "../util/posthog";

/**
 * Validates a SerializedContinueConfig object to ensure all properties are correctly formed.
 * @param config The configuration object to validate.
 * @returns An array of error messages if there are any. Otherwise, the config is valid.
 */
export function validateConfig(config: SerializedContinueConfig) {
  const errors: ConfigValidationError[] = [];

  // Validate chat models
  if (!Array.isArray(config.models)) {
    errors.push({
      fatal: true,
      message: "The 'models' field should be an array.",
    });
  } else {
    config.models.forEach((model, index) => {
      if (typeof model.title !== "string" || model.title.trim() === "") {
        errors.push({
          fatal: true,
          message: `Model at index ${index} has an invalid or missing 'title'.`,
        });
      }
      if (typeof model.provider !== "string") {
        errors.push({
          fatal: true,
          message: `Model at index ${index} has an invalid 'provider'.`,
        });
      }

      if (model.contextLength && model.completionOptions?.maxTokens) {
        const difference =
          model.contextLength - model.completionOptions.maxTokens;

        if (difference < 1000) {
          errors.push({
            fatal: false,
            message: `Model "${model.title}" has a contextLength of ${model.contextLength} and a maxTokens of ${model.completionOptions.maxTokens}. This leaves only ${difference} tokens for input context and will likely result in your inputs being truncated.`,
          });
        }
      }
    });
  }

  // Validate tab autocomplete model(s)
  if (config.tabAutocompleteModel) {
    function validateTabAutocompleteModel(modelDescription: ModelDescription) {
      const modelName = modelDescription.model.toLowerCase();
      const nonAutocompleteModels = [
        // "gpt",
        // "claude",
        "mistral",
        "instruct",
      ];

      if (
        nonAutocompleteModels.some((m) => modelName.includes(m)) &&
        !modelName.includes("deepseek") &&
        !modelName.includes("codestral") &&
        !modelName.toLowerCase().includes("coder")
      ) {
        errors.push({
          fatal: false,
          message: `${modelDescription.model} is not trained for tab-autocomplete, and will result in low-quality suggestions. See the docs to learn more about why: https://docs.continue.dev/features/tab-autocomplete#i-want-better-completions-should-i-use-gpt-4`,
        });
      }
    }

    if (Array.isArray(config.tabAutocompleteModel)) {
      config.tabAutocompleteModel.forEach(validateTabAutocompleteModel);
    } else {
      validateTabAutocompleteModel(config.tabAutocompleteModel);
    }
  }

  // Validate slashCommands
  if (config.slashCommands) {
    if (!Array.isArray(config.slashCommands)) {
      errors.push({
        fatal: true,
        message: "The 'slashCommands' field should be an array if defined.",
      });
    } else {
      config.slashCommands.forEach((command, index) => {
        if (typeof command.name !== "string" || command.name.trim() === "") {
          errors.push({
            fatal: true,
            message: `Slash command at index ${index} has an invalid or missing 'name'.`,
          });
        }
        if (typeof command.description !== "string") {
          errors.push({
            fatal: true,
            message: `Slash command at index ${index} has an invalid or missing 'description'.`,
          });
        }
      });
    }
  }

  // Validate contextProviders
  if (config.contextProviders) {
    if (!Array.isArray(config.contextProviders)) {
      errors.push({
        fatal: true,
        message: "The 'contextProviders' field should be an array if defined.",
      });
    } else {
      config.contextProviders.forEach((provider, index) => {
        if (typeof provider.name !== "string" || provider.name.trim() === "") {
          errors.push({
            fatal: true,
            message: `Context provider at index ${index} has an invalid or missing 'name'.`,
          });
        }
      });
    }
  }

  // Validate embeddingsProvider
  if (
    config.embeddingsProvider &&
    typeof config.embeddingsProvider !== "object"
  ) {
    errors.push({
      fatal: true,
      message: "The 'embeddingsProvider' field should be an object if defined.",
    });
  }

  // Validate reranker
  if (config.reranker && typeof config.reranker !== "object") {
    errors.push({
      fatal: true,
      message: "The 'reranker' field should be an object if defined.",
    });
  }

  // Validate other boolean flags
  const booleanFlags: Array<
    keyof Pick<
      SerializedContinueConfig,
      "allowAnonymousTelemetry" | "disableIndexing" | "disableSessionTitles"
    >
  > = ["allowAnonymousTelemetry", "disableIndexing", "disableSessionTitles"];

  booleanFlags.forEach((flag) => {
    if (config[flag] !== undefined && typeof config[flag] !== "boolean") {
      errors.push({
        fatal: true,
        message: `The '${flag}' field should be a boolean if defined.`,
      });
    }
  });

  if (errors.length > 0) {
    void Telemetry.capture(
      "configValidationError",
      {
        errors,
      },
      true,
    );

    return errors;
  }

  return undefined;
}
