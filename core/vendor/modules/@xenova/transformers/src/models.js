/**
 * @file Definitions of all models available in Transformers.js.
 *
 * **Example:** Load and run an `AutoModel`.
 *
 * ```javascript
 * import { AutoModel, AutoTokenizer } from '@xenova/transformers';
 *
 * let tokenizer = await AutoTokenizer.from_pretrained('Xenova/bert-base-uncased');
 * let model = await AutoModel.from_pretrained('Xenova/bert-base-uncased');
 *
 * let inputs = await tokenizer('I love transformers!');
 * let { logits } = await model(inputs);
 * // Tensor {
 * //     data: Float32Array(183132) [-7.117443084716797, -7.107812881469727, -7.092104911804199, ...]
 * //     dims: (3) [1, 6, 30522],
 * //     type: "float32",
 * //     size: 183132,
 * // }
 * ```
 *
 * We also provide other `AutoModel`s (listed below), which you can use in the same way as the Python library. For example:
 *
 * **Example:** Load and run an `AutoModelForSeq2SeqLM`.
 * ```javascript
 * import { AutoModelForSeq2SeqLM, AutoTokenizer } from '@xenova/transformers';
 *
 * let tokenizer = await AutoTokenizer.from_pretrained('Xenova/t5-small');
 * let model = await AutoModelForSeq2SeqLM.from_pretrained('Xenova/t5-small');
 *
 * let { input_ids } = await tokenizer('translate English to German: I love transformers!');
 * let outputs = await model.generate(input_ids);
 * let decoded = tokenizer.decode(outputs[0], { skip_special_tokens: true });
 * // 'Ich liebe Transformatoren!'
 * ```
 *
 * @module models
 */

import { AutoConfig } from "./configs.js";

import {
  Callable,
  isIntegralNumber,
  isTypedArray,
  mergeArrays,
} from "./utils/core.js";

import { getModelFile, getModelJSON } from "./utils/hub.js";

import {
  ForcedBOSTokenLogitsProcessor,
  ForcedEOSTokenLogitsProcessor,
  ForceTokensLogitsProcessor,
  GenerationConfig,
  LogitsProcessorList,
  MinLengthLogitsProcessor,
  MinNewTokensLengthLogitsProcessor,
  NoBadWordsLogitsProcessor,
  NoRepeatNGramLogitsProcessor,
  RepetitionPenaltyLogitsProcessor,
  Sampler,
  SuppressTokensAtBeginLogitsProcessor,
  WhisperTimeStampLogitsProcessor,
} from "./utils/generation.js";

import {
  cat,
  dynamicTimeWarping,
  mean,
  ones_like,
  stack,
  std_mean,
  Tensor,
} from "./utils/tensor.js";

import { executionProviders, ONNX } from "./backends/onnx.js";
// import { medianFilter } from './transformers.js';
const { InferenceSession, Tensor: ONNXTensor, env } = ONNX;

/** @typedef {import('onnxruntime-web').InferenceSession} InferenceSession */

//////////////////////////////////////////////////
// Model types: used internally
const MODEL_TYPES = {
  EncoderOnly: 0,
  EncoderDecoder: 1,
  Seq2Seq: 2,
  Vision2Seq: 3,
  DecoderOnly: 4,
  MaskGeneration: 5,
};
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Helper functions

// NOTE: These will be populated fully later
const MODEL_TYPE_MAPPING = new Map();
const MODEL_NAME_TO_CLASS_MAPPING = new Map();
const MODEL_CLASS_TO_NAME_MAPPING = new Map();

/**
 * Constructs an InferenceSession using a model file located at the specified path.
 * @param {string} pretrained_model_name_or_path The path to the directory containing the model file.
 * @param {string} fileName The name of the model file.
 * @param {import('./utils/hub.js').PretrainedOptions} options Additional options for loading the model.
 * @returns {Promise<InferenceSession>} A Promise that resolves to an InferenceSession object.
 * @private
 */
async function constructSession(
  pretrained_model_name_or_path,
  fileName,
  options,
) {
  // TODO add option for user to force specify their desired execution provider
  let modelFileName = `onnx/${fileName}${options.quantized ? "_quantized" : ""}.onnx`;
  let buffer = await getModelFile(
    pretrained_model_name_or_path,
    modelFileName,
    true,
    options,
  );

  try {
    return await InferenceSession.create(buffer, {
      executionProviders,
    });
  } catch (err) {
    // If the execution provided was only wasm, throw the error
    if (executionProviders.length === 1 && executionProviders[0] === "wasm") {
      throw err;
    }

    console.warn(err);
    console.warn(
      "Something went wrong during model construction (most likely a missing operation). " +
        "Using `wasm` as a fallback. ",
    );
    return await InferenceSession.create(buffer, {
      executionProviders: ["wasm"],
    });
  }
}

/**
 * Validate model inputs
 * @param {InferenceSession} session The InferenceSession object that will be run.
 * @param {Record<string, Tensor>} inputs The inputs to check.
 * @returns {Record<string, Tensor>} The checked inputs.
 * @throws {Error} If any inputs are missing.
 * @private
 */
function validateInputs(session, inputs) {
  /**
   * NOTE: Create either a shallow or deep copy based on `onnx.wasm.proxy`
   * @type {Record<string, Tensor>}
   */
  const checkedInputs = Object.create(null);
  const missingInputs = [];
  for (const inputName of session.inputNames) {
    const tensor = inputs[inputName];
    // Rare case where one of the model's input names corresponds to a built-in
    // object name (e.g., toString), which would cause a simple (!tensor) check to fail,
    // because it's not undefined but a function.
    if (!(tensor instanceof Tensor)) {
      missingInputs.push(inputName);
      continue;
    }
    // NOTE: When `env.wasm.proxy is true` the tensor is moved across the Worker
    // boundary, transferring ownership to the worker and invalidating the tensor.
    // So, in this case, we simply sacrifice a clone for it.
    checkedInputs[inputName] = env.wasm.proxy ? tensor.clone() : tensor;
  }
  if (missingInputs.length > 0) {
    throw new Error(
      `An error occurred during model execution: "Missing the following inputs: ${missingInputs.join(", ")}.`,
    );
  }

  const numInputsProvided = Object.keys(inputs).length;
  const numInputsNeeded = session.inputNames.length;
  if (numInputsProvided > numInputsNeeded) {
    // No missing inputs, but too many inputs were provided.
    // Warn the user and ignore the extra inputs.
    let ignored = Object.keys(inputs).filter(
      (inputName) => !session.inputNames.includes(inputName),
    );
    console.warn(
      `WARNING: Too many inputs were provided (${numInputsProvided} > ${numInputsNeeded}). The following inputs will be ignored: "${ignored.join(", ")}".`,
    );
  }

  return checkedInputs;
}

/**
 * Executes an InferenceSession using the specified inputs.
 * NOTE: `inputs` must contain at least the input names of the model.
 *  - If additional inputs are passed, they will be ignored.
 *  - If inputs are missing, an error will be thrown.
 *
 * @param {InferenceSession} session The InferenceSession object to run.
 * @param {Object} inputs An object that maps input names to input tensors.
 * @returns {Promise<Object>} A Promise that resolves to an object that maps output names to output tensors.
 * @private
 */
async function sessionRun(session, inputs) {
  const checkedInputs = validateInputs(session, inputs);
  try {
    // @ts-ignore
    let output = await session.run(checkedInputs);
    output = replaceTensors(output);
    return output;
  } catch (e) {
    // This usually occurs when the inputs are of the wrong type.
    console.error(`An error occurred during model execution: "${e}".`);
    console.error("Inputs given to model:", checkedInputs);
    throw e;
  }
}

/**
 * Replaces ONNX Tensor objects with custom Tensor objects to support additional functions.
 * @param {Object} obj The object to replace tensor objects in.
 * @returns {Object} The object with tensor objects replaced by custom Tensor objects.
 * @private
 */
function replaceTensors(obj) {
  for (let prop in obj) {
    if (obj[prop] instanceof ONNXTensor) {
      obj[prop] = new Tensor(obj[prop]);
    } else if (typeof obj[prop] === "object") {
      replaceTensors(obj[prop]);
    }
  }
  return obj;
}

/**
 * Converts an array or Tensor of integers to an int64 Tensor.
 * @param {Array|Tensor} items The input integers to be converted.
 * @returns {Tensor} The int64 Tensor with the converted values.
 * @throws {Error} If the input array is empty or the input is a batched Tensor and not all sequences have the same length.
 * @private
 */
function toI64Tensor(items) {
  if (items instanceof Tensor) {
    return items;
  }
  // items is an array
  if (items.length === 0) {
    throw Error("items must be non-empty");
  }

  if (Array.isArray(items[0])) {
    // batched
    if (items.some((x) => x.length !== items[0].length)) {
      throw Error(
        "Unable to create tensor, you should probably activate truncation and/or padding with 'padding=True' and/or 'truncation=True' to have batched tensors with the same length.",
      );
    }

    return new Tensor(
      "int64",
      BigInt64Array.from(items.flat().map((x) => BigInt(x))),
      [items.length, items[0].length],
    );
  } else {
    //flat
    return new Tensor(
      "int64",
      BigInt64Array.from(items.map((x) => BigInt(x))),
      [1, items.length],
    );
  }
}

/**
 * Prepares an attention mask for a sequence of tokens based on configuration options.
 * @param {Object} self The calling object instance.
 * @param {Tensor} tokens The input tokens.
 * @returns {Tensor} The attention mask tensor.
 * @private
 */
function prepareAttentionMask(self, tokens) {
  // Prepare attention mask
  let pad_token_id = self.config.pad_token_id ?? null;
  let eos_token_id = self.config.eos_token_id ?? null;
  if (isIntegralNumber(eos_token_id)) {
    eos_token_id = [eos_token_id];
  }

  let is_pad_token_in_inputs = tokens.indexOf(pad_token_id) !== -1;
  let is_pad_token_not_equal_to_eos_token_id =
    eos_token_id === null || !eos_token_id.includes(pad_token_id);

  if (is_pad_token_in_inputs && is_pad_token_not_equal_to_eos_token_id) {
    let data = BigInt64Array.from(
      // Note: != so that int matches bigint
      // @ts-ignore
      tokens.data.map((x) => x != pad_token_id),
    );
    return new Tensor("int64", data, tokens.dims);
  } else {
    return ones_like(tokens);
  }
}

/**
 * Add position IDs to the feeds object.
 * @param {Object} session The inference session.
 * @param {Object} feeds The input to the model.
 * @param {boolean} use_cache_branch Whether to use the cache branch of the model.
 * @returns {void}
 * @private
 */
function preparePositionIds(session, feeds, use_cache_branch) {
  if (!session.inputNames.includes("position_ids")) return;

  const data = new BigInt64Array(feeds.attention_mask.data.length);

  // Compute cumulative sum of the attention mask along the sequence length dimension
  for (let i = 0; i < feeds.attention_mask.dims[0]; ++i) {
    let start = i * feeds.attention_mask.dims[1];
    let sum = BigInt(0);
    for (let j = 0; j < feeds.attention_mask.dims[1]; ++j) {
      const index = start + j;
      if (feeds.attention_mask.data[index] === 0n) {
        data[index] = BigInt(1);
      } else {
        // === 1n
        data[index] = sum;
        sum += feeds.attention_mask.data[index];
      }
    }
  }

  feeds.position_ids = new Tensor("int64", data, feeds.attention_mask.dims);

  if (use_cache_branch) {
    feeds.position_ids = feeds.position_ids.slice(null, -1).unsqueeze_(-1);
  }
}

/**
 * Creates a boolean tensor with a single value.
 * @param {boolean} value The value of the tensor.
 * @returns {Tensor} The boolean tensor.
 * @private
 */
function boolTensor(value) {
  return new Tensor("bool", [value], [1]);
}

// JS doesn't support mixins, so we define some reused functions here, and allow "this" to be passed in
/**
 * Perform forward pass on the seq2seq model (both encoder and decoder).
 * @param {Object} self The seq2seq model object.
 * @param {Object} model_inputs The input object for the model containing encoder and decoder inputs.
 * @returns {Promise<Seq2SeqLMOutput>} Promise that resolves with the output of the seq2seq model.
 * @private
 */
async function seq2seqForward(self, model_inputs) {
  let { encoder_outputs, past_key_values } = model_inputs;

  if (!encoder_outputs) {
    // Encoder outputs are not given, so we must compute them.
    encoder_outputs = (await encoderForward(self, model_inputs))
      .last_hidden_state;
  }
  let decoderFeeds = {
    input_ids: model_inputs.decoder_input_ids,
    encoder_hidden_states: encoder_outputs,
  };
  const use_cache_branch = !!past_key_values;

  if (self.decoder_merged_session.inputNames.includes("use_cache_branch")) {
    decoderFeeds.use_cache_branch = boolTensor(use_cache_branch);
  }

  if (
    self.decoder_merged_session.inputNames.includes("encoder_attention_mask")
  ) {
    decoderFeeds.encoder_attention_mask = model_inputs.attention_mask;
  }

  preparePositionIds(
    self.decoder_merged_session,
    decoderFeeds,
    use_cache_branch,
  );
  self.addPastKeyValues(decoderFeeds, past_key_values);

  const decoderResults = await sessionRun(
    self.decoder_merged_session,
    decoderFeeds,
  );
  let logits = decoderResults.logits;
  past_key_values = self.getPastKeyValues(decoderResults, past_key_values);

  // Get cross attention and/or decoder attentions if they are present
  const attns = self.getAttentions(decoderResults);

  return new Seq2SeqLMOutput({
    logits,
    past_key_values,
    encoder_outputs,
    ...attns,
  });
}

/**
 * Start the beam search process for the seq2seq model.
 * @param {PreTrainedModel} self The seq2seq model object.
 * @param {Tensor} inputTokenIds Array of input token ids for each input sequence.
 * @param {Object} generation_config The generation config.
 * @param {number} numOutputTokens The maximum number of output tokens for the model.
 * @returns {Object[]} Array of beam search objects.
 * @private
 */
function seq2seqStartBeams(
  self,
  inputTokenIds,
  generation_config,
  numOutputTokens,
) {
  let beams = [];
  let beamId = 0;

  // @ts-ignore
  const requires_attention_mask = self.requires_attention_mask ?? true;

  // decoder_input_ids == output_token_ids
  let decoder_input_ids =
    generation_config.decoder_input_ids ??
    generation_config.decoder_start_token_id ??
    generation_config.bos_token_id ??
    generation_config.eos_token_id;

  // Support input as tensor or list
  // TODO support batched decoder_input_ids
  if (decoder_input_ids instanceof Tensor) {
    decoder_input_ids = decoder_input_ids.tolist().flat();
  } else if (!Array.isArray(decoder_input_ids)) {
    decoder_input_ids = [decoder_input_ids];
  }

  for (let tokens of inputTokenIds) {
    // TODO: Improve
    // Currently, just add back batch dimension.
    // In future, allow for true parallel execution
    tokens.dims = [1, ...tokens.dims];

    // Create beam
    let start = {
      inputs: tokens,
      encoder_outputs: null,
      prev_model_outputs: null,

      output_token_ids: decoder_input_ids,
      done: false,
      score: 0,
      id: beamId++, // assign unique id to beams
    };

    if (requires_attention_mask) {
      start.attention_mask = prepareAttentionMask(self, tokens);
    }

    beams.push(start);
  }

  return beams;
}

/**
 * Run beam search on the seq2seq model for a single beam.
 * @param {PreTrainedModel} self The seq2seq model object.
 * @param {Object} beam The beam search object for which to run the model.
 * @param {Object} options options
 * @param {string} [options.input_name='input_ids'] The name of the input tensor for the encoder.
 * @returns {Promise<Object>} Promise that resolves with the output of the seq2seq model for the given beam.
 * @private
 */
async function seq2seqRunBeam(self, beam) {
  const input_name = self.main_input_name;

  let decoder_input_ids = beam.output_token_ids;
  if (beam.prev_model_outputs) {
    // After the first step, `prev_model_outputs` won't be null.
    // So, we cut decoder_input_ids if past is used
    decoder_input_ids = decoder_input_ids.slice(-1);
  }

  // 1. Prepare
  let model_inputs = {
    [input_name]: beam.inputs,
    decoder_input_ids: toI64Tensor(decoder_input_ids),
    encoder_outputs: beam.encoder_outputs,
    past_key_values: beam.prev_model_outputs?.past_key_values,
  };
  if (beam.attention_mask) {
    model_inputs.attention_mask = beam.attention_mask;
  }

  // 2. Run
  let output = await self.forward(model_inputs);

  // 3. Update
  beam.prev_model_outputs = output;
  beam.encoder_outputs = output.encoder_outputs;

  return output;
}

/**
 * Update a beam with a new token ID.
 * @param {Object} beam The beam to update.
 * @param {number} newTokenId The new token ID to add to the beam's output.
 * @private
 */
function seq2seqUpdatebeam(beam, newTokenId) {
  beam.output_token_ids = [...beam.output_token_ids, newTokenId];
}

/**
 * Forward pass of an encoder model.
 * @param {Object} self The encoder model.
 * @param {Object} model_inputs The input data to be used for the forward pass.
 * @returns {Promise<Object>} Promise that resolves with an object containing the model's outputs.
 * @private
 */
async function encoderForward(self, model_inputs) {
  const encoderFeeds = Object.create(null);
  for (const key of self.session.inputNames) {
    encoderFeeds[key] = model_inputs[key];
  }
  if (
    self.session.inputNames.includes("token_type_ids") &&
    !encoderFeeds.token_type_ids
  ) {
    // Assign default `token_type_ids` (all zeroes) to the `encoderFeeds` if the model expects it,
    // but they weren't created by the tokenizer.
    encoderFeeds.token_type_ids = new Tensor(
      "int64",
      new BigInt64Array(encoderFeeds.input_ids.data.length),
      encoderFeeds.input_ids.dims,
    );
  }
  return await sessionRun(self.session, encoderFeeds);
}

/**
 * Forward pass of a decoder model.
 * @param {Object} self The decoder model.
 * @param {Object} model_inputs The input data to be used for the forward pass.
 * @returns {Promise<Object>} Promise that resolves with an object containing the logits and past key values.
 * @private
 */
async function decoderForward(self, model_inputs) {
  let { input_ids, past_key_values, attention_mask } = model_inputs;
  let decoderFeeds = {
    input_ids: input_ids,
    attention_mask: attention_mask ?? prepareAttentionMask(self, input_ids),
  };
  const use_cache_branch = !!past_key_values;

  if (self.session.inputNames.includes("use_cache_branch")) {
    decoderFeeds.use_cache_branch = boolTensor(use_cache_branch);
  }

  preparePositionIds(self.session, decoderFeeds, use_cache_branch);

  self.addPastKeyValues(decoderFeeds, past_key_values);

  let decoderResults = await sessionRun(self.session, decoderFeeds);

  let logits = decoderResults.logits;

  past_key_values = self.getPastKeyValues(decoderResults, past_key_values);
  return { logits, past_key_values };
}

/**
 * Starts the generation of text by initializing the beams for the given input token IDs.
 * @param {Object} self The text generation model object.
 * @param {Tensor} inputTokenIds An tensor of input token IDs to generate text from.
 * @param {Object} generation_config The generation config.
 * @param {number} numOutputTokens The maximum number of tokens to generate for each beam.
 * @param {Tensor} [inputs_attention_mask] The attention mask tensor for the input token IDs.
 * @returns {Object[]} An array of beams initialized with the given inputs and parameters.
 * @private
 */
function decoderStartBeams(
  self,
  inputTokenIds,
  generation_config,
  numOutputTokens,
  inputs_attention_mask,
) {
  let beams = [];

  let beamId = 0;
  for (let tokens of inputTokenIds) {
    let output_token_ids = tokens.tolist().map(Number);

    // TODO: Improve
    // Currently, just add back batch dimension.
    // In future, allow for true parallel execution
    tokens.dims = [1, ...tokens.dims];

    let attn_mask;
    if (inputs_attention_mask) {
      attn_mask = inputs_attention_mask[beamId];
      attn_mask.dims = [1, ...attn_mask.dims];
    } else {
      attn_mask = prepareAttentionMask(self, tokens);
    }

    let start = {
      input: tokens,
      model_input_ids: tokens,
      attention_mask: attn_mask,
      prev_model_outputs: null,

      output_token_ids: output_token_ids,
      num_output_tokens: numOutputTokens,

      done: false,
      score: 0,
      id: beamId++, // assign unique id to beams
    };

    beams.push(start);
  }
  return beams;
}

/**
 * Runs a single step of the text generation process for a given beam.
 *
 * @param {Object} self The decoder object.
 * @param {Object} beam The beam to run.
 * @param {Tensor} beam.input The input tensor.
 * @param {Tensor} beam.model_input_ids The input ids to the model.
 * @param {Tensor} beam.attention_mask The attention mask.
 * @param {Object} beam.prev_model_outputs The past key values.
 * @param {number[]} beam.output_token_ids The output token ids.
 * @returns {Promise<Object>} The output of the generation step.
 * @private
 */
async function decoderRunBeam(self, beam) {
  let attnMaskData = new BigInt64Array(beam.output_token_ids.length).fill(1n);

  // 1. Prepare
  let model_inputs = {
    input_ids: beam.model_input_ids,
    attention_mask: new Tensor("int64", attnMaskData, [1, attnMaskData.length]),
    past_key_values: beam.prev_model_outputs?.past_key_values,
  };

  // 2. Run
  let output = await self.forward(model_inputs);

  // 3. Update
  beam.prev_model_outputs = output;

  return output;
}

/**
 * Update a beam with a new token ID.
 * @param {Object} beam The beam to update.
 * @param {number} newTokenId The new token ID to add to the beam's output.
 * @private
 */
