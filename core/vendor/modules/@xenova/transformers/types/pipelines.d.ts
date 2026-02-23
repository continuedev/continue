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
export function pipeline<T extends PipelineType>(
  task: T,
  model?: string,
  {
    quantized,
    progress_callback,
    config,
    cache_dir,
    local_files_only,
    revision,
  }?: import("./utils/hub.js").PretrainedOptions,
): Promise<AllTasks[T]>;
declare const Pipeline_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
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
export class Pipeline extends Pipeline_base {
  /**
   * Create a new Pipeline.
   * @param {Object} options An object containing the following properties:
   * @param {string} [options.task] The task of the pipeline. Useful for specifying subtasks.
   * @param {PreTrainedModel} [options.model] The model used by the pipeline.
   * @param {PreTrainedTokenizer} [options.tokenizer=null] The tokenizer used by the pipeline (if any).
   * @param {Processor} [options.processor=null] The processor used by the pipeline (if any).
   */
  constructor({
    task,
    model,
    tokenizer,
    processor,
  }: {
    task?: string;
    model?: PreTrainedModel;
    tokenizer?: PreTrainedTokenizer;
    processor?: Processor;
  });
  task: string;
  model: PreTrainedModel;
  tokenizer: PreTrainedTokenizer;
  processor: Processor;
  dispose(): Promise<void>;
}
declare const TextClassificationPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => TextClassificationPipelineType;
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
export class TextClassificationPipeline extends TextClassificationPipeline_base {
  _call(
    texts: string | string[],
    options?: TextClassificationPipelineOptions,
  ): Promise<TextClassificationOutput | TextClassificationOutput[]>;
}
declare const TokenClassificationPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => TokenClassificationPipelineType;
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
export class TokenClassificationPipeline extends TokenClassificationPipeline_base {
  _call(
    texts: string | string[],
    options?: TokenClassificationPipelineOptions,
  ): Promise<TokenClassificationOutput | TokenClassificationOutput[]>;
}
declare const QuestionAnsweringPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => QuestionAnsweringPipelineType;
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
export class QuestionAnsweringPipeline extends QuestionAnsweringPipeline_base {
  _call(
    question: string | string[],
    context: string | string[],
    options?: QuestionAnsweringPipelineOptions,
  ): Promise<QuestionAnsweringOutput | QuestionAnsweringOutput[]>;
}
declare const FillMaskPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => FillMaskPipelineType;
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
export class FillMaskPipeline extends FillMaskPipeline_base {
  _call(
    texts: string | string[],
    options?: FillMaskPipelineOptions,
  ): Promise<FillMaskOutput | FillMaskOutput[]>;
}
declare const Text2TextGenerationPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => Text2TextGenerationPipelineType;
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
export class Text2TextGenerationPipeline extends Text2TextGenerationPipeline_base {
  /** @type {'generated_text'} */
  _key: "generated_text";
  _call(
    texts: string | string[],
    options?: import("./utils/generation.js").GenerationConfigType,
  ): Promise<Text2TextGenerationOutput | Text2TextGenerationOutput[]>;
}
declare const SummarizationPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => SummarizationPipelineType;
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
export class SummarizationPipeline extends SummarizationPipeline_base {
  /** @type {'summary_text'} */
  _key: "summary_text";
}
declare const TranslationPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => TranslationPipelineType;
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
export class TranslationPipeline extends TranslationPipeline_base {
  /** @type {'translation_text'} */
  _key: "translation_text";
}
declare const TextGenerationPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => TextGenerationPipelineType;
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
export class TextGenerationPipeline extends TextGenerationPipeline_base {
  _call(
    texts: string | string[],
    options?: TextGenerationConfig,
  ): Promise<TextGenerationOutput | TextGenerationOutput[]>;
}
declare const ZeroShotClassificationPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => ZeroShotClassificationPipelineType;
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
export class ZeroShotClassificationPipeline extends ZeroShotClassificationPipeline_base {
  label2id: {
    [k: string]: any;
  };
  entailment_id: any;
  contradiction_id: any;
  _call(
    texts: string | string[],
    candidate_labels: string | string[],
    options?: ZeroShotClassificationPipelineOptions,
  ): Promise<ZeroShotClassificationOutput | ZeroShotClassificationOutput[]>;
}
declare const FeatureExtractionPipeline_base: new (
  options: TextPipelineConstructorArgs,
) => FeatureExtractionPipelineType;
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
export class FeatureExtractionPipeline extends FeatureExtractionPipeline_base {
  _call(
    texts: string | string[],
    options?: FeatureExtractionPipelineOptions,
  ): Promise<Tensor>;
}
declare const AudioClassificationPipeline_base: new (
  options: AudioPipelineConstructorArgs,
) => AudioClassificationPipelineType;
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
export class AudioClassificationPipeline extends AudioClassificationPipeline_base {
  _call(
    audio: AudioPipelineInputs,
    options?: AudioClassificationPipelineOptions,
  ): Promise<AudioClassificationOutput | AudioClassificationOutput[]>;
}
declare const ZeroShotAudioClassificationPipeline_base: new (
  options: TextAudioPipelineConstructorArgs,
) => ZeroShotAudioClassificationPipelineType;
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
export class ZeroShotAudioClassificationPipeline extends ZeroShotAudioClassificationPipeline_base {
  _call(
    audio: AudioPipelineInputs,
    candidate_labels: string[],
    options?: ZeroShotAudioClassificationPipelineOptions,
  ): Promise<
    ZeroShotAudioClassificationOutput[] | ZeroShotAudioClassificationOutput[][]
  >;
}
declare const AutomaticSpeechRecognitionPipeline_base: new (
  options: TextAudioPipelineConstructorArgs,
) => AutomaticSpeechRecognitionPipelineType;
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
export class AutomaticSpeechRecognitionPipeline extends AutomaticSpeechRecognitionPipeline_base {
  _call(
    audio: AudioPipelineInputs,
    options?: AutomaticSpeechRecognitionConfig,
  ): Promise<
    AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[]
  >;
  /**
   * @type {AutomaticSpeechRecognitionPipelineCallback}
   * @private
   */
  private _call_wav2vec2;
  /**
   * @type {AutomaticSpeechRecognitionPipelineCallback}
   * @private
   */
  private _call_whisper;
}
declare const ImageToTextPipeline_base: new (
  options: TextImagePipelineConstructorArgs,
) => ImageToTextPipelineType;
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
export class ImageToTextPipeline extends ImageToTextPipeline_base {
  _call(
    texts: ImagePipelineInputs,
    options?: import("./utils/generation.js").GenerationConfigType,
  ): Promise<ImageToTextOutput | ImageToTextOutput[]>;
}
declare const ImageClassificationPipeline_base: new (
  options: ImagePipelineConstructorArgs,
) => ImageClassificationPipelineType;
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
export class ImageClassificationPipeline extends ImageClassificationPipeline_base {
  _call(
    images: ImagePipelineInputs,
    options?: ImageClassificationPipelineOptions,
  ): Promise<ImageClassificationOutput | ImageClassificationOutput[]>;
}
declare const ImageSegmentationPipeline_base: new (
  options: ImagePipelineConstructorArgs,
) => ImageSegmentationPipelineType;
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
export class ImageSegmentationPipeline extends ImageSegmentationPipeline_base {
  subtasks_mapping: {
    panoptic: string;
    instance: string;
    semantic: string;
  };
  _call(
    images: ImagePipelineInputs,
    options?: ImageSegmentationPipelineOptions,
  ): Promise<ImageSegmentationPipelineOutput[]>;
}
declare const ZeroShotImageClassificationPipeline_base: new (
  options: TextImagePipelineConstructorArgs,
) => ZeroShotImageClassificationPipelineType;
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
export class ZeroShotImageClassificationPipeline extends ZeroShotImageClassificationPipeline_base {
  _call(
    images: ImagePipelineInputs,
    candidate_labels: string[],
    options?: ZeroShotImageClassificationPipelineOptions,
  ): Promise<
    ZeroShotImageClassificationOutput[] | ZeroShotImageClassificationOutput[][]
  >;
}
declare const ObjectDetectionPipeline_base: new (
  options: ImagePipelineConstructorArgs,
) => ObjectDetectionPipelineType;
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
export class ObjectDetectionPipeline extends ObjectDetectionPipeline_base {
  _call(
    images: ImagePipelineInputs,
    options?: ObjectDetectionPipelineOptions,
  ): Promise<ObjectDetectionPipelineOutput | ObjectDetectionPipelineOutput[]>;
}
declare const ZeroShotObjectDetectionPipeline_base: new (
  options: TextImagePipelineConstructorArgs,
) => ZeroShotObjectDetectionPipelineType;
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
export class ZeroShotObjectDetectionPipeline extends ZeroShotObjectDetectionPipeline_base {
  _call(
    images: ImagePipelineInputs,
    candidate_labels: string[],
    options?: ZeroShotObjectDetectionPipelineOptions,
  ): Promise<
    ZeroShotObjectDetectionOutput[] | ZeroShotObjectDetectionOutput[][]
  >;
}
declare const DocumentQuestionAnsweringPipeline_base: new (
  options: TextImagePipelineConstructorArgs,
) => DocumentQuestionAnsweringPipelineType;
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
export class DocumentQuestionAnsweringPipeline extends DocumentQuestionAnsweringPipeline_base {
  _call(
    image: ImageInput,
    question: string,
    options?: import("./utils/generation.js").GenerationConfigType,
  ): Promise<
    DocumentQuestionAnsweringOutput | DocumentQuestionAnsweringOutput[]
  >;
}
declare const TextToAudioPipeline_base: new (
  options: TextToAudioPipelineConstructorArgs,
) => TextToAudioPipelineType;
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
export class TextToAudioPipeline extends TextToAudioPipeline_base {
  DEFAULT_VOCODER_ID: string;
  vocoder: PreTrainedModel;
  _call(
    texts: string | string[],
    options: TextToAudioPipelineOptions,
  ): Promise<TextToAudioOutput>;
  _call_text_to_waveform(text_inputs: any): Promise<{
    audio: any;
    sampling_rate: any;
  }>;
  _call_text_to_spectrogram(
    text_inputs: any,
    {
      speaker_embeddings,
    }: {
      speaker_embeddings: any;
    },
  ): Promise<{
    audio: any;
    sampling_rate: any;
  }>;
}
declare const ImageToImagePipeline_base: new (
  options: ImagePipelineConstructorArgs,
) => ImageToImagePipelineType;
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
export class ImageToImagePipeline extends ImageToImagePipeline_base {
  _call(images: ImagePipelineInputs): Promise<RawImage | RawImage[]>;
}
declare const DepthEstimationPipeline_base: new (
  options: ImagePipelineConstructorArgs,
) => DepthEstimationPipelineType;
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
export class DepthEstimationPipeline extends DepthEstimationPipeline_base {
  _call(
    images: ImagePipelineInputs,
  ): Promise<DepthEstimationPipelineOutput | DepthEstimationPipelineOutput[]>;
}
export type ImageInput = string | RawImage | URL;
export type ImagePipelineInputs = ImageInput | ImageInput[];
export type AudioInput = string | URL | Float32Array | Float64Array;
export type AudioPipelineInputs = AudioInput | AudioInput[];
export type BoundingBox = {
  /**
   * The minimum x coordinate of the bounding box.
   */
  xmin: number;
  /**
   * The minimum y coordinate of the bounding box.
   */
  ymin: number;
  /**
   * The maximum x coordinate of the bounding box.
   */
  xmax: number;
  /**
   * The maximum y coordinate of the bounding box.
   */
  ymax: number;
};
export type TaskType = keyof typeof SUPPORTED_TASKS;
export type AliasType = keyof typeof TASK_ALIASES;
/**
 * All possible pipeline types.
 */
