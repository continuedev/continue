/**
 * @file Pipelines provide a high-level, easy to use, API for running machine learning models.
 *
 * **Example:** Instantiate pipeline using the `pipeline` function.
 * ```javascript
 * import { pipeline } from '@xenova/transformers';
 *
 * const classifier = await pipeline('sentiment-analysis');
 * const output = await classifier('I love transformers!');
 * // [{'label': 'POSITIVE', 'score': 0.999817686}]
 * ```
 *
 * @module pipelines
 */

import {
  AutoModel,
  AutoModelForAudioClassification,
  AutoModelForCTC,
  AutoModelForCausalLM,
  AutoModelForDepthEstimation,
  AutoModelForDocumentQuestionAnswering,
  AutoModelForImageClassification,
  AutoModelForImageSegmentation,
  AutoModelForImageToImage,
  AutoModelForMaskedLM,
  AutoModelForObjectDetection,
  AutoModelForQuestionAnswering,
  AutoModelForSemanticSegmentation,
  AutoModelForSeq2SeqLM,
  AutoModelForSequenceClassification,
  AutoModelForSpeechSeq2Seq,
  AutoModelForTextToSpectrogram,
  AutoModelForTextToWaveform,
  AutoModelForTokenClassification,
  AutoModelForVision2Seq,
  AutoModelForZeroShotObjectDetection,
  PreTrainedModel,
} from "./models.js";
import { AutoProcessor, Processor } from "./processors.js";
import { AutoTokenizer, PreTrainedTokenizer } from "./tokenizers.js";

import { read_audio } from "./utils/audio.js";
import { Callable, dispatchCallback, pop, product } from "./utils/core.js";
import { getTopItems, max, round, softmax } from "./utils/maths.js";
import { Tensor, interpolate, mean_pooling } from "./utils/tensor.js";
// import { RawImage } from './utils/image.js';

/**
 * @typedef {string | RawImage | URL} ImageInput
 * @typedef {ImageInput|ImageInput[]} ImagePipelineInputs
 */

/**
 * Prepare images for further tasks.
 * @param {ImagePipelineInputs} images images to prepare.
 * @returns {Promise<RawImage[]>} returns processed images.
 * @private
 */
async function prepareImages(images) {
  if (!Array.isArray(images)) {
    images = [images];
  }

  // Possibly convert any non-images to images
  // return await Promise.all(images.map(x => RawImage.read(x)));
  return Promise.resolve([]);
}

/**
 * @typedef {string | URL | Float32Array | Float64Array} AudioInput
 * @typedef {AudioInput|AudioInput[]} AudioPipelineInputs
 */

/**
 * Prepare audios for further tasks.
 * @param {AudioPipelineInputs} audios audios to prepare.
 * @param {number} sampling_rate sampling rate of the audios.
 * @returns {Promise<Float32Array[]>} The preprocessed audio data.
 * @private
 */
async function prepareAudios(audios, sampling_rate) {
  if (!Array.isArray(audios)) {
    audios = [audios];
  }

  return await Promise.all(
    audios.map((x) => {
      if (typeof x === "string" || x instanceof URL) {
        return read_audio(x, sampling_rate);
      } else if (x instanceof Float64Array) {
        return new Float32Array(x);
      }
      return x;
    }),
  );
}

/**
 * @typedef {Object} BoundingBox
 * @property {number} xmin The minimum x coordinate of the bounding box.
 * @property {number} ymin The minimum y coordinate of the bounding box.
 * @property {number} xmax The maximum x coordinate of the bounding box.
 * @property {number} ymax The maximum y coordinate of the bounding box.
 */

/**
 * Helper function to convert list [xmin, xmax, ymin, ymax] into object { "xmin": xmin, ... }
 * @param {number[]} box The bounding box as a list.
 * @param {boolean} asInteger Whether to cast to integers.
 * @returns {BoundingBox} The bounding box as an object.
 * @private
 */
function get_bounding_box(box, asInteger) {
  if (asInteger) {
    box = box.map((x) => x | 0);
  }
  const [xmin, ymin, xmax, ymax] = box;

  return { xmin, ymin, xmax, ymax };
}

/**
 * @callback DisposeType Disposes the item.
 * @returns {Promise<void>} A promise that resolves when the item has been disposed.
 *
 * @typedef {Object} Disposable
 * @property {DisposeType} dispose A promise that resolves when the pipeline has been disposed.
 */

/**
 * The Pipeline class is the class from which all pipelines inherit.
 * Refer to this class for methods shared across different pipelines.
 * @extends Callable
 */
export class Pipeline extends Callable {
  /**
   * Create a new Pipeline.
   * @param {Object} options An object containing the following properties:
   * @param {string} [options.task] The task of the pipeline. Useful for specifying subtasks.
   * @param {PreTrainedModel} [options.model] The model used by the pipeline.
   * @param {PreTrainedTokenizer} [options.tokenizer=null] The tokenizer used by the pipeline (if any).
   * @param {Processor} [options.processor=null] The processor used by the pipeline (if any).
   */
  constructor({ task, model, tokenizer = null, processor = null }) {
    super();
    this.task = task;
    this.model = model;
    this.tokenizer = tokenizer;
    this.processor = processor;
  }

  /** @type {DisposeType} */
  async dispose() {
    await this.model.dispose();
  }
}

/**
 * @typedef {Object} ModelTokenizerConstructorArgs
 * @property {string} task The task of the pipeline. Useful for specifying subtasks.
 * @property {PreTrainedModel} model The model used by the pipeline.
 * @property {PreTrainedTokenizer} tokenizer The tokenizer used by the pipeline.
 *
 * @typedef {ModelTokenizerConstructorArgs} TextPipelineConstructorArgs An object used to instantiate a text-based pipeline.
 */

/**
 * @typedef {Object} ModelProcessorConstructorArgs
 * @property {string} task The task of the pipeline. Useful for specifying subtasks.
 * @property {PreTrainedModel} model The model used by the pipeline.
 * @property {Processor} processor The processor used by the pipeline.
 *
 * @typedef {ModelProcessorConstructorArgs} AudioPipelineConstructorArgs An object used to instantiate an audio-based pipeline.
 * @typedef {ModelProcessorConstructorArgs} ImagePipelineConstructorArgs An object used to instantiate an image-based pipeline.
 */

/**
 * @typedef {Object} ModelTokenizerProcessorConstructorArgs
 * @property {string} task The task of the pipeline. Useful for specifying subtasks.
 * @property {PreTrainedModel} model The model used by the pipeline.
 * @property {PreTrainedTokenizer} tokenizer The tokenizer used by the pipeline.
 * @property {Processor} processor The processor used by the pipeline.
 *
 * @typedef {ModelTokenizerProcessorConstructorArgs} TextAudioPipelineConstructorArgs An object used to instantiate a text- and audio-based pipeline.
 * @typedef {ModelTokenizerProcessorConstructorArgs} TextImagePipelineConstructorArgs An object used to instantiate a text- and image-based pipeline.
 */

/**
 * @typedef {Object} TextClassificationSingle
 * @property {string} label The label predicted.
 * @property {number} score The corresponding probability.
 * @typedef {TextClassificationSingle[]} TextClassificationOutput
 *
 * @typedef {Object} TextClassificationPipelineOptions Parameters specific to text classification pipelines.
 * @property {number} [topk=1] The number of top predictions to be returned.
 *
 * @callback TextClassificationPipelineCallback Classify the text(s) given as inputs.
 * @param {string|string[]} texts The input text(s) to be classified.
 * @param {TextClassificationPipelineOptions} [options] The options to use for text classification.
 * @returns {Promise<TextClassificationOutput|TextClassificationOutput[]>} An array or object containing the predicted labels and scores.
 *
 * @typedef {TextPipelineConstructorArgs & TextClassificationPipelineCallback & Disposable} TextClassificationPipelineType
 */

/**
 * Text classification pipeline using any `ModelForSequenceClassification`.
 *
 * **Example:** Sentiment-analysis w/ `Xenova/distilbert-base-uncased-finetuned-sst-2-english`.
 * ```javascript
 * const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
 * const output = await classifier('I love transformers!');
 * // [{ label: 'POSITIVE', score: 0.999788761138916 }]
 * ```
 *
 * **Example:** Multilingual sentiment-analysis w/ `Xenova/bert-base-multilingual-uncased-sentiment` (and return top 5 classes).
 * ```javascript
 * const classifier = await pipeline('sentiment-analysis', 'Xenova/bert-base-multilingual-uncased-sentiment');
 * const output = await classifier('Le meilleur film de tous les temps.', { topk: 5 });
 * // [
 * //   { label: '5 stars', score: 0.9610759615898132 },
 * //   { label: '4 stars', score: 0.03323351591825485 },
 * //   { label: '3 stars', score: 0.0036155181005597115 },
 * //   { label: '1 star', score: 0.0011325967498123646 },
 * //   { label: '2 stars', score: 0.0009423971059732139 }
 * // ]
 * ```
 *
 * **Example:** Toxic comment classification w/ `Xenova/toxic-bert` (and return all classes).
 * ```javascript
 * const classifier = await pipeline('text-classification', 'Xenova/toxic-bert');
 * const output = await classifier('I hate you!', { topk: null });
 * // [
 * //   { label: 'toxic', score: 0.9593140482902527 },
 * //   { label: 'insult', score: 0.16187334060668945 },
 * //   { label: 'obscene', score: 0.03452680632472038 },
 * //   { label: 'identity_hate', score: 0.0223250575363636 },
 * //   { label: 'threat', score: 0.019197041168808937 },
 * //   { label: 'severe_toxic', score: 0.005651099607348442 }
 * // ]
 * ```
 */
export class TextClassificationPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => TextClassificationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new TextClassificationPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {TextClassificationPipelineCallback} */
  async _call(texts, { topk = 1 } = {}) {
    // Run tokenization
    const model_inputs = this.tokenizer(texts, {
      padding: true,
      truncation: true,
    });

    // Run model
    const outputs = await this.model(model_inputs);

    // TODO: Use softmax tensor function
    const function_to_apply =
      this.model.config.problem_type === "multi_label_classification"
        ? (batch) => batch.sigmoid().data
        : (batch) => softmax(batch.data); // single_label_classification (default)

    const id2label = this.model.config.id2label;

    const toReturn = [];
    for (const batch of outputs.logits) {
      const output = function_to_apply(batch);
      const scores = getTopItems(output, topk);

      const vals = scores.map((x) => ({
        label: id2label[x[0]],
        score: x[1],
      }));
      if (topk === 1) {
        toReturn.push(...vals);
      } else {
        toReturn.push(vals);
      }
    }

    return Array.isArray(texts) || topk === 1
      ? /** @type {TextClassificationOutput} */ (toReturn)
      : /** @type {TextClassificationOutput[]} */ (toReturn)[0];
  }
}

/**
 * @typedef {Object} TokenClassificationSingle
 * @property {string} word The token/word classified. This is obtained by decoding the selected tokens.
 * @property {number} score The corresponding probability for `entity`.
 * @property {string} entity The entity predicted for that token/word.
 * @property {number} index The index of the corresponding token in the sentence.
 * @property {number} [start] The index of the start of the corresponding entity in the sentence.
 * @property {number} [end] The index of the end of the corresponding entity in the sentence.
 * @typedef {TokenClassificationSingle[]} TokenClassificationOutput
 *
 * @typedef {Object} TokenClassificationPipelineOptions Parameters specific to token classification pipelines.
 * @property {string[]} [ignore_labels] A list of labels to ignore.
 *
 * @callback TokenClassificationPipelineCallback Classify each token of the text(s) given as inputs.
 * @param {string|string[]} texts One or several texts (or one list of texts) for token classification.
 * @param {TokenClassificationPipelineOptions} [options] The options to use for token classification.
 * @returns {Promise<TokenClassificationOutput|TokenClassificationOutput[]>} The result.
 *
 * @typedef {TextPipelineConstructorArgs & TokenClassificationPipelineCallback & Disposable} TokenClassificationPipelineType
 */

/**
 * Named Entity Recognition pipeline using any `ModelForTokenClassification`.
 *
 * **Example:** Perform named entity recognition with `Xenova/bert-base-NER`.
 * ```javascript
 * const classifier = await pipeline('token-classification', 'Xenova/bert-base-NER');
 * const output = await classifier('My name is Sarah and I live in London');
 * // [
 * //   { entity: 'B-PER', score: 0.9980202913284302, index: 4, word: 'Sarah' },
 * //   { entity: 'B-LOC', score: 0.9994474053382874, index: 9, word: 'London' }
 * // ]
 * ```
 *
 * **Example:** Perform named entity recognition with `Xenova/bert-base-NER` (and return all labels).
 * ```javascript
 * const classifier = await pipeline('token-classification', 'Xenova/bert-base-NER');
 * const output = await classifier('Sarah lives in the United States of America', { ignore_labels: [] });
 * // [
 * //   { entity: 'B-PER', score: 0.9966587424278259, index: 1, word: 'Sarah' },
 * //   { entity: 'O', score: 0.9987385869026184, index: 2, word: 'lives' },
 * //   { entity: 'O', score: 0.9990072846412659, index: 3, word: 'in' },
 * //   { entity: 'O', score: 0.9988298416137695, index: 4, word: 'the' },
 * //   { entity: 'B-LOC', score: 0.9995510578155518, index: 5, word: 'United' },
 * //   { entity: 'I-LOC', score: 0.9990395307540894, index: 6, word: 'States' },
 * //   { entity: 'I-LOC', score: 0.9986724853515625, index: 7, word: 'of' },
 * //   { entity: 'I-LOC', score: 0.9975294470787048, index: 8, word: 'America' }
 * // ]
 * ```
 */
