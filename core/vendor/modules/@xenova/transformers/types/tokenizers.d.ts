declare const TokenizerModel_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
/**
 * Abstract base class for tokenizer models.
 *
 * @extends Callable
 */
export class TokenizerModel extends TokenizerModel_base {
  /**
   * Instantiates a new TokenizerModel instance based on the configuration object provided.
   * @param {Object} config The configuration object for the TokenizerModel.
   * @param {...*} args Optional arguments to pass to the specific TokenizerModel constructor.
   * @returns {TokenizerModel} A new instance of a TokenizerModel.
   * @throws Will throw an error if the TokenizerModel type in the config is not recognized.
   */
  static fromConfig(config: any, ...args: any[]): TokenizerModel;
  /**
   * Creates a new instance of TokenizerModel.
   * @param {Object} config The configuration object for the TokenizerModel.
   */
  constructor(config: any);
  config: any;
  /** @type {string[]} */
  vocab: string[];
  /**
   * A mapping of tokens to ids.
   * @type {Map<string, number>}
   */
  tokens_to_ids: Map<string, number>;
  unk_token_id: any;
  unk_token: any;
  end_of_word_suffix: any;
  /** @type {boolean} Whether to fuse unknown tokens when encoding. Defaults to false. */
  fuse_unk: boolean;
  /**
   * Internal function to call the TokenizerModel instance.
   * @param {string[]} tokens The tokens to encode.
   * @returns {string[]} The encoded token IDs.
   */
  _call(tokens: string[]): string[];
  /**
   * Encodes a list of tokens into a list of token IDs.
   * @param {string[]} tokens The tokens to encode.
   * @returns {string[]} The encoded tokens.
   * @throws Will throw an error if not implemented in a subclass.
   */
  encode(tokens: string[]): string[];
  /**
   * Converts a list of tokens into a list of token IDs.
   * @param {string[]} tokens The tokens to convert.
   * @returns {number[]} The converted token IDs.
   */
  convert_tokens_to_ids(tokens: string[]): number[];
  /**
   * Converts a list of token IDs into a list of tokens.
   * @param {number[]} ids The token IDs to convert.
   * @returns {string[]} The converted tokens.
   */
  convert_ids_to_tokens(ids: number[]): string[];
}
declare const PreTrainedTokenizer_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
export class PreTrainedTokenizer extends PreTrainedTokenizer_base {
  /**
   * Loads a pre-trained tokenizer from the given `pretrained_model_name_or_path`.
   *
   * @param {string} pretrained_model_name_or_path The path to the pre-trained tokenizer.
   * @param {PretrainedTokenizerOptions} options Additional options for loading the tokenizer.
   *
   * @throws {Error} Throws an error if the tokenizer.json or tokenizer_config.json files are not found in the `pretrained_model_name_or_path`.
   * @returns {Promise<PreTrainedTokenizer>} A new instance of the `PreTrainedTokenizer` class.
   */
  static from_pretrained(
    pretrained_model_name_or_path: string,
    {
      progress_callback,
      config,
      cache_dir,
      local_files_only,
      revision,
      legacy,
    }?: PretrainedTokenizerOptions,
  ): Promise<PreTrainedTokenizer>;
  /**
   * Create a new PreTrainedTokenizer instance.
   * @param {Object} tokenizerJSON The JSON of the tokenizer.
   * @param {Object} tokenizerConfig The config of the tokenizer.
   */
  constructor(tokenizerJSON: any, tokenizerConfig: any);
  return_token_type_ids: boolean;
  _default_chat_template: string;
  _tokenizer_config: any;
  normalizer: Normalizer;
  pre_tokenizer: PreTokenizer;
  model: TokenizerModel;
  post_processor: PostProcessor;
  decoder: Decoder;
  special_tokens: any[];
  all_special_ids: number[];
  /** @type {AddedToken[]} */
  added_tokens: AddedToken[];
  additional_special_tokens: any;
  added_tokens_regex: RegExp;
  mask_token: string;
  mask_token_id: number;
  pad_token: string;
  pad_token_id: number;
  sep_token: string;
  sep_token_id: number;
  unk_token: string;
  unk_token_id: number;
  model_max_length: any;
  /** @type {boolean} Whether or not to strip the text when tokenizing (removing excess spaces before and after the string). */
  remove_space: boolean;
  clean_up_tokenization_spaces: any;
  do_lowercase_and_remove_accent: any;
  /** @type {'right'|'left'} */
  padding_side: "right" | "left";
  legacy: boolean;
  chat_template: any;
  _compiled_template_cache: Map<any, any>;
  /**
   * Returns the value of the first matching key in the tokenizer config object.
   * @param {...string} keys One or more keys to search for in the tokenizer config object.
   * @returns {string|null} The value associated with the first matching key, or null if no match is found.
   * @throws {Error} If an object is found for a matching key and its __type property is not "AddedToken".
   */
  getToken(...keys: string[]): string | null;
  /**
   * @typedef {number[]|number[][]|Tensor} BatchEncodingItem
   *
   * @typedef {Object} BatchEncoding Holds the output of the tokenizer's call function.
   * @property {BatchEncodingItem} input_ids List of token ids to be fed to a model.
   * @property {BatchEncodingItem} attention_mask List of indices specifying which tokens should be attended to by the model.
   * @property {BatchEncodingItem} [token_type_ids] List of token type ids to be fed to a model.
   */
  /**
   * Encode/tokenize the given text(s).
   * @param {string|string[]} text The text to tokenize.
   * @param {Object} options An optional object containing the following properties:
   * @param {string|string[]} [options.text_pair=null] Optional second sequence to be encoded. If set, must be the same type as text.
   * @param {boolean|'max_length'} [options.padding=false] Whether to pad the input sequences.
   * @param {boolean} [options.add_special_tokens=true] Whether or not to add the special tokens associated with the corresponding model.
   * @param {boolean} [options.truncation=null] Whether to truncate the input sequences.
   * @param {number} [options.max_length=null] Maximum length of the returned list and optionally padding length.
   * @param {boolean} [options.return_tensor=true] Whether to return the results as Tensors or arrays.
   * @returns {BatchEncoding} Object to be passed to the model.
   */
  _call(
    text: string | string[],
    {
      text_pair,
      add_special_tokens,
      padding,
      truncation,
      max_length,
      return_tensor,
    }?: {
      text_pair?: string | string[];
      padding?: boolean | "max_length";
      add_special_tokens?: boolean;
      truncation?: boolean;
      max_length?: number;
      return_tensor?: boolean;
    },
  ): {
    /**
     * List of token ids to be fed to a model.
     */
    input_ids: number[] | Tensor | number[][];
    /**
     * List of indices specifying which tokens should be attended to by the model.
     */
    attention_mask: number[] | Tensor | number[][];
    /**
     * List of token type ids to be fed to a model.
     */
    token_type_ids?: number[] | Tensor | number[][];
  };
  /**
   * Encodes a single text using the preprocessor pipeline of the tokenizer.
   *
   * @param {string|null} text The text to encode.
   * @returns {string[]|null} The encoded tokens.
   */
  _encode_text(text: string | null): string[] | null;
  /**
   * Encodes a single text or a pair of texts using the model's tokenizer.
   *
   * @param {string} text The text to encode.
   * @param {string|null} text_pair The optional second text to encode.
   * @param {Object} options An optional object containing the following properties:
   * @param {boolean} [options.add_special_tokens=true] Whether or not to add the special tokens associated with the corresponding model.
   * @returns {EncodingSingle} An object containing the encoded text.
   * @private
   */
  private _encode_plus;
  /**
   * Encodes a single text or a pair of texts using the model's tokenizer.
   *
   * @param {string} text The text to encode.
   * @param {string|null} text_pair The optional second text to encode.
   * @param {Object} options An optional object containing the following properties:
   * @param {boolean} [options.add_special_tokens=true] Whether or not to add the special tokens associated with the corresponding model.
   * @returns {number[]} An array of token IDs representing the encoded text(s).
   */
  encode(
    text: string,
    text_pair?: string | null,
    {
      add_special_tokens,
    }?: {
      add_special_tokens?: boolean;
    },
  ): number[];
  /**
   * Decode a batch of tokenized sequences.
   * @param {number[][]|Tensor} batch List/Tensor of tokenized input sequences.
   * @param {Object} decode_args (Optional) Object with decoding arguments.
   * @returns {string[]} List of decoded sequences.
   */
  batch_decode(batch: number[][] | Tensor, decode_args?: any): string[];
  /**
   * Decodes a sequence of token IDs back to a string.
   *
   * @param {number[]|Tensor} token_ids List/Tensor of token IDs to decode.
   * @param {Object} [decode_args={}]
   * @param {boolean} [decode_args.skip_special_tokens=false] If true, special tokens are removed from the output string.
   * @param {boolean} [decode_args.clean_up_tokenization_spaces=true] If true, spaces before punctuations and abbreviated forms are removed.
   *
   * @returns {string} The decoded string.
   * @throws {Error} If `token_ids` is not a non-empty array of integers.
   */
  decode(
    token_ids: number[] | Tensor,
    decode_args?: {
      skip_special_tokens?: boolean;
      clean_up_tokenization_spaces?: boolean;
    },
  ): string;
  /**
   * Decode a single list of token ids to a string.
   * @param {number[]} token_ids List of token ids to decode
   * @param {Object} decode_args Optional arguments for decoding
   * @param {boolean} [decode_args.skip_special_tokens=false] Whether to skip special tokens during decoding
   * @param {boolean} [decode_args.clean_up_tokenization_spaces=null] Whether to clean up tokenization spaces during decoding.
   * If null, the value is set to `this.decoder.cleanup` if it exists, falling back to `this.clean_up_tokenization_spaces` if it exists, falling back to `true`.
   * @returns {string} The decoded string
   */
  decode_single(
    token_ids: number[],
    {
      skip_special_tokens,
      clean_up_tokenization_spaces,
    }: {
      skip_special_tokens?: boolean;
      clean_up_tokenization_spaces?: boolean;
    },
  ): string;
  get default_chat_template(): string;
  _warned_about_chat_template: boolean;
  /**
   * @typedef {Object} Message
   * @property {string} role The role of the message (e.g., "user" or "assistant" or "system").
   * @property {string} content The content of the message.
   */
  /**
   * Converts a list of message objects with `"role"` and `"content"` keys to a list of token
   * ids. This method is intended for use with chat models, and will read the tokenizer's chat_template attribute to
   * determine the format and control tokens to use when converting. When chat_template is None, it will fall back
   * to the default_chat_template specified at the class level.
   *
   * See [here](https://huggingface.co/docs/transformers/chat_templating) for more information.
   *
   * **Example:** Applying a chat template to a conversation.
   *
   * ```javascript
   * import { AutoTokenizer } from "@xenova/transformers";
   *
   * const tokenizer = await AutoTokenizer.from_pretrained("mistralai/Mistral-7B-Instruct-v0.1");
   *
   * const chat = [
   *   { "role": "user", "content": "Hello, how are you?" },
   *   { "role": "assistant", "content": "I'm doing great. How can I help you today?" },
   *   { "role": "user", "content": "I'd like to show off how chat templating works!" },
   * ]
   *
   * const text = tokenizer.apply_chat_template(chat, { tokenize: false });
   * // "<s>[INST] Hello, how are you? [/INST]I'm doing great. How can I help you today?</s> [INST] I'd like to show off how chat templating works! [/INST]"
   *
   * const input_ids = tokenizer.apply_chat_template(chat, { tokenize: true, return_tensor: false });
   * // [1, 733, 16289, 28793, 22557, 28725, 910, 460, 368, 28804, 733, 28748, 16289, 28793, 28737, 28742, 28719, 2548, 1598, 28723, 1602, 541, 315, 1316, 368, 3154, 28804, 2, 28705, 733, 16289, 28793, 315, 28742, 28715, 737, 298, 1347, 805, 910, 10706, 5752, 1077, 3791, 28808, 733, 28748, 16289, 28793]
   * ```
   *
   * @param {Message[]} conversation A list of message objects with `"role"` and `"content"` keys.
   * @param {Object} options An optional object containing the following properties:
   * @param {string} [options.chat_template=null] A Jinja template to use for this conversion. If
   * this is not passed, the model's default chat template will be used instead.
   * @param {boolean} [options.add_generation_prompt=false] Whether to end the prompt with the token(s) that indicate
   * the start of an assistant message. This is useful when you want to generate a response from the model.
   * Note that this argument will be passed to the chat template, and so it must be supported in the
   * template for this argument to have any effect.
   * @param {boolean} [options.tokenize=true] Whether to tokenize the output. If false, the output will be a string.
   * @param {boolean} [options.padding=false] Whether to pad sequences to the maximum length. Has no effect if tokenize is false.
   * @param {boolean} [options.truncation=false] Whether to truncate sequences to the maximum length. Has no effect if tokenize is false.
   * @param {number} [options.max_length=null] Maximum length (in tokens) to use for padding or truncation. Has no effect if tokenize is false.
   * If not specified, the tokenizer's `max_length` attribute will be used as a default.
   * @param {boolean} [options.return_tensor=true] Whether to return the output as a Tensor or an Array. Has no effect if tokenize is false.
   * @returns {string | Tensor | number[]| number[][]} The tokenized output.
   */
  apply_chat_template(
    conversation: {
      /**
       * The role of the message (e.g., "user" or "assistant" or "system").
       */
      role: string;
      /**
       * The content of the message.
       */
      content: string;
    }[],
    {
      chat_template,
      add_generation_prompt,
      tokenize,
      padding,
      truncation,
      max_length,
      return_tensor,
    }?: {
      chat_template?: string;
      add_generation_prompt?: boolean;
      tokenize?: boolean;
      padding?: boolean;
      truncation?: boolean;
      max_length?: number;
      return_tensor?: boolean;
    },
  ): string | Tensor | number[] | number[][];
}
/**
 * BertTokenizer is a class used to tokenize text for BERT models.
 * @extends PreTrainedTokenizer
 */