export type PipelineType = TaskType | AliasType;
/**
 * A mapping of pipeline names to their corresponding pipeline classes.
 */
export type SupportedTasks = {
  "text-classification": TextClassificationPipeline;
  "token-classification": TokenClassificationPipeline;
  "question-answering": QuestionAnsweringPipeline;
  "fill-mask": FillMaskPipeline;
  summarization: SummarizationPipeline;
  translation: TranslationPipeline;
  "text2text-generation": Text2TextGenerationPipeline;
  "text-generation": TextGenerationPipeline;
  "zero-shot-classification": ZeroShotClassificationPipeline;
  "audio-classification": AudioClassificationPipeline;
  "zero-shot-audio-classification": ZeroShotAudioClassificationPipeline;
  "automatic-speech-recognition": AutomaticSpeechRecognitionPipeline;
  "text-to-audio": TextToAudioPipeline;
  "image-to-text": ImageToTextPipeline;
  "image-classification": ImageClassificationPipeline;
  "image-segmentation": ImageSegmentationPipeline;
  "zero-shot-image-classification": ZeroShotImageClassificationPipeline;
  "object-detection": ObjectDetectionPipeline;
  "zero-shot-object-detection": ZeroShotObjectDetectionPipeline;
  "document-question-answering": DocumentQuestionAnsweringPipeline;
  "image-to-image": ImageToImagePipeline;
  "depth-estimation": DepthEstimationPipeline;
  "feature-extraction": FeatureExtractionPipeline;
};
/**
 * A mapping from pipeline aliases to their corresponding pipeline classes.
 */