export class TokenClassificationPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => TokenClassificationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new TokenClassificationPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {TokenClassificationPipelineCallback} */
  async _call(texts, { ignore_labels = ["O"] } = {}) {
    const isBatched = Array.isArray(texts);

    // Run tokenization
    const model_inputs = this.tokenizer(isBatched ? texts : [texts], {
      padding: true,
      truncation: true,
    });

    // Run model
    const outputs = await this.model(model_inputs);

    const logits = outputs.logits;
    const id2label = this.model.config.id2label;

    const toReturn = [];
    for (let i = 0; i < logits.dims[0]; ++i) {
      const ids = model_inputs.input_ids[i];
      const batch = logits[i];

      // List of tokens that aren't ignored
      const tokens = [];
      for (let j = 0; j < batch.dims[0]; ++j) {
        const tokenData = batch[j];
        const topScoreIndex = max(tokenData.data)[1];

        const entity = id2label
          ? id2label[topScoreIndex]
          : `LABEL_${topScoreIndex}`;
        if (ignore_labels.includes(entity)) {
          // We predicted a token that should be ignored. So, we skip it.
          continue;
        }

        // TODO add option to keep special tokens?
        const word = this.tokenizer.decode([ids[j].item()], {
          skip_special_tokens: true,
        });
        if (word === "") {
          // Was a special token. So, we skip it.
          continue;
        }

        const scores = softmax(tokenData.data);

        tokens.push({
          entity: entity,
          score: scores[topScoreIndex],
          index: j,
          word: word,

          // TODO: null for now, but will add
          start: null,
          end: null,
        });
      }
      toReturn.push(tokens);
    }
    return isBatched ? toReturn : toReturn[0];
  }
}

/**
 * @typedef {Object} QuestionAnsweringOutput
 * @property {number} score The probability associated to the answer.
 * @property {number} [start] The character start index of the answer (in the tokenized version of the input).
 * @property {number} [end] The character end index of the answer (in the tokenized version of the input).
 * @property {string} answer The answer to the question.
 *
 * @typedef {Object} QuestionAnsweringPipelineOptions Parameters specific to question answering pipelines.
 * @property {number} [topk=1] The number of top answer predictions to be returned.
 *
 * @callback QuestionAnsweringPipelineCallback Answer the question(s) given as inputs by using the context(s).
 * @param {string|string[]} question One or several question(s) (must be used in conjunction with the `context` argument).
 * @param {string|string[]} context One or several context(s) associated with the question(s) (must be used in conjunction with the `question` argument).
 * @param {QuestionAnsweringPipelineOptions} [options] The options to use for question answering.
 * @returns {Promise<QuestionAnsweringOutput|QuestionAnsweringOutput[]>} An array or object containing the predicted answers and scores.
 *
 * @typedef {TextPipelineConstructorArgs & QuestionAnsweringPipelineCallback & Disposable} QuestionAnsweringPipelineType
 */

/**
 * Question Answering pipeline using any `ModelForQuestionAnswering`.
 *
 * **Example:** Run question answering with `Xenova/distilbert-base-uncased-distilled-squad`.
 * ```javascript
 * const answerer = await pipeline('question-answering', 'Xenova/distilbert-base-uncased-distilled-squad');
 * const question = 'Who was Jim Henson?';
 * const context = 'Jim Henson was a nice puppet.';
 * const output = await answerer(question, context);
 * // {
 * //   answer: "a nice puppet",
 * //   score: 0.5768911502526741
 * // }
 * ```
 */
export class QuestionAnsweringPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => QuestionAnsweringPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new QuestionAnsweringPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {QuestionAnsweringPipelineCallback} */
  async _call(question, context, { topk = 1 } = {}) {
    // Run tokenization
    const inputs = this.tokenizer(question, {
      text_pair: context,
      padding: true,
      truncation: true,
    });

    const output = await this.model(inputs);

    /** @type {QuestionAnsweringOutput[]} */
    const toReturn = [];
    for (let j = 0; j < output.start_logits.dims[0]; ++j) {
      const ids = inputs.input_ids[j];
      const sepIndex = ids.indexOf(this.tokenizer.sep_token_id);

      const s1 = Array.from(softmax(output.start_logits[j].data))
        .map((x, i) => [x, i])
        .filter((x) => x[1] > sepIndex);
      const e1 = Array.from(softmax(output.end_logits[j].data))
        .map((x, i) => [x, i])
        .filter((x) => x[1] > sepIndex);

      const options = product(s1, e1)
        .filter((x) => x[0][1] <= x[1][1])
        .map((x) => [x[0][1], x[1][1], x[0][0] * x[1][0]])
        .sort((a, b) => b[2] - a[2]);

      for (let k = 0; k < Math.min(options.length, topk); ++k) {
        const [start, end, score] = options[k];

        const answer_tokens = [...ids].slice(start, end + 1);

        const answer = this.tokenizer.decode(answer_tokens, {
          skip_special_tokens: true,
        });

        // TODO add start and end?
        // NOTE: HF returns character index
        toReturn.push({
          answer,
          score,
        });
      }
    }

    // Mimic HF's return type based on topk
    return topk === 1 ? toReturn[0] : toReturn;
  }
}

/**
 * @typedef {Object} FillMaskSingle
 * @property {string} sequence The corresponding input with the mask token prediction.
 * @property {number} score The corresponding probability.
 * @property {number} token The predicted token id (to replace the masked one).
 * @property {string} token_str The predicted token (to replace the masked one).
 * @typedef {FillMaskSingle[]} FillMaskOutput
 *
 * @typedef {Object} FillMaskPipelineOptions Parameters specific to fill mask pipelines.
 * @property {number} [topk=5] When passed, overrides the number of predictions to return.
 *
 * @callback FillMaskPipelineCallback Fill the masked token in the text(s) given as inputs.
 * @param {string|string[]} texts One or several texts (or one list of prompts) with masked tokens.
 * @param {FillMaskPipelineOptions} [options] The options to use for masked language modelling.
 * @returns {Promise<FillMaskOutput|FillMaskOutput[]>} An array of objects containing the score, predicted token, predicted token string,
 * and the sequence with the predicted token filled in, or an array of such arrays (one for each input text).
 * If only one input text is given, the output will be an array of objects.
 * @throws {Error} When the mask token is not found in the input text.
 *
 * @typedef {TextPipelineConstructorArgs & FillMaskPipelineCallback & Disposable} FillMaskPipelineType
 */

/**
 * Masked language modeling prediction pipeline using any `ModelWithLMHead`.
 *
 * **Example:** Perform masked language modelling (a.k.a. "fill-mask") with `Xenova/bert-base-uncased`.
 * ```javascript
 * const unmasker = await pipeline('fill-mask', 'Xenova/bert-base-cased');
 * const output = await unmasker('The goal of life is [MASK].');
 * // [
 * //   { token_str: 'survival', score: 0.06137419492006302, token: 8115, sequence: 'The goal of life is survival.' },
 * //   { token_str: 'love', score: 0.03902450203895569, token: 1567, sequence: 'The goal of life is love.' },
 * //   { token_str: 'happiness', score: 0.03253183513879776, token: 9266, sequence: 'The goal of life is happiness.' },
 * //   { token_str: 'freedom', score: 0.018736306577920914, token: 4438, sequence: 'The goal of life is freedom.' },
 * //   { token_str: 'life', score: 0.01859794743359089, token: 1297, sequence: 'The goal of life is life.' }
 * // ]
 * ```
 *
 * **Example:** Perform masked language modelling (a.k.a. "fill-mask") with `Xenova/bert-base-cased` (and return top result).
 * ```javascript
 * const unmasker = await pipeline('fill-mask', 'Xenova/bert-base-cased');
 * const output = await unmasker('The Milky Way is a [MASK] galaxy.', { topk: 1 });
 * // [{ token_str: 'spiral', score: 0.6299987435340881, token: 14061, sequence: 'The Milky Way is a spiral galaxy.' }]
 * ```
 */
export class FillMaskPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => FillMaskPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new FillMaskPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {FillMaskPipelineCallback} */
  async _call(texts, { topk = 5 } = {}) {
    // Run tokenization
    const model_inputs = this.tokenizer(texts, {
      padding: true,
      truncation: true,
    });

    // Run model
    const outputs = await this.model(model_inputs);

    const toReturn = [];

    for (let i = 0; i < model_inputs.input_ids.dims[0]; ++i) {
      const ids = model_inputs.input_ids[i];
      const mask_token_index = ids.indexOf(this.tokenizer.mask_token_id);

      if (mask_token_index === -1) {
        throw Error(
          `Mask token (${this.tokenizer.mask_token}) not found in text.`,
        );
      }
      const logits = outputs.logits[i];
      const itemLogits = logits[mask_token_index];

      const scores = getTopItems(softmax(itemLogits.data), topk);

      toReturn.push(
        scores.map((x) => {
          const sequence = [...ids];
          sequence[mask_token_index] = x[0];

          return {
            score: x[1],
            token: x[0],
            token_str: this.tokenizer.model.vocab[x[0]],
            sequence: this.tokenizer.decode(sequence, {
              skip_special_tokens: true,
            }),
          };
        }),
      );
    }
    return Array.isArray(texts) ? toReturn : toReturn[0];
  }
}

/**
 * @typedef {Object} Text2TextGenerationSingle
 * @property {string} generated_text The generated text.
 * @typedef {Text2TextGenerationSingle[]} Text2TextGenerationOutput
 *
 * @callback Text2TextGenerationPipelineCallback Generate the output text(s) using text(s) given as inputs.
 * @param {string|string[]} texts Input text for the encoder.
 * @param {import('./utils/generation.js').GenerationConfigType} [options] Additional keyword arguments to pass along to the generate method of the model.
 * @returns {Promise<Text2TextGenerationOutput|Text2TextGenerationOutput[]>}
 *
 * @typedef {TextPipelineConstructorArgs & Text2TextGenerationPipelineCallback & Disposable} Text2TextGenerationPipelineType
 */

/**
 * Text2TextGenerationPipeline class for generating text using a model that performs text-to-text generation tasks.
 *
 * **Example:** Text-to-text generation w/ `Xenova/LaMini-Flan-T5-783M`.
 * ```javascript
 * const generator = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M');
 * const output = await generator('how can I become more healthy?', {
 *   max_new_tokens: 100,
 * });
 * // [{ generated_text: "To become more healthy, you can: 1. Eat a balanced diet with plenty of fruits, vegetables, whole grains, lean proteins, and healthy fats. 2. Stay hydrated by drinking plenty of water. 3. Get enough sleep and manage stress levels. 4. Avoid smoking and excessive alcohol consumption. 5. Regularly exercise and maintain a healthy weight. 6. Practice good hygiene and sanitation. 7. Seek medical attention if you experience any health issues." }]
 * ```
 */
export class Text2TextGenerationPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => Text2TextGenerationPipelineType} */ (
    Pipeline
  )
{
  /** @type {'generated_text'} */
  _key = "generated_text";

  /**
   * Create a new Text2TextGenerationPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {Text2TextGenerationPipelineCallback} */
  async _call(texts, generate_kwargs = {}) {
    if (!Array.isArray(texts)) {
      texts = [texts];
    }

    // Add global prefix, if present
    if (this.model.config.prefix) {
      texts = texts.map((x) => this.model.config.prefix + x);
    }

    // Handle task specific params:
    const task_specific_params = this.model.config.task_specific_params;
    if (task_specific_params && task_specific_params[this.task]) {
      // Add prefixes, if present
      if (task_specific_params[this.task].prefix) {
        texts = texts.map((x) => task_specific_params[this.task].prefix + x);
      }

      // TODO update generation config
    }

    const tokenizer = this.tokenizer;
    const tokenizer_options = {
      padding: true,
      truncation: true,
    };
    let input_ids;
    if (
      this instanceof TranslationPipeline &&
      "_build_translation_inputs" in tokenizer
    ) {
      // TODO: move to Translation pipeline?
      // Currently put here to avoid code duplication
      // @ts-ignore
      input_ids = tokenizer._build_translation_inputs(
        texts,
        tokenizer_options,
        generate_kwargs,
      ).input_ids;
    } else {
      input_ids = tokenizer(texts, tokenizer_options).input_ids;
    }

    const outputTokenIds = await this.model.generate(
      input_ids,
      generate_kwargs,
    );

    return tokenizer
      .batch_decode(outputTokenIds, {
        skip_special_tokens: true,
      })
      .map((text) => ({ [this._key]: text }));
  }
}

/**
 * @typedef {Object} SummarizationSingle
 * @property {string} summary_text The summary text.
 * @typedef {SummarizationSingle[]} SummarizationOutput
 *
 * @callback SummarizationPipelineCallback Summarize the text(s) given as inputs.
 * @param {string|string[]} texts One or several articles (or one list of articles) to summarize.
 * @param {import('./utils/generation.js').GenerationConfigType} [options] Additional keyword arguments to pass along to the generate method of the model.
 * @returns {Promise<SummarizationOutput|SummarizationOutput[]>}
 *
 * @typedef {TextPipelineConstructorArgs & SummarizationPipelineCallback & Disposable} SummarizationPipelineType
 */

/**
 * A pipeline for summarization tasks, inheriting from Text2TextGenerationPipeline.
 *
 * **Example:** Summarization w/ `Xenova/distilbart-cnn-6-6`.
 * ```javascript
 * const generator = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
 * const text = 'The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, ' +
 *   'and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. ' +
 *   'During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest ' +
 *   'man-made structure in the world, a title it held for 41 years until the Chrysler Building in New ' +
 *   'York City was finished in 1930. It was the first structure to reach a height of 300 metres. Due to ' +
 *   'the addition of a broadcasting aerial at the top of the tower in 1957, it is now taller than the ' +
 *   'Chrysler Building by 5.2 metres (17 ft). Excluding transmitters, the Eiffel Tower is the second ' +
 *   'tallest free-standing structure in France after the Millau Viaduct.';
 * const output = await generator(text, {
 *   max_new_tokens: 100,
 * });
 * // [{ summary_text: ' The Eiffel Tower is about the same height as an 81-storey building and the tallest structure in Paris. It is the second tallest free-standing structure in France after the Millau Viaduct.' }]
 * ```
 */