export class BertTokenizer extends PreTrainedTokenizer {}
/**
 * Albert tokenizer
 * @extends PreTrainedTokenizer
 */
export class AlbertTokenizer extends PreTrainedTokenizer {}
export class MobileBertTokenizer extends PreTrainedTokenizer {}
export class SqueezeBertTokenizer extends PreTrainedTokenizer {}
export class DebertaTokenizer extends PreTrainedTokenizer {}
export class DebertaV2Tokenizer extends PreTrainedTokenizer {}
export class HerbertTokenizer extends PreTrainedTokenizer {}
export class ConvBertTokenizer extends PreTrainedTokenizer {}
export class RoFormerTokenizer extends PreTrainedTokenizer {}
export class DistilBertTokenizer extends PreTrainedTokenizer {}
export class CamembertTokenizer extends PreTrainedTokenizer {}
export class XLMTokenizer extends PreTrainedTokenizer {
  constructor(tokenizerJSON: any, tokenizerConfig: any);
}
export class ElectraTokenizer extends PreTrainedTokenizer {}
export class T5Tokenizer extends PreTrainedTokenizer {}
export class GPT2Tokenizer extends PreTrainedTokenizer {}
export class BartTokenizer extends PreTrainedTokenizer {}
export class MBartTokenizer extends PreTrainedTokenizer {
  constructor(tokenizerJSON: any, tokenizerConfig: any);
  languageRegex: RegExp;
  language_codes: any[];
  lang_to_token: (x: any) => any;
  /**
   * Helper function to build translation inputs for an `MBartTokenizer`.
   * @param {string|string[]} raw_inputs The text to tokenize.
   * @param {Object} tokenizer_options Options to be sent to the tokenizer
   * @param {Object} generate_kwargs Generation options.
   * @returns {Object} Object to be passed to the model.
   */
  _build_translation_inputs(
    raw_inputs: string | string[],
    tokenizer_options: any,
    generate_kwargs: any,
  ): any;
}
export class MBart50Tokenizer extends MBartTokenizer {}
export class RobertaTokenizer extends PreTrainedTokenizer {}
export class BloomTokenizer extends GPT2Tokenizer {
  constructor(tokenizerJSON: any, tokenizerConfig: any);
}
export class LlamaTokenizer extends PreTrainedTokenizer {
  constructor(tokenizerJSON: any, tokenizerConfig: any);
  DEFAULT_SYSTEM_PROMPT: string;
  use_default_system_prompt: any;
  legacy: any;
  get default_chat_template(): any;
}
export class CodeLlamaTokenizer extends LlamaTokenizer {}
export class XLMRobertaTokenizer extends PreTrainedTokenizer {}
export class MPNetTokenizer extends PreTrainedTokenizer {}
export class FalconTokenizer extends PreTrainedTokenizer {}
export class GPTNeoXTokenizer extends PreTrainedTokenizer {}
export class EsmTokenizer extends PreTrainedTokenizer {}
/**
 * The NllbTokenizer class is used to tokenize text for NLLB ("No Language Left Behind") models.
 *
 * No Language Left Behind (NLLB) is a first-of-its-kind, AI breakthrough project
 * that open-sources models capable of delivering high-quality translations directly
 * between any pair of 200+ languages — including low-resource languages like Asturian,
 * Luganda, Urdu and more. It aims to help people communicate with anyone, anywhere,
 * regardless of their language preferences. For more information, check out their
 * [paper](https://arxiv.org/abs/2207.04672).
 *
 * For a list of supported languages (along with their language codes),
 * @see {@link https://github.com/facebookresearch/flores/blob/main/flores200/README.md#languages-in-flores-200}
 */