export type AliasTasks = {
  "sentiment-analysis": TextClassificationPipeline;
  ner: TokenClassificationPipeline;
  asr: AutomaticSpeechRecognitionPipeline;
  "text-to-speech": TextToAudioPipeline;
  embeddings: FeatureExtractionPipeline;
};
/**
 * A mapping from all pipeline names and aliases to their corresponding pipeline classes.
 */
export type AllTasks = SupportedTasks & AliasTasks;
/**
 * Disposes the item.
 */
export type DisposeType = () => Promise<void>;
export type Disposable = {
  /**
   * A promise that resolves when the pipeline has been disposed.
   */
  dispose: DisposeType;
};
export type ModelTokenizerConstructorArgs = {
  /**
   * The task of the pipeline. Useful for specifying subtasks.
   */
  task: string;
  /**
   * The model used by the pipeline.
   */
  model: PreTrainedModel;
  /**
   * The tokenizer used by the pipeline.
   */
  tokenizer: PreTrainedTokenizer;
};
/**
 * An object used to instantiate a text-based pipeline.
 */
export type TextPipelineConstructorArgs = ModelTokenizerConstructorArgs;
export type ModelProcessorConstructorArgs = {
  /**
   * The task of the pipeline. Useful for specifying subtasks.
   */
  task: string;
  /**
   * The model used by the pipeline.
   */
  model: PreTrainedModel;
  /**
   * The processor used by the pipeline.
   */
  processor: Processor;
};
/**
 * An object used to instantiate an audio-based pipeline.
 */
export type AudioPipelineConstructorArgs = ModelProcessorConstructorArgs;
/**
 * An object used to instantiate an image-based pipeline.
 */
export type ImagePipelineConstructorArgs = ModelProcessorConstructorArgs;
export type ModelTokenizerProcessorConstructorArgs = {
  /**
   * The task of the pipeline. Useful for specifying subtasks.
   */
  task: string;
  /**
   * The model used by the pipeline.
   */
  model: PreTrainedModel;
  /**
   * The tokenizer used by the pipeline.
   */
  tokenizer: PreTrainedTokenizer;
  /**
   * The processor used by the pipeline.
   */
  processor: Processor;
};
/**
 * An object used to instantiate a text- and audio-based pipeline.
 */
export type TextAudioPipelineConstructorArgs =
  ModelTokenizerProcessorConstructorArgs;
/**
 * An object used to instantiate a text- and image-based pipeline.
 */
export type TextImagePipelineConstructorArgs =
  ModelTokenizerProcessorConstructorArgs;
export type TextClassificationSingle = {
  /**
   * The label predicted.
   */
  label: string;
  /**
   * The corresponding probability.
   */
  score: number;
};
export type TextClassificationOutput = TextClassificationSingle[];
/**
 * Parameters specific to text classification pipelines.
 */
export type TextClassificationPipelineOptions = {
  /**
   * The number of top predictions to be returned.
   */
  topk?: number;
};
/**
 * Classify the text(s) given as inputs.
 */
export type TextClassificationPipelineCallback = (
  texts: string | string[],
  options?: TextClassificationPipelineOptions,
) => Promise<TextClassificationOutput | TextClassificationOutput[]>;
export type TextClassificationPipelineType = TextPipelineConstructorArgs &
  TextClassificationPipelineCallback &
  Disposable;
