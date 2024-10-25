import { SerializedContinueConfig } from "../";
import { Telemetry } from "../util/posthog";

export interface ConfigValidationError {
  fatal: boolean;
  message: string;
}

/**
 * Validates a SerializedContinueConfig object to ensure all properties are correctly formed.
 * @param config The configuration object to validate.
 * @returns An array of error messages if there are any. Otherwise, the config is valid.
 */
export function validateConfig(config: SerializedContinueConfig) {
  const errors: ConfigValidationError[] = [];

  // Validate models
  if (!Array.isArray(config.models) || config.models.length === 0) {
    errors.push({
      fatal: true,
      message: "The 'models' field should be a non-empty array.",
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
    });
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
