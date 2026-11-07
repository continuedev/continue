import { ConfigYaml, configYamlSchema } from "./schemas/index.js";

/**
 * Something the GUI can offer to do about an error. Optional, so existing
 * producers and consumers of ConfigValidationError are unaffected.
 */
export type ConfigErrorAction = {
  /**
   * A `${{ secrets.NAME }}` reference in a model's credentials has no value on
   * this machine (not in ~/.continue/.env, the workspace .env files or the
   * environment).
   */
  kind: "setSecret";
  secretName: string;
  /** Providers of the models that use the secret, for a readable message. */
  providers: string[];
  /** Names (titles) of the models that use the secret. */
  modelNames: string[];
};

export interface ConfigValidationError {
  fatal: boolean;
  message: string;
  uri?: string;
  action?: ConfigErrorAction;
}

export interface ConfigResult<T> {
  config: T | undefined;
  errors: ConfigValidationError[] | undefined;
  configLoadInterrupted: boolean;
  /** Optional display name from config.yaml `name` field */
  configName?: string;
}

function containsUnicode(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
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

    // request headers to the llm api should not contain unicode characters
    if (model.apiKey && containsUnicode(model.apiKey)) {
      errors.push({
        fatal: true,
        message: `Model "${model.name}" has an API key containing unicode characters. API keys should only contain ASCII characters.`,
      });
    }

    if (model.requestOptions?.headers) {
      for (const [key, value] of Object.entries(model.requestOptions.headers)) {
        if (containsUnicode(key) || containsUnicode(value)) {
          errors.push({
            fatal: true,
            message: `Model "${model.name}" has a request header "${key}" containing unicode characters. Request headers should only contain ASCII characters.`,
          });
        }
      }
    }
    // Max tokens not too close to context length
    const effectiveContextLength =
      model.contextLength ?? model.defaultCompletionOptions?.contextLength;
    const effectiveMaxTokens = model.defaultCompletionOptions?.maxTokens;
    if (effectiveContextLength && effectiveMaxTokens) {
      const difference = effectiveContextLength - effectiveMaxTokens;

      if (difference < 1000) {
        errors.push({
          fatal: false,
          message: `Model "${model.name}" has a contextLength of ${effectiveContextLength} and a maxTokens of ${effectiveMaxTokens}. This leaves only ${difference} tokens for input context and will likely result in your inputs being truncated.`,
        });
      }
    }

    if (model.roles?.includes("autocomplete")) {
      // A `from:` entry gets its model id from the catalog when it is loaded
      const modelName = (model.model ?? "").toLocaleLowerCase();
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
          message: `${model.model} is not trained for tab-autocomplete, and will result in low-quality suggestions. See the docs to learn more about why: https://b1tninja.github.io/continued/customize/deep-dives/autocomplete#i-want-better-completions-should-i-use-gpt-5`,
        });
      }
    }
  });

  return errors;
}