export type TokenClassificationSingle = {
  /**
   * The token/word classified. This is obtained by decoding the selected tokens.
   */
  word: string;
  /**
   * The corresponding probability for `entity`.
   */
  score: number;
  /**
   * The entity predicted for that token/word.
   */
  entity: string;
  /**
   * The index of the corresponding token in the sentence.
   */
  index: number;
  /**
   * The index of the start of the corresponding entity in the sentence.
   */
  start?: number;
  /**
   * The index of the end of the corresponding entity in the sentence.
   */
  end?: number;
};
export type TokenClassificationOutput = TokenClassificationSingle[];
/**
 * Parameters specific to token classification pipelines.
 */
export type TokenClassificationPipelineOptions = {
  /**
   * A list of labels to ignore.
   */
  ignore_labels?: string[];
};
/**
 * Classify each token of the text(s) given as inputs.
 */
export type TokenClassificationPipelineCallback = (
  texts: string | string[],
  options?: TokenClassificationPipelineOptions,
) => Promise<TokenClassificationOutput | TokenClassificationOutput[]>;
export type TokenClassificationPipelineType = TextPipelineConstructorArgs &
  TokenClassificationPipelineCallback &
  Disposable;
export type QuestionAnsweringOutput = {
  /**
   * The probability associated to the answer.
   */
  score: number;
  /**
   * The character start index of the answer (in the tokenized version of the input).
   */
  start?: number;
  /**
   * The character end index of the answer (in the tokenized version of the input).
   */
  end?: number;
  /**
   * The answer to the question.
   */
  answer: string;
};
/**
 * Parameters specific to question answering pipelines.
 */
export type QuestionAnsweringPipelineOptions = {
  /**
   * The number of top answer predictions to be returned.
   */
  topk?: number;
};
/**
 * Answer the question(s) given as inputs by using the context(s).
 */
export type QuestionAnsweringPipelineCallback = (
  question: string | string[],
  context: string | string[],
  options?: QuestionAnsweringPipelineOptions,
) => Promise<QuestionAnsweringOutput | QuestionAnsweringOutput[]>;
export type QuestionAnsweringPipelineType = TextPipelineConstructorArgs &
  QuestionAnsweringPipelineCallback &
  Disposable;
export type FillMaskSingle = {
  /**
   * The corresponding input with the mask token prediction.
   */
  sequence: string;
  /**
   * The corresponding probability.
   */
  score: number;
  /**
   * The predicted token id (to replace the masked one).
   */
  token: number;
  /**
   * The predicted token (to replace the masked one).
   */
  token_str: string;
};
export type FillMaskOutput = FillMaskSingle[];
/**
 * Parameters specific to fill mask pipelines.
 */
export type FillMaskPipelineOptions = {
  /**
   * When passed, overrides the number of predictions to return.
   */
  topk?: number;
};
/**
 * Fill the masked token in the text(s) given as inputs.
 */
export type FillMaskPipelineCallback = (
  texts: string | string[],
  options?: FillMaskPipelineOptions,
) => Promise<FillMaskOutput | FillMaskOutput[]>;
export type FillMaskPipelineType = TextPipelineConstructorArgs &
  FillMaskPipelineCallback &
  Disposable;
export type Text2TextGenerationSingle = {
  /**
   * The generated text.
   */
  generated_text: string;
};
export type Text2TextGenerationOutput = Text2TextGenerationSingle[];
/**
 * Generate the output text(s) using text(s) given as inputs.
 */
export type Text2TextGenerationPipelineCallback = (
  texts: string | string[],
  options?: import("./utils/generation.js").GenerationConfigType,
) => Promise<Text2TextGenerationOutput | Text2TextGenerationOutput[]>;
export type Text2TextGenerationPipelineType = TextPipelineConstructorArgs &
  Text2TextGenerationPipelineCallback &
  Disposable;
export type SummarizationSingle = {
  /**
   * The summary text.
   */
  summary_text: string;
};
export type SummarizationOutput = SummarizationSingle[];
/**
 * Summarize the text(s) given as inputs.
 */
export type SummarizationPipelineCallback = (
  texts: string | string[],
  options?: import("./utils/generation.js").GenerationConfigType,
) => Promise<SummarizationOutput | SummarizationOutput[]>;
export type SummarizationPipelineType = TextPipelineConstructorArgs &
  SummarizationPipelineCallback &
  Disposable;
export type TranslationSingle = {
  /**
   * The translated text.
   */
  translation_text: string;
};
export type TranslationOutput = TranslationSingle[];
/**
 * Translate the text(s) given as inputs.
 */
export type TranslationPipelineCallback = (
  texts: string | string[],
  options?: import("./utils/generation.js").GenerationConfigType,
) => Promise<TranslationOutput | TranslationOutput[]>;
export type TranslationPipelineType = TextPipelineConstructorArgs &
  TranslationPipelineCallback &
  Disposable;
export type TextGenerationSingle = {
  /**
   * The generated text.
   */
  generated_text: string;
};
export type TextGenerationOutput = TextGenerationSingle[];
/**
 * Parameters specific to text-generation pipelines.
 */
export type TextGenerationSpecificParams = {
  /**
   * Whether or not to add special tokens when tokenizing the sequences.
   */
  add_special_tokens?: boolean;
};
export type TextGenerationConfig =
  import("./utils/generation.js").GenerationConfigType &
    TextGenerationSpecificParams;
/**
 * Complete the prompt(s) given as inputs.
 */
