import { ConfigYaml, configYamlSchema } from "./schemas/index.js";

export interface ConfigValidationError {
  fatal: boolean;
  message: string;
  uri?: string;
}

export interface ConfigResult<T> {
  config: T | undefined;
  errors: ConfigValidationError[] | undefined;
  configLoadInterrupted: boolean;
}

export function validateConfigYaml(
  config: ConfigYaml,
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  try {
    configYamlSchema.parse(config);
  } catch (e: any) {
    return [
      {
        fatal: true,
        message: e.message,
      },
    ];
  }

  config.models?.forEach((model) => {
    if ("uses" in model) {
      return;
    }
    // Max tokens not too close to context length
    if (
      model.defaultCompletionOptions?.contextLength &&
      model.defaultCompletionOptions?.maxTokens
    ) {
      const difference =
        model.defaultCompletionOptions?.contextLength -
        model.defaultCompletionOptions?.maxTokens;

      if (difference < 1000) {
        errors.push({
          fatal: false,
          message: `Model "${model.name}" has a contextLength of ${model.defaultCompletionOptions?.contextLength} and a maxTokens of ${model.defaultCompletionOptions?.maxTokens}. This leaves only ${difference} tokens for input context and will likely result in your inputs being truncated.`,
        });
      }
    }

    if (model.roles?.includes("autocomplete")) {
      const modelName = model.model.toLocaleLowerCase();
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
          message: `${model.model} is not trained for tab-autocomplete, and will result in low-quality suggestions. See the docs to learn more about why: https://docs.continue.dev/features/tab-autocomplete#i-want-better-completions-should-i-use-gpt-4`,
        });
      }
    }
  });

  return errors;
}