function decoderUpdatebeam(beam, newTokenId) {
  beam.output_token_ids = [...beam.output_token_ids, newTokenId];
  beam.model_input_ids = new Tensor("int64", [BigInt(newTokenId)], [1, 1]);
}

//////////////////////////////////////////////////

//////////////////////////////////////////////////
/**
 * A base class for pre-trained models that provides the model configuration and an ONNX session.
 */
export class PreTrainedModel extends Callable {
  main_input_name = "input_ids";

  /**
   * Creates a new instance of the `PreTrainedModel` class.
   * @param {Object} config The model configuration.
   * @param {any} session session for the model.
   */
  constructor(config, session) {
    super();

    this.config = config;
    this.session = session;

    const modelName = MODEL_CLASS_TO_NAME_MAPPING.get(this.constructor);
    const modelType = MODEL_TYPE_MAPPING.get(modelName);

    this.can_generate = false;
    this._runBeam = null;
    this._getStartBeams = null;
    this._updateBeam = null;
    this._forward = null;
    if (modelType === MODEL_TYPES.DecoderOnly) {
      this.can_generate = true;

      this._runBeam = decoderRunBeam;
      this._getStartBeams = decoderStartBeams;
      this._updateBeam = decoderUpdatebeam;
      this._forward = decoderForward;
    } else if (
      modelType === MODEL_TYPES.Seq2Seq ||
      modelType === MODEL_TYPES.Vision2Seq
    ) {
      this.can_generate = true;

      this._runBeam = seq2seqRunBeam;
      this._getStartBeams = seq2seqStartBeams;
      this._updateBeam = seq2seqUpdatebeam;
      this._forward = seq2seqForward;
    } else if (modelType === MODEL_TYPES.EncoderDecoder) {
      this._forward = encoderForward;
    } else {
      // should be MODEL_TYPES.EncoderOnly
      this._forward = encoderForward;
    }
  }

  /**
   * Disposes of all the ONNX sessions that were created during inference.
   * @returns {Promise<unknown[]>} An array of promises, one for each ONNX session that is being disposed.
   * @todo Use https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry
   */
  async dispose() {
    const promises = [];
    for (let key of Object.keys(this)) {
      const item = this[key];
      // @ts-ignore
      if (item instanceof InferenceSession) {
        promises.push(item.handler.dispose());
      }
    }
    return await Promise.all(promises);
  }

  /**
   * Instantiate one of the model classes of the library from a pretrained model.
   *
   * The model class to instantiate is selected based on the `model_type` property of the config object
   * (either passed as an argument or loaded from `pretrained_model_name_or_path` if possible)
   *
   * @param {string} pretrained_model_name_or_path The name or path of the pretrained model. Can be either:
   * - A string, the *model id* of a pretrained model hosted inside a model repo on huggingface.co.
   *   Valid model ids can be located at the root-level, like `bert-base-uncased`, or namespaced under a
   *   user or organization name, like `dbmdz/bert-base-german-cased`.
   * - A path to a *directory* containing model weights, e.g., `./my_model_directory/`.
   * @param {import('./utils/hub.js').PretrainedOptions} options Additional options for loading the model.
   *
   * @returns {Promise<PreTrainedModel>} A new instance of the `PreTrainedModel` class.
   */
  static async from_pretrained(
    pretrained_model_name_or_path,
    {
      quantized = true,
      progress_callback = null,
      config = null,
      cache_dir = null,
      local_files_only = false,
      revision = "main",
      model_file_name = null,
    } = {},
  ) {
    let options = {
      quantized,
      progress_callback,
      config,
      cache_dir,
      local_files_only,
      revision,
      model_file_name,
    };

    const modelName = MODEL_CLASS_TO_NAME_MAPPING.get(this);
    const modelType = MODEL_TYPE_MAPPING.get(modelName);

    let info;
    if (modelType === MODEL_TYPES.DecoderOnly) {
      info = await Promise.all([
        AutoConfig.from_pretrained(pretrained_model_name_or_path, options),
        constructSession(
          pretrained_model_name_or_path,
          options.model_file_name ?? "decoder_model_merged",
          options,
        ),
        getModelJSON(
          pretrained_model_name_or_path,
          "generation_config.json",
          false,
          options,
        ),
      ]);
    } else if (
      modelType === MODEL_TYPES.Seq2Seq ||
      modelType === MODEL_TYPES.Vision2Seq
    ) {
      info = await Promise.all([
        AutoConfig.from_pretrained(pretrained_model_name_or_path, options),
        constructSession(
          pretrained_model_name_or_path,
          "encoder_model",
          options,
        ),
        constructSession(
          pretrained_model_name_or_path,
          "decoder_model_merged",
          options,
        ),
        getModelJSON(
          pretrained_model_name_or_path,
          "generation_config.json",
          false,
          options,
        ),
      ]);
    } else if (modelType === MODEL_TYPES.MaskGeneration) {
      info = await Promise.all([
        AutoConfig.from_pretrained(pretrained_model_name_or_path, options),
        constructSession(
          pretrained_model_name_or_path,
          "vision_encoder",
          options,
        ),
        constructSession(
          pretrained_model_name_or_path,
          "prompt_encoder_mask_decoder",
          options,
        ),
      ]);
    } else if (modelType === MODEL_TYPES.EncoderDecoder) {
      info = await Promise.all([
        AutoConfig.from_pretrained(pretrained_model_name_or_path, options),
        constructSession(
          pretrained_model_name_or_path,
          "encoder_model",
          options,
        ),
        constructSession(
          pretrained_model_name_or_path,
          "decoder_model_merged",
          options,
        ),
      ]);
    } else {
      // should be MODEL_TYPES.EncoderOnly
      if (modelType !== MODEL_TYPES.EncoderOnly) {
        console.warn(
          `Model type for '${modelName}' not found, assuming encoder-only architecture. Please report this at https://github.com/xenova/transformers.js/issues/new/choose.`,
        );
      }
      info = await Promise.all([
        AutoConfig.from_pretrained(pretrained_model_name_or_path, options),
        constructSession(
          pretrained_model_name_or_path,
          options.model_file_name ?? "model",
          options,
        ),
      ]);
    }

    // @ts-ignore
    return new this(...info);
  }

  /**
   * Runs the model with the provided inputs
   * @param {Object} model_inputs Object containing input tensors
   * @returns {Promise<Object>} Object containing output tensors
   */
  async _call(model_inputs) {
    return await this.forward(model_inputs);
  }

  /**
   * Forward method for a pretrained model. If not overridden by a subclass, the correct forward method
   * will be chosen based on the model type.
   * @param {Object} model_inputs The input data to the model in the format specified in the ONNX model.
   * @returns {Promise<Object>} The output data from the model in the format specified in the ONNX model.
   * @throws {Error} This method must be implemented in subclasses.
   */
  async forward(model_inputs) {
    return await this._forward(this, model_inputs);
  }

  /**
   * @param {import('./utils/generation.js').GenerationConfigType} generation_config
   * @param {number} input_ids_seq_length The starting sequence length for the input ids.
   * @returns {LogitsProcessorList}
   * @private
   */
  _get_logits_processor(
    generation_config,
    input_ids_seq_length,
    // encoder_input_ids, TODO
    // prefix_allowed_tokens_fn, TODO
    logits_processor = null,
  ) {
    const processors = new LogitsProcessorList();

    // if (generation_config.diversity_penalty !== null && generation_config.diversity_penalty > 0.0) {
    //     processors.push(new HammingDiversityLogitsProcessor(
    //         generation_config.diversity_penalty,
    //         generation_config.num_beams,
    //         generation_config.num_beam_groups
    //     ));
    // }

    // if (generation_config.encoder_repetition_penalty !== null && generation_config.encoder_repetition_penalty !== 1.0) {
    //     processors.push(new EncoderRepetitionPenaltyLogitsProcessor(
    //         generation_config.encoder_repetition_penalty,
    //         encoder_input_ids
    //     ));
    // }

    if (
      generation_config.repetition_penalty !== null &&
      generation_config.repetition_penalty !== 1.0
    ) {
      processors.push(
        new RepetitionPenaltyLogitsProcessor(
          generation_config.repetition_penalty,
        ),
      );
    }

    if (
      generation_config.no_repeat_ngram_size !== null &&
      generation_config.no_repeat_ngram_size > 0
    ) {
      processors.push(
        new NoRepeatNGramLogitsProcessor(
          generation_config.no_repeat_ngram_size,
        ),
      );
    }

    // if (generation_config.encoder_no_repeat_ngram_size !== null && generation_config.encoder_no_repeat_ngram_size > 0) {
    //     if (this.config.is_encoder_decoder) {
    //         processors.push(new EncoderNoRepeatNGramLogitsProcessor(
    //             generation_config.encoder_no_repeat_ngram_size,
    //             encoder_input_ids
    //         ));
    //     } else {
    //         throw new Error("It's impossible to use `encoder_no_repeat_ngram_size` with decoder-only architecture");
    //     }
    // }

    if (generation_config.bad_words_ids !== null) {
      processors.push(
        new NoBadWordsLogitsProcessor(
          generation_config.bad_words_ids,
          generation_config.eos_token_id,
        ),
      );
    }

    if (
      generation_config.min_length !== null &&
      generation_config.eos_token_id !== null &&
      generation_config.min_length > 0
    ) {
      processors.push(
        new MinLengthLogitsProcessor(
          generation_config.min_length,
          generation_config.eos_token_id,
        ),
      );
    }

    if (
      generation_config.min_new_tokens !== null &&
      generation_config.eos_token_id !== null &&
      generation_config.min_new_tokens > 0
    ) {
      processors.push(
        new MinNewTokensLengthLogitsProcessor(
          input_ids_seq_length,
          generation_config.min_new_tokens,
          generation_config.eos_token_id,
        ),
      );
    }

    // if (prefix_allowed_tokens_fn !== null) {
    //     processors.push(new PrefixConstrainedLogitsProcessor(
    //         prefix_allowed_tokens_fn,
    //         generation_config.num_beams / generation_config.num_beam_groups
    //     ));
    // }

    if (generation_config.forced_bos_token_id !== null) {
      processors.push(
        new ForcedBOSTokenLogitsProcessor(
          generation_config.forced_bos_token_id,
        ),
      );
    }

    if (generation_config.forced_eos_token_id !== null) {
      processors.push(
        new ForcedEOSTokenLogitsProcessor(
          generation_config.max_length,
          generation_config.forced_eos_token_id,
        ),
      );
    }

    // if (generation_config.remove_invalid_values === true) {
    //     processors.push(new InfNanRemoveLogitsProcessor());
    // }

    // if (generation_config.exponential_decay_length_penalty !== null) {
    //     processors.push(new ExponentialDecayLengthPenalty(
    //         generation_config.exponential_decay_length_penalty,
    //         generation_config.eos_token_id,
    //         input_ids_seq_length
    //     ));
    // }

    // if (generation_config.suppress_tokens !== null) {
    //     processors.push(new SuppressTokensLogitsProcessor(generation_config.suppress_tokens));
    // }

    if (generation_config.begin_suppress_tokens !== null) {
      let begin_index =
        input_ids_seq_length > 1 ||
        generation_config.forced_bos_token_id === null
          ? input_ids_seq_length
          : input_ids_seq_length + 1;

      if (generation_config.forced_decoder_ids !== null) {
        // generation starts after the last token that is forced
        begin_index +=
          generation_config.forced_decoder_ids[
            generation_config.forced_decoder_ids.length - 1
          ][0];
      }
      processors.push(
        new SuppressTokensAtBeginLogitsProcessor(
          generation_config.begin_suppress_tokens,
          begin_index,
        ),
      );
    }

    if (generation_config.forced_decoder_ids !== null) {
      processors.push(
        new ForceTokensLogitsProcessor(generation_config.forced_decoder_ids),
      );
    }

    if (logits_processor !== null) {
      processors.extend(logits_processor);
    }

    // `LogitNormalization` should always be the last logit processor, when present
    // if (generation_config.renormalize_logits === true) {
    //     processors.push(new LogitNormalization());
    // }

    return processors;
  }

  /**
   * This function merges multiple generation configs together to form a final generation config to be used by the model for text generation.
   * It first creates an empty `GenerationConfig` object, then it applies the model's own `generation_config` property to it. Finally, if a `generation_config` object was passed in the arguments, it overwrites the corresponding properties in the final config with those of the passed config object.
   * @param {import('./utils/generation.js').GenerationConfigType} generation_config A `GenerationConfig` object containing generation parameters.
   * @returns {import('./utils/generation.js').GenerationConfigType} The final generation config object to be used by the model for text generation.
   */
  _get_generation_config(generation_config) {
    // Create empty generation config (contains defaults)
    // We pass `this.config` so that if `eos_token_id` or `bos_token_id` exist in the model's config, we will use them
    let gen_config = new GenerationConfig(this.config);

    // Apply model's generation config, if it exists
    if ("generation_config" in this) {
      Object.assign(gen_config, this.generation_config);
    }

    // Finally, use any generation config specified by the user
    // when calling `generate`
    if (generation_config !== null) {
      Object.assign(gen_config, generation_config);
    }
    return gen_config;
  }

  /**
   * @typedef {import('./utils/maths.js').TypedArray} TypedArray
   */

  /**
   * @typedef {{ sequences: Tensor, decoder_attentions: Tensor, cross_attentions: Tensor }} EncoderDecoderOutput
   * @typedef {Object} DecoderOutput
   *
   * Generates text based on the given inputs and generation configuration using the model.
   * @param {Tensor|Array|TypedArray} inputs An array of input token IDs.
   * @param {Object|GenerationConfig|null} generation_config The generation configuration to use. If null, default configuration will be used.
   * @param {Object|null} logits_processor An optional logits processor to use. If null, a new LogitsProcessorList instance will be created.
   * @param {Object} options options
   * @param {Object} [options.inputs_attention_mask=null] An optional attention mask for the inputs.
   * @returns {Promise<number[][]|EncoderDecoderOutput|DecoderOutput>} An array of generated output sequences, where each sequence is an array of token IDs.
   * @throws {Error} Throws an error if the inputs array is empty.
   */
  async generate(
    inputs,
    generation_config = null,
    logits_processor = null,
    { inputs_attention_mask = null } = {},
  ) {
    if (!this.can_generate) {
      const modelName = MODEL_CLASS_TO_NAME_MAPPING.get(this.constructor);
      let errorMessage = `The current model class (${modelName}) is not compatible with \`.generate()\`, as it doesn't have a language model head.`;

      const modelType = this.config.model_type;
      const possibleInfo =
        MODEL_WITH_LM_HEAD_MAPPING_NAMES.get(modelType) ??
        MODEL_FOR_SEQ_TO_SEQ_CAUSAL_LM_MAPPING_NAMES.get(modelType) ??
        MODEL_FOR_SPEECH_SEQ_2_SEQ_MAPPING_NAMES.get(modelType) ??
        // ?? MODEL_FOR_TEXT_TO_SPECTROGRAM_MAPPING_NAMES.get(modelType) // TODO
        MODEL_FOR_VISION_2_SEQ_MAPPING_NAMES.get(modelType);

      if (possibleInfo) {
        // TODO: support multiple possible classes
        errorMessage += ` Please use the following class instead: '${possibleInfo[0]}'`;
      }
      throw Error(errorMessage);
    }

    if (
      !(inputs instanceof Tensor) &&
      !isTypedArray(inputs) &&
      !Array.isArray(inputs)
    ) {
      throw Error(
        `\`inputs\` must be a Tensor, TypedArray, or Array, but is "${inputs.constructor.name}".`,
      );
    }

    let input_ids_seq_length;

    // Prepare `input_ids` which will be used for auto-regressive generation
    // TODO: Update to align with HF transformers' implementation
    if (this.config.is_encoder_decoder) {
      // Generating from the encoder outputs
      input_ids_seq_length = 0;
    } else {
      input_ids_seq_length =
        inputs instanceof Tensor ? inputs.dims.at(-1) : inputs.length;

      // decoder-only
      if (input_ids_seq_length === 0) {
        throw Error("Must supply a non-empty array of input token ids.");
      }
    }

    // Update generation config with defaults
    generation_config = this._get_generation_config(generation_config);

    logits_processor = logits_processor ?? new LogitsProcessorList();

    // Update logits processor
    logits_processor = this._get_logits_processor(
      generation_config,
      input_ids_seq_length,
      logits_processor,
    );

    /** @type {number[]} */
    let eos_token_ids = generation_config.eos_token_id;
    if (eos_token_ids !== null && !Array.isArray(eos_token_ids)) {
      eos_token_ids = [eos_token_ids];
    }

    // TODO implement early_stopping
    // https://huggingface.co/blog/how-to-generate

    let numOutputTokens = 1;
    const maxOutputTokens =
      numOutputTokens + (generation_config.max_new_tokens ?? Infinity);

    // Only use max length if max_new_tokens is not provided
    const useMaxLength =
      Number.isInteger(generation_config.max_length) &&
      (generation_config.max_new_tokens ?? null) === null;
    let sampler = Sampler.getSampler(generation_config);

    // @ts-ignore
    let beams = this.getStartBeams(
      inputs,
      generation_config,
      numOutputTokens,
      inputs_attention_mask,
    );

    while (beams.some((x) => !x.done) && numOutputTokens < maxOutputTokens) {
      let newest_beams = [];
      for (let beam of beams) {
        if (beam.done) {
          // Add this beam back into the pool
          newest_beams.push(beam);
          continue;
        }
        if (
          useMaxLength &&
          beam.output_token_ids.length >= generation_config.max_length
        ) {
          // Set this beam to done and add it back into the pool
          beam.done = true;
          newest_beams.push(beam);
          continue;
        }

        // @ts-ignore
        let output = await this.runBeam(beam);

        // add attentions/scores to beam only if user requested
        if (generation_config.output_attentions) {
          this.addAttentionsToBeam(beam, output);
        }
        if (generation_config.output_scores) {
          // TODO add
        }

        // Logits are of the form [batch_size, out_seq_length, vocab_size]
        // In most cases, this will be [batch_size, 1, vocab_size]
        // So, we select the last token's logits:
        // (equivalent to `logits = outputs.logits[:, -1, :]`)
        let logits = output.logits.slice(null, -1, null);

        // Apply logits processor
        logits_processor(beam.output_token_ids, logits);

        let sampledTokens = sampler(logits);
        for (let [newTokenId, logProb] of sampledTokens) {
          // use previous beam as a starting point
          let newBeam = { ...beam };

          // update new beam
          // @ts-ignore
          this.updateBeam(newBeam, newTokenId);

          newBeam.score += logProb;

          if (eos_token_ids && eos_token_ids.includes(newTokenId)) {
            newBeam.done = true;
          }

          newest_beams.push(newBeam);
        }
      }
      ++numOutputTokens;

      // Next, we get the best beams, per ID
      newest_beams = this.groupBeams(newest_beams).map(
        (group) =>
          group
            .sort((a, b) => b.score - a.score) // sort by score
            .slice(0, generation_config.num_beams), // remove outside beam width
      );

      // Flatten beams
      beams = newest_beams.flat();

      // Run callback
      if (generation_config.callback_function) {
        generation_config.callback_function(beams);
      }
    }

    // TODO: Ensure that we can return non-batched outputs

    const groupedBeams = this.groupBeams(beams);

    const getFlattened = (key) =>
      groupedBeams
        .map((batch) => {
          if (generation_config.num_return_sequences > 1) {
            return batch
              .slice(0, generation_config.num_return_sequences)
              .map((x) => x[key]);
          } else {
            return [batch[0][key]];
          }
        })
        .flat(); // Flatten across batches (depth=1)

    const sequences = getFlattened("output_token_ids"); // [1, seqLength]

    if (generation_config.return_dict_in_generate) {
      // NOTE: `decoder_attentions` and `cross_attentions` should be:
      //    list (one element for each generated token)
      //    of list (one element for each layer of the decoder)
      //    of torch.FloatTensor of shape (batch_size, num_heads, generated_length, sequence_length)
      // However, since we are only generating one batch at a time, they are of the form:
      //   list (batches)
      //   of list (one element for each generated token)
      //   of list (one element for each layer of the decoder)
      //   of torch.FloatTensor of shape (1, num_heads, generated_length, sequence_length)
      //
      // TODO: In future (when true parallelism, we should be able to return the correct shape)

      const decoder_attentions = getFlattened("decoder_attentions");
      const cross_attentions = getFlattened("cross_attentions");

      return {
        sequences,

        decoder_attentions,
        cross_attentions,
      };
    } else {
      return sequences;
    }
  }

  /**
   * Helper function to add attentions to beam
   * @param {Object} beam
   * @param {Object} output
   * @private
   */
  addAttentionsToBeam(beam, output) {
    if (this.config.is_encoder_decoder) {
      if (!output.cross_attentions || output.cross_attentions.length === 0) {
        throw Error(
          "`output_attentions` is true, but the model did not produce cross-attentions. " +
            "This is most likely because the model was not exported with `output_attentions=True`.",
        );
      }
      if (!beam.cross_attentions) {
        beam.cross_attentions = [];
      }
      beam.cross_attentions.push(output.cross_attentions);
    }

    if (!output.decoder_attentions || output.decoder_attentions.length === 0) {
      throw Error(
        "`output_attentions` is true, but the model did not produce decoder-attentions. " +
          "This is most likely because the model was not exported with `output_attentions=True`.",
      );
    }
    if (!beam.decoder_attentions) {
      beam.decoder_attentions = [];
    }
    beam.decoder_attentions.push(output.decoder_attentions);
  }