export class NllbTokenizer extends PreTrainedTokenizer {
  constructor(tokenizerJSON: any, tokenizerConfig: any);
  languageRegex: RegExp;
  language_codes: any[];
  lang_to_token: (x: any) => any;
  /**
   * Helper function to build translation inputs for an `NllbTokenizer`.
   * @param {string|string[]} raw_inputs The text to tokenize.
   * @param {Object} tokenizer_options Options to be sent to the tokenizer
   * @param {Object} generate_kwargs Generation options.
   * @returns {Object} Object to be passed to the model.
   */
  _build_translation_inputs(
    raw_inputs: string | string[],
    tokenizer_options: any,
    generate_kwargs: any,
  ): any;
}
/**
 * The M2M100Tokenizer class is used to tokenize text for M2M100 ("Many-to-Many") models.
 *
 * M2M100 is a multilingual encoder-decoder (seq-to-seq) model trained for Many-to-Many
 * multilingual translation. It was introduced in this [paper](https://arxiv.org/abs/2010.11125)
 * and first released in [this](https://github.com/pytorch/fairseq/tree/master/examples/m2m_100) repository.
 *
 * For a list of supported languages (along with their language codes),
 * @see {@link https://huggingface.co/facebook/m2m100_418M#languages-covered}
 */
export class M2M100Tokenizer extends PreTrainedTokenizer {
  constructor(tokenizerJSON: any, tokenizerConfig: any);
  languageRegex: RegExp;
  language_codes: any[];
  lang_to_token: (x: any) => string;
  /**
   * Helper function to build translation inputs for an `M2M100Tokenizer`.
   * @param {string|string[]} raw_inputs The text to tokenize.
   * @param {Object} tokenizer_options Options to be sent to the tokenizer
   * @param {Object} generate_kwargs Generation options.
   * @returns {Object} Object to be passed to the model.
   */
  _build_translation_inputs(
    raw_inputs: string | string[],
    tokenizer_options: any,
    generate_kwargs: any,
  ): any;
}
/**
 * WhisperTokenizer tokenizer
 * @extends PreTrainedTokenizer
 */