export class SummarizationPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => SummarizationPipelineType} */ (
    /** @type {any} */ (Text2TextGenerationPipeline)
  )
{
  /** @type {'summary_text'} */
  _key = "summary_text";

  /**
   * Create a new SummarizationPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }
}

/**
 * @typedef {Object} TranslationSingle
 * @property {string} translation_text The translated text.
 * @typedef {TranslationSingle[]} TranslationOutput
 *
 * @callback TranslationPipelineCallback Translate the text(s) given as inputs.
 * @param {string|string[]} texts Texts to be translated.
 * @param {import('./utils/generation.js').GenerationConfigType} [options] Additional keyword arguments to pass along to the generate method of the model.
 * @returns {Promise<TranslationOutput|TranslationOutput[]>}
 *
 * @typedef {TextPipelineConstructorArgs & TranslationPipelineCallback & Disposable} TranslationPipelineType
 */

/**
 * Translates text from one language to another.
 *
 * **Example:** Multilingual translation w/ `Xenova/nllb-200-distilled-600M`.
 *
 * See [here](https://github.com/facebookresearch/flores/blob/main/flores200/README.md#languages-in-flores-200)
 * for the full list of languages and their corresponding codes.
 *
 * ```javascript
 * const translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M');
 * const output = await translator('जीवन एक चॉकलेट बॉक्स की तरह है।', {
 *   src_lang: 'hin_Deva', // Hindi
 *   tgt_lang: 'fra_Latn', // French
 * });
 * // [{ translation_text: 'La vie est comme une boîte à chocolat.' }]
 * ```
 *
 * **Example:** Multilingual translation w/ `Xenova/m2m100_418M`.
 *
 * See [here](https://huggingface.co/facebook/m2m100_418M#languages-covered)
 * for the full list of languages and their corresponding codes.
 *
 * ```javascript
 * const translator = await pipeline('translation', 'Xenova/m2m100_418M');
 * const output = await translator('生活就像一盒巧克力。', {
 *   src_lang: 'zh', // Chinese
 *   tgt_lang: 'en', // English
 * });
 * // [{ translation_text: 'Life is like a box of chocolate.' }]
 * ```
 *
 * **Example:** Multilingual translation w/ `Xenova/mbart-large-50-many-to-many-mmt`.
 *
 * See [here](https://huggingface.co/facebook/mbart-large-50-many-to-many-mmt#languages-covered)
 * for the full list of languages and their corresponding codes.
 *
 * ```javascript
 * const translator = await pipeline('translation', 'Xenova/mbart-large-50-many-to-many-mmt');
 * const output = await translator('संयुक्त राष्ट्र के प्रमुख का कहना है कि सीरिया में कोई सैन्य समाधान नहीं है', {
 *   src_lang: 'hi_IN', // Hindi
 *   tgt_lang: 'fr_XX', // French
 * });
 * // [{ translation_text: 'Le chef des Nations affirme qu 'il n 'y a military solution in Syria.' }]
 * ```
 */
export class TranslationPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => TranslationPipelineType} */ (
    /** @type {any} */ (Text2TextGenerationPipeline)
  )
{
  /** @type {'translation_text'} */
  _key = "translation_text";

  /**
   * Create a new TranslationPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }
}

/**
 * @typedef {Object} TextGenerationSingle
 * @property {string} generated_text The generated text.
 * @typedef {TextGenerationSingle[]} TextGenerationOutput
 *
 * @typedef {Object} TextGenerationSpecificParams Parameters specific to text-generation pipelines.
 * @property {boolean} [add_special_tokens] Whether or not to add special tokens when tokenizing the sequences.
 * @typedef {import('./utils/generation.js').GenerationConfigType & TextGenerationSpecificParams} TextGenerationConfig
 *
 * @callback TextGenerationPipelineCallback Complete the prompt(s) given as inputs.
 * @param {string|string[]} texts One or several prompts (or one list of prompts) to complete.
 * @param {TextGenerationConfig} [options] Additional keyword arguments to pass along to the generate method of the model.
 * @returns {Promise<TextGenerationOutput|TextGenerationOutput[]>} An array or object containing the generated texts.
 *
 * @typedef {TextPipelineConstructorArgs & TextGenerationPipelineCallback & Disposable} TextGenerationPipelineType
 */

/**
 * Language generation pipeline using any `ModelWithLMHead` or `ModelForCausalLM`.
 * This pipeline predicts the words that will follow a specified text prompt.
 * NOTE: For the full list of generation parameters, see [`GenerationConfig`](./utils/generation#module_utils/generation.GenerationConfig).
 *
 * **Example:** Text generation with `Xenova/distilgpt2` (default settings).
 * ```javascript
 * const generator = await pipeline('text-generation', 'Xenova/distilgpt2');
 * const text = 'I enjoy walking with my cute dog,';
 * const output = await generator(text);
 * // [{ generated_text: "I enjoy walking with my cute dog, and I love to play with the other dogs." }]
 * ```
 *
 * **Example:** Text generation with `Xenova/distilgpt2` (custom settings).
 * ```javascript
 * const generator = await pipeline('text-generation', 'Xenova/distilgpt2');
 * const text = 'Once upon a time, there was';
 * const output = await generator(text, {
 *   temperature: 2,
 *   max_new_tokens: 10,
 *   repetition_penalty: 1.5,
 *   no_repeat_ngram_size: 2,
 *   num_beams: 2,
 *   num_return_sequences: 2,
 * });
 * // [{
 * //   "generated_text": "Once upon a time, there was an abundance of information about the history and activities that"
 * // }, {
 * //   "generated_text": "Once upon a time, there was an abundance of information about the most important and influential"
 * // }]
 * ```
 *
 * **Example:** Run code generation with `Xenova/codegen-350M-mono`.
 * ```javascript
 * const generator = await pipeline('text-generation', 'Xenova/codegen-350M-mono');
 * const text = 'def fib(n):';
 * const output = await generator(text, {
 *   max_new_tokens: 44,
 * });
 * // [{
 * //   generated_text: 'def fib(n):\n' +
 * //     '    if n == 0:\n' +
 * //     '        return 0\n' +
 * //     '    elif n == 1:\n' +
 * //     '        return 1\n' +
 * //     '    else:\n' +
 * //     '        return fib(n-1) + fib(n-2)\n'
 * // }]
 * ```
 */
export class TextGenerationPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => TextGenerationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new TextGenerationPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {TextGenerationPipelineCallback} */
  async _call(texts, generate_kwargs = {}) {
    const isBatched = Array.isArray(texts);
    if (!isBatched) {
      texts = [/** @type {string}*/ (texts)];
    }

    // By default, do not add special tokens
    const add_special_tokens = generate_kwargs.add_special_tokens ?? false;

    this.tokenizer.padding_side = "left";
    const { input_ids, attention_mask } = this.tokenizer(texts, {
      add_special_tokens,
      padding: true,
      truncation: true,
    });

    const outputTokenIds = await this.model.generate(
      input_ids,
      generate_kwargs,
      null,
      {
        inputs_attention_mask: attention_mask,
      },
    );

    const decoded = this.tokenizer.batch_decode(outputTokenIds, {
      skip_special_tokens: true,
    });

    /** @type {TextGenerationOutput[]} */
    const toReturn = Array.from({ length: texts.length }, (_) => []);
    for (let i = 0; i < decoded.length; ++i) {
      const textIndex = Math.floor((i / outputTokenIds.length) * texts.length);

      toReturn[textIndex].push({
        generated_text: decoded[i],
      });
    }
    return !isBatched && toReturn.length === 1 ? toReturn[0] : toReturn;
  }
}

/**
 * @typedef {Object} ZeroShotClassificationOutput
 * @property {string} sequence The sequence for which this is the output.
 * @property {string[]} labels The labels sorted by order of likelihood.
 * @property {number[]} scores The probabilities for each of the labels.
 *
 * @typedef {Object} ZeroShotClassificationPipelineOptions Parameters specific to zero-shot classification pipelines.
 * @property {string} [hypothesis_template="This example is {}."] The template used to turn each
 * candidate label into an NLI-style hypothesis. The candidate label will replace the {} placeholder.
 * @property {boolean} [multi_label=false] Whether or not multiple candidate labels can be true.
 * If `false`, the scores are normalized such that the sum of the label likelihoods for each sequence
 * is 1. If `true`, the labels are considered independent and probabilities are normalized for each
 * candidate by doing a softmax of the entailment score vs. the contradiction score.
 *
 * @callback ZeroShotClassificationPipelineCallback Classify the sequence(s) given as inputs.
 * @param {string|string[]} texts The sequence(s) to classify, will be truncated if the model input is too large.
 * @param {string|string[]} candidate_labels The set of possible class labels to classify each sequence into.
 * Can be a single label, a string of comma-separated labels, or a list of labels.
 * @param {ZeroShotClassificationPipelineOptions} [options] The options to use for zero-shot classification.
 * @returns {Promise<ZeroShotClassificationOutput|ZeroShotClassificationOutput[]>} An array or object containing the predicted labels and scores.
 *
 * @typedef {TextPipelineConstructorArgs & ZeroShotClassificationPipelineCallback & Disposable} ZeroShotClassificationPipelineType
 */

/**
 * NLI-based zero-shot classification pipeline using a `ModelForSequenceClassification`
 * trained on NLI (natural language inference) tasks. Equivalent of `text-classification`
 * pipelines, but these models don't require a hardcoded number of potential classes, they
 * can be chosen at runtime. It usually means it's slower but it is **much** more flexible.
 *
 * **Example:** Zero shot classification with `Xenova/mobilebert-uncased-mnli`.
 * ```javascript
 * const classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
 * const text = 'Last week I upgraded my iOS version and ever since then my phone has been overheating whenever I use your app.';
 * const labels = [ 'mobile', 'billing', 'website', 'account access' ];
 * const output = await classifier(text, labels);
 * // {
 * //   sequence: 'Last week I upgraded my iOS version and ever since then my phone has been overheating whenever I use your app.',
 * //   labels: [ 'mobile', 'website', 'billing', 'account access' ],
 * //   scores: [ 0.5562091040482018, 0.1843621307860853, 0.13942646639336376, 0.12000229877234923 ]
 * // }
 * ```
 *
 * **Example:** Zero shot classification with `Xenova/nli-deberta-v3-xsmall` (multi-label).
 * ```javascript
 * const classifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall');
 * const text = 'I have a problem with my iphone that needs to be resolved asap!';
 * const labels = [ 'urgent', 'not urgent', 'phone', 'tablet', 'computer' ];
 * const output = await classifier(text, labels, { multi_label: true });
 * // {
 * //   sequence: 'I have a problem with my iphone that needs to be resolved asap!',
 * //   labels: [ 'urgent', 'phone', 'computer', 'tablet', 'not urgent' ],
 * //   scores: [ 0.9958870956360275, 0.9923963400697035, 0.002333537946160235, 0.0015134138567598765, 0.0010699384208377163 ]
 * // }
 * ```
 */
export class ZeroShotClassificationPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => ZeroShotClassificationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ZeroShotClassificationPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);

    // Use model config to get label2id mapping
    this.label2id = Object.fromEntries(
      Object.entries(/** @type {any} */ (this).model.config.label2id).map(
        ([k, v]) => [k.toLowerCase(), v],
      ),
    );

    this.entailment_id = this.label2id["entailment"];
    if (this.entailment_id === undefined) {
      console.warn(
        "Could not find 'entailment' in label2id mapping. Using 2 as entailment_id.",
      );
      this.entailment_id = 2;
    }

    this.contradiction_id =
      this.label2id["contradiction"] ?? this.label2id["not_entailment"];
    if (this.contradiction_id === undefined) {
      console.warn(
        "Could not find 'contradiction' in label2id mapping. Using 0 as contradiction_id.",
      );
      this.contradiction_id = 0;
    }
  }

  /** @type {ZeroShotClassificationPipelineCallback} */
  async _call(
    texts,
    candidate_labels,
    { hypothesis_template = "This example is {}.", multi_label = false } = {},
  ) {
    const isBatched = Array.isArray(texts);
    if (!isBatched) {
      texts = [/** @type {string} */ (texts)];
    }
    if (!Array.isArray(candidate_labels)) {
      candidate_labels = [candidate_labels];
    }

    // Insert labels into hypothesis template
    const hypotheses = candidate_labels.map((x) =>
      hypothesis_template.replace("{}", x),
    );

    // How to perform the softmax over the logits:
    //  - true:  softmax over the entailment vs. contradiction dim for each label independently
    //  - false: softmax the "entailment" logits over all candidate labels
    const softmaxEach = multi_label || candidate_labels.length === 1;

    /** @type {ZeroShotClassificationOutput[]} */
    const toReturn = [];
    for (const premise of texts) {
      const entails_logits = [];

      for (const hypothesis of hypotheses) {
        const inputs = this.tokenizer(premise, {
          text_pair: hypothesis,
          padding: true,
          truncation: true,
        });
        const outputs = await this.model(inputs);

        if (softmaxEach) {
          entails_logits.push([
            outputs.logits.data[this.contradiction_id],
            outputs.logits.data[this.entailment_id],
          ]);
        } else {
          entails_logits.push(outputs.logits.data[this.entailment_id]);
        }
      }

      /** @type {number[]} */
      const scores = softmaxEach
        ? entails_logits.map((x) => softmax(x)[1])
        : softmax(entails_logits);

      // Sort by scores (desc) and return scores with indices
      const scores_sorted = scores
        .map((x, i) => [x, i])
        .sort((a, b) => b[0] - a[0]);

      toReturn.push({
        sequence: premise,
        labels: scores_sorted.map((x) => candidate_labels[x[1]]),
        scores: scores_sorted.map((x) => x[0]),
      });
    }
    return isBatched ? toReturn : toReturn[0];
  }
}

/**
 * @typedef {Object} FeatureExtractionPipelineOptions Parameters specific to feature extraction pipelines.
 * @property {'none'|'mean'|'cls'} [pooling="none"] The pooling method to use.
 * @property {boolean} [normalize=false] Whether or not to normalize the embeddings in the last dimension.
 *
 * @callback FeatureExtractionPipelineCallback Extract the features of the input(s).
 * @param {string|string[]} texts One or several texts (or one list of texts) to get the features of.
 * @param {FeatureExtractionPipelineOptions} [options] The options to use for feature extraction.
 * @returns {Promise<Tensor>} The features computed by the model.
 *
 * @typedef {TextPipelineConstructorArgs & FeatureExtractionPipelineCallback & Disposable} FeatureExtractionPipelineType
 */

/**
 * Feature extraction pipeline using no model head. This pipeline extracts the hidden
 * states from the base transformer, which can be used as features in downstream tasks.
 *
 * **Example:** Run feature extraction with `bert-base-uncased` (without pooling/normalization).
 * ```javascript
 * const extractor = await pipeline('feature-extraction', 'Xenova/bert-base-uncased', { revision: 'default' });
 * const output = await extractor('This is a simple test.');
 * // Tensor {
 * //   type: 'float32',
 * //   data: Float32Array [0.05939924716949463, 0.021655935794115067, ...],
 * //   dims: [1, 8, 768]
 * // }
 * ```
 *
 * **Example:** Run feature extraction with `bert-base-uncased` (with pooling/normalization).
 * ```javascript
 * const extractor = await pipeline('feature-extraction', 'Xenova/bert-base-uncased', { revision: 'default' });
 * const output = await extractor('This is a simple test.', { pooling: 'mean', normalize: true });
 * // Tensor {
 * //   type: 'float32',
 * //   data: Float32Array [0.03373778983950615, -0.010106077417731285, ...],
 * //   dims: [1, 768]
 * // }
 * ```
 *
 * **Example:** Calculating embeddings with `sentence-transformers` models.
 * ```javascript
 * const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
 * const output = await extractor('This is a simple test.', { pooling: 'mean', normalize: true });
 * // Tensor {
 * //   type: 'float32',
 * //   data: Float32Array [0.09094982594251633, -0.014774246141314507, ...],
 * //   dims: [1, 384]
 * // }
 * ```
 */