  /**
   * Groups an array of beam objects by their ids.
   *
   * @param {Array} beams The array of beam objects to group.
   * @returns {Array} An array of arrays, where each inner array contains beam objects with the same id.
   */
  groupBeams(beams) {
    // Group beams by their ids
    const groups = Object.create(null);
    for (const obj of beams) {
      if (groups[obj.id] === undefined) {
        groups[obj.id] = [obj];
      } else {
        groups[obj.id].push(obj);
      }
    }

    return Object.values(groups);
  }

  /**
   * Returns an object containing past key values from the given decoder results object.
   *
   * @param {Object} decoderResults The decoder results object.
   * @param {Object} pastKeyValues The previous past key values.
   * @returns {Object} An object containing past key values.
   */
  getPastKeyValues(decoderResults, pastKeyValues) {
    const pkvs = Object.create(null);

    for (const name in decoderResults) {
      if (name.startsWith("present")) {
        let newName = name.replace("present", "past_key_values");

        if (pastKeyValues && name.includes("encoder")) {
          // Optimization introduced by optimum to reuse past key values. So, we just replace the constant
          // outputs with the previous past key values.
          // https://github.com/huggingface/optimum/blob/0bf2c05fb7e1182b52d21b703cfc95fd9e4ea3dc/optimum/onnxruntime/base.py#L677-L704
          pkvs[newName] = pastKeyValues[newName];
        } else {
          pkvs[newName] = decoderResults[name];
        }
      }
    }
    return pkvs;
  }

  /**
   * Returns an object containing attentions from the given decoder results object.
   *
   * @param {Object} decoderResults The decoder results object.
   * @returns {Object} An object containing attentions.
   */
  getAttentions(decoderResults) {
    const attns = Object.create(null);

    for (const attnName of ["cross_attentions", "decoder_attentions"]) {
      const result = [];
      for (const name in decoderResults) {
        if (name.startsWith(attnName)) {
          const index = name.split(".").pop();
          result[index] = decoderResults[name];
        }
      }
      attns[attnName] = result;
    }
    return attns;
  }

  /**
   * Adds past key values to the decoder feeds object. If pastKeyValues is null, creates new tensors for past key values.
   *
   * @param {Object} decoderFeeds The decoder feeds object to add past key values to.
   * @param {Object} pastKeyValues An object containing past key values.
   */
  addPastKeyValues(decoderFeeds, pastKeyValues) {
    if (pastKeyValues) {
      Object.assign(decoderFeeds, pastKeyValues);
    } else {
      // TODO support batches (i.e., batch_size > 1)
      const batch_size = 1;

      // @ts-ignore
      if (this.config.is_encoder_decoder && (this.add_encoder_pkv ?? true)) {
        // @ts-ignore
        let encoder_dims = [
          batch_size,
          this.num_encoder_heads,
          0,
          this.encoder_dim_kv,
        ];
        // @ts-ignore
        let decoder_dims = [
          batch_size,
          this.num_decoder_heads,
          0,
          this.decoder_dim_kv,
        ];
        // @ts-ignore
        for (let i = 0; i < this.num_decoder_layers; ++i) {
          decoderFeeds[`past_key_values.${i}.encoder.key`] = new Tensor(
            "float32",
            [],
            encoder_dims,
          );
          decoderFeeds[`past_key_values.${i}.encoder.value`] = new Tensor(
            "float32",
            [],
            encoder_dims,
          );
          decoderFeeds[`past_key_values.${i}.decoder.key`] = new Tensor(
            "float32",
            [],
            decoder_dims,
          );
          decoderFeeds[`past_key_values.${i}.decoder.value`] = new Tensor(
            "float32",
            [],
            decoder_dims,
          );
        }
      } else if (this.config.model_type === "falcon") {
        // NOTE: Custom implementation for Falcon
        // @ts-ignore
        let dims = [batch_size * this.num_heads, 0, this.dim_kv];
        // @ts-ignore
        for (let i = 0; i < this.num_layers; ++i) {
          decoderFeeds[`past_key_values.${i}.key`] = new Tensor(
            "float32",
            [],
            dims,
          );
          decoderFeeds[`past_key_values.${i}.value`] = new Tensor(
            "float32",
            [],
            dims,
          );
        }
      } else if (this.config.multi_query) {
        // e.g., for `gpt_bigcode`
        // @ts-ignore
        let dims = [batch_size * this.num_heads, 0, 2 * this.dim_kv];
        // @ts-ignore
        for (let i = 0; i < this.num_layers; ++i) {
          decoderFeeds[`past_key_values.${i}.key_value`] = new Tensor(
            "float32",
            [],
            dims,
          );
        }
      } else if (this.config.model_type === "bloom") {
        // NOTE: Custom implementation for Bloom

        // @ts-ignore
        let keyDims = [batch_size * this.num_heads, this.dim_kv, 0]; // [batch_size x num_heads,64,past_sequence_length]
        // @ts-ignore
        let valueDims = [batch_size * this.num_heads, 0, this.dim_kv]; // [batch_size x num_heads,past_sequence_length,64]
        // @ts-ignore
        for (let i = 0; i < this.num_layers; ++i) {
          decoderFeeds[`past_key_values.${i}.key`] = new Tensor(
            "float32",
            [],
            keyDims,
          );
          decoderFeeds[`past_key_values.${i}.value`] = new Tensor(
            "float32",
            [],
            valueDims,
          );
        }
      } else {
        // Decoder-only
        // @ts-ignore
        let dims = [batch_size, this.num_heads, 0, this.dim_kv];
        // @ts-ignore
        for (let i = 0; i < this.num_layers; ++i) {
          decoderFeeds[`past_key_values.${i}.key`] = new Tensor(
            "float32",
            [],
            dims,
          );
          decoderFeeds[`past_key_values.${i}.value`] = new Tensor(
            "float32",
            [],
            dims,
          );
        }
      }
    }
  }

  /**
   * Initializes and returns the beam for text generation task
   * @param {Tensor} inputTokenIds The input token ids.
   * @param {Object} generation_config The generation config.
   * @param {number} numOutputTokens The number of tokens to be generated.
   * @param {Tensor} inputs_attention_mask Optional input attention mask.
   * @returns {any} A Beam object representing the initialized beam.
   * @private
   */
  getStartBeams(
    inputTokenIds,
    generation_config,
    numOutputTokens,
    inputs_attention_mask,
  ) {
    return this._getStartBeams(
      this,
      inputTokenIds,
      generation_config,
      numOutputTokens,
      inputs_attention_mask,
    );
  }

  /**
   * Runs a single step of the beam search generation algorithm.
   * @param {any} beam The current beam being generated.
   * @returns {Promise<any>} The updated beam after a single generation step.
   * @private
   */
  async runBeam(beam) {
    return await this._runBeam(this, beam);
  }

  /**
   * Update a beam with a new token ID.
   * @param {Object} beam The beam to update.
   * @param {number} newTokenId The new token ID to add to the beam's output.
   * @private
   */
  updateBeam(beam, newTokenId) {
    return this._updateBeam(beam, newTokenId);
  }
}

//////////////////////////////////////////////////
// Base model output class
export class ModelOutput {}

/**
 * Base class for model's outputs, with potential hidden states and attentions.
 */
export class BaseModelOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.last_hidden_state Sequence of hidden-states at the output of the last layer of the model.
   * @param {Tensor} [output.hidden_states] Hidden-states of the model at the output of each layer plus the optional initial embedding outputs.
   * @param {Tensor} [output.attentions] Attentions weights after the attention softmax, used to compute the weighted average in the self-attention heads.
   */
  constructor({ last_hidden_state, hidden_states = null, attentions = null }) {
    super();
    this.last_hidden_state = last_hidden_state;
    this.hidden_states = hidden_states;
    this.attentions = attentions;
  }
}
//////////////////////////////////////////////////
// Bert models
export class BertPreTrainedModel extends PreTrainedModel {}
export class BertModel extends BertPreTrainedModel {}

/**
 * BertForMaskedLM is a class representing a BERT model for masked language modeling.
 */
export class BertForMaskedLM extends BertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * BertForSequenceClassification is a class representing a BERT model for sequence classification.
 */
export class BertForSequenceClassification extends BertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * BertForTokenClassification is a class representing a BERT model for token classification.
 */
export class BertForTokenClassification extends BertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * BertForQuestionAnswering is a class representing a BERT model for question answering.
 */
export class BertForQuestionAnswering extends BertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// RoFormer models
export class RoFormerPreTrainedModel extends PreTrainedModel {}

/**
 * The bare RoFormer Model transformer outputting raw hidden-states without any specific head on top.
 */
export class RoFormerModel extends RoFormerPreTrainedModel {}

/**
 * RoFormer Model with a `language modeling` head on top.
 */
export class RoFormerForMaskedLM extends RoFormerPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * RoFormer Model transformer with a sequence classification/regression head on top (a linear layer on top of the pooled output)
 */
export class RoFormerForSequenceClassification extends RoFormerPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * RoFormer Model with a token classification head on top (a linear layer on top of the hidden-states output)
 * e.g. for Named-Entity-Recognition (NER) tasks.
 */
export class RoFormerForTokenClassification extends RoFormerPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * RoFormer Model with a span classification head on top for extractive question-answering tasks like SQuAD
 * (a linear layers on top of the hidden-states output to compute `span start logits` and `span end logits`).
 */
export class RoFormerForQuestionAnswering extends RoFormerPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
// TODO: Add RoFormerForCausalLM and RoFormerForMultipleChoice
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// ConvBert models
export class ConvBertPreTrainedModel extends PreTrainedModel {}

/**
 * The bare ConvBERT Model transformer outputting raw hidden-states without any specific head on top.
 */
export class ConvBertModel extends ConvBertPreTrainedModel {}

/**
 * ConvBERT Model with a language modeling head on top.
 */
export class ConvBertForMaskedLM extends ConvBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * ConvBERT Model transformer with a sequence classification/regression head on top (a linear layer on top of the pooled output)
 */
export class ConvBertForSequenceClassification extends ConvBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * ConvBERT Model with a token classification head on top (a linear layer on top of the hidden-states output)
 * e.g. for Named-Entity-Recognition (NER) tasks.
 */
export class ConvBertForTokenClassification extends ConvBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * ConvBERT Model with a span classification head on top for extractive question-answering tasks like SQuAD
 * (a linear layers on top of the hidden-states output to compute `span start logits` and `span end logits`)
 */
export class ConvBertForQuestionAnswering extends ConvBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Electra models
export class ElectraPreTrainedModel extends PreTrainedModel {}

/**
 * The bare Electra Model transformer outputting raw hidden-states without any specific head on top.
 * Identical to the BERT model except that it uses an additional linear layer between the embedding
 * layer and the encoder if the hidden size and embedding size are different.
 */
export class ElectraModel extends ElectraPreTrainedModel {}
// TODO add ElectraForPreTraining
/**
 * Electra model with a language modeling head on top.
 */
export class ElectraForMaskedLM extends ElectraPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * ELECTRA Model transformer with a sequence classification/regression head on top (a linear layer on top of the pooled output)
 */
export class ElectraForSequenceClassification extends ElectraPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * Electra model with a token classification head on top.
 */
export class ElectraForTokenClassification extends ElectraPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * LECTRA Model with a span classification head on top for extractive question-answering tasks like SQuAD
 * (a linear layers on top of the hidden-states output to compute `span start logits` and `span end logits`).
 */
export class ElectraForQuestionAnswering extends ElectraPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// CamemBERT models
export class CamembertPreTrainedModel extends PreTrainedModel {}

/**
 * The bare CamemBERT Model transformer outputting raw hidden-states without any specific head on top.
 */
export class CamembertModel extends CamembertPreTrainedModel {}

/**
 * CamemBERT Model with a `language modeling` head on top.
 */
export class CamembertForMaskedLM extends CamembertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * CamemBERT Model transformer with a sequence classification/regression head on top (a linear layer on top of the pooled output) e.g. for GLUE tasks.
 */
export class CamembertForSequenceClassification extends CamembertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * CamemBERT Model with a token classification head on top (a linear layer on top of the hidden-states output) e.g. for Named-Entity-Recognition (NER) tasks.
 */
export class CamembertForTokenClassification extends CamembertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * CamemBERT Model with a span classification head on top for extractive question-answering tasks
 */
export class CamembertForQuestionAnswering extends CamembertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// DeBERTa models
export class DebertaPreTrainedModel extends PreTrainedModel {}

/**
 * The bare DeBERTa Model transformer outputting raw hidden-states without any specific head on top.
 */
export class DebertaModel extends DebertaPreTrainedModel {}

/**
 * DeBERTa Model with a `language modeling` head on top.
 */
export class DebertaForMaskedLM extends DebertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * DeBERTa Model transformer with a sequence classification/regression head on top (a linear layer on top of the pooled output)
 */
export class DebertaForSequenceClassification extends DebertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * DeBERTa Model with a token classification head on top (a linear layer on top of the hidden-states output) e.g. for Named-Entity-Recognition (NER) tasks.
 */
export class DebertaForTokenClassification extends DebertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * DeBERTa Model with a span classification head on top for extractive question-answering tasks like SQuAD (a linear
 * layers on top of the hidden-states output to compute `span start logits` and `span end logits`).
 */
export class DebertaForQuestionAnswering extends DebertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// DeBERTa-v2 models
export class DebertaV2PreTrainedModel extends PreTrainedModel {}

/**
 * The bare DeBERTa-V2 Model transformer outputting raw hidden-states without any specific head on top.
 */
export class DebertaV2Model extends DebertaV2PreTrainedModel {}

/**
 * DeBERTa-V2 Model with a `language modeling` head on top.
 */
export class DebertaV2ForMaskedLM extends DebertaV2PreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * DeBERTa-V2 Model transformer with a sequence classification/regression head on top (a linear layer on top of the pooled output)
 */
export class DebertaV2ForSequenceClassification extends DebertaV2PreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * DeBERTa-V2 Model with a token classification head on top (a linear layer on top of the hidden-states output) e.g. for Named-Entity-Recognition (NER) tasks.
 */
export class DebertaV2ForTokenClassification extends DebertaV2PreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * DeBERTa-V2 Model with a span classification head on top for extractive question-answering tasks like SQuAD (a linear
 * layers on top of the hidden-states output to compute `span start logits` and `span end logits`).
 */
export class DebertaV2ForQuestionAnswering extends DebertaV2PreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// DistilBert models
export class DistilBertPreTrainedModel extends PreTrainedModel {}
export class DistilBertModel extends DistilBertPreTrainedModel {}

/**
 * DistilBertForSequenceClassification is a class representing a DistilBERT model for sequence classification.
 */
export class DistilBertForSequenceClassification extends DistilBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * DistilBertForTokenClassification is a class representing a DistilBERT model for token classification.
 */
export class DistilBertForTokenClassification extends DistilBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * DistilBertForQuestionAnswering is a class representing a DistilBERT model for question answering.
 */
export class DistilBertForQuestionAnswering extends DistilBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}

/**
 * DistilBertForMaskedLM is a class representing a DistilBERT model for masking task.
 */
export class DistilBertForMaskedLM extends DistilBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} returned object
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// ESM models
export class EsmPreTrainedModel extends PreTrainedModel {}

/**
 * The bare ESM Model transformer outputting raw hidden-states without any specific head on top.
 */
export class EsmModel extends EsmPreTrainedModel {}

/**
 * ESM Model with a `language modeling` head on top.
 */
export class EsmForMaskedLM extends EsmPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * ESM Model transformer with a sequence classification/regression head on top (a linear layer on top of the pooled output)
 */
export class EsmForSequenceClassification extends EsmPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * ESM Model with a token classification head on top (a linear layer on top of the hidden-states output)
 * e.g. for Named-Entity-Recognition (NER) tasks.
 */
export class EsmForTokenClassification extends EsmPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// MobileBert models
export class MobileBertPreTrainedModel extends PreTrainedModel {}
export class MobileBertModel extends MobileBertPreTrainedModel {}

/**
 * MobileBertForMaskedLM is a class representing a MobileBERT model for masking task.
 */
export class MobileBertForMaskedLM extends MobileBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} returned object
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * MobileBert Model transformer with a sequence classification/regression head on top (a linear layer on top of the pooled output)
 */
export class MobileBertForSequenceClassification extends MobileBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} returned object
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * MobileBert Model with a span classification head on top for extractive question-answering tasks
 */
export class MobileBertForQuestionAnswering extends MobileBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} returned object
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// MPNet models
export class MPNetPreTrainedModel extends PreTrainedModel {}

/**
 * The bare MPNet Model transformer outputting raw hidden-states without any specific head on top.
 */
export class MPNetModel extends MPNetPreTrainedModel {}

/**
 * MPNetForMaskedLM is a class representing a MPNet model for masked language modeling.
 */
export class MPNetForMaskedLM extends MPNetPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} An object containing the model's output logits for masked language modeling.
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * MPNetForSequenceClassification is a class representing a MPNet model for sequence classification.
 */
export class MPNetForSequenceClassification extends MPNetPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * MPNetForTokenClassification is a class representing a MPNet model for token classification.
 */
export class MPNetForTokenClassification extends MPNetPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * MPNetForQuestionAnswering is a class representing a MPNet model for question answering.
 */
export class MPNetForQuestionAnswering extends MPNetPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} An object containing the model's output logits for question answering.
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// SqueezeBert models
export class SqueezeBertPreTrainedModel extends PreTrainedModel {}
export class SqueezeBertModel extends SqueezeBertPreTrainedModel {}
export class SqueezeBertForMaskedLM extends SqueezeBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} returned object
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}
export class SqueezeBertForSequenceClassification extends SqueezeBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} returned object
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
export class SqueezeBertForQuestionAnswering extends SqueezeBertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} returned object
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Albert models
export class AlbertPreTrainedModel extends PreTrainedModel {}
export class AlbertModel extends AlbertPreTrainedModel {}
export class AlbertForSequenceClassification extends AlbertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} returned object
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
export class AlbertForQuestionAnswering extends AlbertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} returned object
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
export class AlbertForMaskedLM extends AlbertPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} returned object
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// T5 models
export class T5PreTrainedModel extends PreTrainedModel {}

export class T5Model extends T5PreTrainedModel {}

/**
 * T5Model is a class representing a T5 model for conditional generation.
 */