export type TextGenerationPipelineCallback = (
  texts: string | string[],
  options?: TextGenerationConfig,
) => Promise<TextGenerationOutput | TextGenerationOutput[]>;
export type TextGenerationPipelineType = TextPipelineConstructorArgs &
  TextGenerationPipelineCallback &
  Disposable;
export type ZeroShotClassificationOutput = {
  /**
   * The sequence for which this is the output.
   */
  sequence: string;
  /**
   * The labels sorted by order of likelihood.
   */
  labels: string[];
  /**
   * The probabilities for each of the labels.
   */
  scores: number[];
};
/**
 * Parameters specific to zero-shot classification pipelines.
 */
export type ZeroShotClassificationPipelineOptions = {
  /**
   * The template used to turn each
   * candidate label into an NLI-style hypothesis. The candidate label will replace the {} placeholder.
   */
  hypothesis_template?: string;
  /**
   * Whether or not multiple candidate labels can be true.
   * If `false`, the scores are normalized such that the sum of the label likelihoods for each sequence
   * is 1. If `true`, the labels are considered independent and probabilities are normalized for each
   * candidate by doing a softmax of the entailment score vs. the contradiction score.
   */
  multi_label?: boolean;
};
/**
 * Classify the sequence(s) given as inputs.
 */
export type ZeroShotClassificationPipelineCallback = (
  texts: string | string[],
  candidate_labels: string | string[],
  options?: ZeroShotClassificationPipelineOptions,
) => Promise<ZeroShotClassificationOutput | ZeroShotClassificationOutput[]>;
export type ZeroShotClassificationPipelineType = TextPipelineConstructorArgs &
  ZeroShotClassificationPipelineCallback &
  Disposable;
/**
 * Parameters specific to feature extraction pipelines.
 */
export type FeatureExtractionPipelineOptions = {
  /**
   * The pooling method to use.
   */
  pooling?: "none" | "mean" | "cls";
  /**
   * Whether or not to normalize the embeddings in the last dimension.
   */
  normalize?: boolean;
};
/**
 * Extract the features of the input(s).
 */
export type FeatureExtractionPipelineCallback = (
  texts: string | string[],
  options?: FeatureExtractionPipelineOptions,
) => Promise<Tensor>;
export type FeatureExtractionPipelineType = TextPipelineConstructorArgs &
  FeatureExtractionPipelineCallback &
  Disposable;
export type AudioClassificationSingle = {
  /**
   * The label predicted.
   */
  label: string;
  /**
   * The corresponding probability.
   */
  score: number;
};
export type AudioClassificationOutput = AudioClassificationSingle[];
/**
 * Parameters specific to audio classification pipelines.
 */
export type AudioClassificationPipelineOptions = {
  /**
   * The number of top labels that will be returned by the pipeline.
   * If the provided number is `null` or higher than the number of labels available in the model configuration,
   * it will default to the number of labels.
   */
  topk?: number;
};
/**
 * Classify the sequence(s) given as inputs.
 */
export type AudioClassificationPipelineCallback = (
  audio: AudioPipelineInputs,
  options?: AudioClassificationPipelineOptions,
) => Promise<AudioClassificationOutput | AudioClassificationOutput[]>;
export type AudioClassificationPipelineType = AudioPipelineConstructorArgs &
  AudioClassificationPipelineCallback &
  Disposable;
export type ZeroShotAudioClassificationOutput = {
  /**
   * The label identified by the model. It is one of the suggested `candidate_label`.
   */
  label: string;
  /**
   * The score attributed by the model for that label (between 0 and 1).
   */
  score: number;
};
/**
 * Parameters specific to zero-shot audio classification pipelines.
 */
export type ZeroShotAudioClassificationPipelineOptions = {
  /**
   * The sentence used in conjunction with `candidate_labels`
   * to attempt the audio classification by replacing the placeholder with the candidate_labels.
   * Then likelihood is estimated by using `logits_per_audio`.
   */
  hypothesis_template?: string;
};
/**
 * Classify the sequence(s) given as inputs.
 */
export type ZeroShotAudioClassificationPipelineCallback = (
  audio: AudioPipelineInputs,
  candidate_labels: string[],
  options?: ZeroShotAudioClassificationPipelineOptions,
) => Promise<
  ZeroShotAudioClassificationOutput[] | ZeroShotAudioClassificationOutput[][]
>;
export type ZeroShotAudioClassificationPipelineType =
  TextAudioPipelineConstructorArgs &
    ZeroShotAudioClassificationPipelineCallback &
    Disposable;
export type ChunkCallbackItem = {
  stride: number[];
  input_features: Tensor;
  is_last: boolean;
  tokens?: number[];
  token_timestamps?: number[];
};
export type ChunkCallback = (chunk: ChunkCallbackItem) => any;
export type Chunk = {
  /**
   * The start and end timestamp of the chunk in seconds.
   */
  timestamp: [number, number];
  /**
   * The recognized text.
   */
  text: string;
};
export type AutomaticSpeechRecognitionOutput = {
  /**
   * The recognized text.
   */
  text: string;
  /**
   * When using `return_timestamps`, the `chunks` will become a list
   * containing all the various text chunks identified by the model.
   */
  chunks?: Chunk[];
};
/**
 * Parameters specific to automatic-speech-recognition pipelines.
 */
