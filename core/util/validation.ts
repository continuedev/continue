/**
 * Module for validating configuration
 * @module validation
 */

// Use our own ConfigValidationError type definition
export interface ConfigValidationError {
  fatal: boolean;
  message: string;
}

/**
 * Function to validate configuration files
 * @param {Object} config Configuration object to validate
 * @returns {ConfigValidationError[]|undefined} Array of errors, or undefined if no errors
 */
export function validateConfig(config: any): ConfigValidationError[] | undefined {
  if (!config) {
    return [{ fatal: true, message: "Config is null or undefined" }];
  }

  const errors = [];

  // models配列の検証
  if (!config.models || !Array.isArray(config.models) || config.models.length === 0) {
    errors.push({
      fatal: false,
      message: "No models defined in config"
    });
  } else {
    // 各モデルの必須フィールドを検証
    config.models.forEach((model: any, index: number) => {
      if (typeof model === "object") {
        // "title" プロパティを持つモデル記述の場合
        if ("title" in model) {
          if (!model.provider) {
            errors.push({
              fatal: false,
              message: `Model at index ${index} is missing required field 'provider'`
            });
          }
          if (!model.model && model.model !== "") {
            errors.push({
              fatal: false,
              message: `Model at index ${index} is missing required field 'model'`
            });
          }
        }
        // カスタムモデルの場合
        else {
          if (!model.options) {
            errors.push({
              fatal: false,
              message: `Custom model at index ${index} is missing required field 'options'`
            });
          }
        }
      } else {
        errors.push({
          fatal: false,
          message: `Model at index ${index} is not an object`
        });
      }
    });
  }

  // contextProviders配列の検証（存在する場合のみ）
  if (config.contextProviders && !Array.isArray(config.contextProviders)) {
    errors.push({
      fatal: false,
      message: "contextProviders must be an array"
    });
  }

  // contextProviders配列の検証（存在する場合のみ）
  if (config.contextProviders && Array.isArray(config.contextProviders)) {
    config.contextProviders.forEach((provider: any, index: number) => {
      if (typeof provider === "object") {
        // "name" プロパティを持つコンテキストプロバイダの場合
        if ("name" in provider) {
          if (!provider.name) {
            errors.push({
              fatal: false,
              message: `ContextProvider at index ${index} has empty name`
            });
          }
        }
        // カスタムプロバイダの場合
        else if (!provider.run && !provider.getContext) {
          errors.push({
            fatal: false,
            message: `Custom ContextProvider at index ${index} is missing required method 'run' or 'getContext'`
          });
        }
      } else {
        errors.push({
          fatal: false,
          message: `ContextProvider at index ${index} is not an object`
        });
      }
    });
  }

  // embeddingsProviderの検証（存在する場合のみ）
  if (config.embeddingsProvider && typeof config.embeddingsProvider === "object") {
    if (!("provider" in config.embeddingsProvider) && !("providerName" in config.embeddingsProvider)) {
      errors.push({
        fatal: false,
        message: "embeddingsProvider is missing required field 'provider' or 'providerName'"
      });
    }
  }

  // baseAgentSystemMessageプロパティをbaseChatSystemMessageに変換
  config.models?.forEach((model: any) => {
    if (model.baseAgentSystemMessage && !model.baseChatSystemMessage) {
      model.baseChatSystemMessage = model.baseAgentSystemMessage;
      console.warn(`Deprecated 'baseAgentSystemMessage' found in model '${model.title || "unknown"}'. Use 'baseChatSystemMessage' instead.`);
    }
  });

  return errors.length > 0 ? errors : undefined;
}