export class T5ForConditionalGeneration extends T5PreTrainedModel {
  /**
   * Creates a new instance of the `T5ForConditionalGeneration` class.
   * @param {Object} config The model configuration.
   * @param {any} session session for the model.
   * @param {any} decoder_merged_session session for the decoder.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.num_decoder_layers;
    this.num_decoder_heads = this.config.num_heads;
    this.decoder_dim_kv = this.config.d_kv;

    this.num_encoder_layers = this.config.num_layers;
    this.num_encoder_heads = this.config.num_heads;
    this.encoder_dim_kv = this.config.d_kv;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// LONGT5 models
/**
 * An abstract class to handle weights initialization and a simple interface for downloading and loading pretrained models.
 */
export class LongT5PreTrainedModel extends PreTrainedModel {}

/**
 * The bare LONGT5 Model transformer outputting raw hidden-states without any specific head on top.
 */
export class LongT5Model extends LongT5PreTrainedModel {}

/**
 * LONGT5 Model with a `language modeling` head on top.
 */
export class LongT5ForConditionalGeneration extends LongT5PreTrainedModel {
  /**
   * Creates a new instance of the `LongT5ForConditionalGeneration` class.
   * @param {Object} config The model configuration.
   * @param {any} session session for the model.
   * @param {any} decoder_merged_session session for the decoder.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.num_decoder_layers;
    this.num_decoder_heads = this.config.num_heads;
    this.decoder_dim_kv = this.config.d_kv;

    this.num_encoder_layers = this.config.num_layers;
    this.num_encoder_heads = this.config.num_heads;
    this.encoder_dim_kv = this.config.d_kv;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// MT5 models
export class MT5PreTrainedModel extends PreTrainedModel {}

export class MT5Model extends MT5PreTrainedModel {}

/**
 * A class representing a conditional sequence-to-sequence model based on the MT5 architecture.
 */
export class MT5ForConditionalGeneration extends MT5PreTrainedModel {
  /**
   * Creates a new instance of the `MT5ForConditionalGeneration` class.
   * @param {any} config The model configuration.
   * @param {any} session The ONNX session containing the encoder weights.
   * @param {any} decoder_merged_session The ONNX session containing the merged decoder weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.num_decoder_layers;
    this.num_decoder_heads = this.config.num_heads;
    this.decoder_dim_kv = this.config.d_kv;

    this.num_encoder_layers = this.config.num_layers;
    this.num_encoder_heads = this.config.num_heads;
    this.encoder_dim_kv = this.config.d_kv;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Bart models
export class BartPretrainedModel extends PreTrainedModel {}

/**
 * The bare BART Model outputting raw hidden-states without any specific head on top.
 */
export class BartModel extends BartPretrainedModel {}

/**
 * The BART Model with a language modeling head. Can be used for summarization.
 */
export class BartForConditionalGeneration extends BartPretrainedModel {
  /**
   * Creates a new instance of the `BartForConditionalGeneration` class.
   * @param {Object} config The configuration object for the Bart model.
   * @param {Object} session The ONNX session used to execute the model.
   * @param {Object} decoder_merged_session The ONNX session used to execute the decoder.
   * @param {Object} generation_config The generation configuration object.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.d_model / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.d_model / this.num_encoder_heads;
  }
}

/**
 * Bart model with a sequence classification/head on top (a linear layer on top of the pooled output)
 */
export class BartForSequenceClassification extends BartPretrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

//////////////////////////////////////////////////

//////////////////////////////////////////////////
// MBart models
export class MBartPreTrainedModel extends PreTrainedModel {}

/**
 * The bare MBART Model outputting raw hidden-states without any specific head on top.
 */
export class MBartModel extends MBartPreTrainedModel {}

/**
 * The MBART Model with a language modeling head. Can be used for summarization, after fine-tuning the pretrained models.
 */
export class MBartForConditionalGeneration extends MBartPreTrainedModel {
  /**
   * Creates a new instance of the `MBartForConditionalGeneration` class.
   * @param {Object} config The configuration object for the Bart model.
   * @param {Object} session The ONNX session used to execute the model.
   * @param {Object} decoder_merged_session The ONNX session used to execute the decoder.
   * @param {Object} generation_config The generation configuration object.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.d_model / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.d_model / this.num_encoder_heads;
  }
}

/**
 * MBart model with a sequence classification/head on top (a linear layer on top of the pooled output).
 */
export class MBartForSequenceClassification extends MBartPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

export class MBartForCausalLM extends MBartPreTrainedModel {
  /**
   * Creates a new instance of the `MBartForCausalLM` class.
   * @param {Object} config Configuration object for the model.
   * @param {Object} decoder_merged_session ONNX Session object for the decoder.
   * @param {Object} generation_config Configuration object for the generation process.
   */
  constructor(config, decoder_merged_session, generation_config) {
    super(config, decoder_merged_session);
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.d_model / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.d_model / this.num_encoder_heads;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Blenderbot models
export class BlenderbotPreTrainedModel extends PreTrainedModel {}

/**
 * The bare Blenderbot Model outputting raw hidden-states without any specific head on top.
 */
export class BlenderbotModel extends BlenderbotPreTrainedModel {}

/**
 * The Blenderbot Model with a language modeling head. Can be used for summarization.
 */
export class BlenderbotForConditionalGeneration extends BlenderbotPreTrainedModel {
  /**
   * Creates a new instance of the `BlenderbotForConditionalGeneration` class.
   * @param {any} config The model configuration.
   * @param {any} session The ONNX session containing the encoder weights.
   * @param {any} decoder_merged_session The ONNX session containing the merged decoder weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.d_model / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.d_model / this.num_encoder_heads;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Blenderbot models
export class BlenderbotSmallPreTrainedModel extends PreTrainedModel {}

/**
 * The bare BlenderbotSmall Model outputting raw hidden-states without any specific head on top.
 */
export class BlenderbotSmallModel extends BlenderbotSmallPreTrainedModel {}

/**
 * The BlenderbotSmall Model with a language modeling head. Can be used for summarization.
 */
export class BlenderbotSmallForConditionalGeneration extends BlenderbotSmallPreTrainedModel {
  /**
   * Creates a new instance of the `BlenderbotForConditionalGeneration` class.
   * @param {any} config The model configuration.
   * @param {any} session The ONNX session containing the encoder weights.
   * @param {any} decoder_merged_session The ONNX session containing the merged decoder weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.d_model / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.d_model / this.num_encoder_heads;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Roberta models
export class RobertaPreTrainedModel extends PreTrainedModel {}
export class RobertaModel extends RobertaPreTrainedModel {}

/**
 * RobertaForMaskedLM class for performing masked language modeling on Roberta models.
 */
export class RobertaForMaskedLM extends RobertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} returned object
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * RobertaForSequenceClassification class for performing sequence classification on Roberta models.
 */
export class RobertaForSequenceClassification extends RobertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} returned object
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * RobertaForTokenClassification class for performing token classification on Roberta models.
 */
export class RobertaForTokenClassification extends RobertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * RobertaForQuestionAnswering class for performing question answering on Roberta models.
 */
export class RobertaForQuestionAnswering extends RobertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} returned object
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// XLM models
/**
 * An abstract class to handle weights initialization and a simple interface for downloading and loading pretrained models.
 */
export class XLMPreTrainedModel extends PreTrainedModel {}

/**
 * The bare XLM Model transformer outputting raw hidden-states without any specific head on top.
 */
export class XLMModel extends XLMPreTrainedModel {}

/**
 * The XLM Model transformer with a language modeling head on top (linear layer with weights tied to the input embeddings).
 */
export class XLMWithLMHeadModel extends XLMPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} returned object
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * XLM Model with a sequence classification/regression head on top (a linear layer on top of the pooled output)
 */
export class XLMForSequenceClassification extends XLMPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} returned object
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * XLM Model with a token classification head on top (a linear layer on top of the hidden-states output)
 */
export class XLMForTokenClassification extends XLMPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * XLM Model with a span classification head on top for extractive question-answering tasks
 */
export class XLMForQuestionAnswering extends XLMPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} returned object
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// XLMRoberta models
export class XLMRobertaPreTrainedModel extends PreTrainedModel {}
export class XLMRobertaModel extends XLMRobertaPreTrainedModel {}

/**
 * XLMRobertaForMaskedLM class for performing masked language modeling on XLMRoberta models.
 */
export class XLMRobertaForMaskedLM extends XLMRobertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MaskedLMOutput>} returned object
   */
  async _call(model_inputs) {
    return new MaskedLMOutput(await super._call(model_inputs));
  }
}

/**
 * XLMRobertaForSequenceClassification class for performing sequence classification on XLMRoberta models.
 */
export class XLMRobertaForSequenceClassification extends XLMRobertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} returned object
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * XLMRobertaForTokenClassification class for performing token classification on XLMRoberta models.
 */
export class XLMRobertaForTokenClassification extends XLMRobertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<TokenClassifierOutput>} An object containing the model's output logits for token classification.
   */
  async _call(model_inputs) {
    return new TokenClassifierOutput(await super._call(model_inputs));
  }
}

/**
 * XLMRobertaForQuestionAnswering class for performing question answering on XLMRoberta models.
 */
export class XLMRobertaForQuestionAnswering extends XLMRobertaPreTrainedModel {
  /**
   * Calls the model on new inputs.
   *
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<QuestionAnsweringModelOutput>} returned object
   */
  async _call(model_inputs) {
    return new QuestionAnsweringModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Audio Spectrogram Transformer (AST) models
export class ASTPreTrainedModel extends PreTrainedModel {}

/**
 * The bare AST Model transformer outputting raw hidden-states without any specific head on top.
 */
export class ASTModel extends ASTPreTrainedModel {}

/**
 * Audio Spectrogram Transformer model with an audio classification head on top
 * (a linear layer on top of the pooled output) e.g. for datasets like AudioSet, Speech Commands v2.
 */
export class ASTForAudioClassification extends ASTPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Whisper models
export class WhisperPreTrainedModel extends PreTrainedModel {}

/**
 * WhisperModel class for training Whisper models without a language model head.
 */
export class WhisperModel extends WhisperPreTrainedModel {}

/**
 * WhisperForConditionalGeneration class for generating conditional outputs from Whisper models.
 */
export class WhisperForConditionalGeneration extends WhisperPreTrainedModel {
  requires_attention_mask = false;
  main_input_name = "input_features";

  /**
   * Creates a new instance of the `WhisperForConditionalGeneration` class.
   * @param {Object} config Configuration object for the model.
   * @param {Object} session ONNX Session object for the model.
   * @param {Object} decoder_merged_session ONNX Session object for the decoder.
   * @param {Object} generation_config Configuration object for the generation process.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.d_model / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.d_model / this.num_encoder_heads;
  }

  /**
   * @typedef {Object} WhisperGenerationConfig
   * @extends GenerationConfig
   * @property {boolean} [return_timestamps=null] Whether to return the timestamps with the text. This enables the `WhisperTimestampsLogitsProcessor`.
   * @property {boolean} [return_token_timestamps=null] Whether to return token-level timestamps
   * with the text. This can be used with or without the `return_timestamps` option. To get word-level
   * timestamps, use the tokenizer to group the tokens into words.
   * @property {number} [num_frames=null]  The number of audio frames available in this chunk. This is only used generating word-level timestamps.
   */

  /**
   * Generates outputs based on input and generation configuration.
   * @param {Object} inputs Input data for the model.
   * @param {WhisperGenerationConfig} generation_config Configuration object for the generation process.
   * @param {Object} logits_processor Optional logits processor object.
   * @returns {Promise<Object>} Promise object represents the generated outputs.
   */
  async generate(
    inputs,
    generation_config = null,
    logits_processor = null,
    // {
    //     return_timestamps = null,
    //     return_token_timestamps = null,
    //     language = null,
    //     task = null,
    // } = {},
  ) {
    // Create generation config object
    generation_config = this._get_generation_config(generation_config);

    // Whisper has additional options for returning timestamps
    generation_config.return_timestamps ??= false;

    // TODO add language and task

    if (generation_config.return_timestamps) {
      logits_processor = [
        new WhisperTimeStampLogitsProcessor(generation_config),
      ];
    }

    if (generation_config.return_token_timestamps) {
      generation_config.output_attentions = true;
      generation_config.return_dict_in_generate = true;

      if (generation_config.task === "translate") {
        console.warn(
          "Token-level timestamps may not be reliable for task 'translate'.",
        );
      }

      if (!generation_config.alignment_heads) {
        throw new Error(
          "Model generation config has no `alignment_heads`, token-level timestamps not available. " +
            "See https://gist.github.com/hollance/42e32852f24243b748ae6bc1f985b13a on how to add this property to the generation config.",
        );
      }
    }

    const outputs = await super.generate(
      inputs,
      generation_config,
      logits_processor,
    );

    if (
      generation_config.return_token_timestamps &&
      generation_config.alignment_heads
    ) {
      outputs["token_timestamps"] = this._extract_token_timestamps(
        outputs,
        generation_config.alignment_heads,
        generation_config.num_frames,
      );
    }

    return outputs;
  }

  /**
   * Calculates token-level timestamps using the encoder-decoder cross-attentions and
   * dynamic time-warping (DTW) to map each output token to a position in the input audio.
   * @param {Object} generate_outputs Outputs generated by the model
   * @param {Tensor[][][]} generate_outputs.cross_attentions The cross attentions output by the model
   * @param {Tensor[][][]} generate_outputs.decoder_attentions The decoder attentions output by the model
   * @param {number[][]} generate_outputs.sequences The sequences output by the model
   * @param {number[][]} alignment_heads Alignment heads of the model
   * @param {number} [num_frames=null] Number of frames in the input audio.
   * @param {number} [time_precision=0.02] Precision of the timestamps in seconds
   * @returns {Tensor} tensor containing the timestamps in seconds for each predicted token
   */
  _extract_token_timestamps(
    generate_outputs,
    alignment_heads,
    num_frames = null,
    time_precision = 0.02,
  ) {
    if (!generate_outputs.cross_attentions) {
      throw new Error(
        "Model outputs must contain cross attentions to extract timestamps. " +
          "This is most likely because the model was not exported with `output_attentions=True`.",
      );
    }

    let median_filter_width = this.config.median_filter_width;
    if (median_filter_width === undefined) {
      console.warn(
        "Model config has no `median_filter_width`, using default value of 7.",
      );
      median_filter_width = 7;
    }

    const batchedMatrices = generate_outputs.cross_attentions.map((batch) => {
      // Create a list with `decoder_layers` elements, each a tensor of shape
      // (batch size, attention_heads, output length, input length).
      let cross_attentions = Array.from(
        { length: this.config.decoder_layers },
        (_, i) =>
          cat(
            batch.map((x) => x[i]),
            2,
          ),
      );

      let weights = stack(
        alignment_heads.map(([l, h]) => {
          return num_frames
            ? cross_attentions[l].slice(null, h, null, [0, num_frames])
            : cross_attentions[l].slice(null, h);
        }),
      );
      weights = weights.transpose(1, 0, 2, 3);

      let [std, calculatedMean] = std_mean(weights, -2, 0, true);

      // Normalize and smoothen the weights.
      let smoothedWeights = weights.clone(); // [1, 8, seqLength, 1500]

      for (let a = 0; a < smoothedWeights.dims[0]; ++a) {
        let aTensor = smoothedWeights[a]; // [8, seqLength, 1500]

        for (let b = 0; b < aTensor.dims[0]; ++b) {
          let bTensor = aTensor[b]; // [seqLength, 1500]

          const stdTensor = std[a][b][0]; // [1500]
          const meanTensor = calculatedMean[a][b][0]; // [1500]

          for (let c = 0; c < bTensor.dims[0]; ++c) {
            let cTensor = bTensor[c]; // [1500]
            for (let d = 0; d < cTensor.data.length; ++d) {
              cTensor.data[d] =
                (cTensor.data[d] - meanTensor.data[d]) / stdTensor.data[d];
            }

            // Apply median filter.
            // cTensor.data.set(medianFilter(cTensor.data, median_filter_width))
          }
        }
      }

      // Average the different cross-attention heads.
      const matrix = mean(smoothedWeights, 1);
      return matrix;
    });

    const timestampsShape = [
      generate_outputs.sequences.length,
      generate_outputs.sequences[0].length,
    ];

    const timestamps = new Tensor(
      "float32",
      new Float32Array(timestampsShape[0] * timestampsShape[1]),
      timestampsShape,
    );

    // Perform dynamic time warping on each element of the batch.
    for (let batch_idx = 0; batch_idx < timestampsShape[0]; ++batch_idx) {
      // NOTE: Since we run only one batch at a time, we can squeeze to get the same dimensions
      // as the python implementation
      const matrix = batchedMatrices[batch_idx].neg().squeeze_(0);
      let [text_indices, time_indices] = dynamicTimeWarping(matrix);

      let diffs = Array.from(
        { length: text_indices.length - 1 },
        (v, i) => text_indices[i + 1] - text_indices[i],
      );
      let jumps = mergeArrays([1], diffs).map((x) => !!x); // convert to boolean

      let jump_times = [];
      for (let i = 0; i < jumps.length; ++i) {
        if (jumps[i]) {
          jump_times.push(time_indices[i] * time_precision);
          // NOTE: No point in rounding here, since we set to Float32Array later
        }
      }
      timestamps[batch_idx].data.set(jump_times, 1);
    }

    return timestamps;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
/**
 * Vision Encoder-Decoder model based on OpenAI's GPT architecture for image captioning and other vision tasks
 */
export class VisionEncoderDecoderModel extends PreTrainedModel {
  main_input_name = "pixel_values";

  /**
   * Creates a new instance of the `VisionEncoderDecoderModel` class.
   * @param {Object} config The configuration object specifying the hyperparameters and other model settings.
   * @param {Object} session The ONNX session containing the encoder model.
   * @param {any} decoder_merged_session The ONNX session containing the merged decoder model.
   * @param {Object} generation_config Configuration object for the generation process.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    // Extract configs
    const encoderConfig = this.config.encoder;
    const decoderConfig = this.config.decoder;

    // Validate encoder
    const encoderModelType = encoderConfig.model_type;
    const encoderModel =
      MODEL_MAPPING_NAMES_ENCODER_ONLY.get(encoderModelType) ??
      MODEL_MAPPING_NAMES_ENCODER_DECODER.get(encoderModelType);
    if (!encoderModel) {
      console.warn(
        `Model type for encoder '${encoderModelType}' not found, assuming encoder-only architecture. Please report this at https://github.com/xenova/transformers.js/issues/new/choose.`,
      );
    }

    // Validate decoder
    const decoderModel = MODEL_WITH_LM_HEAD_MAPPING_NAMES.get(
      decoderConfig.model_type,
    );
    if (!decoderModel) {
      throw new Error(
        `Unable to construct \`VisionEncoderDecoder\` due to unsupported decoder: "${this.config.decoder.model_type}"`,
      );
    }

    // @ts-ignore
    const decoderModelClass = decoderModel[1];
    // @ts-ignore
    const decoder = new decoderModelClass(
      decoderConfig,
      decoder_merged_session,
      generation_config,
    );

    this.add_encoder_pkv = "num_decoder_layers" in decoder;
    if (this.add_encoder_pkv) {
      // Decoder is part of an encoder-decoder model
      this.num_decoder_layers = decoder.num_decoder_layers;
      this.num_decoder_heads = decoder.num_decoder_heads;
      this.decoder_dim_kv = decoder.decoder_dim_kv;

      this.num_encoder_layers = decoder.num_encoder_layers;
      this.num_encoder_heads = decoder.num_encoder_heads;
      this.encoder_dim_kv = decoder.encoder_dim_kv;
    } else {
      // Decoder is a decoder-only model
      this.num_layers = decoder.num_layers;
      this.num_heads = decoder.num_heads;
      this.dim_kv = decoder.dim_kv;
    }
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// CLIP models
export class CLIPPreTrainedModel extends PreTrainedModel {}

/**
 * CLIP Text and Vision Model with a projection layers on top
 *
 * **Example:** Perform zero-shot image classification with a `CLIPModel`.
 *
 * ```javascript
 * import { AutoTokenizer, AutoProcessor, CLIPModel, RawImage } from '@xenova/transformers';
 *
 * // Load tokenizer, processor, and model
 * let tokenizer = await AutoTokenizer.from_pretrained('Xenova/clip-vit-base-patch16');
 * let processor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch16');
 * let model = await CLIPModel.from_pretrained('Xenova/clip-vit-base-patch16');
 *
 * // Run tokenization
 * let texts = ['a photo of a car', 'a photo of a football match']
 * let text_inputs = tokenizer(texts, { padding: true, truncation: true });
 *
 * // Read image and run processor
 * let image = await RawImage.read('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/football-match.jpg');
 * let image_inputs = await processor(image);
 *
 * // Run model with both text and pixel inputs
 * let output = await model({ ...text_inputs, ...image_inputs });
 * // {
 * //   logits_per_image: Tensor {
 * //     dims: [ 1, 2 ],
 * //     data: Float32Array(2) [ 18.579734802246094, 24.31830596923828 ],
 * //   },
 * //   logits_per_text: Tensor {
 * //     dims: [ 2, 1 ],
 * //     data: Float32Array(2) [ 18.579734802246094, 24.31830596923828 ],
 * //   },
 * //   text_embeds: Tensor {
 * //     dims: [ 2, 512 ],
 * //     data: Float32Array(1024) [ ... ],
 * //   },
 * //   image_embeds: Tensor {
 * //     dims: [ 1, 512 ],
 * //     data: Float32Array(512) [ ... ],
 * //   }
 * // }
 * ```
 */
export class CLIPModel extends CLIPPreTrainedModel {}

/**
 * CLIP Text Model with a projection layer on top (a linear layer on top of the pooled output)
 *
 * **Example:** Compute text embeddings with `CLIPTextModelWithProjection`.
 *
 * ```javascript
 * import { AutoTokenizer, CLIPTextModelWithProjection } from '@xenova/transformers';
 *
 * // Load tokenizer and text model
 * const tokenizer = await AutoTokenizer.from_pretrained('Xenova/clip-vit-base-patch16');
 * const text_model = await CLIPTextModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch16');
 *
 * // Run tokenization
 * let texts = ['a photo of a car', 'a photo of a football match'];
 * let text_inputs = tokenizer(texts, { padding: true, truncation: true });
 *
 * // Compute embeddings
 * const { text_embeds } = await text_model(text_inputs);
 * // Tensor {
 * //   dims: [ 2, 512 ],
 * //   type: 'float32',
 * //   data: Float32Array(1024) [ ... ],
 * //   size: 1024
 * // }
 * ```
 */
export class CLIPTextModelWithProjection extends CLIPPreTrainedModel {
  /** @type {PreTrainedModel.from_pretrained} */
  static async from_pretrained(pretrained_model_name_or_path, options = {}) {
    // Update default model file name if not provided
    options.model_file_name ??= "text_model";
    return super.from_pretrained(pretrained_model_name_or_path, options);
  }
}

/**
 * CLIP Vision Model with a projection layer on top (a linear layer on top of the pooled output)
 *
 * **Example:** Compute vision embeddings with `CLIPVisionModelWithProjection`.
 *
 * ```javascript
 * import { AutoProcessor, CLIPVisionModelWithProjection, RawImage} from '@xenova/transformers';
 *
 * // Load processor and vision model
 * const processor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch16');
 * const vision_model = await CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch16');
 *
 * // Read image and run processor
 * let image = await RawImage.read('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/football-match.jpg');
 * let image_inputs = await processor(image);
 *
 * // Compute embeddings
 * const { image_embeds } = await vision_model(image_inputs);
 * // Tensor {
 * //   dims: [ 1, 512 ],
 * //   type: 'float32',
 * //   data: Float32Array(512) [ ... ],
 * //   size: 512
 * // }
 * ```
 */
export class CLIPVisionModelWithProjection extends CLIPPreTrainedModel {
  /** @type {PreTrainedModel.from_pretrained} */
  static async from_pretrained(pretrained_model_name_or_path, options = {}) {
    // Update default model file name if not provided
    options.model_file_name ??= "vision_model";
    return super.from_pretrained(pretrained_model_name_or_path, options);
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// SigLIP models
export class SiglipPreTrainedModel extends PreTrainedModel {}

/**
 * SigLIP Text and Vision Model with a projection layers on top
 *
 * **Example:** Perform zero-shot image classification with a `SiglipModel`.
 *
 * ```javascript
 * import { AutoTokenizer, AutoProcessor, SiglipModel, RawImage } from '@xenova/transformers';
 *
 * // Load tokenizer, processor, and model
 * const tokenizer = await AutoTokenizer.from_pretrained('Xenova/siglip-base-patch16-224');
 * const processor = await AutoProcessor.from_pretrained('Xenova/siglip-base-patch16-224');
 * const model = await SiglipModel.from_pretrained('Xenova/siglip-base-patch16-224');
 *
 * // Run tokenization
 * const texts = ['a photo of 2 cats', 'a photo of 2 dogs'];
 * const text_inputs = tokenizer(texts, { padding: 'max_length', truncation: true });
 *
 * // Read image and run processor
 * const image = await RawImage.read('http://images.cocodataset.org/val2017/000000039769.jpg');
 * const image_inputs = await processor(image);
 *
 * // Run model with both text and pixel inputs
 * const output = await model({ ...text_inputs, ...image_inputs });
 * // {
 * //   logits_per_image: Tensor {
 * //     dims: [ 1, 2 ],
 * //     data: Float32Array(2) [ -1.6019744873046875, -10.720091819763184 ],
 * //   },
 * //   logits_per_text: Tensor {
 * //     dims: [ 2, 1 ],
 * //     data: Float32Array(2) [ -1.6019744873046875, -10.720091819763184 ],
 * //   },
 * //   text_embeds: Tensor {
 * //     dims: [ 2, 768 ],
 * //     data: Float32Array(1536) [ ... ],
 * //   },
 * //   image_embeds: Tensor {
 * //     dims: [ 1, 768 ],
 * //     data: Float32Array(768) [ ... ],
 * //   }
 * // }
 * ```
 */
export class SiglipModel extends SiglipPreTrainedModel {}

/**
 * The text model from SigLIP without any head or projection on top.
 *
 * **Example:** Compute text embeddings with `SiglipTextModel`.
 *
 * ```javascript
 * import { AutoTokenizer, SiglipTextModel } from '@xenova/transformers';
 *
 * // Load tokenizer and text model
 * const tokenizer = await AutoTokenizer.from_pretrained('Xenova/siglip-base-patch16-224');
 * const text_model = await SiglipTextModel.from_pretrained('Xenova/siglip-base-patch16-224');
 *
 * // Run tokenization
 * const texts = ['a photo of 2 cats', 'a photo of 2 dogs'];
 * const text_inputs = tokenizer(texts, { padding: 'max_length', truncation: true });
 *
 * // Compute embeddings
 * const { pooler_output } = await text_model(text_inputs);
 * // Tensor {
 * //   dims: [ 2, 768 ],
 * //   type: 'float32',
 * //   data: Float32Array(1536) [ ... ],
 * //   size: 1536
 * // }
 * ```
 */
export class SiglipTextModel extends SiglipPreTrainedModel {
  /** @type {PreTrainedModel.from_pretrained} */
  static async from_pretrained(pretrained_model_name_or_path, options = {}) {
    // Update default model file name if not provided
    options.model_file_name ??= "text_model";
    return super.from_pretrained(pretrained_model_name_or_path, options);
  }
}

/**
 * The vision model from SigLIP without any head or projection on top.
 *
 * **Example:** Compute vision embeddings with `SiglipVisionModel`.
 *
 * ```javascript
 * import { AutoProcessor, SiglipVisionModel, RawImage} from '@xenova/transformers';
 *
 * // Load processor and vision model
 * const processor = await AutoProcessor.from_pretrained('Xenova/siglip-base-patch16-224');
 * const vision_model = await SiglipVisionModel.from_pretrained('Xenova/siglip-base-patch16-224');
 *
 * // Read image and run processor
 * const image = await RawImage.read('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/football-match.jpg');
 * const image_inputs = await processor(image);
 *
 * // Compute embeddings
 * const { pooler_output } = await vision_model(image_inputs);
 * // Tensor {
 * //   dims: [ 1, 768 ],
 * //   type: 'float32',
 * //   data: Float32Array(768) [ ... ],
 * //   size: 768
 * // }
 * ```
 */
export class SiglipVisionModel extends CLIPPreTrainedModel {
  /** @type {PreTrainedModel.from_pretrained} */
  static async from_pretrained(pretrained_model_name_or_path, options = {}) {
    // Update default model file name if not provided
    options.model_file_name ??= "vision_model";
    return super.from_pretrained(pretrained_model_name_or_path, options);
  }
}
//////////////////////////////////////////////////
// ChineseCLIP models
export class ChineseCLIPPreTrainedModel extends PreTrainedModel {}

export class ChineseCLIPModel extends ChineseCLIPPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// CLIPSeg models
export class CLIPSegPreTrainedModel extends PreTrainedModel {}

export class CLIPSegModel extends CLIPSegPreTrainedModel {}

/**
 * CLIPSeg model with a Transformer-based decoder on top for zero-shot and one-shot image segmentation.
 *
 * **Example:** Perform zero-shot image segmentation with a `CLIPSegForImageSegmentation` model.
 *
 * ```javascript
 * import { AutoTokenizer, AutoProcessor, CLIPSegForImageSegmentation, RawImage } from '@xenova/transformers';
 *
 * // Load tokenizer, processor, and model
 * const tokenizer = await AutoTokenizer.from_pretrained('Xenova/clipseg-rd64-refined');
 * const processor = await AutoProcessor.from_pretrained('Xenova/clipseg-rd64-refined');
 * const model = await CLIPSegForImageSegmentation.from_pretrained('Xenova/clipseg-rd64-refined');
 *
 * // Run tokenization
 * const texts = ['a glass', 'something to fill', 'wood', 'a jar'];
 * const text_inputs = tokenizer(texts, { padding: true, truncation: true });
 *
 * // Read image and run processor
 * const image = await RawImage.read('https://github.com/timojl/clipseg/blob/master/example_image.jpg?raw=true');
 * const image_inputs = await processor(image);
 *
 * // Run model with both text and pixel inputs
 * const { logits } = await model({ ...text_inputs, ...image_inputs });
 * // logits: Tensor {
 * //   dims: [4, 352, 352],
 * //   type: 'float32',
 * //   data: Float32Array(495616) [ ... ],
 * //   size: 495616
 * // }
 * ```
 *
 * You can visualize the predictions as follows:
 * ```javascript
 * const preds = logits
 *   .unsqueeze_(1)
 *   .sigmoid_()
 *   .mul_(255)
 *   .round_()
 *   .to('uint8');
 *
 * for (let i = 0; i < preds.dims[0]; ++i) {
 *   const img = RawImage.fromTensor(preds[i]);
 *   img.save(`prediction_${i}.png`);
 * }
 * ```
 */
export class CLIPSegForImageSegmentation extends CLIPSegPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// GPT2 models
export class GPT2PreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `GPT2PreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.n_head;
    this.num_layers = this.config.n_layer;
    this.dim_kv = this.config.n_embd / this.num_heads;
  }
}

export class GPT2Model extends GPT2PreTrainedModel {}

/**
 * GPT-2 language model head on top of the GPT-2 base model. This model is suitable for text generation tasks.
 */
export class GPT2LMHeadModel extends GPT2PreTrainedModel {}
// export class GPT2ForSequenceClassification extends GPT2PreTrainedModel {
// TODO
// }
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// GPTNeo models
export class GPTNeoPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `GPTNeoPreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.num_heads;
    this.num_layers = this.config.num_layers;
    this.dim_kv = this.config.hidden_size / this.num_heads;
  }
}
export class GPTNeoModel extends GPTNeoPreTrainedModel {}

export class GPTNeoForCausalLM extends GPTNeoPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// GPTNeoX models
export class GPTNeoXPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `GPTNeoXPreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.num_attention_heads;
    this.num_layers = this.config.num_hidden_layers;
    this.dim_kv = this.config.hidden_size / this.num_heads;
  }
}
export class GPTNeoXModel extends GPTNeoXPreTrainedModel {}

export class GPTNeoXForCausalLM extends GPTNeoXPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// GPT-J models
export class GPTJPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `GPTJPreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.n_head;
    this.num_layers = this.config.n_layer;
    this.dim_kv = this.config.n_embd / this.num_heads;
  }
}

export class GPTJModel extends GPTJPreTrainedModel {}

export class GPTJForCausalLM extends GPTJPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// GPTBigCode models
export class GPTBigCodePreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `GPTBigCodePreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.n_head;
    this.num_layers = this.config.n_layer;
    this.dim_kv = this.config.n_embd / this.num_heads;
  }
}

export class GPTBigCodeModel extends GPTBigCodePreTrainedModel {}

export class GPTBigCodeForCausalLM extends GPTBigCodePreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// CodeGen models
export class CodeGenPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `CodeGenPreTrainedModel` class.
   * @param {Object} config The model configuration object.
   * @param {Object} session The ONNX session object.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.n_head;
    this.num_layers = this.config.n_layer;
    this.dim_kv = this.config.n_embd / this.num_heads;
  }
}
/**
 * CodeGenModel is a class representing a code generation model without a language model head.
 */
export class CodeGenModel extends CodeGenPreTrainedModel {}

/**
 * CodeGenForCausalLM is a class that represents a code generation model based on the GPT-2 architecture. It extends the `CodeGenPreTrainedModel` class.
 */
export class CodeGenForCausalLM extends CodeGenPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// LLama models

/**
 * The bare LLama Model outputting raw hidden-states without any specific head on top.
 */
export class LlamaPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `LlamaPreTrainedModel` class.
   * @param {Object} config The model configuration object.
   * @param {Object} session The ONNX session object.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads =
      this.config.num_key_value_heads ?? this.config.num_attention_heads;
    this.num_layers = this.config.num_hidden_layers;
    this.dim_kv = this.config.hidden_size / this.config.num_attention_heads;
  }
}
/**
 * The bare LLaMA Model outputting raw hidden-states without any specific head on top.
 */
export class LlamaModel extends LlamaPreTrainedModel {}

export class LlamaForCausalLM extends LlamaPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Phi models

export class PhiPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `PhiPreTrainedModel` class.
   * @param {Object} config The model configuration object.
   * @param {Object} session The ONNX session object.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.num_attention_heads;
    this.num_layers = this.config.num_hidden_layers;
    this.dim_kv = this.config.hidden_size / this.num_heads;
  }
}
/**
 * The bare Phi Model outputting raw hidden-states without any specific head on top.
 */
export class PhiModel extends PhiPreTrainedModel {}

export class PhiForCausalLM extends PhiPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Bloom models
/**
 * The Bloom Model transformer with a language modeling head on top (linear layer with weights tied to the input embeddings).
 */
export class BloomPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `BloomPreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.n_head;
    this.num_layers = this.config.n_layer;
    this.dim_kv = this.config.hidden_size / this.num_heads;
  }
}

/**
 * The bare Bloom Model transformer outputting raw hidden-states without any specific head on top.
 */
export class BloomModel extends BloomPreTrainedModel {}

/**
 * The Bloom Model transformer with a language modeling head on top (linear layer with weights tied to the input embeddings).
 */
export class BloomForCausalLM extends BloomPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// MPT models
export class MptPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `MptPreTrainedModel` class.
   * @param {Object} config The model configuration object.
   * @param {Object} session The ONNX session object.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.n_heads;
    this.num_layers = this.config.n_layers;
    this.dim_kv = this.config.d_model / this.num_heads;
  }
}