export type AutomaticSpeechRecognitionSpecificParams = {
  /**
   * Whether to return timestamps or not. Default is `false`.
   */
  return_timestamps?: boolean | "word";
  /**
   * The length of audio chunks to process in seconds. Default is 0 (no chunking).
   */
  chunk_length_s?: number;
  /**
   * The length of overlap between consecutive audio chunks in seconds. If not provided, defaults to `chunk_length_s / 6`.
   */
  stride_length_s?: number;
  /**
   * Callback function to be called with each chunk processed.
   */
  chunk_callback?: ChunkCallback;
  /**
   * Whether to force outputting full sequences or not. Default is `false`.
   */
  force_full_sequences?: boolean;
  /**
   * The source language. Default is `null`, meaning it should be auto-detected. Use this to potentially improve performance if the source language is known.
   */
  language?: string;
  /**
   * The task to perform. Default is `null`, meaning it should be auto-detected.
   */
  task?: string;
  /**
   * A list of pairs of integers which indicates a mapping from generation indices to token indices
   * that will be forced before sampling. For example, [[1, 123]] means the second generated token will always be a token of index 123.
   */
  forced_decoder_ids?: number[][];
  /**
   * The number of frames in the input audio.
   */
  num_frames?: number;
};
export type AutomaticSpeechRecognitionConfig =
  import("./utils/generation.js").GenerationConfigType &
    AutomaticSpeechRecognitionSpecificParams;
/**
 * Transcribe the audio sequence(s) given as inputs to text.
 */
export type AutomaticSpeechRecognitionPipelineCallback = (
  audio: AudioPipelineInputs,
  options?: AutomaticSpeechRecognitionConfig,
) => Promise<
  AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[]
>;
export type AutomaticSpeechRecognitionPipelineType =
  TextAudioPipelineConstructorArgs &
    AutomaticSpeechRecognitionPipelineCallback &
    Disposable;
export type ImageToTextSingle = {
  /**
   * The generated text.
   */
  generated_text: string;
};
export type ImageToTextOutput = ImageToTextSingle[];
/**
 * Assign labels to the image(s) passed as inputs.
 */
export type ImageToTextPipelineCallback = (
  texts: ImagePipelineInputs,
  options?: import("./utils/generation.js").GenerationConfigType,
) => Promise<ImageToTextOutput | ImageToTextOutput[]>;
export type ImageToTextPipelineType = TextImagePipelineConstructorArgs &
  ImageToTextPipelineCallback &
  Disposable;
export type ImageClassificationSingle = {
  /**
   * The label identified by the model.
   */
  label: string;
  /**
   * The score attributed by the model for that label.
   */
  score: number;
};
export type ImageClassificationOutput = ImageClassificationSingle[];
/**
 * Parameters specific to image classification pipelines.
 */
export type ImageClassificationPipelineOptions = {
  /**
   * The number of top labels that will be returned by the pipeline.
   */
  topk?: number;
};
/**
 * Assign labels to the image(s) passed as inputs.
 */
export type ImageClassificationPipelineCallback = (
  images: ImagePipelineInputs,
  options?: ImageClassificationPipelineOptions,
) => Promise<ImageClassificationOutput | ImageClassificationOutput[]>;
export type ImageClassificationPipelineType = ImagePipelineConstructorArgs &
  ImageClassificationPipelineCallback &
  Disposable;
export type ImageSegmentationPipelineOutput = {
  /**
   * The label of the segment.
   */
  label: string;
  /**
   * The score of the segment.
   */
  score: number | null;
  /**
   * The mask of the segment.
   */
  mask: RawImage;
};
/**
 * Parameters specific to image segmentation pipelines.
 */
export type ImageSegmentationPipelineOptions = {
  /**
   * Probability threshold to filter out predicted masks.
   */
  threshold?: number;
  /**
   * Threshold to use when turning the predicted masks into binary values.
   */
  mask_threshold?: number;
  /**
   * Mask overlap threshold to eliminate small, disconnected segments.
   */
  overlap_mask_area_threshold?: number;
  /**
   * Segmentation task to be performed. One of [`panoptic`, `instance`, and `semantic`],
   * depending on model capabilities. If not set, the pipeline will attempt to resolve (in that order).
   */
  subtask?: null | string;
  /**
   * List of label ids to fuse. If not set, do not fuse any labels.
   */
  label_ids_to_fuse?: number[];
  /**
   * List of target sizes for the input images. If not set, use the original image sizes.
   */
  target_sizes?: number[][];
};
/**
 * Segment the input images.
 */
export type ImageSegmentationPipelineCallback = (
  images: ImagePipelineInputs,
  options?: ImageSegmentationPipelineOptions,
) => Promise<ImageSegmentationPipelineOutput[]>;
export type ImageSegmentationPipelineType = ImagePipelineConstructorArgs &
  ImageSegmentationPipelineCallback &
  Disposable;
export type ZeroShotImageClassificationOutput = {
  /**
   * The label identified by the model. It is one of the suggested `candidate_label`.
   */
  label: string;
  /**
   * The score attributed by the model for that label (between 0 and 1).
   */
  score: number;
};
/**
 * Parameters specific to zero-shot image classification pipelines.
 */
export type ZeroShotImageClassificationPipelineOptions = {
  /**
   * The sentence used in conjunction with `candidate_labels`
   * to attempt the image classification by replacing the placeholder with the candidate_labels.
   * Then likelihood is estimated by using `logits_per_image`.
   */
  hypothesis_template?: string;
};
/**
 * Assign labels to the image(s) passed as inputs.
 */
export type ZeroShotImageClassificationPipelineCallback = (
  images: ImagePipelineInputs,
  candidate_labels: string[],
  options?: ZeroShotImageClassificationPipelineOptions,
) => Promise<
  ZeroShotImageClassificationOutput[] | ZeroShotImageClassificationOutput[][]
