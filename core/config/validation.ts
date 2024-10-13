import { SerializedContinueConfig } from "../";

export type ValidationErrorMessage = string;

export class ValidationError extends Error {
  public errors: ValidationErrorMessage[];

  constructor(errors: ValidationErrorMessage[]) {
    super("Validation failed");
    this.errors = errors;

    // Maintains proper stack trace for where our error was thrown (only available on V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Validates a SerializedContinueConfig object to ensure all properties are correctly formed.
 * @param config The configuration object to validate.
 * @returns An array of error messages. If the array is empty, the config is valid.
 */
export function validateConfig(config: SerializedContinueConfig) {
  const errors: ValidationErrorMessage[] = [];

  // Validate models
  if (!Array.isArray(config.models) || config.models.length === 0) {
    errors.push("The 'models' field should be a non-empty array.");
  } else {
    config.models.forEach((model, index) => {
      if (typeof model.title !== "string" || model.title.trim() === "") {
        errors.push(
          `Model at index ${index} has an invalid or missing 'title'.`,
        );
      }
      if (typeof model.provider !== "string") {
        errors.push(`Model at index ${index} has an invalid 'provider'.`);
      }
    });
  }

  // Validate slashCommands
  if (config.slashCommands) {
    if (!Array.isArray(config.slashCommands)) {
      errors.push("The 'slashCommands' field should be an array if defined.");
    } else {
      config.slashCommands.forEach((command, index) => {
        if (typeof command.name !== "string" || command.name.trim() === "") {
          errors.push(
            `Slash command at index ${index} has an invalid or missing 'name'.`,
          );
        }
        if (typeof command.description !== "string") {
          errors.push(
            `Slash command at index ${index} has an invalid or missing 'description'.`,
          );
        }
      });
    }
  }

  // Validate contextProviders
  if (config.contextProviders) {
    if (!Array.isArray(config.contextProviders)) {
      errors.push(
        "The 'contextProviders' field should be an array if defined.",
      );
    } else {
      config.contextProviders.forEach((provider, index) => {
        if (typeof provider.name !== "string" || provider.name.trim() === "") {
          errors.push(
            `Context provider at index ${index} has an invalid or missing 'name'.`,
          );
        }
      });
    }
  }

  // Validate embeddingsProvider
  if (
    config.embeddingsProvider &&
    typeof config.embeddingsProvider !== "object"
  ) {
    errors.push(
      "The 'embeddingsProvider' field should be an object if defined.",
    );
  }

  // Validate reranker
  if (config.reranker && typeof config.reranker !== "object") {
    errors.push("The 'reranker' field should be an object if defined.");
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
      errors.push(`The '${flag}' field should be a boolean if defined.`);
    }
  });

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}