/**
 * The bare Mpt Model transformer outputting raw hidden-states without any specific head on top.
 */
export class MptModel extends MptPreTrainedModel {}

/**
 * The MPT Model transformer with a language modeling head on top (linear layer with weights tied to the input embeddings).
 */
export class MptForCausalLM extends MptPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// OPT models
export class OPTPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `OPTPreTrainedModel` class.
   * @param {Object} config The model configuration object.
   * @param {Object} session The ONNX session object.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.num_attention_heads;
    this.num_layers = this.config.num_hidden_layers;
    this.dim_kv = this.config.hidden_size / this.num_heads;
  }
}

/**
 * The bare OPT Model outputting raw hidden-states without any specific head on top.
 */
export class OPTModel extends OPTPreTrainedModel {}

/**
 * The OPT Model transformer with a language modeling head on top (linear layer with weights tied to the input embeddings).
 */
export class OPTForCausalLM extends OPTPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class ViTPreTrainedModel extends PreTrainedModel {}
export class ViTModel extends ViTPreTrainedModel {}
export class ViTForImageClassification extends ViTPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class VitMattePreTrainedModel extends PreTrainedModel {}

/**
 * ViTMatte framework leveraging any vision backbone e.g. for ADE20k, CityScapes.
 *
 * **Example:** Perform image matting with a `VitMatteForImageMatting` model.
 * ```javascript
 * import { AutoProcessor, VitMatteForImageMatting, RawImage } from '@xenova/transformers';
 *
 * // Load processor and model
 * const processor = await AutoProcessor.from_pretrained('Xenova/vitmatte-small-distinctions-646');
 * const model = await VitMatteForImageMatting.from_pretrained('Xenova/vitmatte-small-distinctions-646');
 *
 * // Load image and trimap
 * const image = await RawImage.fromURL('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/vitmatte_image.png');
 * const trimap = await RawImage.fromURL('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/vitmatte_trimap.png');
 *
 * // Prepare image + trimap for the model
 * const inputs = await processor(image, trimap);
 *
 * // Predict alpha matte
 * const { alphas } = await model(inputs);
 * // Tensor {
 * //   dims: [ 1, 1, 640, 960 ],
 * //   type: 'float32',
 * //   size: 614400,
 * //   data: Float32Array(614400) [ 0.9894027709960938, 0.9970508813858032, ... ]
 * // }
 * ```
 *
 * You can visualize the alpha matte as follows:
 * ```javascript
 * import { Tensor, cat } from '@xenova/transformers';
 *
 * // Visualize predicted alpha matte
 * const imageTensor = new Tensor(
 *   'uint8',
 *   new Uint8Array(image.data),
 *   [image.height, image.width, image.channels]
 * ).transpose(2, 0, 1);
 *
 * // Convert float (0-1) alpha matte to uint8 (0-255)
 * const alphaChannel = alphas
 *   .squeeze(0)
 *   .mul_(255)
 *   .clamp_(0, 255)
 *   .round_()
 *   .to('uint8');
 *
 * // Concatenate original image with predicted alpha
 * const imageData = cat([imageTensor, alphaChannel], 0);
 *
 * // Save output image
 * const outputImage = RawImage.fromTensor(imageData);
 * outputImage.save('output.png');
 * ```
 */
export class VitMatteForImageMatting extends VitMattePreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new ImageMattingOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class MobileViTPreTrainedModel extends PreTrainedModel {}
export class MobileViTModel extends MobileViTPreTrainedModel {}
export class MobileViTForImageClassification extends MobileViTPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
// TODO: MobileViTForSemanticSegmentation

//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class OwlViTPreTrainedModel extends PreTrainedModel {}
export class OwlViTModel extends OwlViTPreTrainedModel {}
export class OwlViTForObjectDetection extends OwlViTPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Beit Models
export class BeitPreTrainedModel extends PreTrainedModel {}
export class BeitModel extends BeitPreTrainedModel {}
export class BeitForImageClassification extends BeitPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class DetrPreTrainedModel extends PreTrainedModel {}
export class DetrModel extends DetrPreTrainedModel {}
export class DetrForObjectDetection extends DetrPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new DetrObjectDetectionOutput(await super._call(model_inputs));
  }
}

export class DetrForSegmentation extends DetrPreTrainedModel {
  /**
   * Runs the model with the provided inputs
   * @param {Object} model_inputs Model inputs
   * @returns {Promise<DetrSegmentationOutput>} Object containing segmentation outputs
   */
  async _call(model_inputs) {
    return new DetrSegmentationOutput(await super._call(model_inputs));
  }
}

export class DetrObjectDetectionOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits Classification logits (including no-object) for all queries.
   * @param {Tensor} output.pred_boxes Normalized boxes coordinates for all queries, represented as (center_x, center_y, width, height).
   * These values are normalized in [0, 1], relative to the size of each individual image in the batch (disregarding possible padding).
   */
  constructor({ logits, pred_boxes }) {
    super();
    this.logits = logits;
    this.pred_boxes = pred_boxes;
  }
}