>;
export type ZeroShotImageClassificationPipelineType =
  TextImagePipelineConstructorArgs &
    ZeroShotImageClassificationPipelineCallback &
    Disposable;
export type ObjectDetectionPipelineSingle = {
  /**
   * The class label identified by the model.
   */
  label: string;
  /**
   * The score attributed by the model for that label.
   */
  score: number;
  /**
   * The bounding box of detected object in image's original size, or as a percentage if `percentage` is set to true.
   */
  box: BoundingBox;
};
export type ObjectDetectionPipelineOutput = ObjectDetectionPipelineSingle[];
/**
 * Parameters specific to object detection pipelines.
 */
export type ObjectDetectionPipelineOptions = {
  /**
   * The threshold used to filter boxes by score.
   */
  threshold?: number;
  /**
   * Whether to return the boxes coordinates in percentage (true) or in pixels (false).
   */
  percentage?: boolean;
};
/**
 * Detect objects (bounding boxes & classes) in the image(s) passed as inputs.
 */
export type ObjectDetectionPipelineCallback = (
  images: ImagePipelineInputs,
  options?: ObjectDetectionPipelineOptions,
) => Promise<ObjectDetectionPipelineOutput | ObjectDetectionPipelineOutput[]>;
export type ObjectDetectionPipelineType = ImagePipelineConstructorArgs &
  ObjectDetectionPipelineCallback &
  Disposable;
export type ZeroShotObjectDetectionOutput = {
  /**
   * Text query corresponding to the found object.
   */
  label: string;
  /**
   * Score corresponding to the object (between 0 and 1).
   */
  score: number;
  /**
   * Bounding box of the detected object in image's original size, or as a percentage if `percentage` is set to true.
   */
  box: BoundingBox;
};
/**
 * Parameters specific to zero-shot object detection pipelines.
 */
export type ZeroShotObjectDetectionPipelineOptions = {
  /**
   * The probability necessary to make a prediction.
   */
  threshold?: number;
  /**
   * The number of top predictions that will be returned by the pipeline.
   * If the provided number is `null` or higher than the number of predictions available, it will default
   * to the number of predictions.
   */
  topk?: number;
  /**
   * Whether to return the boxes coordinates in percentage (true) or in pixels (false).
   */
  percentage?: boolean;
};
/**
 * Detect objects (bounding boxes & classes) in the image(s) passed as inputs.
 */
export type ZeroShotObjectDetectionPipelineCallback = (
  images: ImagePipelineInputs,
  candidate_labels: string[],
  options?: ZeroShotObjectDetectionPipelineOptions,
) => Promise<
  ZeroShotObjectDetectionOutput[] | ZeroShotObjectDetectionOutput[][]
>;
export type ZeroShotObjectDetectionPipelineType =
  TextImagePipelineConstructorArgs &
    ZeroShotObjectDetectionPipelineCallback &
    Disposable;
export type DocumentQuestionAnsweringSingle = {
  /**
   * The generated text.
   */
  answer: string;
};
export type DocumentQuestionAnsweringOutput = DocumentQuestionAnsweringSingle[];
/**
 * Answer the question given as input by using the document.
 */
export type DocumentQuestionAnsweringPipelineCallback = (
  image: ImageInput,
  question: string,
  options?: import("./utils/generation.js").GenerationConfigType,
) => Promise<
  DocumentQuestionAnsweringOutput | DocumentQuestionAnsweringOutput[]
>;
export type DocumentQuestionAnsweringPipelineType =
  TextImagePipelineConstructorArgs &
    DocumentQuestionAnsweringPipelineCallback &
    Disposable;
export type VocoderOptions = {
  /**
   * The vocoder used by the pipeline (if the model uses one). If not provided, use the default HifiGan vocoder.
   */
  vocoder?: PreTrainedModel;
};
export type TextToAudioPipelineConstructorArgs =
  TextAudioPipelineConstructorArgs & VocoderOptions;
export type TextToAudioOutput = {
  /**
   * The generated audio waveform.
   */
  audio: Float32Array;
  /**
   * The sampling rate of the generated audio waveform.
   */
  sampling_rate: number;
};
/**
 * Parameters specific to text-to-audio pipelines.
 */
export type TextToAudioPipelineOptions = {
  /**
   * The speaker embeddings (if the model requires it).
   */
  speaker_embeddings?: Tensor | Float32Array | string | URL;
};
/**
 * Generates speech/audio from the inputs.
 */
export type TextToAudioPipelineCallback = (
  texts: string | string[],
  options: TextToAudioPipelineOptions,
) => Promise<TextToAudioOutput>;
export type TextToAudioPipelineType = TextToAudioPipelineConstructorArgs &
  TextToAudioPipelineCallback &
  Disposable;
/**
 * Transform the image(s) passed as inputs.
 */
export type ImageToImagePipelineCallback = (
  images: ImagePipelineInputs,
) => Promise<RawImage | RawImage[]>;
export type ImageToImagePipelineType = ImagePipelineConstructorArgs &
  ImageToImagePipelineCallback &
  Disposable;
export type DepthEstimationPipelineOutput = {
  /**
   * The raw depth map predicted by the model.
   */
  predicted_depth: Tensor;
  /**
   * The processed depth map as an image (with the same size as the input image).
   */
  depth: RawImage;
};
/**
 * Predicts the depth for the image(s) passed as inputs.
 */
export type DepthEstimationPipelineCallback = (
  images: ImagePipelineInputs,
) => Promise<DepthEstimationPipelineOutput | DepthEstimationPipelineOutput[]>;
export type DepthEstimationPipelineType = ImagePipelineConstructorArgs &
  DepthEstimationPipelineCallback &
  Disposable;
