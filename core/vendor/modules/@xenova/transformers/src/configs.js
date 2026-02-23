/**
 * @file Helper module for using model configs. For more information, see the corresponding
 * [Python documentation](https://huggingface.co/docs/transformers/main/en/model_doc/auto#transformers.AutoConfig).
 *
 * **Example:** Load an `AutoConfig`.
 *
 * ```javascript
 * import { AutoConfig } from '@xenova/transformers';
 * let config = await AutoConfig.from_pretrained('bert-base-uncased');
 * console.log(config);
 * // PretrainedConfig {
 * //   "model_type": "bert",
 * //   "is_encoder_decoder": false,
 * //   "architectures": [
 * //       "BertForMaskedLM"
 * //   ],
 * //   "vocab_size": 30522
 * //   "num_attention_heads": 12,
 * //   "num_hidden_layers": 12,
 * //   "hidden_size": 768,
 * //   "max_position_embeddings": 512,
 * //   ...
 * // }
 * ```
 *
 * @module configs
 */

import { getModelJSON } from "./utils/hub.js";

/**
 * @typedef {import('./utils/hub.js').PretrainedOptions} PretrainedOptions
 */

/**
 * Loads a config from the specified path.
 * @param {string} pretrained_model_name_or_path The path to the config directory.
 * @param {PretrainedOptions} options Additional options for loading the config.
 * @returns {Promise<Array>} A promise that resolves with information about the loaded config.
 */
async function loadConfig(pretrained_model_name_or_path, options) {
  let info = await getModelJSON(
    pretrained_model_name_or_path,
    "config.json",
    true,
    options,
  );
  return info;
}

/**
 * Base class for all configuration classes. For more information, see the corresponding
 * [Python documentation](https://huggingface.co/docs/transformers/main/en/main_classes/configuration#transformers.PretrainedConfig).
 */
export class PretrainedConfig {
  // NOTE: Typo in original

  /**
   * Create a new PreTrainedTokenizer instance.
   * @param {Object} configJSON The JSON of the config.
   */
  constructor(configJSON) {
    this.model_type = null;
    this.is_encoder_decoder = false;

    Object.assign(this, configJSON);
  }

  /**
   * Loads a pre-trained config from the given `pretrained_model_name_or_path`.
   *
   * @param {string} pretrained_model_name_or_path The path to the pre-trained config.
   * @param {PretrainedOptions} options Additional options for loading the config.
   * @throws {Error} Throws an error if the config.json is not found in the `pretrained_model_name_or_path`.
   *
   * @returns {Promise<PretrainedConfig>} A new instance of the `PretrainedConfig` class.
   */
  static async from_pretrained(
    pretrained_model_name_or_path,
    {
      progress_callback = null,
      config = null,
      cache_dir = null,
      local_files_only = false,
      revision = "main",
    } = {},
  ) {
    let data =
      config ??
      (await loadConfig(pretrained_model_name_or_path, {
        progress_callback,
        config,
        cache_dir,
        local_files_only,
        revision,
      }));
    return new this(data);
  }
}

/**
 * Helper class which is used to instantiate pretrained configs with the `from_pretrained` function.
 *
 * @example
 * let config = await AutoConfig.from_pretrained('bert-base-uncased');
 */
export class AutoConfig {
  /** @type {PretrainedConfig.from_pretrained} */
  static async from_pretrained(...args) {
    return PretrainedConfig.from_pretrained(...args);
  }
}