export class DetrSegmentationOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits The output logits of the model.
   * @param {Tensor} output.pred_boxes Predicted boxes.
   * @param {Tensor} output.pred_masks Predicted masks.
   */
  constructor({ logits, pred_boxes, pred_masks }) {
    super();
    this.logits = logits;
    this.pred_boxes = pred_boxes;
    this.pred_masks = pred_masks;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class TableTransformerPreTrainedModel extends PreTrainedModel {}

/**
 * The bare Table Transformer Model (consisting of a backbone and encoder-decoder Transformer)
 * outputting raw hidden-states without any specific head on top.
 */
export class TableTransformerModel extends TableTransformerPreTrainedModel {}

/**
 * Table Transformer Model (consisting of a backbone and encoder-decoder Transformer)
 * with object detection heads on top, for tasks such as COCO detection.
 */
export class TableTransformerForObjectDetection extends TableTransformerPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new TableTransformerObjectDetectionOutput(
      await super._call(model_inputs),
    );
  }
}
export class TableTransformerObjectDetectionOutput extends DetrObjectDetectionOutput {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class DeiTPreTrainedModel extends PreTrainedModel {}
export class DeiTModel extends DeiTPreTrainedModel {}
export class DeiTForImageClassification extends DeiTPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
/**
 * An abstract class to handle weights initialization and a simple interface for downloading and loading pretrained models.
 */
export class ResNetPreTrainedModel extends PreTrainedModel {}

/**
 * The bare ResNet model outputting raw features without any specific head on top.
 */
export class ResNetModel extends ResNetPreTrainedModel {}

/**
 * ResNet Model with an image classification head on top (a linear layer on top of the pooled features), e.g. for ImageNet.
 */
export class ResNetForImageClassification extends ResNetPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class SwinPreTrainedModel extends PreTrainedModel {}
export class SwinModel extends SwinPreTrainedModel {}
export class SwinForImageClassification extends SwinPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class Swin2SRPreTrainedModel extends PreTrainedModel {}

/**
 * The bare Swin2SR Model transformer outputting raw hidden-states without any specific head on top.
 */
export class Swin2SRModel extends Swin2SRPreTrainedModel {}

/**
 * Swin2SR Model transformer with an upsampler head on top for image super resolution and restoration.
 *
 * **Example:** Super-resolution w/ `Xenova/swin2SR-classical-sr-x2-64`.
 *
 * ```javascript
 * import { AutoProcessor, Swin2SRForImageSuperResolution, RawImage } from '@xenova/transformers';
 *
 * // Load processor and model
 * const model_id = 'Xenova/swin2SR-classical-sr-x2-64';
 * const processor = await AutoProcessor.from_pretrained(model_id);
 * const model = await Swin2SRForImageSuperResolution.from_pretrained(model_id);
 *
 * // Prepare model inputs
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/butterfly.jpg';
 * const image = await RawImage.fromURL(url);
 * const inputs = await processor(image);
 *
 * // Run model
 * const outputs = await model(inputs);
 *
 * // Convert Tensor to RawImage
 * const output = outputs.reconstruction.squeeze().clamp_(0, 1).mul_(255).round_().to('uint8');
 * const outputImage = RawImage.fromTensor(output);
 * // RawImage {
 * //   data: Uint8Array(786432) [ 41, 31, 24, ... ],
 * //   width: 512,
 * //   height: 512,
 * //   channels: 3
 * // }
 * ```
 */
export class Swin2SRForImageSuperResolution extends Swin2SRPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class DPTPreTrainedModel extends PreTrainedModel {}

/**
 * The bare DPT Model transformer outputting raw hidden-states without any specific head on top.
 */
export class DPTModel extends DPTPreTrainedModel {}

/**
 * DPT Model with a depth estimation head on top (consisting of 3 convolutional layers) e.g. for KITTI, NYUv2.
 *
 * **Example:** Depth estimation w/ `Xenova/dpt-hybrid-midas`.
 * ```javascript
 * import { DPTForDepthEstimation, AutoProcessor, RawImage, interpolate, max } from '@xenova/transformers';
 *
 * // Load model and processor
 * const model_id = 'Xenova/dpt-hybrid-midas';
 * const model = await DPTForDepthEstimation.from_pretrained(model_id);
 * const processor = await AutoProcessor.from_pretrained(model_id);
 *
 * // Load image from URL
 * const url = 'http://images.cocodataset.org/val2017/000000039769.jpg';
 * const image = await RawImage.fromURL(url);
 *
 * // Prepare image for the model
 * const inputs = await processor(image);
 *
 * // Run model
 * const { predicted_depth } = await model(inputs);
 *
 * // Interpolate to original size
 * const prediction = interpolate(predicted_depth, image.size.reverse(), 'bilinear', false);
 *
 * // Visualize the prediction
 * const formatted = prediction.mul_(255 / max(prediction.data)[0]).to('uint8');
 * const depth = RawImage.fromTensor(formatted);
 * // RawImage {
 * //   data: Uint8Array(307200) [ 85, 85, 84, ... ],
 * //   width: 640,
 * //   height: 480,
 * //   channels: 1
 * // }
 * ```
 */
export class DPTForDepthEstimation extends DPTPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class GLPNPreTrainedModel extends PreTrainedModel {}

/**
 * The bare GLPN encoder (Mix-Transformer) outputting raw hidden-states without any specific head on top.
 */
export class GLPNModel extends GLPNPreTrainedModel {}

/**
 * GLPN Model transformer with a lightweight depth estimation head on top e.g. for KITTI, NYUv2.
 *
 * **Example:** Depth estimation w/ `Xenova/glpn-kitti`.
 * ```javascript
 * import { GLPNForDepthEstimation, AutoProcessor, RawImage, interpolate, max } from '@xenova/transformers';
 *
 * // Load model and processor
 * const model_id = 'Xenova/glpn-kitti';
 * const model = await GLPNForDepthEstimation.from_pretrained(model_id);
 * const processor = await AutoProcessor.from_pretrained(model_id);
 *
 * // Load image from URL
 * const url = 'http://images.cocodataset.org/val2017/000000039769.jpg';
 * const image = await RawImage.fromURL(url);
 *
 * // Prepare image for the model
 * const inputs = await processor(image);
 *
 * // Run model
 * const { predicted_depth } = await model(inputs);
 *
 * // Interpolate to original size
 * const prediction = interpolate(predicted_depth, image.size.reverse(), 'bilinear', false);
 *
 * // Visualize the prediction
 * const formatted = prediction.mul_(255 / max(prediction.data)[0]).to('uint8');
 * const depth = RawImage.fromTensor(formatted);
 * // RawImage {
 * //   data: Uint8Array(307200) [ 207, 169, 154, ... ],
 * //   width: 640,
 * //   height: 480,
 * //   channels: 1
 * // }
 * ```
 */
export class GLPNForDepthEstimation extends GLPNPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class DonutSwinPreTrainedModel extends PreTrainedModel {}

/**
 * The bare Donut Swin Model transformer outputting raw hidden-states without any specific head on top.
 *
 * **Example:** Step-by-step Document Parsing.
 *
 * ```javascript
 * import { AutoProcessor, AutoTokenizer, AutoModelForVision2Seq, RawImage } from '@xenova/transformers';
 *
 * // Choose model to use
 * const model_id = 'Xenova/donut-base-finetuned-cord-v2';
 *
 * // Prepare image inputs
 * const processor = await AutoProcessor.from_pretrained(model_id);
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/receipt.png';
 * const image = await RawImage.read(url);
 * const image_inputs = await processor(image);
 *
 * // Prepare decoder inputs
 * const tokenizer = await AutoTokenizer.from_pretrained(model_id);
 * const task_prompt = '<s_cord-v2>';
 * const decoder_input_ids = tokenizer(task_prompt, {
 *   add_special_tokens: false,
 * }).input_ids;
 *
 * // Create the model
 * const model = await AutoModelForVision2Seq.from_pretrained(model_id);
 *
 * // Run inference
 * const output = await model.generate(image_inputs.pixel_values, {
 *   decoder_input_ids,
 *   max_length: model.config.decoder.max_position_embeddings,
 * });
 *
 * // Decode output
 * const decoded = tokenizer.batch_decode(output)[0];
 * // <s_cord-v2><s_menu><s_nm> CINNAMON SUGAR</s_nm><s_unitprice> 17,000</s_unitprice><s_cnt> 1 x</s_cnt><s_price> 17,000</s_price></s_menu><s_sub_total><s_subtotal_price> 17,000</s_subtotal_price></s_sub_total><s_total><s_total_price> 17,000</s_total_price><s_cashprice> 20,000</s_cashprice><s_changeprice> 3,000</s_changeprice></s_total></s>
 * ```
 *
 * **Example:** Step-by-step Document Visual Question Answering (DocVQA)
 *
 * ```javascript
 * import { AutoProcessor, AutoTokenizer, AutoModelForVision2Seq, RawImage } from '@xenova/transformers';
 *
 * // Choose model to use
 * const model_id = 'Xenova/donut-base-finetuned-docvqa';
 *
 * // Prepare image inputs
 * const processor = await AutoProcessor.from_pretrained(model_id);
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/invoice.png';
 * const image = await RawImage.read(url);
 * const image_inputs = await processor(image);
 *
 * // Prepare decoder inputs
 * const tokenizer = await AutoTokenizer.from_pretrained(model_id);
 * const question = 'What is the invoice number?';
 * const task_prompt = `<s_docvqa><s_question>${question}</s_question><s_answer>`;
 * const decoder_input_ids = tokenizer(task_prompt, {
 *   add_special_tokens: false,
 * }).input_ids;
 *
 * // Create the model
 * const model = await AutoModelForVision2Seq.from_pretrained(model_id);
 *
 * // Run inference
 * const output = await model.generate(image_inputs.pixel_values, {
 *   decoder_input_ids,
 *   max_length: model.config.decoder.max_position_embeddings,
 * });
 *
 * // Decode output
 * const decoded = tokenizer.batch_decode(output)[0];
 * // <s_docvqa><s_question> What is the invoice number?</s_question><s_answer> us-001</s_answer></s>
 * ```
 */
export class DonutSwinModel extends DonutSwinPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class ConvNextPreTrainedModel extends PreTrainedModel {}

/**
 * The bare ConvNext model outputting raw features without any specific head on top.
 */
export class ConvNextModel extends ConvNextPreTrainedModel {}

/**
 * ConvNext Model with an image classification head on top (a linear layer on top of the pooled features), e.g. for ImageNet.
 */
export class ConvNextForImageClassification extends ConvNextPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class ConvNextV2PreTrainedModel extends PreTrainedModel {}

/**
 * The bare ConvNextV2 model outputting raw features without any specific head on top.
 */
export class ConvNextV2Model extends ConvNextV2PreTrainedModel {}

/**
 * ConvNextV2 Model with an image classification head on top (a linear layer on top of the pooled features), e.g. for ImageNet.
 */
export class ConvNextV2ForImageClassification extends ConvNextV2PreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class Dinov2PreTrainedModel extends PreTrainedModel {}

/**
 * The bare DINOv2 Model transformer outputting raw hidden-states without any specific head on top.
 */
export class Dinov2Model extends Dinov2PreTrainedModel {}

/**
 * Dinov2 Model transformer with an image classification head on top (a linear layer on top of the final hidden state of the [CLS] token) e.g. for ImageNet.
 */
export class Dinov2ForImageClassification extends Dinov2PreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class YolosPreTrainedModel extends PreTrainedModel {}
export class YolosModel extends YolosPreTrainedModel {}
export class YolosForObjectDetection extends YolosPreTrainedModel {
  /**
   * @param {any} model_inputs
   */
  async _call(model_inputs) {
    return new YolosObjectDetectionOutput(await super._call(model_inputs));
  }
}

export class YolosObjectDetectionOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits Classification logits (including no-object) for all queries.
   * @param {Tensor} output.pred_boxes Normalized boxes coordinates for all queries, represented as (center_x, center_y, width, height).
   * These values are normalized in [0, 1], relative to the size of each individual image in the batch (disregarding possible padding).
   */
  constructor({ logits, pred_boxes }) {
    super();
    this.logits = logits;
    this.pred_boxes = pred_boxes;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class SamPreTrainedModel extends PreTrainedModel {}

/**
 * Segment Anything Model (SAM) for generating segmentation masks, given an input image
 * and optional 2D location and bounding boxes.
 *
 * **Example:** Perform mask generation w/ `Xenova/sam-vit-base`.
 * ```javascript
 * import { SamModel, AutoProcessor, RawImage } from '@xenova/transformers';
 *
 * const model = await SamModel.from_pretrained('Xenova/sam-vit-base');
 * const processor = await AutoProcessor.from_pretrained('Xenova/sam-vit-base');
 *
 * const img_url = 'https://huggingface.co/ybelkada/segment-anything/resolve/main/assets/car.png';
 * const raw_image = await RawImage.read(img_url);
 * const input_points = [[[450, 600]]] // 2D localization of a window
 *
 * const inputs = await processor(raw_image, input_points);
 * const outputs = await model(inputs);
 *
 * const masks = await processor.post_process_masks(outputs.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
 * // [
 * //   Tensor {
 * //     dims: [ 1, 3, 1764, 2646 ],
 * //     type: 'bool',
 * //     data: Uint8Array(14002632) [ ... ],
 * //     size: 14002632
 * //   }
 * // ]
 * const scores = outputs.iou_scores;
 * // Tensor {
 * //   dims: [ 1, 1, 3 ],
 * //   type: 'float32',
 * //   data: Float32Array(3) [
 * //     0.8892380595207214,
 * //     0.9311248064041138,
 * //     0.983696699142456
 * //   ],
 * //   size: 3
 * // }
 * ```
 */
export class SamModel extends SamPreTrainedModel {
  /**
   * Creates a new instance of the `SamModel` class.
   * @param {Object} config The configuration object specifying the hyperparameters and other model settings.
   * @param {Object} vision_encoder The ONNX session containing the vision encoder model.
   * @param {any} prompt_encoder_mask_decoder The ONNX session containing the prompt encoder and mask decoder model.
   */
  constructor(config, vision_encoder, prompt_encoder_mask_decoder) {
    super(config, vision_encoder);
    this.prompt_encoder_mask_decoder = prompt_encoder_mask_decoder;
  }

  /**
   * Compute image embeddings and positional image embeddings, given the pixel values of an image.
   * @param {Object} model_inputs Object containing the model inputs.
   * @param {Tensor} model_inputs.pixel_values Pixel values obtained using a `SamProcessor`.
   * @returns {Promise<{ image_embeddings: Tensor, image_positional_embeddings: Tensor }>} The image embeddings and positional image embeddings.
   */
  async get_image_embeddings({ pixel_values }) {
    // in:
    //  - pixel_values: tensor.float32[batch_size,3,1024,1024]
    //
    // out:
    //  - image_embeddings: tensor.float32[batch_size,256,64,64]
    //  - image_positional_embeddings: tensor.float32[batch_size,256,64,64]
    return await encoderForward(this, { pixel_values });
  }

  /**
   * @typedef {Object} SamModelInputs Object containing the model inputs.
   * @property {Tensor} pixel_values Pixel values as a Tensor with shape `(batch_size, num_channels, height, width)`.
   * These can be obtained using a `SamProcessor`.
   * @property {Tensor} input_points Input 2D spatial points with shape `(batch_size, num_points, 2)`.
   * This is used by the prompt encoder to encode the prompt.
   * @property {Tensor} [input_labels] Input labels for the points, as a Tensor of shape `(batch_size, point_batch_size, num_points)`.
   * This is used by the prompt encoder to encode the prompt. There are 4 types of labels:
   *  - `1`: the point is a point that contains the object of interest
   *  - `0`: the point is a point that does not contain the object of interest
   *  - `-1`: the point corresponds to the background
   *  - `-10`: the point is a padding point, thus should be ignored by the prompt encoder
   * @property {Tensor} [image_embeddings] Image embeddings used by the mask decoder.
   * @property {Tensor} [image_positional_embeddings] Image positional embeddings used by the mask decoder.
   */

  /**
   * @param {SamModelInputs} model_inputs Object containing the model inputs.
   * @returns {Promise<Object>} The output of the model.
   */
  async forward(model_inputs) {
    if (
      !model_inputs.image_embeddings ||
      !model_inputs.image_positional_embeddings
    ) {
      // Compute the image embeddings if they are missing
      model_inputs = {
        ...model_inputs,
        ...(await this.get_image_embeddings(model_inputs)),
      };
    }

    if (!model_inputs.input_labels) {
      // Set default input labels if they are missing
      const shape = model_inputs.input_points.dims.slice(0, -1);
      const numElements = shape.reduce((a, b) => a * b, 1);
      model_inputs.input_labels = new Tensor(
        "int64",
        new BigInt64Array(numElements).fill(1n),
        shape,
      );
    }

    // Returns:
    //  - iou_scores: tensor.float32[batch_size,point_batch_size,3]
    //  - pred_masks: tensor.float32[batch_size,point_batch_size,3,256,256]
    return await sessionRun(this.prompt_encoder_mask_decoder, {
      input_points: model_inputs.input_points,
      input_labels: model_inputs.input_labels,
      image_embeddings: model_inputs.image_embeddings,
      image_positional_embeddings: model_inputs.image_positional_embeddings,
    });
  }

  /**
   * Runs the model with the provided inputs
   * @param {Object} model_inputs Model inputs
   * @returns {Promise<SamImageSegmentationOutput>} Object containing segmentation outputs
   */
  async _call(model_inputs) {
    return new SamImageSegmentationOutput(await super._call(model_inputs));
  }
}

/**
 * Base class for Segment-Anything model's output.
 */
export class SamImageSegmentationOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.iou_scores The output logits of the model.
   * @param {Tensor} output.pred_masks Predicted boxes.
   */
  constructor({ iou_scores, pred_masks }) {
    super();
    this.iou_scores = iou_scores;
    this.pred_masks = pred_masks;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// MarianMT models
export class MarianPreTrainedModel extends PreTrainedModel {}

export class MarianModel extends MarianPreTrainedModel {}

export class MarianMTModel extends MarianPreTrainedModel {
  /**
   * Creates a new instance of the `MarianMTModel` class.
   * @param {Object} config The model configuration object.
   * @param {Object} session The ONNX session object.
   * @param {any} decoder_merged_session
   * @param {any} generation_config
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.d_model / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.d_model / this.num_encoder_heads;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// M2M100 models
export class M2M100PreTrainedModel extends PreTrainedModel {}

export class M2M100Model extends M2M100PreTrainedModel {}

export class M2M100ForConditionalGeneration extends M2M100PreTrainedModel {
  /**
   * Creates a new instance of the `M2M100ForConditionalGeneration` class.
   * @param {Object} config The model configuration object.
   * @param {Object} session The ONNX session object.
   * @param {any} decoder_merged_session
   * @param {any} generation_config
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.d_model / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.d_model / this.num_encoder_heads;
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Wav2Vec2 models
export class Wav2Vec2PreTrainedModel extends PreTrainedModel {}

/**
 * The bare Wav2Vec2 Model transformer outputting raw hidden-states without any specific head on top.
 *
 * **Example:** Load and run a `Wav2Vec2Model` for feature extraction.
 *
 * ```javascript
 * import { AutoProcessor, AutoModel, read_audio } from '@xenova/transformers';
 *
 * // Read and preprocess audio
 * const processor = await AutoProcessor.from_pretrained('Xenova/mms-300m');
 * const audio = await read_audio('https://huggingface.co/datasets/Narsil/asr_dummy/resolve/main/mlk.flac', 16000);
 * const inputs = await processor(audio);
 *
 * // Run model with inputs
 * const model = await AutoModel.from_pretrained('Xenova/mms-300m');
 * const output = await model(inputs);
 * // {
 * //   last_hidden_state: Tensor {
 * //     dims: [ 1, 1144, 1024 ],
 * //     type: 'float32',
 * //     data: Float32Array(1171456) [ ... ],
 * //     size: 1171456
 * //   }
 * // }
 * ```
 */
export class Wav2Vec2Model extends Wav2Vec2PreTrainedModel {}

export class Wav2Vec2ForCTC extends Wav2Vec2PreTrainedModel {
  /**
   * @param {Object} model_inputs
   * @param {Tensor} model_inputs.input_values Float values of input raw speech waveform.
   * @param {Tensor} model_inputs.attention_mask Mask to avoid performing convolution and attention on padding token indices. Mask values selected in [0, 1]
   */
  async _call(model_inputs) {
    return new CausalLMOutput(await super._call(model_inputs));
  }
}

export class Wav2Vec2ForSequenceClassification extends Wav2Vec2PreTrainedModel {
  /**
   * Calls the model on new inputs.
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Hubert models
export class HubertPreTrainedModel extends PreTrainedModel {}

/**
 * The bare Hubert Model transformer outputting raw hidden-states without any specific head on top.
 *
 * **Example:** Load and run a `HubertModel` for feature extraction.
 *
 * ```javascript
 * import { AutoProcessor, AutoModel, read_audio } from '@xenova/transformers';
 *
 * // Read and preprocess audio
 * const processor = await AutoProcessor.from_pretrained('Xenova/hubert-base-ls960');
 * const audio = await read_audio('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav', 16000);
 * const inputs = await processor(audio);
 *
 * // Load and run model with inputs
 * const model = await AutoModel.from_pretrained('Xenova/hubert-base-ls960');
 * const output = await model(inputs);
 * // {
 * //   last_hidden_state: Tensor {
 * //     dims: [ 1, 549, 768 ],
 * //     type: 'float32',
 * //     data: Float32Array(421632) [0.0682469978928566, 0.08104046434164047, -0.4975186586380005, ...],
 * //     size: 421632
 * //   }
 * // }
 * ```
 */
export class HubertModel extends Wav2Vec2PreTrainedModel {}

/**
 * Hubert Model with a `language modeling` head on top for Connectionist Temporal Classification (CTC).
 */
export class HubertForCTC extends Wav2Vec2PreTrainedModel {
  /**
   * @param {Object} model_inputs
   * @param {Tensor} model_inputs.input_values Float values of input raw speech waveform.
   * @param {Tensor} model_inputs.attention_mask Mask to avoid performing convolution and attention on padding token indices. Mask values selected in [0, 1]
   */
  async _call(model_inputs) {
    return new CausalLMOutput(await super._call(model_inputs));
  }
}

/**
 * Hubert Model with a sequence classification head on top (a linear layer over the pooled output) for tasks like SUPERB Keyword Spotting.
 */
export class HubertForSequenceClassification extends Wav2Vec2PreTrainedModel {
  /**
   * Calls the model on new inputs.
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// WavLM models
/**
 * An abstract class to handle weights initialization and a simple interface for downloading and loading pretrained models.
 */
export class WavLMPreTrainedModel extends PreTrainedModel {}

/**
 * The bare WavLM Model transformer outputting raw hidden-states without any specific head on top.
 *
 * **Example:** Load and run a `WavLMModel` for feature extraction.
 *
 * ```javascript
 * import { AutoProcessor, AutoModel, read_audio } from '@xenova/transformers';
 *
 * // Read and preprocess audio
 * const processor = await AutoProcessor.from_pretrained('Xenova/wavlm-base');
 * const audio = await read_audio('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav', 16000);
 * const inputs = await processor(audio);
 *
 * // Run model with inputs
 * const model = await AutoModel.from_pretrained('Xenova/wavlm-base');
 * const output = await model(inputs);
 * // {
 * //   last_hidden_state: Tensor {
 * //     dims: [ 1, 549, 768 ],
 * //     type: 'float32',
 * //     data: Float32Array(421632) [-0.349443256855011, -0.39341306686401367,  0.022836603224277496, ...],
 * //     size: 421632
 * //   }
 * // }
 * ```
 */
export class WavLMModel extends WavLMPreTrainedModel {}

/**
 * WavLM Model with a `language modeling` head on top for Connectionist Temporal Classification (CTC).
 */
export class WavLMForCTC extends WavLMPreTrainedModel {
  /**
   * @param {Object} model_inputs
   * @param {Tensor} model_inputs.input_values Float values of input raw speech waveform.
   * @param {Tensor} model_inputs.attention_mask Mask to avoid performing convolution and attention on padding token indices. Mask values selected in [0, 1]
   */
  async _call(model_inputs) {
    return new CausalLMOutput(await super._call(model_inputs));
  }
}

/**
 * WavLM Model with a sequence classification head on top (a linear layer over the pooled output).
 */
export class WavLMForSequenceClassification extends WavLMPreTrainedModel {
  /**
   * Calls the model on new inputs.
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<SequenceClassifierOutput>} An object containing the model's output logits for sequence classification.
   */
  async _call(model_inputs) {
    return new SequenceClassifierOutput(await super._call(model_inputs));
  }
}

//////////////////////////////////////////////////
// SpeechT5 models
/**
 * An abstract class to handle weights initialization and a simple interface for downloading and loading pretrained models.
 */
export class SpeechT5PreTrainedModel extends PreTrainedModel {}

/**
 * The bare SpeechT5 Encoder-Decoder Model outputting raw hidden-states without any specific pre- or post-nets.
 */
export class SpeechT5Model extends SpeechT5PreTrainedModel {}

/**
 * SpeechT5 Model with a speech encoder and a text decoder.
 *
 * **Example:** Generate speech from text with `SpeechT5ForSpeechToText`.
 * ```javascript
 * import { AutoTokenizer, AutoProcessor, SpeechT5ForTextToSpeech, SpeechT5HifiGan, Tensor } from '@xenova/transformers';
 *
 * // Load the tokenizer and processor
 * const tokenizer = await AutoTokenizer.from_pretrained('Xenova/speecht5_tts');
 * const processor = await AutoProcessor.from_pretrained('Xenova/speecht5_tts');
 *
 * // Load the models
 * // NOTE: We use the unquantized versions as they are more accurate
 * const model = await SpeechT5ForTextToSpeech.from_pretrained('Xenova/speecht5_tts', { quantized: false });
 * const vocoder = await SpeechT5HifiGan.from_pretrained('Xenova/speecht5_hifigan', { quantized: false });
 *
 * // Load speaker embeddings from URL
 * const speaker_embeddings_data = new Float32Array(
 *     await (await fetch('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin')).arrayBuffer()
 * );
 * const speaker_embeddings = new Tensor(
 *     'float32',
 *     speaker_embeddings_data,
 *     [1, speaker_embeddings_data.length]
 * )
 *
 * // Run tokenization
 * const { input_ids } = tokenizer('Hello, my dog is cute');
 *
 * // Generate waveform
 * const { waveform } = await model.generate_speech(input_ids, speaker_embeddings, { vocoder });
 * console.log(waveform)
 * // Tensor {
 * //   dims: [ 26112 ],
 * //   type: 'float32',
 * //   size: 26112,
 * //   data: Float32Array(26112) [ -0.00043630177970044315, -0.00018082228780258447, ... ],
 * // }
 * ```
 */
export class SpeechT5ForSpeechToText extends SpeechT5PreTrainedModel {}

/**
 * SpeechT5 Model with a text encoder and a speech decoder.
 */
export class SpeechT5ForTextToSpeech extends SpeechT5PreTrainedModel {
  /**
   * Creates a new instance of the `SpeechT5ForTextToSpeech` class.
   * @param {Object} config The model configuration.
   * @param {any} session session for the model.
   * @param {any} decoder_merged_session session for the decoder.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, decoder_merged_session, generation_config) {
    super(config, session);
    this.decoder_merged_session = decoder_merged_session;
    this.generation_config = generation_config;

    this.num_decoder_layers = this.config.decoder_layers;
    this.num_decoder_heads = this.config.decoder_attention_heads;
    this.decoder_dim_kv = this.config.hidden_size / this.num_decoder_heads;

    this.num_encoder_layers = this.config.encoder_layers;
    this.num_encoder_heads = this.config.encoder_attention_heads;
    this.encoder_dim_kv = this.config.hidden_size / this.num_encoder_heads;
  }

  /**
   * @typedef {Object} SpeechOutput
   * @property {Tensor} [spectrogram] The predicted log-mel spectrogram of shape
   * `(output_sequence_length, config.num_mel_bins)`. Returned when no `vocoder` is provided
   * @property {Tensor} [waveform] The predicted waveform of shape `(num_frames,)`. Returned when a `vocoder` is provided.
   * @property {Tensor} [cross_attentions] The outputs of the decoder's cross-attention layers of shape
   * `(config.decoder_layers, config.decoder_attention_heads, output_sequence_length, input_sequence_length)`. returned when `output_cross_attentions` is `true`.
   */

  /**
   * Converts a sequence of input tokens into a sequence of mel spectrograms, which are subsequently turned into a speech waveform using a vocoder.
   * @param {Tensor} input_values Indices of input sequence tokens in the vocabulary.
   * @param {Tensor} speaker_embeddings Tensor containing the speaker embeddings.
   * @param {Object} options Optional parameters for generating speech.
   * @param {number} [options.threshold=0.5] The generated sequence ends when the predicted stop token probability exceeds this value.
   * @param {number} [options.minlenratio=0.0] Used to calculate the minimum required length for the output sequence.
   * @param {number} [options.maxlenratio=20.0] Used to calculate the maximum allowed length for the output sequence.
   * @param {Object} [options.vocoder=null] The vocoder that converts the mel spectrogram into a speech waveform. If `null`, the output is the mel spectrogram.
   * @param {boolean} [options.output_cross_attentions=false] Whether or not to return the attentions tensors of the decoder's cross-attention layers.
   * @returns {Promise<SpeechOutput>} A promise which resolves to an object containing the spectrogram, waveform, and cross-attention tensors.
   */
  async generate_speech(
    input_values,
    speaker_embeddings,
    {
      threshold = 0.5,
      minlenratio = 0.0,
      maxlenratio = 20.0,
      vocoder = null,
      // output_cross_attentions = false, // TODO add
    } = {},
  ) {
    const model_inputs = {
      input_ids: input_values,
    };

    const { encoder_outputs, encoder_attention_mask } = await encoderForward(
      this,
      model_inputs,
    );

    const r = encoder_outputs.dims[1] / this.config.reduction_factor;
    const maxlen = Math.floor(r * maxlenratio);
    const minlen = Math.floor(r * minlenratio);

    const num_mel_bins = this.config.num_mel_bins;

    let spectrogramParts = [];
    let past_key_values = null;
    let decoder_outputs = null;
    let idx = 0;

    while (true) {
      ++idx;

      const use_cache_branch = boolTensor(!!decoder_outputs);
      let output_sequence;
      if (decoder_outputs) {
        output_sequence = decoder_outputs.output_sequence_out;
      } else {
        output_sequence = new Tensor(
          "float32",
          new Float32Array(num_mel_bins),
          [1, 1, num_mel_bins],
        );
      }
      let decoderFeeds = {
        use_cache_branch,
        output_sequence,
        encoder_attention_mask: encoder_attention_mask,
        speaker_embeddings: speaker_embeddings,
        encoder_hidden_states: encoder_outputs,
      };

      this.addPastKeyValues(decoderFeeds, past_key_values);
      decoder_outputs = await sessionRun(
        this.decoder_merged_session,
        decoderFeeds,
      );
      past_key_values = this.getPastKeyValues(decoder_outputs, past_key_values);

      const { prob, spectrum } = decoder_outputs;
      spectrogramParts.push(spectrum);

      if (
        idx >= minlen &&
        // Finished when stop token or maximum length is reached.
        (Array.from(prob.data).filter((p) => p >= threshold).length > 0 ||
          idx >= maxlen)
      ) {
        break;
      }
    }

    const spectrogram = cat(spectrogramParts);
    const { waveform } = await sessionRun(vocoder.session, { spectrogram });

    return {
      spectrogram,
      waveform,
      // cross_attentions: null, // TODO add
    };
  }
}

/**
 * HiFi-GAN vocoder.
 *
 * See [SpeechT5ForSpeechToText](./models#module_models.SpeechT5ForSpeechToText) for example usage.
 */
export class SpeechT5HifiGan extends PreTrainedModel {
  main_input_name = "spectrogram";
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// TrOCR models
export class TrOCRPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `TrOCRPreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_encoder_layers = this.num_decoder_layers =
      this.config.decoder_layers;
    this.num_encoder_heads = this.num_decoder_heads =
      this.config.decoder_attention_heads;
    this.encoder_dim_kv = this.decoder_dim_kv =
      this.config.d_model / this.num_decoder_heads;
  }
}

/**
 * The TrOCR Decoder with a language modeling head.
 */
export class TrOCRForCausalLM extends TrOCRPreTrainedModel {}

//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Mistral models
/**
 * The bare Mistral Model outputting raw hidden-states without any specific head on top.
 */
export class MistralPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `MistralPreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.num_key_value_heads;
    this.num_layers = this.config.num_hidden_layers;
    this.dim_kv = this.config.hidden_size / this.config.num_attention_heads;
  }
}

export class MistralModel extends MistralPreTrainedModel {}

export class MistralForCausalLM extends MistralPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Falcon models
/**
 * The bare Falcon Model outputting raw hidden-states without any specific head on top.
 */
export class FalconPreTrainedModel extends PreTrainedModel {
  /**
   * Creates a new instance of the `FalconPreTrainedModel` class.
   * @param {Object} config The configuration of the model.
   * @param {any} session The ONNX session containing the model weights.
   * @param {GenerationConfig} generation_config The generation configuration.
   */
  constructor(config, session, generation_config) {
    super(config, session);
    this.generation_config = generation_config;

    // config doesn't contain pad_token_id, so we assume it is the eos_token_id
    this.config.pad_token_id = this.config.eos_token_id;

    this.num_heads = this.config.num_attention_heads;
    this.num_layers = this.config.num_hidden_layers;
    this.dim_kv = this.config.hidden_size / this.config.num_attention_heads;
  }
}

export class FalconModel extends FalconPreTrainedModel {}

export class FalconForCausalLM extends FalconPreTrainedModel {}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// CLAP models
export class ClapPreTrainedModel extends PreTrainedModel {}

export class ClapModel extends ClapPreTrainedModel {}

/**
 * CLAP Text Model with a projection layer on top (a linear layer on top of the pooled output).
 *
 * **Example:** Compute text embeddings with `ClapTextModelWithProjection`.
 *
 * ```javascript
 * import { AutoTokenizer, ClapTextModelWithProjection } from '@xenova/transformers';
 *
 * // Load tokenizer and text model
 * const tokenizer = await AutoTokenizer.from_pretrained('Xenova/clap-htsat-unfused');
 * const text_model = await ClapTextModelWithProjection.from_pretrained('Xenova/clap-htsat-unfused');
 *
 * // Run tokenization
 * const texts = ['a sound of a cat', 'a sound of a dog'];
 * const text_inputs = tokenizer(texts, { padding: true, truncation: true });
 *
 * // Compute embeddings
 * const { text_embeds } = await text_model(text_inputs);
 * // Tensor {
 * //   dims: [ 2, 512 ],
 * //   type: 'float32',
 * //   data: Float32Array(1024) [ ... ],
 * //   size: 1024
 * // }
 * ```
 */
export class ClapTextModelWithProjection extends ClapPreTrainedModel {
  /** @type {PreTrainedModel.from_pretrained} */
  static async from_pretrained(pretrained_model_name_or_path, options = {}) {
    // Update default model file name if not provided
    options.model_file_name ??= "text_model";
    return super.from_pretrained(pretrained_model_name_or_path, options);
  }
}

/**
 * CLAP Audio Model with a projection layer on top (a linear layer on top of the pooled output).
 *
 * **Example:** Compute audio embeddings with `ClapAudioModelWithProjection`.
 *
 * ```javascript
 * import { AutoProcessor, ClapAudioModelWithProjection, read_audio } from '@xenova/transformers';
 *
 * // Load processor and audio model
 * const processor = await AutoProcessor.from_pretrained('Xenova/clap-htsat-unfused');
 * const audio_model = await ClapAudioModelWithProjection.from_pretrained('Xenova/clap-htsat-unfused');
 *
 * // Read audio and run processor
 * const audio = await read_audio('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cat_meow.wav');
 * const audio_inputs = await processor(audio);
 *
 * // Compute embeddings
 * const { audio_embeds } = await audio_model(audio_inputs);
 * // Tensor {
 * //   dims: [ 1, 512 ],
 * //   type: 'float32',
 * //   data: Float32Array(512) [ ... ],
 * //   size: 512
 * // }
 * ```
 */
export class ClapAudioModelWithProjection extends ClapPreTrainedModel {
  /** @type {PreTrainedModel.from_pretrained} */
  static async from_pretrained(pretrained_model_name_or_path, options = {}) {
    // Update default model file name if not provided
    options.model_file_name ??= "audio_model";
    return super.from_pretrained(pretrained_model_name_or_path, options);
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// VITS models
export class VitsPreTrainedModel extends PreTrainedModel {}

/**
 * The complete VITS model, for text-to-speech synthesis.
 *
 * **Example:** Generate speech from text with `VitsModel`.
 * ```javascript
 * import { AutoTokenizer, VitsModel } from '@xenova/transformers';
 *
 * // Load the tokenizer and model
 * const tokenizer = await AutoTokenizer.from_pretrained('Xenova/mms-tts-eng');
 * const model = await VitsModel.from_pretrained('Xenova/mms-tts-eng');
 *
 * // Run tokenization
 * const inputs = tokenizer('I love transformers');
 *
 * // Generate waveform
 * const { waveform } = await model(inputs);
 * // Tensor {
 * //   dims: [ 1, 35328 ],
 * //   type: 'float32',
 * //   data: Float32Array(35328) [ ... ],
 * //   size: 35328,
 * // }
 * ```
 */
export class VitsModel extends VitsPreTrainedModel {
  /**
   * Calls the model on new inputs.
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<VitsModelOutput>} The outputs for the VITS model.
   */
  async _call(model_inputs) {
    return new VitsModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Segformer models
export class SegformerPreTrainedModel extends PreTrainedModel {}

/**
 * The bare SegFormer encoder (Mix-Transformer) outputting raw hidden-states without any specific head on top.
 */
export class SegformerModel extends SegformerPreTrainedModel {}

/**
 * SegFormer Model transformer with an image classification head on top (a linear layer on top of the final hidden states) e.g. for ImageNet.
 */
export class SegformerForImageClassification extends SegformerPreTrainedModel {}

/**
 * SegFormer Model transformer with an all-MLP decode head on top e.g. for ADE20k, CityScapes.
 */
export class SegformerForSemanticSegmentation extends SegformerPreTrainedModel {}

//////////////////////////////////////////////////

//////////////////////////////////////////////////
// AutoModels, used to simplify construction of PreTrainedModels
// (uses config to instantiate correct class)

/**
 * Base class of all AutoModels. Contains the `from_pretrained` function
 * which is used to instantiate pretrained models.
 */
export class PretrainedMixin {
  /**
   * Mapping from model type to model class.
   * @type {Map<string, Object>[]}
   */
  static MODEL_CLASS_MAPPINGS = null;

  /**
   * Whether to attempt to instantiate the base class (`PretrainedModel`) if
   * the model type is not found in the mapping.
   */
  static BASE_IF_FAIL = false;

  /** @type {PreTrainedModel.from_pretrained} */
  static async from_pretrained(
    pretrained_model_name_or_path,
    {
      quantized = true,
      progress_callback = null,
      config = null,
      cache_dir = null,
      local_files_only = false,
      revision = "main",
      model_file_name = null,
    } = {},
  ) {
    let options = {
      quantized,
      progress_callback,
      config,
      cache_dir,
      local_files_only,
      revision,
      model_file_name,
    };
    config = await AutoConfig.from_pretrained(
      pretrained_model_name_or_path,
      options,
    );
    if (!options.config) {
      // If no config was passed, reuse this config for future processing
      options.config = config;
    }

    if (!this.MODEL_CLASS_MAPPINGS) {
      throw new Error(
        "`MODEL_CLASS_MAPPINGS` not implemented for this type of `AutoClass`: " +
          this.name,
      );
    }

    for (let MODEL_CLASS_MAPPING of this.MODEL_CLASS_MAPPINGS) {
      const modelInfo = MODEL_CLASS_MAPPING.get(config.model_type);
      if (!modelInfo) {
        continue; // Item not found in this mapping
      }
      return await modelInfo[1].from_pretrained(
        pretrained_model_name_or_path,
        options,
      );
    }

    if (this.BASE_IF_FAIL) {
      console.warn(
        `Unknown model class "${config.model_type}", attempting to construct from base class.`,
      );
      return await PreTrainedModel.from_pretrained(
        pretrained_model_name_or_path,
        options,
      );
    } else {
      throw Error(`Unsupported model type: ${config.model_type}`);
    }
  }
}

const MODEL_MAPPING_NAMES_ENCODER_ONLY = new Map([
  ["bert", ["BertModel", BertModel]],
  ["roformer", ["RoFormerModel", RoFormerModel]],
  ["electra", ["ElectraModel", ElectraModel]],
  ["esm", ["EsmModel", EsmModel]],
  ["convbert", ["ConvBertModel", ConvBertModel]],
  ["camembert", ["CamembertModel", CamembertModel]],
  ["deberta", ["DebertaModel", DebertaModel]],
  ["deberta-v2", ["DebertaV2Model", DebertaV2Model]],
  ["mpnet", ["MPNetModel", MPNetModel]],
  ["albert", ["AlbertModel", AlbertModel]],
  ["distilbert", ["DistilBertModel", DistilBertModel]],
  ["roberta", ["RobertaModel", RobertaModel]],
  ["xlm", ["XLMModel", XLMModel]],
  ["xlm-roberta", ["XLMRobertaModel", XLMRobertaModel]],
  ["clap", ["ClapModel", ClapModel]],
  ["clip", ["CLIPModel", CLIPModel]],
  ["clipseg", ["CLIPSegModel", CLIPSegModel]],
  ["chinese_clip", ["ChineseCLIPModel", ChineseCLIPModel]],
  ["siglip", ["SiglipModel", SiglipModel]],
  ["mobilebert", ["MobileBertModel", MobileBertModel]],
  ["squeezebert", ["SqueezeBertModel", SqueezeBertModel]],
  ["wav2vec2", ["Wav2Vec2Model", Wav2Vec2Model]],
  ["hubert", ["HubertModel", HubertModel]],
  ["wavlm", ["WavLMModel", WavLMModel]],
  ["audio-spectrogram-transformer", ["ASTModel", ASTModel]],
  ["vits", ["VitsModel", VitsModel]],

  ["detr", ["DetrModel", DetrModel]],
  ["table-transformer", ["TableTransformerModel", TableTransformerModel]],
  ["vit", ["ViTModel", ViTModel]],
  ["mobilevit", ["MobileViTModel", MobileViTModel]],
  ["owlvit", ["OwlViTModel", OwlViTModel]],
  ["beit", ["BeitModel", BeitModel]],
  ["deit", ["DeiTModel", DeiTModel]],
  ["convnext", ["ConvNextModel", ConvNextModel]],
  ["convnextv2", ["ConvNextV2Model", ConvNextV2Model]],
  ["dinov2", ["Dinov2Model", Dinov2Model]],
  ["resnet", ["ResNetModel", ResNetModel]],
  ["swin", ["SwinModel", SwinModel]],
  ["swin2sr", ["Swin2SRModel", Swin2SRModel]],
  ["donut-swin", ["DonutSwinModel", DonutSwinModel]],
  ["yolos", ["YolosModel", YolosModel]],
  ["dpt", ["DPTModel", DPTModel]],
  ["glpn", ["GLPNModel", GLPNModel]],

  ["hifigan", ["SpeechT5HifiGan", SpeechT5HifiGan]],
]);

const MODEL_MAPPING_NAMES_ENCODER_DECODER = new Map([
  ["t5", ["T5Model", T5Model]],
  ["longt5", ["LongT5Model", LongT5Model]],
  ["mt5", ["MT5Model", MT5Model]],
  ["bart", ["BartModel", BartModel]],
  ["mbart", ["MBartModel", MBartModel]],
  ["marian", ["MarianModel", MarianModel]],
  ["whisper", ["WhisperModel", WhisperModel]],
  ["m2m_100", ["M2M100Model", M2M100Model]],
  ["blenderbot", ["BlenderbotModel", BlenderbotModel]],
  ["blenderbot-small", ["BlenderbotSmallModel", BlenderbotSmallModel]],
]);

const MODEL_MAPPING_NAMES_DECODER_ONLY = new Map([
  ["bloom", ["BloomModel", BloomModel]],
  ["gpt2", ["GPT2Model", GPT2Model]],
  ["gptj", ["GPTJModel", GPTJModel]],
  ["gpt_bigcode", ["GPTBigCodeModel", GPTBigCodeModel]],
  ["gpt_neo", ["GPTNeoModel", GPTNeoModel]],
  ["gpt_neox", ["GPTNeoXModel", GPTNeoXModel]],
  ["codegen", ["CodeGenModel", CodeGenModel]],
  ["llama", ["LlamaModel", LlamaModel]],
  ["phi", ["PhiModel", PhiModel]],
  ["mpt", ["MptModel", MptModel]],
  ["opt", ["OPTModel", OPTModel]],
  ["mistral", ["MistralModel", MistralModel]],
  ["falcon", ["FalconModel", FalconModel]],
]);

const MODEL_FOR_SPEECH_SEQ_2_SEQ_MAPPING_NAMES = new Map([
  ["speecht5", ["SpeechT5ForSpeechToText", SpeechT5ForSpeechToText]],
  [
    "whisper",
    ["WhisperForConditionalGeneration", WhisperForConditionalGeneration],
  ],
]);

const MODEL_FOR_TEXT_TO_SPECTROGRAM_MAPPING_NAMES = new Map([
  ["speecht5", ["SpeechT5ForTextToSpeech", SpeechT5ForTextToSpeech]],
]);

const MODEL_FOR_TEXT_TO_WAVEFORM_MAPPING_NAMES = new Map([
  ["vits", ["VitsModel", VitsModel]],
]);

const MODEL_FOR_SEQUENCE_CLASSIFICATION_MAPPING_NAMES = new Map([
  ["bert", ["BertForSequenceClassification", BertForSequenceClassification]],
  [
    "roformer",
    ["RoFormerForSequenceClassification", RoFormerForSequenceClassification],
  ],
  [
    "electra",
    ["ElectraForSequenceClassification", ElectraForSequenceClassification],
  ],
  ["esm", ["EsmForSequenceClassification", EsmForSequenceClassification]],
  [
    "convbert",
    ["ConvBertForSequenceClassification", ConvBertForSequenceClassification],
  ],
  [
    "camembert",
    ["CamembertForSequenceClassification", CamembertForSequenceClassification],
  ],
  [
    "deberta",
    ["DebertaForSequenceClassification", DebertaForSequenceClassification],
  ],
  [
    "deberta-v2",
    ["DebertaV2ForSequenceClassification", DebertaV2ForSequenceClassification],
  ],
  ["mpnet", ["MPNetForSequenceClassification", MPNetForSequenceClassification]],
  [
    "albert",
    ["AlbertForSequenceClassification", AlbertForSequenceClassification],
  ],
  [
    "distilbert",
    [
      "DistilBertForSequenceClassification",
      DistilBertForSequenceClassification,
    ],
  ],
  [
    "roberta",
    ["RobertaForSequenceClassification", RobertaForSequenceClassification],
  ],
  ["xlm", ["XLMForSequenceClassification", XLMForSequenceClassification]],
  [
    "xlm-roberta",
    [
      "XLMRobertaForSequenceClassification",
      XLMRobertaForSequenceClassification,
    ],
  ],
  ["bart", ["BartForSequenceClassification", BartForSequenceClassification]],
  ["mbart", ["MBartForSequenceClassification", MBartForSequenceClassification]],
  [
    "mobilebert",
    [
      "MobileBertForSequenceClassification",
      MobileBertForSequenceClassification,
    ],
  ],
  [
    "squeezebert",
    [
      "SqueezeBertForSequenceClassification",
      SqueezeBertForSequenceClassification,
    ],
  ],
]);

const MODEL_FOR_TOKEN_CLASSIFICATION_MAPPING_NAMES = new Map([
  ["bert", ["BertForTokenClassification", BertForTokenClassification]],
  [
    "roformer",
    ["RoFormerForTokenClassification", RoFormerForTokenClassification],
  ],
  ["electra", ["ElectraForTokenClassification", ElectraForTokenClassification]],
  ["esm", ["EsmForTokenClassification", EsmForTokenClassification]],
  [
    "convbert",
    ["ConvBertForTokenClassification", ConvBertForTokenClassification],
  ],
  [
    "camembert",
    ["CamembertForTokenClassification", CamembertForTokenClassification],
  ],
  ["deberta", ["DebertaForTokenClassification", DebertaForTokenClassification]],
  [
    "deberta-v2",
    ["DebertaV2ForTokenClassification", DebertaV2ForTokenClassification],
  ],
  ["mpnet", ["MPNetForTokenClassification", MPNetForTokenClassification]],
  [
    "distilbert",
    ["DistilBertForTokenClassification", DistilBertForTokenClassification],
  ],
  ["roberta", ["RobertaForTokenClassification", RobertaForTokenClassification]],
  ["xlm", ["XLMForTokenClassification", XLMForTokenClassification]],
  [
    "xlm-roberta",
    ["XLMRobertaForTokenClassification", XLMRobertaForTokenClassification],
  ],
]);

const MODEL_FOR_SEQ_TO_SEQ_CAUSAL_LM_MAPPING_NAMES = new Map([
  ["t5", ["T5ForConditionalGeneration", T5ForConditionalGeneration]],
  [
    "longt5",
    ["LongT5ForConditionalGeneration", LongT5ForConditionalGeneration],
  ],
  ["mt5", ["MT5ForConditionalGeneration", MT5ForConditionalGeneration]],
  ["bart", ["BartForConditionalGeneration", BartForConditionalGeneration]],
  ["mbart", ["MBartForConditionalGeneration", MBartForConditionalGeneration]],
  ["marian", ["MarianMTModel", MarianMTModel]],
  [
    "m2m_100",
    ["M2M100ForConditionalGeneration", M2M100ForConditionalGeneration],
  ],
  [
    "blenderbot",
    ["BlenderbotForConditionalGeneration", BlenderbotForConditionalGeneration],
  ],
  [
    "blenderbot-small",
    [
      "BlenderbotSmallForConditionalGeneration",
      BlenderbotSmallForConditionalGeneration,
    ],
  ],
]);

const MODEL_WITH_LM_HEAD_MAPPING_NAMES = new Map([
  ["bloom", ["BloomForCausalLM", BloomForCausalLM]],
  ["gpt2", ["GPT2LMHeadModel", GPT2LMHeadModel]],
  ["gptj", ["GPTJForCausalLM", GPTJForCausalLM]],
  ["gpt_bigcode", ["GPTBigCodeForCausalLM", GPTBigCodeForCausalLM]],
  ["gpt_neo", ["GPTNeoForCausalLM", GPTNeoForCausalLM]],
  ["gpt_neox", ["GPTNeoXForCausalLM", GPTNeoXForCausalLM]],
  ["codegen", ["CodeGenForCausalLM", CodeGenForCausalLM]],
  ["llama", ["LlamaForCausalLM", LlamaForCausalLM]],
  ["phi", ["PhiForCausalLM", PhiForCausalLM]],
  ["mpt", ["MptForCausalLM", MptForCausalLM]],
  ["opt", ["OPTForCausalLM", OPTForCausalLM]],
  ["mbart", ["MBartForCausalLM", MBartForCausalLM]],
  ["mistral", ["MistralForCausalLM", MistralForCausalLM]],
  ["falcon", ["FalconForCausalLM", FalconForCausalLM]],
  ["trocr", ["TrOCRForCausalLM", TrOCRForCausalLM]],
]);

const MODEL_FOR_MASKED_LM_MAPPING_NAMES = new Map([
  ["bert", ["BertForMaskedLM", BertForMaskedLM]],
  ["roformer", ["RoFormerForMaskedLM", RoFormerForMaskedLM]],
  ["electra", ["ElectraForMaskedLM", ElectraForMaskedLM]],
  ["esm", ["EsmForMaskedLM", EsmForMaskedLM]],
  ["convbert", ["ConvBertForMaskedLM", ConvBertForMaskedLM]],
  ["camembert", ["CamembertForMaskedLM", CamembertForMaskedLM]],
  ["deberta", ["DebertaForMaskedLM", DebertaForMaskedLM]],
  ["deberta-v2", ["DebertaV2ForMaskedLM", DebertaV2ForMaskedLM]],
  ["mpnet", ["MPNetForMaskedLM", MPNetForMaskedLM]],
  ["albert", ["AlbertForMaskedLM", AlbertForMaskedLM]],
  ["distilbert", ["DistilBertForMaskedLM", DistilBertForMaskedLM]],
  ["roberta", ["RobertaForMaskedLM", RobertaForMaskedLM]],
  ["xlm", ["XLMWithLMHeadModel", XLMWithLMHeadModel]],
  ["xlm-roberta", ["XLMRobertaForMaskedLM", XLMRobertaForMaskedLM]],
  ["mobilebert", ["MobileBertForMaskedLM", MobileBertForMaskedLM]],
  ["squeezebert", ["SqueezeBertForMaskedLM", SqueezeBertForMaskedLM]],
]);

const MODEL_FOR_QUESTION_ANSWERING_MAPPING_NAMES = new Map([
  ["bert", ["BertForQuestionAnswering", BertForQuestionAnswering]],
  ["roformer", ["RoFormerForQuestionAnswering", RoFormerForQuestionAnswering]],
  ["electra", ["ElectraForQuestionAnswering", ElectraForQuestionAnswering]],
  ["convbert", ["ConvBertForQuestionAnswering", ConvBertForQuestionAnswering]],
  [
    "camembert",
    ["CamembertForQuestionAnswering", CamembertForQuestionAnswering],
  ],
  ["deberta", ["DebertaForQuestionAnswering", DebertaForQuestionAnswering]],
  [
    "deberta-v2",
    ["DebertaV2ForQuestionAnswering", DebertaV2ForQuestionAnswering],
  ],
  ["mpnet", ["MPNetForQuestionAnswering", MPNetForQuestionAnswering]],
  ["albert", ["AlbertForQuestionAnswering", AlbertForQuestionAnswering]],
  [
    "distilbert",
    ["DistilBertForQuestionAnswering", DistilBertForQuestionAnswering],
  ],
  ["roberta", ["RobertaForQuestionAnswering", RobertaForQuestionAnswering]],
  ["xlm", ["XLMForQuestionAnswering", XLMForQuestionAnswering]],
  [
    "xlm-roberta",
    ["XLMRobertaForQuestionAnswering", XLMRobertaForQuestionAnswering],
  ],
  [
    "mobilebert",
    ["MobileBertForQuestionAnswering", MobileBertForQuestionAnswering],
  ],
  [
    "squeezebert",
    ["SqueezeBertForQuestionAnswering", SqueezeBertForQuestionAnswering],
  ],
]);

const MODEL_FOR_VISION_2_SEQ_MAPPING_NAMES = new Map([
  [
    "vision-encoder-decoder",
    ["VisionEncoderDecoderModel", VisionEncoderDecoderModel],
  ],
]);

const MODEL_FOR_DOCUMENT_QUESTION_ANSWERING_MAPPING_NAMES = new Map([
  [
    "vision-encoder-decoder",
    ["VisionEncoderDecoderModel", VisionEncoderDecoderModel],
  ],
]);

const MODEL_FOR_IMAGE_CLASSIFICATION_MAPPING_NAMES = new Map([
  ["vit", ["ViTForImageClassification", ViTForImageClassification]],
  [
    "mobilevit",
    ["MobileViTForImageClassification", MobileViTForImageClassification],
  ],
  ["beit", ["BeitForImageClassification", BeitForImageClassification]],
  ["deit", ["DeiTForImageClassification", DeiTForImageClassification]],
  [
    "convnext",
    ["ConvNextForImageClassification", ConvNextForImageClassification],
  ],
  [
    "convnextv2",
    ["ConvNextV2ForImageClassification", ConvNextV2ForImageClassification],
  ],
  ["dinov2", ["Dinov2ForImageClassification", Dinov2ForImageClassification]],
  ["resnet", ["ResNetForImageClassification", ResNetForImageClassification]],
  ["swin", ["SwinForImageClassification", SwinForImageClassification]],
  [
    "segformer",
    ["SegformerForImageClassification", SegformerForImageClassification],
  ],
]);

const MODEL_FOR_OBJECT_DETECTION_MAPPING_NAMES = new Map([
  ["detr", ["DetrForObjectDetection", DetrForObjectDetection]],
  [
    "table-transformer",
    ["TableTransformerForObjectDetection", TableTransformerForObjectDetection],
  ],
  ["yolos", ["YolosForObjectDetection", YolosForObjectDetection]],
]);

const MODEL_FOR_ZERO_SHOT_OBJECT_DETECTION_MAPPING_NAMES = new Map([
  ["owlvit", ["OwlViTForObjectDetection", OwlViTForObjectDetection]],
]);

const MODEL_FOR_IMAGE_SEGMENTATION_MAPPING_NAMES = new Map([
  ["detr", ["DetrForSegmentation", DetrForSegmentation]],
  ["clipseg", ["CLIPSegForImageSegmentation", CLIPSegForImageSegmentation]],
]);

const MODEL_FOR_SEMANTIC_SEGMENTATION_MAPPING_NAMES = new Map([
  [
    "segformer",
    ["SegformerForSemanticSegmentation", SegformerForSemanticSegmentation],
  ],
]);

const MODEL_FOR_MASK_GENERATION_MAPPING_NAMES = new Map([
  ["sam", ["SamModel", SamModel]],
]);

const MODEL_FOR_CTC_MAPPING_NAMES = new Map([
  ["wav2vec2", ["Wav2Vec2ForCTC", Wav2Vec2ForCTC]],
  ["wavlm", ["WavLMForCTC", WavLMForCTC]],
  ["hubert", ["HubertForCTC", HubertForCTC]],
]);

const MODEL_FOR_AUDIO_CLASSIFICATION_MAPPING_NAMES = new Map([
  [
    "wav2vec2",
    ["Wav2Vec2ForSequenceClassification", Wav2Vec2ForSequenceClassification],
  ],
  ["wavlm", ["WavLMForSequenceClassification", WavLMForSequenceClassification]],
  [
    "hubert",
    ["HubertForSequenceClassification", HubertForSequenceClassification],
  ],
  [
    "audio-spectrogram-transformer",
    ["ASTForAudioClassification", ASTForAudioClassification],
  ],
]);

const MODEL_FOR_IMAGE_MATTING_MAPPING_NAMES = new Map([
  ["vitmatte", ["VitMatteForImageMatting", VitMatteForImageMatting]],
]);

const MODEL_FOR_IMAGE_TO_IMAGE_MAPPING_NAMES = new Map([
  [
    "swin2sr",
    ["Swin2SRForImageSuperResolution", Swin2SRForImageSuperResolution],
  ],
]);

const MODEL_FOR_DEPTH_ESTIMATION_MAPPING_NAMES = new Map([
  ["dpt", ["DPTForDepthEstimation", DPTForDepthEstimation]],
  ["glpn", ["GLPNForDepthEstimation", GLPNForDepthEstimation]],
]);

const MODEL_CLASS_TYPE_MAPPING = [
  [MODEL_MAPPING_NAMES_ENCODER_ONLY, MODEL_TYPES.EncoderOnly],
  [MODEL_MAPPING_NAMES_ENCODER_DECODER, MODEL_TYPES.EncoderDecoder],
  [MODEL_MAPPING_NAMES_DECODER_ONLY, MODEL_TYPES.DecoderOnly],
  [MODEL_FOR_SEQUENCE_CLASSIFICATION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_TOKEN_CLASSIFICATION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_SEQ_TO_SEQ_CAUSAL_LM_MAPPING_NAMES, MODEL_TYPES.Seq2Seq],
  [MODEL_FOR_SPEECH_SEQ_2_SEQ_MAPPING_NAMES, MODEL_TYPES.Seq2Seq],
  [MODEL_WITH_LM_HEAD_MAPPING_NAMES, MODEL_TYPES.DecoderOnly],
  [MODEL_FOR_MASKED_LM_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_QUESTION_ANSWERING_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_VISION_2_SEQ_MAPPING_NAMES, MODEL_TYPES.Vision2Seq],
  [MODEL_FOR_IMAGE_CLASSIFICATION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_IMAGE_SEGMENTATION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_SEMANTIC_SEGMENTATION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_IMAGE_MATTING_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_IMAGE_TO_IMAGE_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_DEPTH_ESTIMATION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_OBJECT_DETECTION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_ZERO_SHOT_OBJECT_DETECTION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_MASK_GENERATION_MAPPING_NAMES, MODEL_TYPES.MaskGeneration],
  [MODEL_FOR_CTC_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_AUDIO_CLASSIFICATION_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
  [MODEL_FOR_TEXT_TO_SPECTROGRAM_MAPPING_NAMES, MODEL_TYPES.Seq2Seq],
  [MODEL_FOR_TEXT_TO_WAVEFORM_MAPPING_NAMES, MODEL_TYPES.EncoderOnly],
];

for (const [mappings, type] of MODEL_CLASS_TYPE_MAPPING) {
  // @ts-ignore
  for (const [name, model] of mappings.values()) {
    MODEL_TYPE_MAPPING.set(name, type);
    MODEL_CLASS_TO_NAME_MAPPING.set(model, name);
    MODEL_NAME_TO_CLASS_MAPPING.set(name, model);
  }
}

const CUSTOM_MAPPING = [
  [
    "CLIPTextModelWithProjection",
    CLIPTextModelWithProjection,
    MODEL_TYPES.EncoderOnly,
  ],
  [
    "CLIPVisionModelWithProjection",
    CLIPVisionModelWithProjection,
    MODEL_TYPES.EncoderOnly,
  ],
  ["SiglipTextModel", SiglipTextModel, MODEL_TYPES.EncoderOnly],
  ["SiglipVisionModel", SiglipVisionModel, MODEL_TYPES.EncoderOnly],
  [
    "ClapTextModelWithProjection",
    ClapTextModelWithProjection,
    MODEL_TYPES.EncoderOnly,
  ],
  [
    "ClapAudioModelWithProjection",
    ClapAudioModelWithProjection,
    MODEL_TYPES.EncoderOnly,
  ],
];
for (const [name, model, type] of CUSTOM_MAPPING) {
  MODEL_TYPE_MAPPING.set(name, type);
  MODEL_CLASS_TO_NAME_MAPPING.set(model, name);
  MODEL_NAME_TO_CLASS_MAPPING.set(name, model);
}

/**
 * Helper class which is used to instantiate pretrained models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModel.from_pretrained('bert-base-uncased');
 */
export class AutoModel extends PretrainedMixin {
  /** @type {Map<string, Object>[]} */
  // @ts-ignore
  static MODEL_CLASS_MAPPINGS = MODEL_CLASS_TYPE_MAPPING.map((x) => x[0]);
  static BASE_IF_FAIL = true;
}

/**
 * Helper class which is used to instantiate pretrained sequence classification models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForSequenceClassification.from_pretrained('distilbert-base-uncased-finetuned-sst-2-english');
 */
export class AutoModelForSequenceClassification extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [
    MODEL_FOR_SEQUENCE_CLASSIFICATION_MAPPING_NAMES,
  ];
}

/**
 * Helper class which is used to instantiate pretrained token classification models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForTokenClassification.from_pretrained('Davlan/distilbert-base-multilingual-cased-ner-hrl');
 */
export class AutoModelForTokenClassification extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_TOKEN_CLASSIFICATION_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained sequence-to-sequence models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForSeq2SeqLM.from_pretrained('t5-small');
 */
export class AutoModelForSeq2SeqLM extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_SEQ_TO_SEQ_CAUSAL_LM_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained sequence-to-sequence speech-to-text models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForSpeechSeq2Seq.from_pretrained('openai/whisper-tiny.en');
 */
export class AutoModelForSpeechSeq2Seq extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_SPEECH_SEQ_2_SEQ_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained sequence-to-sequence text-to-spectrogram models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForTextToSpectrogram.from_pretrained('microsoft/speecht5_tts');
 */
export class AutoModelForTextToSpectrogram extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_TEXT_TO_SPECTROGRAM_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained text-to-waveform models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForTextToSpectrogram.from_pretrained('facebook/mms-tts-eng');
 */
export class AutoModelForTextToWaveform extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_TEXT_TO_WAVEFORM_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained causal language models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForCausalLM.from_pretrained('gpt2');
 */
export class AutoModelForCausalLM extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_WITH_LM_HEAD_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained masked language models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForMaskedLM.from_pretrained('bert-base-uncased');
 */
export class AutoModelForMaskedLM extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_MASKED_LM_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained question answering models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForQuestionAnswering.from_pretrained('distilbert-base-cased-distilled-squad');
 */
export class AutoModelForQuestionAnswering extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_QUESTION_ANSWERING_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained vision-to-sequence models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForVision2Seq.from_pretrained('nlpconnect/vit-gpt2-image-captioning');
 */
export class AutoModelForVision2Seq extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_VISION_2_SEQ_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained image classification models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForImageClassification.from_pretrained('google/vit-base-patch16-224');
 */
export class AutoModelForImageClassification extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_IMAGE_CLASSIFICATION_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained image segmentation models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForImageSegmentation.from_pretrained('facebook/detr-resnet-50-panoptic');
 */
export class AutoModelForImageSegmentation extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_IMAGE_SEGMENTATION_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained image segmentation models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForSemanticSegmentation.from_pretrained('nvidia/segformer-b3-finetuned-cityscapes-1024-1024');
 */
export class AutoModelForSemanticSegmentation extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_SEMANTIC_SEGMENTATION_MAPPING_NAMES];
}

/**
 * Helper class which is used to instantiate pretrained object detection models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForObjectDetection.from_pretrained('facebook/detr-resnet-50');
 */
export class AutoModelForObjectDetection extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_OBJECT_DETECTION_MAPPING_NAMES];
}

export class AutoModelForZeroShotObjectDetection extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [
    MODEL_FOR_ZERO_SHOT_OBJECT_DETECTION_MAPPING_NAMES,
  ];
}

/**
 * Helper class which is used to instantiate pretrained mask generation models with the `from_pretrained` function.
 * The chosen model class is determined by the type specified in the model config.
 *
 * @example
 * let model = await AutoModelForMaskGeneration.from_pretrained('Xenova/sam-vit-base');
 */
export class AutoModelForMaskGeneration extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_MASK_GENERATION_MAPPING_NAMES];
}

export class AutoModelForCTC extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_CTC_MAPPING_NAMES];
}