export class FeatureExtractionPipeline
  extends /** @type {new (options: TextPipelineConstructorArgs) => FeatureExtractionPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new FeatureExtractionPipeline.
   * @param {TextPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {FeatureExtractionPipelineCallback} */
  async _call(
    texts,
    { pooling = /** @type {'none'} */ ("none"), normalize = false } = {},
  ) {
    // Run tokenization
    const model_inputs = this.tokenizer(texts, {
      padding: true,
      truncation: true,
    });

    // Run model
    const outputs = await this.model(model_inputs);

    // TODO: Provide warning to the user that they might be using model which was not exported
    // specifically for feature extraction
    // console.log(this.model.config)
    // console.log(outputs)

    /** @type {Tensor} */
    let result = outputs.last_hidden_state ?? outputs.logits;
    if (pooling === "none") {
      // Skip pooling
    } else if (pooling === "mean") {
      result = mean_pooling(result, model_inputs.attention_mask);
    } else if (pooling === "cls") {
      result = result.slice(null, 0);
    } else {
      throw Error(`Pooling method '${pooling}' not supported.`);
    }

    if (normalize) {
      result = result.normalize(2, -1);
    }

    return result;
  }
}

// TODO
// export class SentenceSimilarityPipeline extends Pipeline {
// }

/**
 * @typedef {Object} AudioClassificationSingle
 * @property {string} label The label predicted.
 * @property {number} score The corresponding probability.
 * @typedef {AudioClassificationSingle[]} AudioClassificationOutput
 *
 * @typedef {Object} AudioClassificationPipelineOptions Parameters specific to audio classification pipelines.
 * @property {number} [topk=null] The number of top labels that will be returned by the pipeline.
 * If the provided number is `null` or higher than the number of labels available in the model configuration,
 * it will default to the number of labels.
 *
 * @callback AudioClassificationPipelineCallback Classify the sequence(s) given as inputs.
 * @param {AudioPipelineInputs} audio The input audio file(s) to be classified. The input is either:
 * - `string` or `URL` that is the filename/URL of the audio file, the file will be read at the processor's sampling rate
 * to get the waveform using the [`AudioContext`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) API.
 * If `AudioContext` is not available, you should pass the raw waveform in as a Float32Array of shape `(n, )`.
 * - `Float32Array` or `Float64Array` of shape `(n, )`, representing the raw audio at the correct sampling rate (no further check will be done).
 * @param {AudioClassificationPipelineOptions} [options] The options to use for audio classification.
 * @returns {Promise<AudioClassificationOutput|AudioClassificationOutput[]>} An array or object containing the predicted labels and scores.
 *
 * @typedef {AudioPipelineConstructorArgs & AudioClassificationPipelineCallback & Disposable} AudioClassificationPipelineType
 */

/**
 * Audio classification pipeline using any `AutoModelForAudioClassification`.
 * This pipeline predicts the class of a raw waveform or an audio file.
 *
 * **Example:** Perform audio classification with `Xenova/wav2vec2-large-xlsr-53-gender-recognition-librispeech`.
 * ```javascript
 * const classifier = await pipeline('audio-classification', 'Xenova/wav2vec2-large-xlsr-53-gender-recognition-librispeech');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav';
 * const output = await classifier(url);
 * // [
 * //   { label: 'male', score: 0.9981542229652405 },
 * //   { label: 'female', score: 0.001845747814513743 }
 * // ]
 * ```
 *
 * **Example:** Perform audio classification with `Xenova/ast-finetuned-audioset-10-10-0.4593` and return top 4 results.
 * ```javascript
 * const classifier = await pipeline('audio-classification', 'Xenova/ast-finetuned-audioset-10-10-0.4593');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cat_meow.wav';
 * const output = await classifier(url, { topk: 4 });
 * // [
 * //   { label: 'Meow', score: 0.5617874264717102 },
 * //   { label: 'Cat', score: 0.22365376353263855 },
 * //   { label: 'Domestic animals, pets', score: 0.1141069084405899 },
 * //   { label: 'Animal', score: 0.08985692262649536 },
 * // ]
 * ```
 */
export class AudioClassificationPipeline
  extends /** @type {new (options: AudioPipelineConstructorArgs) => AudioClassificationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new AudioClassificationPipeline.
   * @param {AudioPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {AudioClassificationPipelineCallback} */
  async _call(audio, { topk = null } = {}) {
    const single = !Array.isArray(audio);

    const sampling_rate = this.processor.feature_extractor.config.sampling_rate;
    const preparedAudios = await prepareAudios(audio, sampling_rate);

    const id2label = this.model.config.id2label;

    const toReturn = [];
    for (const aud of preparedAudios) {
      const inputs = await this.processor(aud);
      const output = await this.model(inputs);
      const logits = output.logits[0];

      const scores = getTopItems(softmax(logits.data), topk);

      const vals = scores.map((x) => ({
        label: /** @type {string} */ (id2label[x[0]]),
        score: /** @type {number} */ (x[1]),
      }));

      if (topk === 1) {
        toReturn.push(...vals);
      } else {
        toReturn.push(vals);
      }
    }
    return !single || topk === 1
      ? /** @type {AudioClassificationOutput} */ (toReturn)
      : /** @type {AudioClassificationOutput[]} */ (toReturn)[0];
  }
}

/**
 * @typedef {Object} ZeroShotAudioClassificationOutput
 * @property {string} label The label identified by the model. It is one of the suggested `candidate_label`.
 * @property {number} score The score attributed by the model for that label (between 0 and 1).
 *
 * @typedef {Object} ZeroShotAudioClassificationPipelineOptions Parameters specific to zero-shot audio classification pipelines.
 * @property {string} [hypothesis_template="This is a sound of {}."] The sentence used in conjunction with `candidate_labels`
 * to attempt the audio classification by replacing the placeholder with the candidate_labels.
 * Then likelihood is estimated by using `logits_per_audio`.
 *
 * @callback ZeroShotAudioClassificationPipelineCallback Classify the sequence(s) given as inputs.
 * @param {AudioPipelineInputs} audio The input audio file(s) to be classified. The input is either:
 * - `string` or `URL` that is the filename/URL of the audio file, the file will be read at the processor's sampling rate
 * to get the waveform using the [`AudioContext`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) API.
 * If `AudioContext` is not available, you should pass the raw waveform in as a Float32Array of shape `(n, )`.
 * - `Float32Array` or `Float64Array` of shape `(n, )`, representing the raw audio at the correct sampling rate (no further check will be done).
 * @param {string[]} candidate_labels The candidate labels for this audio.
 * @param {ZeroShotAudioClassificationPipelineOptions} [options] The options to use for zero-shot audio classification.
 * @returns {Promise<ZeroShotAudioClassificationOutput[]|ZeroShotAudioClassificationOutput[][]>} An array of objects containing the predicted labels and scores.
 *
 * @typedef {TextAudioPipelineConstructorArgs & ZeroShotAudioClassificationPipelineCallback & Disposable} ZeroShotAudioClassificationPipelineType
 */

/**
 * Zero shot audio classification pipeline using `ClapModel`. This pipeline predicts the class of an audio when you
 * provide an audio and a set of `candidate_labels`.
 *
 * **Example**: Perform zero-shot audio classification with `Xenova/clap-htsat-unfused`.
 * ```javascript
 * const classifier = await pipeline('zero-shot-audio-classification', 'Xenova/clap-htsat-unfused');
 * const audio = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/dog_barking.wav';
 * const candidate_labels = ['dog', 'vaccum cleaner'];
 * const scores = await classifier(audio, candidate_labels);
 * // [
 * //   { score: 0.9993992447853088, label: 'dog' },
 * //   { score: 0.0006007603369653225, label: 'vaccum cleaner' }
 * // ]
 * ```
 */
export class ZeroShotAudioClassificationPipeline
  extends /** @type {new (options: TextAudioPipelineConstructorArgs) => ZeroShotAudioClassificationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ZeroShotAudioClassificationPipeline.
   * @param {TextAudioPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {ZeroShotAudioClassificationPipelineCallback} */
  async _call(
    audio,
    candidate_labels,
    { hypothesis_template = "This is a sound of {}." } = {},
  ) {
    const single = !Array.isArray(audio);
    if (single) {
      audio = [/** @type {AudioInput} */ (audio)];
    }

    // Insert label into hypothesis template
    const texts = candidate_labels.map((x) =>
      hypothesis_template.replace("{}", x),
    );

    // Run tokenization
    const text_inputs = this.tokenizer(texts, {
      padding: true,
      truncation: true,
    });

    const sampling_rate = this.processor.feature_extractor.config.sampling_rate;
    const preparedAudios = await prepareAudios(audio, sampling_rate);

    const toReturn = [];
    for (const aud of preparedAudios) {
      const audio_inputs = await this.processor(aud);

      // Run model with both text and audio inputs
      const output = await this.model({ ...text_inputs, ...audio_inputs });

      // Compute softmax per audio
      const probs = softmax(output.logits_per_audio.data);

      toReturn.push(
        [...probs].map((x, i) => ({
          score: x,
          label: candidate_labels[i],
        })),
      );
    }
    return single ? toReturn[0] : toReturn;
  }
}

/**
 * @typedef {{stride: number[], input_features: Tensor, is_last: boolean, tokens?: number[], token_timestamps?: number[]}} ChunkCallbackItem
 * @callback ChunkCallback
 * @param {ChunkCallbackItem} chunk The chunk to process.
 */

/**
 * @typedef {Object} Chunk
 * @property {[number, number]} timestamp The start and end timestamp of the chunk in seconds.
 * @property {string} text The recognized text.
 */

/**
 * @typedef {Object} AutomaticSpeechRecognitionOutput
 * @property {string} text The recognized text.
 * @property {Chunk[]} [chunks] When using `return_timestamps`, the `chunks` will become a list
 * containing all the various text chunks identified by the model.
 *
 * @typedef {Object} AutomaticSpeechRecognitionSpecificParams Parameters specific to automatic-speech-recognition pipelines.
 * @property {boolean|'word'} [kwargs.return_timestamps] Whether to return timestamps or not. Default is `false`.
 * @property {number} [kwargs.chunk_length_s] The length of audio chunks to process in seconds. Default is 0 (no chunking).
 * @property {number} [kwargs.stride_length_s] The length of overlap between consecutive audio chunks in seconds. If not provided, defaults to `chunk_length_s / 6`.
 * @property {ChunkCallback} [kwargs.chunk_callback] Callback function to be called with each chunk processed.
 * @property {boolean} [kwargs.force_full_sequences] Whether to force outputting full sequences or not. Default is `false`.
 * @property {string} [kwargs.language] The source language. Default is `null`, meaning it should be auto-detected. Use this to potentially improve performance if the source language is known.
 * @property {string} [kwargs.task] The task to perform. Default is `null`, meaning it should be auto-detected.
 * @property {number[][]} [kwargs.forced_decoder_ids] A list of pairs of integers which indicates a mapping from generation indices to token indices
 * that will be forced before sampling. For example, [[1, 123]] means the second generated token will always be a token of index 123.
 * @property {number} [num_frames] The number of frames in the input audio.
 * @typedef {import('./utils/generation.js').GenerationConfigType & AutomaticSpeechRecognitionSpecificParams} AutomaticSpeechRecognitionConfig
 *
 * @callback AutomaticSpeechRecognitionPipelineCallback Transcribe the audio sequence(s) given as inputs to text.
 * @param {AudioPipelineInputs} audio The input audio file(s) to be transcribed. The input is either:
 * - `string` or `URL` that is the filename/URL of the audio file, the file will be read at the processor's sampling rate
 * to get the waveform using the [`AudioContext`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) API.
 * If `AudioContext` is not available, you should pass the raw waveform in as a Float32Array of shape `(n, )`.
 * - `Float32Array` or `Float64Array` of shape `(n, )`, representing the raw audio at the correct sampling rate (no further check will be done).
 * @param {AutomaticSpeechRecognitionConfig} [options] Additional keyword arguments to pass along to the generate method of the model.
 * @returns {Promise<AutomaticSpeechRecognitionOutput|AutomaticSpeechRecognitionOutput[]>} An object containing the transcription text and optionally timestamps if `return_timestamps` is `true`.
 *
 * @typedef {TextAudioPipelineConstructorArgs & AutomaticSpeechRecognitionPipelineCallback & Disposable} AutomaticSpeechRecognitionPipelineType
 */

/**
 * Pipeline that aims at extracting spoken text contained within some audio.
 *
 * **Example:** Transcribe English.
 * ```javascript
 * const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav';
 * const output = await transcriber(url);
 * // { text: " And so my fellow Americans ask not what your country can do for you, ask what you can do for your country." }
 * ```
 *
 * **Example:** Transcribe English w/ timestamps.
 * ```javascript
 * const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav';
 * const output = await transcriber(url, { return_timestamps: true });
 * // {
 * //   text: " And so my fellow Americans ask not what your country can do for you, ask what you can do for your country."
 * //   chunks: [
 * //     { timestamp: [0, 8],  text: " And so my fellow Americans ask not what your country can do for you" }
 * //     { timestamp: [8, 11], text: " ask what you can do for your country." }
 * //   ]
 * // }
 * ```
 *
 * **Example:** Transcribe English w/ word-level timestamps.
 * ```javascript
 * const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav';
 * const output = await transcriber(url, { return_timestamps: 'word' });
 * // {
 * //   "text": " And so my fellow Americans ask not what your country can do for you ask what you can do for your country.",
 * //   "chunks": [
 * //     { "text": " And", "timestamp": [0, 0.78] },
 * //     { "text": " so", "timestamp": [0.78, 1.06] },
 * //     { "text": " my", "timestamp": [1.06, 1.46] },
 * //     ...
 * //     { "text": " for", "timestamp": [9.72, 9.92] },
 * //     { "text": " your", "timestamp": [9.92, 10.22] },
 * //     { "text": " country.", "timestamp": [10.22, 13.5] }
 * //   ]
 * // }
 * ```
 *
 * **Example:** Transcribe French.
 * ```javascript
 * const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/french-audio.mp3';
 * const output = await transcriber(url, { language: 'french', task: 'transcribe' });
 * // { text: " J'adore, j'aime, je n'aime pas, je déteste." }
 * ```
 *
 * **Example:** Translate French to English.
 * ```javascript
 * const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/french-audio.mp3';
 * const output = await transcriber(url, { language: 'french', task: 'translate' });
 * // { text: " I love, I like, I don't like, I hate." }
 * ```
 *
 * **Example:** Transcribe/translate audio longer than 30 seconds.
 * ```javascript
 * const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/ted_60.wav';
 * const output = await transcriber(url, { chunk_length_s: 30, stride_length_s: 5 });
 * // { text: " So in college, I was a government major, which means [...] So I'd start off light and I'd bump it up" }
 * ```
 */
