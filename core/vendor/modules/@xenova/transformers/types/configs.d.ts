/**
 * Base class for all configuration classes. For more information, see the corresponding
 * [Python documentation](https://huggingface.co/docs/transformers/main/en/main_classes/configuration#transformers.PretrainedConfig).
 */
export class PretrainedConfig {
    /**
     * Loads a pre-trained config from the given `pretrained_model_name_or_path`.
     *
     * @param {string} pretrained_model_name_or_path The path to the pre-trained config.
     * @param {PretrainedOptions} options Additional options for loading the config.
     * @throws {Error} Throws an error if the config.json is not found in the `pretrained_model_name_or_path`.
     *
     * @returns {Promise<PretrainedConfig>} A new instance of the `PretrainedConfig` class.
     */
    static from_pretrained(pretrained_model_name_or_path: string, { progress_callback, config, cache_dir, local_files_only, revision, }?: PretrainedOptions): Promise<PretrainedConfig>;
    /**
     * Create a new PreTrainedTokenizer instance.
     * @param {Object} configJSON The JSON of the config.
     */
    constructor(configJSON: any);
    model_type: any;
    is_encoder_decoder: boolean;
}
/**
 * Helper class which is used to instantiate pretrained configs with the `from_pretrained` function.
 *
 * @example
 * let config = await AutoConfig.from_pretrained('bert-base-uncased');
 */
export class AutoConfig {
    /**
     * Loads a pre-trained config from the given `pretrained_model_name_or_path`.
     *
     * @param {string} pretrained_model_name_or_path The path to the pre-trained config.
     * @param {PretrainedOptions} options Additional options for loading the config.
     * @throws {Error} Throws an error if the config.json is not found in the `pretrained_model_name_or_path`.
     *
     * @returns {Promise<PretrainedConfig>} A new instance of the `PretrainedConfig` class.
     */
    static from_pretrained(pretrained_model_name_or_path: string, { progress_callback, config, cache_dir, local_files_only, revision, }?: import("./utils/hub.js").PretrainedOptions): Promise<PretrainedConfig>;
}
export type PretrainedOptions = import('./utils/hub.js').PretrainedOptions;
//# sourceMappingURL=configs.d.ts.map