export class AutoModelForAudioClassification extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_AUDIO_CLASSIFICATION_MAPPING_NAMES];
}

export class AutoModelForDocumentQuestionAnswering extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [
    MODEL_FOR_DOCUMENT_QUESTION_ANSWERING_MAPPING_NAMES,
  ];
}

export class AutoModelForImageMatting extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_IMAGE_MATTING_MAPPING_NAMES];
}

export class AutoModelForImageToImage extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_IMAGE_TO_IMAGE_MAPPING_NAMES];
}

export class AutoModelForDepthEstimation extends PretrainedMixin {
  static MODEL_CLASS_MAPPINGS = [MODEL_FOR_DEPTH_ESTIMATION_MAPPING_NAMES];
}

//////////////////////////////////////////////////

//////////////////////////////////////////////////
export class Seq2SeqLMOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits The output logits of the model.
   * @param {Tensor} output.past_key_values An tensor of key/value pairs that represent the previous state of the model.
   * @param {Tensor} output.encoder_outputs The output of the encoder in a sequence-to-sequence model.
   * @param {Tensor} [output.decoder_attentions] Attentions weights of the decoder, after the attention softmax, used to compute the weighted average in the self-attention heads.
   * @param {Tensor} [output.cross_attentions] Attentions weights of the decoder's cross-attention layer, after the attention softmax, used to compute the weighted average in the cross-attention heads.
   */
  constructor({
    logits,
    past_key_values,
    encoder_outputs,
    decoder_attentions = null,
    cross_attentions = null,
  }) {
    super();
    this.logits = logits;
    this.past_key_values = past_key_values;
    this.encoder_outputs = encoder_outputs;
    this.decoder_attentions = decoder_attentions;
    this.cross_attentions = cross_attentions;
  }
}