export class AutomaticSpeechRecognitionPipeline
  extends /** @type {new (options: TextAudioPipelineConstructorArgs) => AutomaticSpeechRecognitionPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new AutomaticSpeechRecognitionPipeline.
   * @param {TextAudioPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {AutomaticSpeechRecognitionPipelineCallback} */
  async _call(audio, kwargs = {}) {
    switch (this.model.config.model_type) {
      case "whisper":
        return this._call_whisper(audio, kwargs);
      case "wav2vec2":
      case "hubert":
        return this._call_wav2vec2(audio, kwargs);
      default:
        throw new Error(
          `AutomaticSpeechRecognitionPipeline does not support model type '${this.model.config.model_type}'.`,
        );
    }
  }

  /**
   * @type {AutomaticSpeechRecognitionPipelineCallback}
   * @private
   */
  async _call_wav2vec2(audio, kwargs = {}) {
    // TODO use kwargs

    if (kwargs.language) {
      console.warn(
        '`language` parameter is not yet supported for `wav2vec2` models, defaulting to "English".',
      );
    }
    if (kwargs.task) {
      console.warn(
        '`task` parameter is not yet supported for `wav2vec2` models, defaulting to "transcribe".',
      );
    }

    const single = !Array.isArray(audio);
    if (single) {
      audio = [/** @type {AudioInput} */ (audio)];
    }

    const sampling_rate = this.processor.feature_extractor.config.sampling_rate;
    const preparedAudios = await prepareAudios(audio, sampling_rate);

    const toReturn = [];
    for (const aud of preparedAudios) {
      const inputs = await this.processor(aud);
      const output = await this.model(inputs);
      const logits = output.logits[0];

      const predicted_ids = [];
      for (const item of logits) {
        predicted_ids.push(max(item.data)[1]);
      }
      const predicted_sentences = this.tokenizer.decode(predicted_ids);
      toReturn.push({ text: predicted_sentences });
    }
    return single ? toReturn[0] : toReturn;
  }

  /**
   * @type {AutomaticSpeechRecognitionPipelineCallback}
   * @private
   */
  async _call_whisper(audio, kwargs = {}) {
    const return_timestamps = kwargs.return_timestamps ?? false;
    const chunk_length_s = kwargs.chunk_length_s ?? 0;
    const chunk_callback = kwargs.chunk_callback ?? null;
    const force_full_sequences = kwargs.force_full_sequences ?? false;
    let stride_length_s = kwargs.stride_length_s ?? null;

    if (return_timestamps === "word") {
      kwargs["return_token_timestamps"] = true;
    }

    const language = pop(kwargs, "language", null);
    const task = pop(kwargs, "task", null);

    if (language || task || return_timestamps) {
      if (kwargs.forced_decoder_ids) {
        throw new Error(
          "Cannot specify `language`/`task`/`return_timestamps` and `forced_decoder_ids` at the same time.",
        );
      }
      // @ts-ignore
      const decoder_prompt_ids = this.tokenizer.get_decoder_prompt_ids({
        language,
        task,
        no_timestamps: !return_timestamps,
      });
      if (decoder_prompt_ids.length > 0) {
        kwargs.forced_decoder_ids = decoder_prompt_ids;
      }
    }

    const single = !Array.isArray(audio);
    if (single) {
      audio = [/** @type {AudioInput} */ (audio)];
    }

    const time_precision =
      this.processor.feature_extractor.config.chunk_length /
      this.model.config.max_source_positions;
    const hop_length = this.processor.feature_extractor.config.hop_length;

    const sampling_rate = this.processor.feature_extractor.config.sampling_rate;
    const preparedAudios = await prepareAudios(audio, sampling_rate);

    const toReturn = [];
    for (const aud of preparedAudios) {
      /** @type {ChunkCallbackItem[]} */
      let chunks = [];
      if (chunk_length_s > 0) {
        if (stride_length_s === null) {
          stride_length_s = chunk_length_s / 6;
        } else if (chunk_length_s <= stride_length_s) {
          throw Error(
            "`chunk_length_s` must be larger than `stride_length_s`.",
          );
        }

        // TODO support different stride_length_s (for left and right)

        const window = sampling_rate * chunk_length_s;
        const stride = sampling_rate * stride_length_s;
        const jump = window - 2 * stride;
        let offset = 0;

        // Create subarrays of audio with overlaps

        while (offset < aud.length) {
          const subarr = aud.subarray(offset, offset + window);
          const feature = await this.processor(subarr);

          const isFirst = offset === 0;
          const isLast = offset + jump >= aud.length;
          chunks.push({
            stride: [subarr.length, isFirst ? 0 : stride, isLast ? 0 : stride],
            input_features: feature.input_features,
            is_last: isLast,
          });
          offset += jump;
        }
      } else {
        chunks = [
          {
            stride: [aud.length, 0, 0],
            input_features: (await this.processor(aud)).input_features,
            is_last: true,
          },
        ];
      }

      // Generate for each set of input features
      for (const chunk of chunks) {
        kwargs.num_frames = Math.floor(chunk.stride[0] / hop_length);

        // NOTE: doing sequentially for now
        const data = await this.model.generate(chunk.input_features, kwargs);

        // TODO: Right now we only get top beam
        if (return_timestamps === "word") {
          chunk.tokens = data.sequences[0];
          chunk.token_timestamps = data.token_timestamps
            .tolist()[0]
            .map((/** @type {number} */ x) => round(x, 2));
        } else {
          chunk.tokens = data[0];
        }

        // convert stride to seconds
        chunk.stride = chunk.stride.map((x) => x / sampling_rate);

        if (chunk_callback !== null) {
          chunk_callback(chunk);
        }
      }

      // Merge text chunks
      // @ts-ignore
      const [full_text, optional] = this.tokenizer._decode_asr(chunks, {
        time_precision,
        return_timestamps,
        force_full_sequences,
      });

      toReturn.push({ text: full_text, ...optional });
    }
    return single ? toReturn[0] : toReturn;
  }
}

/**
 * @typedef {Object} ImageToTextSingle
 * @property {string} generated_text The generated text.
 * @typedef {ImageToTextSingle[]} ImageToTextOutput
 *
 * @callback ImageToTextPipelineCallback Assign labels to the image(s) passed as inputs.
 * @param {ImagePipelineInputs} texts The images to be captioned.
 * @param {import('./utils/generation.js').GenerationConfigType} [options] Additional keyword arguments to pass along to the generate method of the model.
 * @returns {Promise<ImageToTextOutput|ImageToTextOutput[]>} An object (or array of objects) containing the generated text(s).
 *
 * @typedef {TextImagePipelineConstructorArgs & ImageToTextPipelineCallback & Disposable} ImageToTextPipelineType
 */

/**
 * Image To Text pipeline using a `AutoModelForVision2Seq`. This pipeline predicts a caption for a given image.
 *
 * **Example:** Generate a caption for an image w/ `Xenova/vit-gpt2-image-captioning`.
 * ```javascript
 * const captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg';
 * const output = await captioner(url);
 * // [{ generated_text: 'a cat laying on a couch with another cat' }]
 * ```
 *
 * **Example:** Optical Character Recognition (OCR) w/ `Xenova/trocr-small-handwritten`.
 * ```javascript
 * const captioner = await pipeline('image-to-text', 'Xenova/trocr-small-handwritten');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/handwriting.jpg';
 * const output = await captioner(url);
 * // [{ generated_text: 'Mr. Brown commented icily.' }]
 * ```
 */
export class ImageToTextPipeline
  extends /** @type {new (options: TextImagePipelineConstructorArgs) => ImageToTextPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ImageToTextPipeline.
   * @param {TextImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {ImageToTextPipelineCallback} */
  async _call(images, generate_kwargs = {}) {
    const isBatched = Array.isArray(images);
    const preparedImages = await prepareImages(images);

    const { pixel_values } = await this.processor(preparedImages);

    const toReturn = [];
    for (const batch of pixel_values) {
      batch.dims = [1, ...batch.dims];
      const output = await this.model.generate(batch, generate_kwargs);
      const decoded = this.tokenizer
        .batch_decode(output, {
          skip_special_tokens: true,
        })
        .map((x) => ({ generated_text: x.trim() }));
      toReturn.push(decoded);
    }

    return isBatched ? toReturn : toReturn[0];
  }
}

/**
 * @typedef {Object} ImageClassificationSingle
 * @property {string} label The label identified by the model.
 * @property {number} score The score attributed by the model for that label.
 * @typedef {ImageClassificationSingle[]} ImageClassificationOutput
 *
 * @typedef {Object} ImageClassificationPipelineOptions Parameters specific to image classification pipelines.
 * @property {number} [topk=1] The number of top labels that will be returned by the pipeline.
 *
 * @callback ImageClassificationPipelineCallback Assign labels to the image(s) passed as inputs.
 * @param {ImagePipelineInputs} images The input images(s) to be classified.
 * @param {ImageClassificationPipelineOptions} [options] The options to use for image classification.
 * @returns {Promise<ImageClassificationOutput|ImageClassificationOutput[]>} An array or object containing the predicted labels and scores.
 *
 * @typedef {ImagePipelineConstructorArgs & ImageClassificationPipelineCallback & Disposable} ImageClassificationPipelineType
 */

/**
 * Image classification pipeline using any `AutoModelForImageClassification`.
 * This pipeline predicts the class of an image.
 *
 * **Example:** Classify an image.
 * ```javascript
 * const classifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg';
 * const output = await classifier(url);
 * // [
 * //   { label: 'tiger, Panthera tigris', score: 0.632695734500885 },
 * // ]
 * ```
 *
 * **Example:** Classify an image and return top `n` classes.
 * ```javascript
 * const classifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg';
 * const output = await classifier(url, { topk: 3 });
 * // [
 * //   { label: 'tiger, Panthera tigris', score: 0.632695734500885 },
 * //   { label: 'tiger cat', score: 0.3634825646877289 },
 * //   { label: 'lion, king of beasts, Panthera leo', score: 0.00045060308184474707 },
 * // ]
 * ```
 *
 * **Example:** Classify an image and return all classes.
 * ```javascript
 * const classifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg';
 * const output = await classifier(url, { topk: 0 });
 * // [
 * //   { label: 'tiger, Panthera tigris', score: 0.632695734500885 },
 * //   { label: 'tiger cat', score: 0.3634825646877289 },
 * //   { label: 'lion, king of beasts, Panthera leo', score: 0.00045060308184474707 },
 * //   { label: 'jaguar, panther, Panthera onca, Felis onca', score: 0.00035465499968267977 },
 * //   ...
 * // ]
 * ```
 */
export class ImageClassificationPipeline
  extends /** @type {new (options: ImagePipelineConstructorArgs) => ImageClassificationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ImageClassificationPipeline.
   * @param {ImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {ImageClassificationPipelineCallback} */
  async _call(images, { topk = 1 } = {}) {
    const isBatched = Array.isArray(images);
    const preparedImages = await prepareImages(images);

    const { pixel_values } = await this.processor(preparedImages);
    const output = await this.model({ pixel_values });

    const id2label = this.model.config.id2label;
    const toReturn = [];
    for (const batch of output.logits) {
      const scores = getTopItems(softmax(batch.data), topk);

      const vals = scores.map((x) => ({
        label: id2label[x[0]],
        score: x[1],
      }));
      if (topk === 1) {
        toReturn.push(...vals);
      } else {
        toReturn.push(vals);
      }
    }

    return isBatched || topk === 1
      ? /** @type {ImageClassificationOutput} */ (toReturn)
      : /** @type {ImageClassificationOutput[]} */ (toReturn)[0];
  }
}

/**
 * @typedef {Object} ImageSegmentationPipelineOutput
 * @property {string} label The label of the segment.
 * @property {number|null} score The score of the segment.
 * @property {RawImage} mask The mask of the segment.
 *
 * @typedef {Object} ImageSegmentationPipelineOptions Parameters specific to image segmentation pipelines.
 * @property {number} [threshold=0.5] Probability threshold to filter out predicted masks.
 * @property {number} [mask_threshold=0.5] Threshold to use when turning the predicted masks into binary values.
 * @property {number} [overlap_mask_area_threshold=0.8] Mask overlap threshold to eliminate small, disconnected segments.
 * @property {null|string} [subtask=null] Segmentation task to be performed. One of [`panoptic`, `instance`, and `semantic`],
 * depending on model capabilities. If not set, the pipeline will attempt to resolve (in that order).
 * @property {number[]} [label_ids_to_fuse=null] List of label ids to fuse. If not set, do not fuse any labels.
 * @property {number[][]} [target_sizes=null] List of target sizes for the input images. If not set, use the original image sizes.
 *
 * @callback ImageSegmentationPipelineCallback Segment the input images.
 * @param {ImagePipelineInputs} images The input images.
 * @param {ImageSegmentationPipelineOptions} [options] The options to use for image segmentation.
 * @returns {Promise<ImageSegmentationPipelineOutput[]>} The annotated segments.
 *
 * @typedef {ImagePipelineConstructorArgs & ImageSegmentationPipelineCallback & Disposable} ImageSegmentationPipelineType
 */