export class WhisperTokenizer extends PreTrainedTokenizer {
  /**
   * Decodes automatic speech recognition (ASR) sequences.
   * @param {Array<{tokens: number[], token_timestamps?: number[], stride: number[]}>} sequences The sequences to decode.
   * @param {Object} options The options to use for decoding.
   * @returns {Array<string|{chunks?: undefined|Array<{language: string|null, timestamp: Array<number|null>, text: string}>}>} The decoded sequences.
   */
  _decode_asr(
    sequences: Array<{
      tokens: number[];
      token_timestamps?: number[];
      stride: number[];
    }>,
    {
      return_timestamps,
      return_language,
      time_precision,
      force_full_sequences,
    }?: any,
  ): (
    | string
    | {
        chunks?:
          | undefined
          | Array<{
              language: string | null;
              timestamp: Array<number | null>;
              text: string;
            }>;
      }
  )[];
  /**
   * Finds the longest common sequence among the provided sequences.
   * @param {number[][]} sequences An array of sequences of token ids to compare.
   * @returns {number[][]} The longest common sequence found.
   * @throws {Error} If there is a bug within the function.
   * @private
   */
  private findLongestCommonSequence;
  /** @private */
  private collateWordTimestamps;
  /**
   * Groups tokens by word. Returns a tuple containing a list of strings with the words,
   * and a list of `token_id` sequences with the tokens making up each word.
   * @param {number[]} tokens
   * @param {string} [language]
   * @param {string} prepend_punctionations
   * @param {string} append_punctuations
   *
   * @private
   */
  private combineTokensIntoWords;
  /**
   * @param {number[]} token_ids List of token IDs to decode.
   * @param {Object} decode_args Optional arguments for decoding
   * @private
   */
  private decodeWithTimestamps;
  /**
   * Combine tokens into words by splitting at any position where the tokens are decoded as valid unicode points.
   * @param {number[]} tokens
   * @returns {*}
   * @private
   */
  private splitTokensOnUnicode;
  /**
   * Combine tokens into words by splitting at whitespace and punctuation tokens.
   * @param {number[]} tokens
   * @private
   */
  private splitTokensOnSpaces;
  /**
   * Merges punctuation tokens with neighboring words.
   * @param {string[]} words
   * @param {number[][]} tokens
   * @param {number[][]} indices
   * @param {string} prepended
   * @param {string} appended
   * @private
   */
  private mergePunctuations;
  /**
   * Helper function to build translation inputs for a `WhisperTokenizer`,
   * depending on the language, task, and whether to predict timestamp tokens.
   *
   * Used to override the prefix tokens appended to the start of the label sequence.
   *
   * **Example: Get ids for a language**
   * ```javascript
   * // instantiate the tokenizer and set the prefix token to Spanish
   * const tokenizer = await WhisperTokenizer.from_pretrained('Xenova/whisper-tiny');
   * const forced_decoder_ids = tokenizer.get_decoder_prompt_ids({ language: 'spanish' });
   * // [(1, 50262), (2, 50363)]
   * ```
   *
   * @param {Object} options Options to generate the decoder prompt.
   * @param {string} [options.language] The language of the transcription text.
   * The corresponding language id token is appended to the start of the sequence for multilingual
   * speech recognition and speech translation tasks, e.g. for "Spanish" the token "<|es|>" is appended
   * to the start of sequence.
   * @param {string} [options.task] Task identifier to append at the start of sequence (if any).
   * This should be used for mulitlingual fine-tuning, with "transcribe" for speech recognition and
   * "translate" for speech translation.
   * @param {boolean} [options.no_timestamps] Whether to add the <|notimestamps|> token at the start of the sequence.
   * @returns {number[][]} The decoder prompt ids.
   */
  get_decoder_prompt_ids({
    language,
    task,
    no_timestamps,
  }?: {
    language?: string;
    task?: string;
    no_timestamps?: boolean;
  }): number[][];
}
export class CodeGenTokenizer extends PreTrainedTokenizer {}
export class CLIPTokenizer extends PreTrainedTokenizer {}
export class SiglipTokenizer extends PreTrainedTokenizer {}
/**
 * @todo This model is not yet supported by Hugging Face's "fast" tokenizers library (https://github.com/huggingface/tokenizers).
 * Therefore, this implementation (which is based on fast tokenizers) may produce slightly inaccurate results.
 */