import { PreTrainedModel } from "./models.js";
import { PreTrainedTokenizer } from "./tokenizers.js";
import { Processor } from "./processors.js";
import { Tensor } from "./utils/tensor.js";
import { RawImage } from "./utils/image.js";
declare const SUPPORTED_TASKS: Readonly<{
  "text-classification": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof TextClassificationPipeline;
    model: typeof AutoModelForSequenceClassification;
    default: {
      model: string;
    };
    type: string;
  };
  "token-classification": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof TokenClassificationPipeline;
    model: typeof AutoModelForTokenClassification;
    default: {
      model: string;
    };
    type: string;
  };
  "question-answering": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof QuestionAnsweringPipeline;
    model: typeof AutoModelForQuestionAnswering;
    default: {
      model: string;
    };
    type: string;
  };
  "fill-mask": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof FillMaskPipeline;
    model: typeof AutoModelForMaskedLM;
    default: {
      model: string;
    };
    type: string;
  };
  summarization: {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof SummarizationPipeline;
    model: typeof AutoModelForSeq2SeqLM;
    default: {
      model: string;
    };
    type: string;
  };
  translation: {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof TranslationPipeline;
    model: typeof AutoModelForSeq2SeqLM;
    default: {
      model: string;
    };
    type: string;
  };
  "text2text-generation": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof Text2TextGenerationPipeline;
    model: typeof AutoModelForSeq2SeqLM;
    default: {
      model: string;
    };
    type: string;
  };
  "text-generation": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof TextGenerationPipeline;
    model: typeof AutoModelForCausalLM;
    default: {
      model: string;
    };
    type: string;
  };
  "zero-shot-classification": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof ZeroShotClassificationPipeline;
    model: typeof AutoModelForSequenceClassification;
    default: {
      model: string;
    };
    type: string;
  };
  "audio-classification": {
    pipeline: typeof AudioClassificationPipeline;
    model: typeof AutoModelForAudioClassification;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "zero-shot-audio-classification": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof ZeroShotAudioClassificationPipeline;
    model: typeof AutoModel;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "automatic-speech-recognition": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof AutomaticSpeechRecognitionPipeline;
    model: (typeof AutoModelForSpeechSeq2Seq)[];
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "text-to-audio": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof TextToAudioPipeline;
    model: (
      | typeof AutoModelForTextToSpectrogram
      | typeof AutoModelForTextToWaveform
    )[];
    processor: (typeof AutoProcessor)[];
    default: {
      model: string;
    };
    type: string;
  };
  "image-to-text": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof ImageToTextPipeline;
    model: typeof AutoModelForVision2Seq;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "image-classification": {
    pipeline: typeof ImageClassificationPipeline;
    model: typeof AutoModelForImageClassification;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "image-segmentation": {
    pipeline: typeof ImageSegmentationPipeline;
    model: (typeof AutoModelForImageSegmentation)[];
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "zero-shot-image-classification": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof ZeroShotImageClassificationPipeline;
    model: typeof AutoModel;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "object-detection": {
    pipeline: typeof ObjectDetectionPipeline;
    model: typeof AutoModelForObjectDetection;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "zero-shot-object-detection": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof ZeroShotObjectDetectionPipeline;
    model: typeof AutoModelForZeroShotObjectDetection;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "document-question-answering": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof DocumentQuestionAnsweringPipeline;
    model: typeof AutoModelForDocumentQuestionAnswering;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "image-to-image": {
    pipeline: typeof ImageToImagePipeline;
    model: typeof AutoModelForImageToImage;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "depth-estimation": {
    pipeline: typeof DepthEstimationPipeline;
    model: typeof AutoModelForDepthEstimation;
    processor: typeof AutoProcessor;
    default: {
      model: string;
    };
    type: string;
  };
  "feature-extraction": {
    tokenizer: typeof AutoTokenizer;
    pipeline: typeof FeatureExtractionPipeline;
    model: typeof AutoModel;
    default: {
      model: string;
    };
    type: string;
  };
}>;
declare const TASK_ALIASES: Readonly<{
  "sentiment-analysis": "text-classification";
  ner: "token-classification";
  asr: "automatic-speech-recognition";
  "text-to-speech": "text-to-audio";
  embeddings: "feature-extraction";
}>;
import { AutoTokenizer } from "./tokenizers.js";
import { AutoModelForSequenceClassification } from "./models.js";
import { AutoModelForTokenClassification } from "./models.js";
import { AutoModelForQuestionAnswering } from "./models.js";
import { AutoModelForMaskedLM } from "./models.js";
import { AutoModelForSeq2SeqLM } from "./models.js";
import { AutoModelForCausalLM } from "./models.js";
import { AutoModelForAudioClassification } from "./models.js";
import { AutoProcessor } from "./processors.js";
import { AutoModel } from "./models.js";
import { AutoModelForSpeechSeq2Seq } from "./models.js";
import { AutoModelForTextToSpectrogram } from "./models.js";
import { AutoModelForTextToWaveform } from "./models.js";
import { AutoModelForVision2Seq } from "./models.js";
import { AutoModelForImageClassification } from "./models.js";
import { AutoModelForImageSegmentation } from "./models.js";
import { AutoModelForObjectDetection } from "./models.js";
import { AutoModelForZeroShotObjectDetection } from "./models.js";
import { AutoModelForDocumentQuestionAnswering } from "./models.js";
import { AutoModelForImageToImage } from "./models.js";
import { AutoModelForDepthEstimation } from "./models.js";
export {};
//# sourceMappingURL=pipelines.d.ts.map