/**
 * Image segmentation pipeline using any `AutoModelForXXXSegmentation`.
 * This pipeline predicts masks of objects and their classes.
 *
 * **Example:** Perform image segmentation with `Xenova/detr-resnet-50-panoptic`.
 * ```javascript
 * const segmenter = await pipeline('image-segmentation', 'Xenova/detr-resnet-50-panoptic');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg';
 * const output = await segmenter(url);
 * // [
 * //   { label: 'remote', score: 0.9984649419784546, mask: RawImage { ... } },
 * //   { label: 'cat', score: 0.9994316101074219, mask: RawImage { ... } }
 * // ]
 * ```
 */
export class ImageSegmentationPipeline
  extends /** @type {new (options: ImagePipelineConstructorArgs) => ImageSegmentationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ImageSegmentationPipeline.
   * @param {ImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);

    this.subtasks_mapping = {
      // Mapping of subtasks to their corresponding post-processing function names.
      panoptic: "post_process_panoptic_segmentation",
      instance: "post_process_instance_segmentation",
      semantic: "post_process_semantic_segmentation",
    };
  }

  /** @type {ImageSegmentationPipelineCallback} */
  async _call(
    images,
    {
      threshold = 0.5,
      mask_threshold = 0.5,
      overlap_mask_area_threshold = 0.8,
      label_ids_to_fuse = null,
      target_sizes = null,
      subtask = null,
    } = {},
  ) {
    const isBatched = Array.isArray(images);

    if (isBatched && images.length !== 1) {
      throw Error(
        "Image segmentation pipeline currently only supports a batch size of 1.",
      );
    }

    const preparedImages = await prepareImages(images);
    const imageSizes = preparedImages.map((x) => [x.height, x.width]);

    const { pixel_values, pixel_mask } = await this.processor(preparedImages);
    const output = await this.model({ pixel_values, pixel_mask });

    let fn = null;
    if (subtask !== null) {
      fn = this.subtasks_mapping[subtask];
    } else {
      for (let [task, func] of Object.entries(this.subtasks_mapping)) {
        if (func in this.processor.feature_extractor) {
          fn = this.processor.feature_extractor[func].bind(
            this.processor.feature_extractor,
          );
          subtask = task;
          break;
        }
      }
    }

    const id2label = this.model.config.id2label;

    /** @type {ImageSegmentationPipelineOutput[]} */
    const annotation = [];
    if (subtask === "panoptic" || subtask === "instance") {
      const processed = fn(
        output,
        threshold,
        mask_threshold,
        overlap_mask_area_threshold,
        label_ids_to_fuse,
        target_sizes ?? imageSizes, // TODO FIX?
      )[0];

      const segmentation = processed.segmentation;

      for (const segment of processed.segments_info) {
        const maskData = new Uint8ClampedArray(segmentation.data.length);
        for (let i = 0; i < segmentation.data.length; ++i) {
          if (segmentation.data[i] === segment.id) {
            maskData[i] = 255;
          }
        }

        // const mask = new RawImage(maskData, segmentation.dims[1], segmentation.dims[0], 1)

        annotation.push({
          score: segment.score,
          label: id2label[segment.label_id],
          // mask: mask
        });
      }
    } else if (subtask === "semantic") {
      const { segmentation, labels } = fn(
        output,
        target_sizes ?? imageSizes,
      )[0];

      for (const label of labels) {
        const maskData = new Uint8ClampedArray(segmentation.data.length);
        for (let i = 0; i < segmentation.data.length; ++i) {
          if (segmentation.data[i] === label) {
            maskData[i] = 255;
          }
        }

        // const mask = new RawImage(maskData, segmentation.dims[1], segmentation.dims[0], 1);

        annotation.push({
          score: null,
          label: id2label[label],
          // mask: mask
        });
      }
    } else {
      throw Error(`Subtask ${subtask} not supported.`);
    }

    return annotation;
  }
}

/**
 * @typedef {Object} ZeroShotImageClassificationOutput
 * @property {string} label The label identified by the model. It is one of the suggested `candidate_label`.
 * @property {number} score The score attributed by the model for that label (between 0 and 1).
 *
 * @typedef {Object} ZeroShotImageClassificationPipelineOptions Parameters specific to zero-shot image classification pipelines.
 * @property {string} [hypothesis_template="This is a photo of {}"] The sentence used in conjunction with `candidate_labels`
 * to attempt the image classification by replacing the placeholder with the candidate_labels.
 * Then likelihood is estimated by using `logits_per_image`.
 *
 * @callback ZeroShotImageClassificationPipelineCallback Assign labels to the image(s) passed as inputs.
 * @param {ImagePipelineInputs} images The input images.
 * @param {string[]} candidate_labels The candidate labels for this image.
 * @param {ZeroShotImageClassificationPipelineOptions} [options] The options to use for zero-shot image classification.
 * @returns {Promise<ZeroShotImageClassificationOutput[]|ZeroShotImageClassificationOutput[][]>} An array of objects containing the predicted labels and scores.
 *
 * @typedef {TextImagePipelineConstructorArgs & ZeroShotImageClassificationPipelineCallback & Disposable} ZeroShotImageClassificationPipelineType
 */

/**
 * Zero shot image classification pipeline. This pipeline predicts the class of
 * an image when you provide an image and a set of `candidate_labels`.
 *
 * **Example:** Zero shot image classification w/ `Xenova/clip-vit-base-patch32`.
 * ```javascript
 * const classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg';
 * const output = await classifier(url, ['tiger', 'horse', 'dog']);
 * // [
 * //   { score: 0.9993917942047119, label: 'tiger' },
 * //   { score: 0.0003519294841680676, label: 'horse' },
 * //   { score: 0.0002562698791734874, label: 'dog' }
 * // ]
 * ```
 */
export class ZeroShotImageClassificationPipeline
  extends /** @type {new (options: TextImagePipelineConstructorArgs) => ZeroShotImageClassificationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ZeroShotImageClassificationPipeline.
   * @param {TextImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {ZeroShotImageClassificationPipelineCallback} */
  async _call(
    images,
    candidate_labels,
    { hypothesis_template = "This is a photo of {}" } = {},
  ) {
    const isBatched = Array.isArray(images);
    const preparedImages = await prepareImages(images);

    // Insert label into hypothesis template
    const texts = candidate_labels.map((x) =>
      hypothesis_template.replace("{}", x),
    );

    // Run tokenization
    const text_inputs = this.tokenizer(texts, {
      padding: this.model.config.model_type === "siglip" ? "max_length" : true,
      truncation: true,
    });

    // Run processor
    const { pixel_values } = await this.processor(preparedImages);

    // Run model with both text and pixel inputs
    const output = await this.model({ ...text_inputs, pixel_values });

    const function_to_apply =
      this.model.config.model_type === "siglip"
        ? (batch) => batch.sigmoid().data
        : (batch) => softmax(batch.data);

    // Compare each image with each candidate label
    const toReturn = [];
    for (const batch of output.logits_per_image) {
      // Compute softmax per image
      const probs = function_to_apply(batch);

      const result = [...probs].map((x, i) => ({
        score: x,
        label: candidate_labels[i],
      }));
      result.sort((a, b) => b.score - a.score); // sort by score in descending order
      toReturn.push(result);
    }

    return isBatched ? toReturn : toReturn[0];
  }
}

/**
 * @typedef {Object} ObjectDetectionPipelineSingle
 * @property {string} label The class label identified by the model.
 * @property {number} score The score attributed by the model for that label.
 * @property {BoundingBox} box The bounding box of detected object in image's original size, or as a percentage if `percentage` is set to true.
 * @typedef {ObjectDetectionPipelineSingle[]} ObjectDetectionPipelineOutput
 *
 * @typedef {Object} ObjectDetectionPipelineOptions Parameters specific to object detection pipelines.
 * @property {number} [threshold=0.9] The threshold used to filter boxes by score.
 * @property {boolean} [percentage=false] Whether to return the boxes coordinates in percentage (true) or in pixels (false).
 *
 * @callback ObjectDetectionPipelineCallback Detect objects (bounding boxes & classes) in the image(s) passed as inputs.
 * @param {ImagePipelineInputs} images The input images.
 * @param {ObjectDetectionPipelineOptions} [options] The options to use for object detection.
 * @returns {Promise<ObjectDetectionPipelineOutput|ObjectDetectionPipelineOutput[]>} A list of objects or a list of list of objects.
 *
 * @typedef {ImagePipelineConstructorArgs & ObjectDetectionPipelineCallback & Disposable} ObjectDetectionPipelineType
 */

/**
 * Object detection pipeline using any `AutoModelForObjectDetection`.
 * This pipeline predicts bounding boxes of objects and their classes.
 *
 * **Example:** Run object-detection with `Xenova/detr-resnet-50`.
 * ```javascript
 * const detector = await pipeline('object-detection', 'Xenova/detr-resnet-50');
 * const img = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg';
 * const output = await detector(img, { threshold: 0.9 });
 * // [{
 * //   score: 0.9976370930671692,
 * //   label: "remote",
 * //   box: { xmin: 31, ymin: 68, xmax: 190, ymax: 118 }
 * // },
 * // ...
 * // {
 * //   score: 0.9984092116355896,
 * //   label: "cat",
 * //   box: { xmin: 331, ymin: 19, xmax: 649, ymax: 371 }
 * // }]
 * ```
 */
export class ObjectDetectionPipeline
  extends /** @type {new (options: ImagePipelineConstructorArgs) => ObjectDetectionPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ObjectDetectionPipeline.
   * @param {ImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {ObjectDetectionPipelineCallback} */
  async _call(images, { threshold = 0.9, percentage = false } = {}) {
    const isBatched = Array.isArray(images);

    if (isBatched && images.length !== 1) {
      throw Error(
        "Object detection pipeline currently only supports a batch size of 1.",
      );
    }
    const preparedImages = await prepareImages(images);

    const imageSizes = percentage
      ? null
      : preparedImages.map((x) => [x.height, x.width]);

    const { pixel_values, pixel_mask } = await this.processor(preparedImages);
    const output = await this.model({ pixel_values, pixel_mask });

    // @ts-ignore
    const processed =
      this.processor.feature_extractor.post_process_object_detection(
        output,
        threshold,
        imageSizes,
      );

    // Add labels
    const id2label = this.model.config.id2label;

    // Format output
    /** @type {ObjectDetectionPipelineOutput[]} */
    const result = processed.map((batch) =>
      batch.boxes.map((box, i) => ({
        score: batch.scores[i],
        label: id2label[batch.classes[i]],
        box: get_bounding_box(box, !percentage),
      })),
    );

    return isBatched ? result : result[0];
  }
}

/**
 * @typedef {Object} ZeroShotObjectDetectionOutput
 * @property {string} label Text query corresponding to the found object.
 * @property {number} score Score corresponding to the object (between 0 and 1).
 * @property {BoundingBox} box Bounding box of the detected object in image's original size, or as a percentage if `percentage` is set to true.
 *
 * @typedef {Object} ZeroShotObjectDetectionPipelineOptions Parameters specific to zero-shot object detection pipelines.
 * @property {number} [threshold=0.1] The probability necessary to make a prediction.
 * @property {number} [topk=null] The number of top predictions that will be returned by the pipeline.
 * If the provided number is `null` or higher than the number of predictions available, it will default
 * to the number of predictions.
 * @property {boolean} [percentage=false] Whether to return the boxes coordinates in percentage (true) or in pixels (false).
 *
 * @callback ZeroShotObjectDetectionPipelineCallback Detect objects (bounding boxes & classes) in the image(s) passed as inputs.
 * @param {ImagePipelineInputs} images The input images.
 * @param {string[]} candidate_labels What the model should recognize in the image.
 * @param {ZeroShotObjectDetectionPipelineOptions} [options] The options to use for zero-shot object detection.
 * @returns {Promise<ZeroShotObjectDetectionOutput[]|ZeroShotObjectDetectionOutput[][]>} An array of objects containing the predicted labels, scores, and bounding boxes.
 *
 * @typedef {TextImagePipelineConstructorArgs & ZeroShotObjectDetectionPipelineCallback & Disposable} ZeroShotObjectDetectionPipelineType
 */

/**
 * Zero-shot object detection pipeline. This pipeline predicts bounding boxes of
 * objects when you provide an image and a set of `candidate_labels`.
 *
 * **Example:** Zero-shot object detection w/ `Xenova/owlvit-base-patch32`.
 * ```javascript
 * const detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/astronaut.png';
 * const candidate_labels = ['human face', 'rocket', 'helmet', 'american flag'];
 * const output = await detector(url, candidate_labels);
 * // [
 * //   {
 * //     score: 0.24392342567443848,
 * //     label: 'human face',
 * //     box: { xmin: 180, ymin: 67, xmax: 274, ymax: 175 }
 * //   },
 * //   {
 * //     score: 0.15129457414150238,
 * //     label: 'american flag',
 * //     box: { xmin: 0, ymin: 4, xmax: 106, ymax: 513 }
 * //   },
 * //   {
 * //     score: 0.13649864494800568,
 * //     label: 'helmet',
 * //     box: { xmin: 277, ymin: 337, xmax: 511, ymax: 511 }
 * //   },
 * //   {
 * //     score: 0.10262022167444229,
 * //     label: 'rocket',
 * //     box: { xmin: 352, ymin: -1, xmax: 463, ymax: 287 }
 * //   }
 * // ]
 * ```
 *
 * **Example:** Zero-shot object detection w/ `Xenova/owlvit-base-patch32` (returning top 4 matches and setting a threshold).
 * ```javascript
 * const detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/beach.png';
 * const candidate_labels = ['hat', 'book', 'sunglasses', 'camera'];
 * const output = await detector(url, candidate_labels, { topk: 4, threshold: 0.05 });
 * // [
 * //   {
 * //     score: 0.1606510728597641,
 * //     label: 'sunglasses',
 * //     box: { xmin: 347, ymin: 229, xmax: 429, ymax: 264 }
 * //   },
 * //   {
 * //     score: 0.08935828506946564,
 * //     label: 'hat',
 * //     box: { xmin: 38, ymin: 174, xmax: 258, ymax: 364 }
 * //   },
 * //   {
 * //     score: 0.08530698716640472,
 * //     label: 'camera',
 * //     box: { xmin: 187, ymin: 350, xmax: 260, ymax: 411 }
 * //   },
 * //   {
 * //     score: 0.08349756896495819,
 * //     label: 'book',
 * //     box: { xmin: 261, ymin: 280, xmax: 494, ymax: 425 }
 * //   }
 * // ]
 * ```
 */