export class MarianTokenizer extends PreTrainedTokenizer {
  languageRegex: RegExp;
  supported_language_codes: string[];
  /**
   * Encodes a single text. Overriding this method is necessary since the language codes
   * must be removed before encoding with sentencepiece model.
   * @see https://github.com/huggingface/transformers/blob/12d51db243a00726a548a43cc333390ebae731e3/src/transformers/models/marian/tokenization_marian.py#L204-L213
   *
   * @param {string|null} text The text to encode.
   * @returns {Array} The encoded tokens.
   */
  _encode_text(text: string | null): any[];
}
export class Wav2Vec2CTCTokenizer extends PreTrainedTokenizer {}
export class BlenderbotTokenizer extends PreTrainedTokenizer {}
export class BlenderbotSmallTokenizer extends BlenderbotTokenizer {}
export class SpeechT5Tokenizer extends PreTrainedTokenizer {}
export class NougatTokenizer extends PreTrainedTokenizer {}
export class VitsTokenizer extends PreTrainedTokenizer {
  constructor(tokenizerJSON: any, tokenizerConfig: any);
}
/**
 * Helper class which is used to instantiate pretrained tokenizers with the `from_pretrained` function.
 * The chosen tokenizer class is determined by the type specified in the tokenizer config.
 *
 * @example
 * const tokenizer = await AutoTokenizer.from_pretrained('Xenova/bert-base-uncased');
 */