/**
 * Base class for outputs of sentence classification models.
 */
export class SequenceClassifierOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits classification (or regression if config.num_labels==1) scores (before SoftMax).
   */
  constructor({ logits }) {
    super();
    this.logits = logits;
  }
}

/**
 * Base class for outputs of token classification models.
 */
export class TokenClassifierOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits Classification scores (before SoftMax).
   */
  constructor({ logits }) {
    super();
    this.logits = logits;
  }
}

/**
 * Base class for masked language models outputs.
 */
export class MaskedLMOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits Prediction scores of the language modeling head (scores for each vocabulary token before SoftMax).
   */
  constructor({ logits }) {
    super();
    this.logits = logits;
  }
}

/**
 * Base class for outputs of question answering models.
 */
export class QuestionAnsweringModelOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.start_logits Span-start scores (before SoftMax).
   * @param {Tensor} output.end_logits Span-end scores (before SoftMax).
   */
  constructor({ start_logits, end_logits }) {
    super();
    this.start_logits = start_logits;
    this.end_logits = end_logits;
  }
}

/**
 * Base class for causal language model (or autoregressive) outputs.
 */
export class CausalLMOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits Prediction scores of the language modeling head (scores for each vocabulary token before softmax).
   */
  constructor({ logits }) {
    super();
    this.logits = logits;
  }
}

/**
 * Base class for causal language model (or autoregressive) outputs.
 */
export class CausalLMOutputWithPast extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.logits Prediction scores of the language modeling head (scores for each vocabulary token before softmax).
   * @param {Tensor} output.past_key_values Contains pre-computed hidden-states (key and values in the self-attention blocks)
   * that can be used (see `past_key_values` input) to speed up sequential decoding.
   */
  constructor({ logits, past_key_values }) {
    super();
    this.logits = logits;
    this.past_key_values = past_key_values;
  }
}

export class ImageMattingOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.alphas Estimated alpha values, of shape `(batch_size, num_channels, height, width)`.
   */
  constructor({ alphas }) {
    super();
    this.alphas = alphas;
  }
}

/**
 * Describes the outputs for the VITS model.
 */
export class VitsModelOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.waveform The final audio waveform predicted by the model, of shape `(batch_size, sequence_length)`.
   * @param {Tensor} output.spectrogram The log-mel spectrogram predicted at the output of the flow model.
   * This spectrogram is passed to the Hi-Fi GAN decoder model to obtain the final audio waveform.
   */
  constructor({ waveform, spectrogram }) {
    super();
    this.waveform = waveform;
    this.spectrogram = spectrogram;
  }
}