export class ZeroShotObjectDetectionPipeline
  extends /** @type {new (options: TextImagePipelineConstructorArgs) => ZeroShotObjectDetectionPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ZeroShotObjectDetectionPipeline.
   * @param {TextImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {ZeroShotObjectDetectionPipelineCallback} */
  async _call(
    images,
    candidate_labels,
    { threshold = 0.1, topk = null, percentage = false } = {},
  ) {
    const isBatched = Array.isArray(images);
    const preparedImages = await prepareImages(images);

    // Run tokenization
    const text_inputs = this.tokenizer(candidate_labels, {
      padding: true,
      truncation: true,
    });

    // Run processor
    const model_inputs = await this.processor(preparedImages);

    // Since non-maximum suppression is performed for exporting, we need to
    // process each image separately. For more information, see:
    // https://github.com/huggingface/optimum/blob/e3b7efb1257c011db907ef40ab340e795cc5684c/optimum/exporters/onnx/model_configs.py#L1028-L1032
    const toReturn = [];
    for (let i = 0; i < preparedImages.length; ++i) {
      const image = preparedImages[i];
      const imageSize = percentage ? null : [[image.height, image.width]];
      const pixel_values = model_inputs.pixel_values[i].unsqueeze_(0);

      // Run model with both text and pixel inputs
      const output = await this.model({ ...text_inputs, pixel_values });

      // @ts-ignore
      const processed =
        this.processor.feature_extractor.post_process_object_detection(
          output,
          threshold,
          imageSize,
          true,
        )[0];
      let result = processed.boxes
        .map((box, i) => ({
          score: processed.scores[i],
          label: candidate_labels[processed.classes[i]],
          box: get_bounding_box(box, !percentage),
        }))
        .sort((a, b) => b.score - a.score);
      if (topk !== null) {
        result = result.slice(0, topk);
      }
      toReturn.push(result);
    }

    return isBatched ? toReturn : toReturn[0];
  }
}

/**
 * @typedef {Object} DocumentQuestionAnsweringSingle
 * @property {string} answer The generated text.
 * @typedef {DocumentQuestionAnsweringSingle[]} DocumentQuestionAnsweringOutput
 *
 * @callback DocumentQuestionAnsweringPipelineCallback Answer the question given as input by using the document.
 * @param {ImageInput} image The image of the document to use.
 * @param {string} question A question to ask of the document.
 * @param {import('./utils/generation.js').GenerationConfigType} [options] Additional keyword arguments to pass along to the generate method of the model.
 * @returns {Promise<DocumentQuestionAnsweringOutput|DocumentQuestionAnsweringOutput[]>} An object (or array of objects) containing the answer(s).
 *
 * @typedef {TextImagePipelineConstructorArgs & DocumentQuestionAnsweringPipelineCallback & Disposable} DocumentQuestionAnsweringPipelineType
 */

/**
 * Document Question Answering pipeline using any `AutoModelForDocumentQuestionAnswering`.
 * The inputs/outputs are similar to the (extractive) question answering pipeline; however,
 * the pipeline takes an image (and optional OCR'd words/boxes) as input instead of text context.
 *
 * **Example:** Answer questions about a document with `Xenova/donut-base-finetuned-docvqa`.
 * ```javascript
 * const qa_pipeline = await pipeline('document-question-answering', 'Xenova/donut-base-finetuned-docvqa');
 * const image = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/invoice.png';
 * const question = 'What is the invoice number?';
 * const output = await qa_pipeline(image, question);
 * // [{ answer: 'us-001' }]
 * ```
 */
export class DocumentQuestionAnsweringPipeline
  extends /** @type {new (options: TextImagePipelineConstructorArgs) => DocumentQuestionAnsweringPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new DocumentQuestionAnsweringPipeline.
   * @param {TextImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {DocumentQuestionAnsweringPipelineCallback} */
  async _call(image, question, generate_kwargs = {}) {
    // NOTE: For now, we only support a batch size of 1

    // Preprocess image
    const preparedImage = (await prepareImages(image))[0];
    const { pixel_values } = await this.processor(preparedImage);

    // Run tokenization
    const task_prompt = `<s_docvqa><s_question>${question}</s_question><s_answer>`;
    const decoder_input_ids = this.tokenizer(task_prompt, {
      add_special_tokens: false,
      padding: true,
      truncation: true,
    }).input_ids;

    // Run model
    const output = await this.model.generate(pixel_values, {
      ...generate_kwargs,
      decoder_input_ids,
      max_length: this.model.config.decoder.max_position_embeddings,
    });

    // Decode output
    const decoded = this.tokenizer.batch_decode(output)[0];

    // Parse answer
    const match = decoded.match(/<s_answer>(.*?)<\/s_answer>/);
    let answer = null;
    if (match && match.length >= 2) {
      answer = match[1].trim();
    }
    return [{ answer }];
  }
}

/**
 * @typedef {Object} VocoderOptions
 * @property {PreTrainedModel} [vocoder] The vocoder used by the pipeline (if the model uses one). If not provided, use the default HifiGan vocoder.
 * @typedef {TextAudioPipelineConstructorArgs & VocoderOptions} TextToAudioPipelineConstructorArgs
 */

/**
 * @typedef {Object} TextToAudioOutput
 * @property {Float32Array} audio The generated audio waveform.
 * @property {number} sampling_rate The sampling rate of the generated audio waveform.
 *
 * @typedef {Object} TextToAudioPipelineOptions Parameters specific to text-to-audio pipelines.
 * @property {Tensor|Float32Array|string|URL} [speaker_embeddings=null] The speaker embeddings (if the model requires it).
 *
 * @callback TextToAudioPipelineCallback Generates speech/audio from the inputs.
 * @param {string|string[]} texts The text(s) to generate.
 * @param {TextToAudioPipelineOptions} options Parameters passed to the model generation/forward method.
 * @returns {Promise<TextToAudioOutput>} An object containing the generated audio and sampling rate.
 *
 * @typedef {TextToAudioPipelineConstructorArgs & TextToAudioPipelineCallback & Disposable} TextToAudioPipelineType
 */

/**
 * Text-to-audio generation pipeline using any `AutoModelForTextToWaveform` or `AutoModelForTextToSpectrogram`.
 * This pipeline generates an audio file from an input text and optional other conditional inputs.
 *
 * **Example:** Generate audio from text with `Xenova/speecht5_tts`.
 * ```javascript
 * const synthesizer = await pipeline('text-to-speech', 'Xenova/speecht5_tts', { quantized: false });
 * const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
 * const out = await synthesizer('Hello, my dog is cute', { speaker_embeddings });
 * // {
 * //   audio: Float32Array(26112) [-0.00005657337896991521, 0.00020583874720614403, ...],
 * //   sampling_rate: 16000
 * // }
 * ```
 *
 * You can then save the audio to a .wav file with the `wavefile` package:
 * ```javascript
 * import wavefile from 'wavefile';
 * import fs from 'fs';
 *
 * const wav = new wavefile.WaveFile();
 * wav.fromScratch(1, out.sampling_rate, '32f', out.audio);
 * fs.writeFileSync('out.wav', wav.toBuffer());
 * ```
 *
 * **Example:** Multilingual speech generation with `Xenova/mms-tts-fra`. See [here](https://huggingface.co/models?pipeline_tag=text-to-speech&other=vits&sort=trending) for the full list of available languages (1107).
 * ```javascript
 * const synthesizer = await pipeline('text-to-speech', 'Xenova/mms-tts-fra');
 * const out = await synthesizer('Bonjour');
 * // {
 * //   audio: Float32Array(23808) [-0.00037693005288019776, 0.0003325853613205254, ...],
 * //   sampling_rate: 16000
 * // }
 * ```
 */
export class TextToAudioPipeline
  extends /** @type {new (options: TextToAudioPipelineConstructorArgs) => TextToAudioPipelineType} */ (
    Pipeline
  )
{
  DEFAULT_VOCODER_ID = "Xenova/speecht5_hifigan";

  /**
   * Create a new TextToAudioPipeline.
   * @param {TextToAudioPipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);

    // TODO: Find a better way for `pipeline` to set the default vocoder
    this.vocoder = options.vocoder ?? null;
  }

  /** @type {TextToAudioPipelineCallback} */
  async _call(text_inputs, { speaker_embeddings = null } = {}) {
    // If this.processor is not set, we are using a `AutoModelForTextToWaveform` model
    if (this.processor) {
      return this._call_text_to_spectrogram(text_inputs, {
        speaker_embeddings,
      });
    } else {
      return this._call_text_to_waveform(text_inputs);
    }
  }

  async _call_text_to_waveform(text_inputs) {
    // Run tokenization
    const inputs = this.tokenizer(text_inputs, {
      padding: true,
      truncation: true,
    });

    // Generate waveform
    const { waveform } = await this.model(inputs);

    const sampling_rate = this.model.config.sampling_rate;
    return {
      audio: waveform.data,
      sampling_rate,
    };
  }

  async _call_text_to_spectrogram(text_inputs, { speaker_embeddings }) {
    // Load vocoder, if not provided
    if (!this.vocoder) {
      console.log("No vocoder specified, using default HifiGan vocoder.");
      this.vocoder = await AutoModel.from_pretrained(this.DEFAULT_VOCODER_ID, {
        quantized: false,
      });
    }

    // Load speaker embeddings as Float32Array from path/URL
    if (
      typeof speaker_embeddings === "string" ||
      speaker_embeddings instanceof URL
    ) {
      // Load from URL with fetch
      speaker_embeddings = new Float32Array(
        await (await fetch(speaker_embeddings)).arrayBuffer(),
      );
    }

    if (speaker_embeddings instanceof Float32Array) {
      speaker_embeddings = new Tensor("float32", speaker_embeddings, [
        1,
        speaker_embeddings.length,
      ]);
    } else if (!(speaker_embeddings instanceof Tensor)) {
      throw new Error(
        "Speaker embeddings must be a `Tensor`, `Float32Array`, `string`, or `URL`.",
      );
    }

    // Run tokenization
    const { input_ids } = this.tokenizer(text_inputs, {
      padding: true,
      truncation: true,
    });

    // NOTE: At this point, we are guaranteed that `speaker_embeddings` is a `Tensor`
    // @ts-ignore
    const { waveform } = await this.model.generate_speech(
      input_ids,
      speaker_embeddings,
      { vocoder: this.vocoder },
    );

    const sampling_rate = this.processor.feature_extractor.config.sampling_rate;
    return {
      audio: waveform.data,
      sampling_rate,
    };
  }
}

/**
 * @callback ImageToImagePipelineCallback Transform the image(s) passed as inputs.
 * @param {ImagePipelineInputs} images The images to transform.
 * @returns {Promise<RawImage|RawImage[]>} The transformed image or list of images.
 *
 * @typedef {ImagePipelineConstructorArgs & ImageToImagePipelineCallback & Disposable} ImageToImagePipelineType
 */

/**
 * Image to Image pipeline using any `AutoModelForImageToImage`. This pipeline generates an image based on a previous image input.
 *
 * **Example:** Super-resolution w/ `Xenova/swin2SR-classical-sr-x2-64`
 * ```javascript
 * const upscaler = await pipeline('image-to-image', 'Xenova/swin2SR-classical-sr-x2-64');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/butterfly.jpg';
 * const output = await upscaler(url);
 * // RawImage {
 * //   data: Uint8Array(786432) [ 41, 31, 24,  43, ... ],
 * //   width: 512,
 * //   height: 512,
 * //   channels: 3
 * // }
 * ```
 */
export class ImageToImagePipeline
  extends /** @type {new (options: ImagePipelineConstructorArgs) => ImageToImagePipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new ImageToImagePipeline.
   * @param {ImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {ImageToImagePipelineCallback} */
  async _call(images) {
    const preparedImages = await prepareImages(images);
    const inputs = await this.processor(preparedImages);
    const outputs = await this.model(inputs);

    /** @type {RawImage[]} */
    const toReturn = [];
    for (const batch of outputs.reconstruction) {
      const output = batch
        .squeeze()
        .clamp_(0, 1)
        .mul_(255)
        .round_()
        .to("uint8");
      // toReturn.push(RawImage.fromTensor(output));
    }

    return toReturn.length > 1 ? toReturn : toReturn[0];
  }
}

/**
 * @typedef {Object} DepthEstimationPipelineOutput
 * @property {Tensor} predicted_depth The raw depth map predicted by the model.
 * @property {RawImage} depth The processed depth map as an image (with the same size as the input image).
 *
 * @callback DepthEstimationPipelineCallback Predicts the depth for the image(s) passed as inputs.
 * @param {ImagePipelineInputs} images The images to compute depth for.
 * @returns {Promise<DepthEstimationPipelineOutput|DepthEstimationPipelineOutput[]>} An image or a list of images containing result(s).
 *
 * @typedef {ImagePipelineConstructorArgs & DepthEstimationPipelineCallback & Disposable} DepthEstimationPipelineType
 */

/**
 * Depth estimation pipeline using any `AutoModelForDepthEstimation`. This pipeline predicts the depth of an image.
 *
 * **Example:** Depth estimation w/ `Xenova/dpt-hybrid-midas`
 * ```javascript
 * const depth_estimator = await pipeline('depth-estimation', 'Xenova/dpt-hybrid-midas');
 * const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg';
 * const out = await depth_estimator(url);
 * // {
 * //   predicted_depth: Tensor {
 * //     dims: [ 384, 384 ],
 * //     type: 'float32',
 * //     data: Float32Array(147456) [ 542.859130859375, 545.2833862304688, 546.1649169921875, ... ],
 * //     size: 147456
 * //   },
 * //   depth: RawImage {
 * //     data: Uint8Array(307200) [ 86, 86, 86, ... ],
 * //     width: 640,
 * //     height: 480,
 * //     channels: 1
 * //   }
 * // }
 * ```
 */
export class DepthEstimationPipeline
  extends /** @type {new (options: ImagePipelineConstructorArgs) => DepthEstimationPipelineType} */ (
    Pipeline
  )
{
  /**
   * Create a new DepthEstimationPipeline.
   * @param {ImagePipelineConstructorArgs} options An object used to instantiate the pipeline.
   */
  constructor(options) {
    super(options);
  }

  /** @type {DepthEstimationPipelineCallback} */
  async _call(images) {
    const preparedImages = await prepareImages(images);

    const inputs = await this.processor(preparedImages);
    const { predicted_depth } = await this.model(inputs);

    const toReturn = [];
    for (let i = 0; i < preparedImages.length; ++i) {
      const prediction = interpolate(
        predicted_depth[i],
        preparedImages[i].size.reverse(),
        "bilinear",
        false,
      );
      const formatted = prediction
        .mul_(255 / max(prediction.data)[0])
        .to("uint8");
      toReturn.push({
        predicted_depth: predicted_depth[i],
        // depth: RawImage.fromTensor(formatted),
      });
    }

    return toReturn.length > 1 ? toReturn : toReturn[0];
  }
}