export class AutoTokenizer {
  static TOKENIZER_CLASS_MAPPING: {
    T5Tokenizer: typeof T5Tokenizer;
    DistilBertTokenizer: typeof DistilBertTokenizer;
    CamembertTokenizer: typeof CamembertTokenizer;
    DebertaTokenizer: typeof DebertaTokenizer;
    DebertaV2Tokenizer: typeof DebertaV2Tokenizer;
    BertTokenizer: typeof BertTokenizer;
    HerbertTokenizer: typeof HerbertTokenizer;
    ConvBertTokenizer: typeof ConvBertTokenizer;
    RoFormerTokenizer: typeof RoFormerTokenizer;
    XLMTokenizer: typeof XLMTokenizer;
    ElectraTokenizer: typeof ElectraTokenizer;
    MobileBertTokenizer: typeof MobileBertTokenizer;
    SqueezeBertTokenizer: typeof SqueezeBertTokenizer;
    AlbertTokenizer: typeof AlbertTokenizer;
    GPT2Tokenizer: typeof GPT2Tokenizer;
    BartTokenizer: typeof BartTokenizer;
    MBartTokenizer: typeof MBartTokenizer;
    MBart50Tokenizer: typeof MBart50Tokenizer;
    RobertaTokenizer: typeof RobertaTokenizer;
    WhisperTokenizer: typeof WhisperTokenizer;
    CodeGenTokenizer: typeof CodeGenTokenizer;
    CLIPTokenizer: typeof CLIPTokenizer;
    SiglipTokenizer: typeof SiglipTokenizer;
    MarianTokenizer: typeof MarianTokenizer;
    BloomTokenizer: typeof BloomTokenizer;
    NllbTokenizer: typeof NllbTokenizer;
    M2M100Tokenizer: typeof M2M100Tokenizer;
    LlamaTokenizer: typeof LlamaTokenizer;
    CodeLlamaTokenizer: typeof CodeLlamaTokenizer;
    XLMRobertaTokenizer: typeof XLMRobertaTokenizer;
    MPNetTokenizer: typeof MPNetTokenizer;
    FalconTokenizer: typeof FalconTokenizer;
    GPTNeoXTokenizer: typeof GPTNeoXTokenizer;
    EsmTokenizer: typeof EsmTokenizer;
    Wav2Vec2CTCTokenizer: typeof Wav2Vec2CTCTokenizer;
    BlenderbotTokenizer: typeof BlenderbotTokenizer;
    BlenderbotSmallTokenizer: typeof BlenderbotSmallTokenizer;
    SpeechT5Tokenizer: typeof SpeechT5Tokenizer;
    NougatTokenizer: typeof NougatTokenizer;
    VitsTokenizer: typeof VitsTokenizer;
    PreTrainedTokenizer: typeof PreTrainedTokenizer;
  };
  /**
   * Instantiate one of the tokenizer classes of the library from a pretrained model.
   *
   * The tokenizer class to instantiate is selected based on the `tokenizer_class` property of the config object
   * (either passed as an argument or loaded from `pretrained_model_name_or_path` if possible)
   *
   * @param {string} pretrained_model_name_or_path The name or path of the pretrained model. Can be either:
   * - A string, the *model id* of a pretrained tokenizer hosted inside a model repo on huggingface.co.
   *   Valid model ids can be located at the root-level, like `bert-base-uncased`, or namespaced under a
   *   user or organization name, like `dbmdz/bert-base-german-cased`.
   * - A path to a *directory* containing tokenizer files, e.g., `./my_model_directory/`.
   * @param {PretrainedTokenizerOptions} options Additional options for loading the tokenizer.
   *
   * @returns {Promise<PreTrainedTokenizer>} A new instance of the PreTrainedTokenizer class.
   */
  static from_pretrained(
    pretrained_model_name_or_path: string,
    {
      quantized,
      progress_callback,
      config,
      cache_dir,
      local_files_only,
      revision,
      legacy,
    }?: PretrainedTokenizerOptions,
  ): Promise<PreTrainedTokenizer>;
}
/**
 * Additional tokenizer-specific properties.
 */