const SUPPORTED_TASKS = Object.freeze({
  "text-classification": {
    tokenizer: AutoTokenizer,
    pipeline: TextClassificationPipeline,
    model: AutoModelForSequenceClassification,
    default: {
      // TODO: replace with original
      // "model": "distilbert-base-uncased-finetuned-sst-2-english",
      model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
    },
    type: "text",
  },
  "token-classification": {
    tokenizer: AutoTokenizer,
    pipeline: TokenClassificationPipeline,
    model: AutoModelForTokenClassification,
    default: {
      // TODO: replace with original
      // "model": "Davlan/bert-base-multilingual-cased-ner-hrl",
      model: "Xenova/bert-base-multilingual-cased-ner-hrl",
    },
    type: "text",
  },
  "question-answering": {
    tokenizer: AutoTokenizer,
    pipeline: QuestionAnsweringPipeline,
    model: AutoModelForQuestionAnswering,
    default: {
      // TODO: replace with original
      // "model": "distilbert-base-cased-distilled-squad",
      model: "Xenova/distilbert-base-cased-distilled-squad",
    },
    type: "text",
  },

  "fill-mask": {
    tokenizer: AutoTokenizer,
    pipeline: FillMaskPipeline,
    model: AutoModelForMaskedLM,
    default: {
      // TODO: replace with original
      // "model": "bert-base-uncased",
      model: "Xenova/bert-base-uncased",
    },
    type: "text",
  },
  summarization: {
    tokenizer: AutoTokenizer,
    pipeline: SummarizationPipeline,
    model: AutoModelForSeq2SeqLM,
    default: {
      // TODO: replace with original
      // "model": "sshleifer/distilbart-cnn-6-6",
      model: "Xenova/distilbart-cnn-6-6",
    },
    type: "text",
  },
  translation: {
    tokenizer: AutoTokenizer,
    pipeline: TranslationPipeline,
    model: AutoModelForSeq2SeqLM,
    default: {
      // TODO: replace with original
      // "model": "t5-small",
      model: "Xenova/t5-small",
    },
    type: "text",
  },
  "text2text-generation": {
    tokenizer: AutoTokenizer,
    pipeline: Text2TextGenerationPipeline,
    model: AutoModelForSeq2SeqLM,
    default: {
      // TODO: replace with original
      // "model": "google/flan-t5-small",
      model: "Xenova/flan-t5-small",
    },
    type: "text",
  },
  "text-generation": {
    tokenizer: AutoTokenizer,
    pipeline: TextGenerationPipeline,
    model: AutoModelForCausalLM,
    default: {
      // TODO: replace with original
      // "model": "gpt2",
      model: "Xenova/gpt2",
    },
    type: "text",
  },
  "zero-shot-classification": {
    tokenizer: AutoTokenizer,
    pipeline: ZeroShotClassificationPipeline,
    model: AutoModelForSequenceClassification,
    default: {
      // TODO: replace with original
      // "model": "typeform/distilbert-base-uncased-mnli",
      model: "Xenova/distilbert-base-uncased-mnli",
    },
    type: "text",
  },
  "audio-classification": {
    pipeline: AudioClassificationPipeline,
    model: AutoModelForAudioClassification,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "superb/wav2vec2-base-superb-ks",
      model: "Xenova/wav2vec2-base-superb-ks",
    },
    type: "audio",
  },
  "zero-shot-audio-classification": {
    tokenizer: AutoTokenizer,
    pipeline: ZeroShotAudioClassificationPipeline,
    model: AutoModel,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "laion/clap-htsat-fused",
      model: "Xenova/clap-htsat-unfused",
    },
    type: "multimodal",
  },
  "automatic-speech-recognition": {
    tokenizer: AutoTokenizer,
    pipeline: AutomaticSpeechRecognitionPipeline,
    model: [AutoModelForSpeechSeq2Seq, AutoModelForCTC],
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "openai/whisper-tiny.en",
      model: "Xenova/whisper-tiny.en",
    },
    type: "multimodal",
  },
  "text-to-audio": {
    tokenizer: AutoTokenizer,
    pipeline: TextToAudioPipeline,
    model: [AutoModelForTextToWaveform, AutoModelForTextToSpectrogram],
    processor: [AutoProcessor, /* Some don't use a processor */ null],
    default: {
      // TODO: replace with original
      // "model": "microsoft/speecht5_tts",
      model: "Xenova/speecht5_tts",
    },
    type: "text",
  },
  "image-to-text": {
    tokenizer: AutoTokenizer,
    pipeline: ImageToTextPipeline,
    model: AutoModelForVision2Seq,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "nlpconnect/vit-gpt2-image-captioning",
      model: "Xenova/vit-gpt2-image-captioning",
    },
    type: "multimodal",
  },

  "image-classification": {
    // no tokenizer
    pipeline: ImageClassificationPipeline,
    model: AutoModelForImageClassification,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "google/vit-base-patch16-224",
      model: "Xenova/vit-base-patch16-224",
    },
    type: "multimodal",
  },

  "image-segmentation": {
    // no tokenizer
    pipeline: ImageSegmentationPipeline,
    model: [AutoModelForImageSegmentation, AutoModelForSemanticSegmentation],
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "facebook/detr-resnet-50-panoptic",
      model: "Xenova/detr-resnet-50-panoptic",
    },
    type: "multimodal",
  },

  "zero-shot-image-classification": {
    tokenizer: AutoTokenizer,
    pipeline: ZeroShotImageClassificationPipeline,
    model: AutoModel,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "openai/clip-vit-base-patch32",
      model: "Xenova/clip-vit-base-patch32",
    },
    type: "multimodal",
  },

  "object-detection": {
    // no tokenizer
    pipeline: ObjectDetectionPipeline,
    model: AutoModelForObjectDetection,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "facebook/detr-resnet-50",
      model: "Xenova/detr-resnet-50",
    },
    type: "multimodal",
  },
  "zero-shot-object-detection": {
    tokenizer: AutoTokenizer,
    pipeline: ZeroShotObjectDetectionPipeline,
    model: AutoModelForZeroShotObjectDetection,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "google/owlvit-base-patch32",
      model: "Xenova/owlvit-base-patch32",
    },
    type: "multimodal",
  },
  "document-question-answering": {
    tokenizer: AutoTokenizer,
    pipeline: DocumentQuestionAnsweringPipeline,
    model: AutoModelForDocumentQuestionAnswering,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "naver-clova-ix/donut-base-finetuned-docvqa",
      model: "Xenova/donut-base-finetuned-docvqa",
    },
    type: "multimodal",
  },
  "image-to-image": {
    // no tokenizer
    pipeline: ImageToImagePipeline,
    model: AutoModelForImageToImage,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "caidas/swin2SR-classical-sr-x2-64",
      model: "Xenova/swin2SR-classical-sr-x2-64",
    },
    type: "image",
  },
  "depth-estimation": {
    // no tokenizer
    pipeline: DepthEstimationPipeline,
    model: AutoModelForDepthEstimation,
    processor: AutoProcessor,
    default: {
      // TODO: replace with original
      // "model": "Intel/dpt-large",
      model: "Xenova/dpt-large",
    },
    type: "image",
  },

  // This task serves as a useful interface for dealing with sentence-transformers (https://huggingface.co/sentence-transformers).
  "feature-extraction": {
    tokenizer: AutoTokenizer,
    pipeline: FeatureExtractionPipeline,
    model: AutoModel,
    default: {
      // TODO: replace with original
      // "model": "sentence-transformers/all-MiniLM-L6-v2",
      model: "Xenova/all-MiniLM-L6-v2",
    },
    type: "text",
  },
});

// TODO: Add types for TASK_ALIASES
const TASK_ALIASES = Object.freeze({
  "sentiment-analysis": "text-classification",
  ner: "token-classification",
  // "vqa": "visual-question-answering", // TODO: Add
  asr: "automatic-speech-recognition",
  "text-to-speech": "text-to-audio",

  // Add for backwards compatibility
  embeddings: "feature-extraction",
});

/**
 * @typedef {keyof typeof SUPPORTED_TASKS} TaskType
 * @typedef {keyof typeof TASK_ALIASES} AliasType
 * @typedef {TaskType | AliasType} PipelineType All possible pipeline types.
 * @typedef {{[K in TaskType]: InstanceType<typeof SUPPORTED_TASKS[K]["pipeline"]>}} SupportedTasks A mapping of pipeline names to their corresponding pipeline classes.
 * @typedef {{[K in AliasType]: InstanceType<typeof SUPPORTED_TASKS[TASK_ALIASES[K]]["pipeline"]>}} AliasTasks A mapping from pipeline aliases to their corresponding pipeline classes.
 * @typedef {SupportedTasks & AliasTasks} AllTasks A mapping from all pipeline names and aliases to their corresponding pipeline classes.
 */

/**
 * Utility factory method to build a `Pipeline` object.
 *
 * @template {PipelineType} T The type of pipeline to return.
 * @param {T} task The task defining which pipeline will be returned. Currently accepted tasks are:
 *  - `"audio-classification"`: will return a `AudioClassificationPipeline`.
 *  - `"automatic-speech-recognition"`: will return a `AutomaticSpeechRecognitionPipeline`.
 *  - `"depth-estimation"`: will return a `DepthEstimationPipeline`.
 *  - `"document-question-answering"`: will return a `DocumentQuestionAnsweringPipeline`.
 *  - `"feature-extraction"`: will return a `FeatureExtractionPipeline`.
 *  - `"fill-mask"`: will return a `FillMaskPipeline`.
 *  - `"image-classification"`: will return a `ImageClassificationPipeline`.
 *  - `"image-segmentation"`: will return a `ImageSegmentationPipeline`.
 *  - `"image-to-text"`: will return a `ImageToTextPipeline`.
 *  - `"object-detection"`: will return a `ObjectDetectionPipeline`.
 *  - `"question-answering"`: will return a `QuestionAnsweringPipeline`.
 *  - `"summarization"`: will return a `SummarizationPipeline`.
 *  - `"text2text-generation"`: will return a `Text2TextGenerationPipeline`.
 *  - `"text-classification"` (alias "sentiment-analysis" available): will return a `TextClassificationPipeline`.
 *  - `"text-generation"`: will return a `TextGenerationPipeline`.
 *  - `"token-classification"` (alias "ner" available): will return a `TokenClassificationPipeline`.
 *  - `"translation"`: will return a `TranslationPipeline`.
 *  - `"translation_xx_to_yy"`: will return a `TranslationPipeline`.
 *  - `"zero-shot-classification"`: will return a `ZeroShotClassificationPipeline`.
 *  - `"zero-shot-audio-classification"`: will return a `ZeroShotAudioClassificationPipeline`.
 *  - `"zero-shot-image-classification"`: will return a `ZeroShotImageClassificationPipeline`.
 *  - `"zero-shot-object-detection"`: will return a `ZeroShotObjectDetectionPipeline`.
 * @param {string} [model=null] The name of the pre-trained model to use. If not specified, the default model for the task will be used.
 * @param {import('./utils/hub.js').PretrainedOptions} [options] Optional parameters for the pipeline.
 * @returns {Promise<AllTasks[T]>} A Pipeline object for the specified task.
 * @throws {Error} If an unsupported pipeline is requested.
 */
export async function pipeline(
  task,
  model = null,
  {
    quantized = true,
    progress_callback = null,
    config = null,
    cache_dir = null,
    local_files_only = false,
    revision = "main",
  } = {},
) {
  // Helper method to construct pipeline

  // Apply aliases
  // @ts-ignore
  task = TASK_ALIASES[task] ?? task;

  // Get pipeline info
  const pipelineInfo = SUPPORTED_TASKS[task.split("_", 1)[0]];
  if (!pipelineInfo) {
    throw Error(
      `Unsupported pipeline: ${task}. Must be one of [${Object.keys(SUPPORTED_TASKS)}]`,
    );
  }

  // Use model if specified, otherwise, use default
  if (!model) {
    model = pipelineInfo.default.model;
    console.log(`No model specified. Using default model: "${model}".`);
  }

  const pretrainedOptions = {
    quantized,
    progress_callback,
    config,
    cache_dir,
    local_files_only,
    revision,
  };

  const classes = new Map([
    ["tokenizer", pipelineInfo.tokenizer],
    ["model", pipelineInfo.model],
    ["processor", pipelineInfo.processor],
  ]);

  // Load model, tokenizer, and processor (if they exist)
  const results = await loadItems(classes, model, pretrainedOptions);
  results.task = task;

  dispatchCallback(progress_callback, {
    status: "ready",
    task: task,
    model: model,
  });

  const pipelineClass = pipelineInfo.pipeline;
  return new pipelineClass(results);
}

/**
 * Helper function to get applicable model, tokenizer, or processor classes for a given model.
 * @param {Map<string, any>} mapping The mapping of names to classes, arrays of classes, or null.
 * @param {string} model The name of the model to load.
 * @param {import('./utils/hub.js').PretrainedOptions} pretrainedOptions The options to pass to the `from_pretrained` method.
 * @private
 */
async function loadItems(mapping, model, pretrainedOptions) {
  const result = Object.create(null);

  /**@type {Promise[]} */
  const promises = [];
  for (let [name, cls] of mapping.entries()) {
    if (!cls) continue;

    /**@type {Promise} */
    let promise;
    if (Array.isArray(cls)) {
      promise = new Promise(async (resolve, reject) => {
        let e;
        for (let c of cls) {
          if (c === null) {
            // If null, we resolve it immediately, meaning the relevant
            // class was not found, but it is optional.
            resolve(null);
            return;
          }
          try {
            resolve(await c.from_pretrained(model, pretrainedOptions));
            return;
          } catch (err) {
            e = err;
          }
        }
        reject(e);
      });
    } else {
      promise = cls.from_pretrained(model, pretrainedOptions);
    }

    result[name] = promise;
    promises.push(promise);
  }

  // Wait for all promises to resolve (in parallel)
  await Promise.all(promises);

  // Then assign to result
  for (let [name, promise] of Object.entries(result)) {
    result[name] = await promise;
  }

  return result;
}