export type TokenizerProperties = {
  /**
   * Whether or not the `legacy` behavior of the tokenizer should be used.
   */
  legacy?: boolean;
};
export type PretrainedTokenizerOptions =
  import("./utils/hub.js").PretrainedOptions & TokenizerProperties;
export type BPENode = {
  /**
   * The token associated with the node
   */
  token: string;
  /**
   * A positional bias for the node.
   */
  bias: number;
  /**
   * The score of the node.
   */
  score?: number;
  /**
   * The previous node in the linked list.
   */
  prev?: BPENode;
  /**
   * The next node in the linked list.
   */
  next?: BPENode;
};
export type SplitDelimiterBehavior =
  | "removed"
  | "isolated"
  | "mergedWithPrevious"
  | "mergedWithNext"
  | "contiguous";
export type PostProcessedOutput = {
  /**
   * List of token produced by the post-processor.
   */
  tokens: string[];
  /**
   * List of token type ids produced by the post-processor.
   */
  token_type_ids?: number[];
};
export type EncodingSingle = {
  /**
   * List of token ids to be fed to a model.
   */
  input_ids: number[];
  /**
   * List of token type ids to be fed to a model
   */
  attention_mask: number[];
  /**
   * List of indices specifying which tokens should be attended to by the model
   */
  token_type_ids?: number[];
};
declare const Normalizer_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
/**
 * A base class for text normalization.
 * @abstract
 */
declare class Normalizer extends Normalizer_base {
  /**
   * Factory method for creating normalizers from config objects.
   * @static
   * @param {Object} config The configuration object for the normalizer.
   * @returns {Normalizer} A Normalizer object.
   * @throws {Error} If an unknown Normalizer type is specified in the config.
   */
  static fromConfig(config: any): Normalizer;
  /**
   * @param {Object} config The configuration object for the normalizer.
   */
  constructor(config: any);
  config: any;
  /**
   * Normalize the input text.
   * @abstract
   * @param {string} text The text to normalize.
   * @returns {string} The normalized text.
   * @throws {Error} If this method is not implemented in a subclass.
   */
  normalize(text: string): string;
  /**
   * Alias for {@link Normalizer#normalize}.
   * @param {string} text The text to normalize.
   * @returns {string} The normalized text.
   */
  _call(text: string): string;
}
declare const PreTokenizer_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
/**
 * A callable class representing a pre-tokenizer used in tokenization. Subclasses
 * should implement the `pre_tokenize_text` method to define the specific pre-tokenization logic.
 * @extends Callable
 */
declare class PreTokenizer extends PreTokenizer_base {
  /**
   * Factory method that returns an instance of a subclass of `PreTokenizer` based on the provided configuration.
   *
   * @static
   * @param {Object} config A configuration object for the pre-tokenizer.
   * @returns {PreTokenizer} An instance of a subclass of `PreTokenizer`.
   * @throws {Error} If the provided configuration object does not correspond to any known pre-tokenizer.
   */
  static fromConfig(config: any): PreTokenizer;
  /**
   * Method that should be implemented by subclasses to define the specific pre-tokenization logic.
   *
   * @abstract
   * @param {string} text The text to pre-tokenize.
   * @param {Object} [options] Additional options for the pre-tokenization logic.
   * @returns {string[]} The pre-tokenized text.
   * @throws {Error} If the method is not implemented in the subclass.
   */
  pre_tokenize_text(text: string, options?: any): string[];
  /**
   * Tokenizes the given text into pre-tokens.
   * @param {string|string[]} text The text or array of texts to pre-tokenize.
   * @param {Object} [options] Additional options for the pre-tokenization logic.
   * @returns {string[]} An array of pre-tokens.
   */
  pre_tokenize(text: string | string[], options?: any): string[];
  /**
   * Alias for {@link PreTokenizer#pre_tokenize}.
   * @param {string|string[]} text The text or array of texts to pre-tokenize.
   * @param {Object} [options] Additional options for the pre-tokenization logic.
   * @returns {string[]} An array of pre-tokens.
   */
  _call(text: string | string[], options?: any): string[];
}
declare const PostProcessor_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
/**
 * @typedef {Object} PostProcessedOutput
 * @property {string[]} tokens List of token produced by the post-processor.
 * @property {number[]} [token_type_ids] List of token type ids produced by the post-processor.
 */
/**
 * @typedef {Object} EncodingSingle
 * @property {number[]} input_ids List of token ids to be fed to a model.
 * @property {number[]} attention_mask List of token type ids to be fed to a model
 * @property {number[]} [token_type_ids] List of indices specifying which tokens should be attended to by the model
 */
/**
 * @extends Callable
 */
declare class PostProcessor extends PostProcessor_base {
  /**
   * Factory method to create a PostProcessor object from a configuration object.
   *
   * @param {Object} config Configuration object representing a PostProcessor.
   * @returns {PostProcessor} A PostProcessor object created from the given configuration.
   * @throws {Error} If an unknown PostProcessor type is encountered.
   */
  static fromConfig(config: any): PostProcessor;
  /**
   * @param {Object} config The configuration for the post-processor.
   */
  constructor(config: any);
  config: any;
  /**
   * Method to be implemented in subclass to apply post-processing on the given tokens.
   *
   * @param {Array} tokens The input tokens to be post-processed.
   * @param {...*} args Additional arguments required by the post-processing logic.
   * @returns {PostProcessedOutput} The post-processed tokens.
   * @throws {Error} If the method is not implemented in subclass.
   */
  post_process(tokens: any[], ...args: any[]): PostProcessedOutput;
  /**
   * Alias for {@link PostProcessor#post_process}.
   * @param {Array} tokens The text or array of texts to post-process.
   * @param {...*} args Additional arguments required by the post-processing logic.
   * @returns {PostProcessedOutput} The post-processed tokens.
   */
  _call(tokens: any[], ...args: any[]): PostProcessedOutput;
}
declare const Decoder_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
/**
 * The base class for token decoders.
 * @extends Callable
 */
declare class Decoder extends Decoder_base {
  /**
   * Creates a decoder instance based on the provided configuration.
   *
   * @param {Object} config The configuration object.
   * @returns {Decoder} A decoder instance.
   * @throws {Error} If an unknown decoder type is provided.
   */
  static fromConfig(config: any): Decoder;
  /**
   * Creates an instance of `Decoder`.
   *
   * @param {Object} config The configuration object.
   */
  constructor(config: any);
  config: any;
  /** @type {AddedToken[]} */
  added_tokens: AddedToken[];
  end_of_word_suffix: any;
  trim_offsets: any;
  /**
   * Calls the `decode` method.
   *
   * @param {string[]} tokens The list of tokens.
   * @returns {string} The decoded string.
   */
  _call(tokens: string[]): string;
  /**
   * Decodes a list of tokens.
   * @param {string[]} tokens The list of tokens.
   * @returns {string} The decoded string.
   */
  decode(tokens: string[]): string;
  /**
   * Apply the decoder to a list of tokens.
   *
   * @param {string[]} tokens The list of tokens.
   * @returns {string[]} The decoded list of tokens.
   * @throws {Error} If the `decode_chain` method is not implemented in the subclass.
   */
  decode_chain(tokens: string[]): string[];
}
/**
 * Represent a token added by the user on top of the existing Model vocabulary.
 * AddedToken can be configured to specify the behavior they should have in various situations like:
 *   - Whether they should only match single words
 *   - Whether to include any whitespace on its left or right
 */
declare class AddedToken {
  /**
   * Creates a new instance of AddedToken.
   * @param {Object} config Added token configuration object.
   * @param {string} config.content The content of the added token.
   * @param {number} config.id The id of the added token.
   * @param {boolean} [config.single_word=false] Whether this token must be a single word or can break words.
   * @param {boolean} [config.lstrip=false] Whether this token should strip whitespaces on its left.
   * @param {boolean} [config.rstrip=false] Whether this token should strip whitespaces on its right.
   * @param {boolean} [config.normalized=false] Whether this token should be normalized.
   * @param {boolean} [config.special=false] Whether this token is special.
   */
  constructor(config: {
    content: string;
    id: number;
    single_word?: boolean;
    lstrip?: boolean;
    rstrip?: boolean;
    normalized?: boolean;
    special?: boolean;
  });
  content: string;
  id: number;
  single_word: boolean;
  lstrip: boolean;
  rstrip: boolean;
  special: boolean;
  normalized: boolean;
}
import { Tensor } from "./utils/tensor.js";
export {};
//# sourceMappingURL=tokenizers.d.ts.map
