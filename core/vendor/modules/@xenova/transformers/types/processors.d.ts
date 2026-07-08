declare const FeatureExtractor_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
/**
 * Base class for feature extractors.
 *
 * @extends Callable
 */
export class FeatureExtractor extends FeatureExtractor_base {
  /**
   * Constructs a new FeatureExtractor instance.
   *
   * @param {Object} config The configuration for the feature extractor.
   */
  constructor(config: any);
  config: any;
}
/**
 * @typedef {object} ImageFeatureExtractorResult
 * @property {Tensor} pixel_values The pixel values of the batched preprocessed images.
 * @property {HeightWidth[]} original_sizes Array of two-dimensional tuples like [[480, 640]].
 * @property {HeightWidth[]} reshaped_input_sizes Array of two-dimensional tuples like [[1000, 1330]].
 */
/**
 * Feature extractor for image models.
 *
 * @extends FeatureExtractor
 */
export class ImageFeatureExtractor extends FeatureExtractor {
  /**
   * Constructs a new ImageFeatureExtractor instance.
   *
   * @param {Object} config The configuration for the feature extractor.
   * @param {number[]} config.image_mean The mean values for image normalization.
   * @param {number[]} config.image_std The standard deviation values for image normalization.
   * @param {boolean} config.do_rescale Whether to rescale the image pixel values to the [0,1] range.
   * @param {number} config.rescale_factor The factor to use for rescaling the image pixel values.
   * @param {boolean} config.do_normalize Whether to normalize the image pixel values.
   * @param {boolean} config.do_resize Whether to resize the image.
   * @param {number} config.resample What method to use for resampling.
   * @param {number} config.size The size to resize the image to.
   */
  constructor(config: {
    image_mean: number[];
    image_std: number[];
    do_rescale: boolean;
    rescale_factor: number;
    do_normalize: boolean;
    do_resize: boolean;
    resample: number;
    size: number;
  });
  image_mean: any;
  image_std: any;
  resample: any;
  do_rescale: any;
  rescale_factor: any;
  do_normalize: any;
  do_resize: any;
  do_thumbnail: any;
  size: any;
  size_divisibility: any;
  do_center_crop: any;
  crop_size: any;
  do_convert_rgb: any;
  do_crop_margin: any;
  pad_size: any;
  do_pad: any;
  /**
   * Resize the image to make a thumbnail. The image is resized so that no dimension is larger than any
   * corresponding dimension of the specified size.
   * @param {RawImage} image The image to be resized.
   * @param {{height:number, width:number}} size The size `{"height": h, "width": w}` to resize the image to.
   * @param {string | 0 | 1 | 2 | 3 | 4 | 5} [resample=2] The resampling filter to use.
   * @returns {Promise<RawImage>} The resized image.
   */
  thumbnail(
    image: RawImage,
    size: {
      height: number;
      width: number;
    },
    resample?: string | 0 | 1 | 2 | 3 | 4 | 5,
  ): Promise<RawImage>;
  /**
   * Crops the margin of the image. Gray pixels are considered margin (i.e., pixels with a value below the threshold).
   * @param {RawImage} image The image to be cropped.
   * @param {number} gray_threshold Value below which pixels are considered to be gray.
   * @returns {Promise<RawImage>} The cropped image.
   */
  crop_margin(image: RawImage, gray_threshold?: number): Promise<RawImage>;
  /**
   * Pad the image by a certain amount.
   * @param {Float32Array} pixelData The pixel data to pad.
   * @param {number[]} imgDims The dimensions of the image.
   * @param {{width:number; height:number}|number} padSize The dimensions of the padded image.
   * @param {Object} options The options for padding.
   * @param {'constant'|'symmetric'} [options.mode='constant'] The type of padding to add.
   * @param {boolean} [options.center=false] Whether to center the image.
   * @param {number} [options.constant_values=0] The constant value to use for padding.
   * @returns {[Float32Array, number[]]} The padded pixel data and image dimensions.
   */
  pad_image(
    pixelData: Float32Array,
    imgDims: number[],
    padSize:
      | {
          width: number;
          height: number;
        }
      | number,
    {
      mode,
      center,
      constant_values,
    }?: {
      mode?: "constant" | "symmetric";
      center?: boolean;
      constant_values?: number;
    },
  ): [Float32Array, number[]];
  /**
   * Rescale the image' pixel values by `this.rescale_factor`.
   * @param {Float32Array} pixelData The pixel data to rescale.
   * @returns {void}
   */
  rescale(pixelData: Float32Array): void;
  /**
   * Find the target (width, height) dimension of the output image after
   * resizing given the input image and the desired size.
   * @param {RawImage} image The image to resize.
   * @param {any} size The size to use for resizing the image.
   * @returns {[number, number]} The target (width, height) dimension of the output image after resizing.
   */
  get_resize_output_image_size(image: RawImage, size: any): [number, number];
  /**
   * Resizes the image.
   * @param {RawImage} image The image to resize.
   * @returns {Promise<RawImage>} The resized image.
   */
  resize(image: RawImage): Promise<RawImage>;
  /**
   * @typedef {object} PreprocessedImage
   * @property {HeightWidth} original_size The original size of the image.
   * @property {HeightWidth} reshaped_input_size The reshaped input size of the image.
   * @property {Tensor} pixel_values The pixel values of the preprocessed image.
   */
  /**
   * Preprocesses the given image.
   *
   * @param {RawImage} image The image to preprocess.
   * @param {Object} overrides The overrides for the preprocessing options.
   * @returns {Promise<PreprocessedImage>} The preprocessed image.
   */
  preprocess(
    image: RawImage,
    { do_normalize, do_pad, do_convert_rgb, do_convert_grayscale }?: any,
  ): Promise<{
    /**
     * The original size of the image.
     */
    original_size: HeightWidth;
    /**
     * The reshaped input size of the image.
     */
    reshaped_input_size: HeightWidth;
    /**
     * The pixel values of the preprocessed image.
     */
    pixel_values: Tensor;
  }>;
  /**
   * Calls the feature extraction process on an array of images,
   * preprocesses each image, and concatenates the resulting
   * features into a single Tensor.
   * @param {RawImage[]} images The image(s) to extract features from.
   * @param {...any} args Additional arguments.
   * @returns {Promise<ImageFeatureExtractorResult>} An object containing the concatenated pixel values (and other metadata) of the preprocessed images.
   */
  _call(
    images: RawImage[],
    ...args: any[]
  ): Promise<ImageFeatureExtractorResult>;
}
export class SegformerFeatureExtractor extends ImageFeatureExtractor {
  /**
   * Converts the output of `SegformerForSemanticSegmentation` into semantic segmentation maps.
   * @param {*} outputs Raw outputs of the model.
   * @param {number[][]} [target_sizes=null] List of tuples corresponding to the requested final size
   * (height, width) of each prediction. If unset, predictions will not be resized.
   * @returns {{segmentation: Tensor; labels: number[]}[]} The semantic segmentation maps.
   */
  post_process_semantic_segmentation(
    outputs: any,
    target_sizes?: number[][],
  ): {
    segmentation: Tensor;
    labels: number[];
  }[];
}
export class BitImageProcessor extends ImageFeatureExtractor {}
export class DPTFeatureExtractor extends ImageFeatureExtractor {}
export class GLPNFeatureExtractor extends ImageFeatureExtractor {}
export class CLIPFeatureExtractor extends ImageFeatureExtractor {}
export class ChineseCLIPFeatureExtractor extends ImageFeatureExtractor {}
export class SiglipImageProcessor extends ImageFeatureExtractor {}
export class ConvNextFeatureExtractor extends ImageFeatureExtractor {
  constructor(config: any);
  /**
   * Percentage of the image to crop. Only has an effect if this.size < 384.
   */
  crop_pct: any;
  resize(image: any): Promise<any>;
}
export class ConvNextImageProcessor extends ConvNextFeatureExtractor {}
export class ViTFeatureExtractor extends ImageFeatureExtractor {}
export class ViTImageProcessor extends ImageFeatureExtractor {}
export class MobileViTFeatureExtractor extends ImageFeatureExtractor {}
export class OwlViTFeatureExtractor extends ImageFeatureExtractor {
  /**
   * Post-processes the outputs of the model (for object detection).
   * @param {Object} outputs The outputs of the model that must be post-processed
   * @param {Tensor} outputs.logits The logits
   * @param {Tensor} outputs.pred_boxes The predicted boxes.
   * @param {number} [threshold=0.5] The threshold to use for the scores.
   * @param {number[][]} [target_sizes=null] The sizes of the original images.
   * @param {boolean} [is_zero_shot=false] Whether zero-shot object detection was performed.
   * @return {Object[]} An array of objects containing the post-processed outputs.
   * @private
   */
  post_process_object_detection(
    outputs: {
      logits: Tensor;
      pred_boxes: Tensor;
    },
    threshold?: number,
    target_sizes?: number[][],
    is_zero_shot?: boolean,
  ): any[];
}
export class DeiTFeatureExtractor extends ImageFeatureExtractor {}
export class BeitFeatureExtractor extends ImageFeatureExtractor {}
export class DonutFeatureExtractor extends ImageFeatureExtractor {
  pad_image(
    pixelData: any,
    imgDims: any,
    padSize: any,
    options?: {},
  ): [Float32Array, number[]];
}
export class NougatImageProcessor extends DonutFeatureExtractor {}
/**
 * @typedef {object} DetrFeatureExtractorResultProps
 * @property {Tensor} pixel_mask
 * @typedef {ImageFeatureExtractorResult & DetrFeatureExtractorResultProps} DetrFeatureExtractorResult
 */
/**
 * Detr Feature Extractor.
 *
 * @extends ImageFeatureExtractor
 */
export class DetrFeatureExtractor extends ImageFeatureExtractor {
  /**
   * Calls the feature extraction process on an array of images, preprocesses
   * each image, and concatenates the resulting features into a single Tensor.
   * @param {RawImage[]} images The image(s) to extract features from.
   * @returns {Promise<DetrFeatureExtractorResult>} An object containing the concatenated pixel values of the preprocessed images.
   */
  _call(images: RawImage[]): Promise<DetrFeatureExtractorResult>;
  /**
   * Post-processes the outputs of the model (for object detection).
   * @param {Object} outputs The outputs of the model that must be post-processed
   * @param {Tensor} outputs.logits The logits
   * @param {Tensor} outputs.pred_boxes The predicted boxes.
   * @param {number} [threshold=0.5] The threshold to use for the scores.
   * @param {number[][]} [target_sizes=null] The sizes of the original images.
   * @param {boolean} [is_zero_shot=false] Whether zero-shot object detection was performed.
   * @return {Object[]} An array of objects containing the post-processed outputs.
   * @private
   */
  post_process_object_detection(
    outputs: {
      logits: Tensor;
      pred_boxes: Tensor;
    },
    threshold?: number,
    target_sizes?: number[][],
    is_zero_shot?: boolean,
  ): any[];
  /**
   * Binarize the given masks using `object_mask_threshold`, it returns the associated values of `masks`, `scores` and `labels`.
   * @param {Tensor} class_logits The class logits.
   * @param {Tensor} mask_logits The mask logits.
   * @param {number} object_mask_threshold A number between 0 and 1 used to binarize the masks.
   * @param {number} num_labels The number of labels.
   * @returns {[Tensor[], number[], number[]]} The binarized masks, the scores, and the labels.
   */
  remove_low_and_no_objects(
    class_logits: Tensor,
    mask_logits: Tensor,
    object_mask_threshold: number,
    num_labels: number,
  ): [Tensor[], number[], number[]];
  /**
   * Checks whether the segment is valid or not.
   * @param {Int32Array} mask_labels Labels for each pixel in the mask.
   * @param {Tensor[]} mask_probs Probabilities for each pixel in the masks.
   * @param {number} k The class id of the segment.
   * @param {number} mask_threshold The mask threshold.
   * @param {number} overlap_mask_area_threshold The overlap mask area threshold.
   * @returns {[boolean, number[]]} Whether the segment is valid or not, and the indices of the valid labels.
   */
  check_segment_validity(
    mask_labels: Int32Array,
    mask_probs: Tensor[],
    k: number,
    mask_threshold?: number,
    overlap_mask_area_threshold?: number,
  ): [boolean, number[]];
  /**
   * Computes the segments.
   * @param {Tensor[]} mask_probs The mask probabilities.
   * @param {number[]} pred_scores The predicted scores.
   * @param {number[]} pred_labels The predicted labels.
   * @param {number} mask_threshold The mask threshold.
   * @param {number} overlap_mask_area_threshold The overlap mask area threshold.
   * @param {Set<number>} label_ids_to_fuse The label ids to fuse.
   * @param {number[]} target_size The target size of the image.
   * @returns {[Tensor, Array<{id: number, label_id: number, score: number}>]} The computed segments.
   */
  compute_segments(
    mask_probs: Tensor[],
    pred_scores: number[],
    pred_labels: number[],
    mask_threshold: number,
    overlap_mask_area_threshold: number,
    label_ids_to_fuse?: Set<number>,
    target_size?: number[],
  ): [
    Tensor,
    Array<{
      id: number;
      label_id: number;
      score: number;
    }>,
  ];
  /**
   * Post-process the model output to generate the final panoptic segmentation.
   * @param {*} outputs The model output to post process
   * @param {number} [threshold=0.5] The probability score threshold to keep predicted instance masks.
   * @param {number} [mask_threshold=0.5] Threshold to use when turning the predicted masks into binary values.
   * @param {number} [overlap_mask_area_threshold=0.8] The overlap mask area threshold to merge or discard small disconnected parts within each binary instance mask.
   * @param {Set<number>} [label_ids_to_fuse=null] The labels in this state will have all their instances be fused together.
   * @param {number[][]} [target_sizes=null] The target sizes to resize the masks to.
   * @returns {Array<{ segmentation: Tensor, segments_info: Array<{id: number, label_id: number, score: number}>}>}
   */
  post_process_panoptic_segmentation(
    outputs: any,
    threshold?: number,
    mask_threshold?: number,
    overlap_mask_area_threshold?: number,
    label_ids_to_fuse?: Set<number>,
    target_sizes?: number[][],
  ): Array<{
    segmentation: Tensor;
    segments_info: Array<{
      id: number;
      label_id: number;
      score: number;
    }>;
  }>;
  post_process_instance_segmentation(): void;
}
export class YolosFeatureExtractor extends ImageFeatureExtractor {
  /**
   * Post-processes the outputs of the model (for object detection).
   * @param {Object} outputs The outputs of the model that must be post-processed
   * @param {Tensor} outputs.logits The logits
   * @param {Tensor} outputs.pred_boxes The predicted boxes.
   * @param {number} [threshold=0.5] The threshold to use for the scores.
   * @param {number[][]} [target_sizes=null] The sizes of the original images.
   * @param {boolean} [is_zero_shot=false] Whether zero-shot object detection was performed.
   * @return {Object[]} An array of objects containing the post-processed outputs.
   * @private
   */
  post_process_object_detection(
    outputs: {
      logits: Tensor;
      pred_boxes: Tensor;
    },
    threshold?: number,
    target_sizes?: number[][],
    is_zero_shot?: boolean,
  ): any[];
}
/**
 * @typedef {object} SamImageProcessorResult
 * @property {Tensor} pixel_values
 * @property {HeightWidth[]} original_sizes
 * @property {HeightWidth[]} reshaped_input_sizes
 * @property {Tensor} [input_points]
 * @property {Tensor} [input_labels]
 */
export class SamImageProcessor extends ImageFeatureExtractor {
  /**
   *
   * @param {any} input_points
   * @param {HeightWidth[]} original_sizes
   * @param {HeightWidth[]} reshaped_input_sizes
   * @returns {Tensor}
   */
  reshape_input_points(
    input_points: any,
    original_sizes: HeightWidth[],
    reshaped_input_sizes: HeightWidth[],
  ): Tensor;
  /**
   *
   * @param {any} input_labels
   * @param {Tensor} input_points
   * @returns {Tensor}
   */
  add_input_labels(input_labels: any, input_points: Tensor): Tensor;
  /**
   * @param {any[]} images The URL(s) of the image(s) to extract features from.
   * @param {any} [input_points] A 3D or 4D array, representing the input points provided by the user.
   * - 3D: `[point_batch_size, nb_points_per_image, 2]`. In this case, `batch_size` is assumed to be 1.
   * - 4D: `[batch_size, point_batch_size, nb_points_per_image, 2]`.
   * @param {any} [input_labels] A 2D or 3D array, representing the input labels for the points, used by the prompt encoder to encode the prompt.
   * - 2D: `[point_batch_size, nb_points_per_image]`. In this case, `batch_size` is assumed to be 1.
   * - 3D: `[batch_size, point_batch_size, nb_points_per_image]`.
   * @returns {Promise<SamImageProcessorResult>}
   */
  _call(
    images: any[],
    input_points?: any,
    input_labels?: any,
  ): Promise<SamImageProcessorResult>;
  /**
   * Remove padding and upscale masks to the original image size.
   * @param {Tensor} masks Batched masks from the mask_decoder in (batch_size, num_channels, height, width) format.
   * @param {number[][]} original_sizes The original sizes of each image before it was resized to the model's expected input shape, in (height, width) format.
   * @param {number[][]} reshaped_input_sizes The size of each image as it is fed to the model, in (height, width) format. Used to remove padding.
   * @param {Object} options Optional parameters for post-processing.
   * @param {number} [options.mask_threshold] The threshold to use for binarizing the masks.
   * @param {boolean} [options.binarize] Whether to binarize the masks.
   * @param {Object} [options.pad_size] The target size the images were padded to before being passed to the model. If `null`, the target size is assumed to be the processor's `pad_size`.
   * @param {number} [options.pad_size.height] The height the images were padded to.
   * @param {number} [options.pad_size.width] The width the images were padded to.
   * @returns {Tensor[]} Batched masks in batch_size, num_channels, height, width) format, where (height, width) is given by original_size.
   */
  post_process_masks(
    masks: Tensor,
    original_sizes: number[][],
    reshaped_input_sizes: number[][],
    {
      mask_threshold,
      binarize,
      pad_size,
    }?: {
      mask_threshold?: number;
      binarize?: boolean;
      pad_size?: {
        height?: number;
        width?: number;
      };
    },
  ): Tensor[];
}
export class Swin2SRImageProcessor extends ImageFeatureExtractor {
  pad_image(
    pixelData: any,
    imgDims: any,
    padSize: any,
    options?: {},
  ): [Float32Array, number[]];
}
export class VitMatteImageProcessor extends ImageFeatureExtractor {
  /**
   * Calls the feature extraction process on an array of images, preprocesses
   * each image, and concatenates the resulting features into a single Tensor.
   * @param {RawImage[]} images The image(s) to extract features from.
   * @param {RawImage[]} trimaps The trimaps(s) to extract features from.
   * @returns {Promise<ImageFeatureExtractorResult>} An object containing the concatenated pixel values of the preprocessed images.
   */
  _call(
    images: RawImage[],
    trimaps: RawImage[],
  ): Promise<ImageFeatureExtractorResult>;
}
export class WhisperFeatureExtractor extends FeatureExtractor {
  constructor(config: any);
  window: Float64Array;
  /**
   * Computes the log-Mel spectrogram of the provided audio waveform.
   * @param {Float32Array|Float64Array} waveform The audio waveform to process.
   * @returns {{data: Float32Array, dims: number[]}} An object containing the log-Mel spectrogram data as a Float32Array and its dimensions as an array of numbers.
   */
  _extract_fbank_features(waveform: Float32Array | Float64Array): {
    data: Float32Array;
    dims: number[];
  };
  /**
   * Asynchronously extracts features from a given audio using the provided configuration.
   * @param {Float32Array|Float64Array} audio The audio data as a Float32Array/Float64Array.
   * @returns {Promise<{ input_features: Tensor }>} A Promise resolving to an object containing the extracted input features as a Tensor.
   */
  _call(audio: Float32Array | Float64Array): Promise<{
    input_features: Tensor;
  }>;
}
export class Wav2Vec2FeatureExtractor extends FeatureExtractor {
  /**
   * @param {Float32Array} input_values
   * @returns {Float32Array}
   */
  _zero_mean_unit_var_norm(input_values: Float32Array): Float32Array;
  /**
   * Asynchronously extracts features from a given audio using the provided configuration.
   * @param {Float32Array|Float64Array} audio The audio data as a Float32Array/Float64Array.
   * @returns {Promise<{ input_values: Tensor; attention_mask: Tensor }>} A Promise resolving to an object containing the extracted input features and attention mask as Tensors.
   */
  _call(audio: Float32Array | Float64Array): Promise<{
    input_values: Tensor;
    attention_mask: Tensor;
  }>;
}
export class ASTFeatureExtractor extends FeatureExtractor {
  constructor(config: any);
  mel_filters: number[][];
  window: Float64Array;
  mean: any;
  std: any;
  /**
   * Computes the log-Mel spectrogram of the provided audio waveform.
   * @param {Float32Array|Float64Array} waveform The audio waveform to process.
   * @param {number} max_length The maximum number of frames to return.
   * @returns {{data: Float32Array, dims: number[]}} An object containing the log-Mel spectrogram data as a Float32Array and its dimensions as an array of numbers.
   */
  _extract_fbank_features(
    waveform: Float32Array | Float64Array,
    max_length: number,
  ): {
    data: Float32Array;
    dims: number[];
  };
  /**
   * Asynchronously extracts features from a given audio using the provided configuration.
   * @param {Float32Array|Float64Array} audio The audio data as a Float32Array/Float64Array.
   * @returns {Promise<{ input_values: Tensor }>} A Promise resolving to an object containing the extracted input features as a Tensor.
   */
  _call(audio: Float32Array | Float64Array): Promise<{
    input_values: Tensor;
  }>;
}
export class ClapFeatureExtractor extends FeatureExtractor {
  constructor(config: any);
  mel_filters: number[][];
  mel_filters_slaney: number[][];
  window: Float64Array;
  /**
   * Extracts the mel spectrogram and prepares it for the mode based on the `truncation` and `padding` arguments.
   *
   * Four different path are possible:
   *   - `truncation="fusion"` and the length of the waveform is greater than the max length: the mel spectrogram
   *     will be computed on the entire audio. 3 random crops and a dowsampled version of the full mel spectrogram
   *     are then stacked together. They will later be used for `feature_fusion`.
   *   - `truncation="rand_trunc"` and the length of the waveform is smaller than the max length: the audio is
   *     padded based on `padding`.
   *   - `truncation="fusion"` and the length of the waveform is smaller than the max length: the audio is padded
   *     based on `padding`, and is repeated `4` times.
   *   - `truncation="rand_trunc"` and the length of the waveform is greater than the max length: the mel
   *     spectrogram will be computed on a random crop of the waveform.
   *
   * @param {Float32Array|Float64Array} waveform The input waveform.
   * @param {number} max_length The maximum length of the waveform.
   * @param {string} truncation The truncation strategy to use.
   * @param {string} padding The padding strategy to use.
   * @returns {{ data: Float32Array; dims: number[]; longer: boolean; }} An object containing the mel spectrogram data as a Float32Array, its dimensions as an array of numbers, and a boolean indicating whether the waveform was longer than the max length.
   */
  _get_input_mel(
    waveform: Float32Array | Float64Array,
    max_length: number,
    truncation: string,
    padding: string,
  ): {
    data: Float32Array;
    dims: number[];
    longer: boolean;
  };
  /**
   * Compute the log-mel spectrogram of the provided `waveform` using the Hann window.
   * In CLAP, two different filter banks are used depending on the truncation pattern:
   *  - `self.mel_filters`: they correspond to the default parameters of `torchaudio` which can be obtained from
   *    calling `torchaudio.transforms.MelSpectrogram().mel_scale.fb`. These filters are used when `truncation`
   *    is set to `"fusion"`.
   *  - `self.mel_filteres_slaney` : they correspond to the default parameters of `librosa` which used
   *    `librosa.filters.mel` when computing the mel spectrogram. These filters were only used in the original
   *    implementation when the truncation mode is not `"fusion"`.
   *
   * @param {Float32Array|Float64Array} waveform The audio waveform to process.
   * @param {number[][]} mel_filters The mel filters to use.
   * @param {number} [max_length=null] The maximum number of frames to return.
   * @returns {{data: Float32Array, dims: number[]}} An object containing the log-Mel spectrogram data as a Float32Array and its dimensions as an array of numbers.
   */
  _extract_fbank_features(
    waveform: Float32Array | Float64Array,
    mel_filters: number[][],
    max_length?: number,
  ): {
    data: Float32Array;
    dims: number[];
  };
  /**
   * Asynchronously extracts features from a given audio using the provided configuration.
   * @param {Float32Array|Float64Array} audio The audio data as a Float32Array/Float64Array.
   * @returns {Promise<{ input_features: Tensor }>} A Promise resolving to an object containing the extracted input features as a Tensor.
   */
  _call(
    audio: Float32Array | Float64Array,
    {
      max_length,
    }?: {
      max_length?: any;
    },
  ): Promise<{
    input_features: Tensor;
  }>;
}
export class SpeechT5FeatureExtractor extends FeatureExtractor {}
declare const Processor_base: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
/**
 * Represents a Processor that extracts features from an input.
 * @extends Callable
 */
export class Processor extends Processor_base {
  /**
   * Creates a new Processor with the given feature extractor.
   * @param {FeatureExtractor} feature_extractor The function used to extract features from the input.
   */
  constructor(feature_extractor: FeatureExtractor);
  feature_extractor: FeatureExtractor;
  /**
   * Calls the feature_extractor function with the given input.
   * @param {any} input The input to extract features from.
   * @param {...any} args Additional arguments.
   * @returns {Promise<any>} A Promise that resolves with the extracted features.
   */
  _call(input: any, ...args: any[]): Promise<any>;
}
export class SamProcessor extends Processor {
  /**
   * @borrows SamImageProcessor#_call as _call
   */
  _call(...args: any[]): Promise<any>;
  /**
   * @borrows SamImageProcessor#post_process_masks as post_process_masks
   */
  post_process_masks(...args: any[]): any;
  /**
   * @borrows SamImageProcessor#reshape_input_points as reshape_input_points
   */
  reshape_input_points(...args: any[]): any;
}
/**
 * Represents a WhisperProcessor that extracts features from an audio input.
 * @extends Processor
 */
export class WhisperProcessor extends Processor {
  /**
   * Calls the feature_extractor function with the given audio input.
   * @param {any} audio The audio input to extract features from.
   * @returns {Promise<any>} A Promise that resolves with the extracted features.
   */
  _call(audio: any): Promise<any>;
}
export class Wav2Vec2ProcessorWithLM extends Processor {
  /**
   * Calls the feature_extractor function with the given audio input.
   * @param {any} audio The audio input to extract features from.
   * @returns {Promise<any>} A Promise that resolves with the extracted features.
   */
  _call(audio: any): Promise<any>;
}
export class SpeechT5Processor extends Processor {
  /**
   * Calls the feature_extractor function with the given input.
   * @param {any} input The input to extract features from.
   * @returns {Promise<any>} A Promise that resolves with the extracted features.
   */
  _call(input: any): Promise<any>;
}
export class OwlViTProcessor extends Processor {}
/**
 * Helper class which is used to instantiate pretrained processors with the `from_pretrained` function.
 * The chosen processor class is determined by the type specified in the processor config.
 *
 * **Example:** Load a processor using `from_pretrained`.
 * ```javascript
 * let processor = await AutoProcessor.from_pretrained('openai/whisper-tiny.en');
 * ```
 *
 * **Example:** Run an image through a processor.
 * ```javascript
 * let processor = await AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch16');
 * let image = await RawImage.read('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/football-match.jpg');
 * let image_inputs = await processor(image);
 * // {
 * //   "pixel_values": {
 * //     "dims": [ 1, 3, 224, 224 ],
 * //     "type": "float32",
 * //     "data": Float32Array [ -1.558687686920166, -1.558687686920166, -1.5440893173217773, ... ],
 * //     "size": 150528
 * //   },
 * //   "original_sizes": [
 * //     [ 533, 800 ]
 * //   ],
 * //   "reshaped_input_sizes": [
 * //     [ 224, 224 ]
 * //   ]
 * // }
 * ```
 */
export class AutoProcessor {
  static FEATURE_EXTRACTOR_CLASS_MAPPING: {
    WhisperFeatureExtractor: typeof WhisperFeatureExtractor;
    ViTFeatureExtractor: typeof ViTFeatureExtractor;
    MobileViTFeatureExtractor: typeof MobileViTFeatureExtractor;
    OwlViTFeatureExtractor: typeof OwlViTFeatureExtractor;
    CLIPFeatureExtractor: typeof CLIPFeatureExtractor;
    ChineseCLIPFeatureExtractor: typeof ChineseCLIPFeatureExtractor;
    SiglipImageProcessor: typeof SiglipImageProcessor;
    ConvNextFeatureExtractor: typeof ConvNextFeatureExtractor;
    ConvNextImageProcessor: typeof ConvNextImageProcessor;
    SegformerFeatureExtractor: typeof SegformerFeatureExtractor;
    BitImageProcessor: typeof BitImageProcessor;
    DPTFeatureExtractor: typeof DPTFeatureExtractor;
    GLPNFeatureExtractor: typeof GLPNFeatureExtractor;
    BeitFeatureExtractor: typeof BeitFeatureExtractor;
    DeiTFeatureExtractor: typeof DeiTFeatureExtractor;
    DetrFeatureExtractor: typeof DetrFeatureExtractor;
    YolosFeatureExtractor: typeof YolosFeatureExtractor;
    DonutFeatureExtractor: typeof DonutFeatureExtractor;
    NougatImageProcessor: typeof NougatImageProcessor;
    ViTImageProcessor: typeof ViTImageProcessor;
    VitMatteImageProcessor: typeof VitMatteImageProcessor;
    SamImageProcessor: typeof SamImageProcessor;
    Swin2SRImageProcessor: typeof Swin2SRImageProcessor;
    Wav2Vec2FeatureExtractor: typeof Wav2Vec2FeatureExtractor;
    SpeechT5FeatureExtractor: typeof SpeechT5FeatureExtractor;
    ASTFeatureExtractor: typeof ASTFeatureExtractor;
    ClapFeatureExtractor: typeof ClapFeatureExtractor;
  };
  static PROCESSOR_CLASS_MAPPING: {
    WhisperProcessor: typeof WhisperProcessor;
    Wav2Vec2ProcessorWithLM: typeof Wav2Vec2ProcessorWithLM;
    SamProcessor: typeof SamProcessor;
    SpeechT5Processor: typeof SpeechT5Processor;
    OwlViTProcessor: typeof OwlViTProcessor;
  };
  /**
   * Instantiate one of the processor classes of the library from a pretrained model.
   *
   * The processor class to instantiate is selected based on the `feature_extractor_type` property of the config object
   * (either passed as an argument or loaded from `pretrained_model_name_or_path` if possible)
   *
   * @param {string} pretrained_model_name_or_path The name or path of the pretrained model. Can be either:
   * - A string, the *model id* of a pretrained processor hosted inside a model repo on huggingface.co.
   *   Valid model ids can be located at the root-level, like `bert-base-uncased`, or namespaced under a
   *   user or organization name, like `dbmdz/bert-base-german-cased`.
   * - A path to a *directory* containing processor files, e.g., `./my_model_directory/`.
   * @param {import('./utils/hub.js').PretrainedOptions} options Additional options for loading the processor.
   *
   * @returns {Promise<Processor>} A new instance of the Processor class.
   */
  static from_pretrained(
    pretrained_model_name_or_path: string,
    {
      progress_callback,
      config,
      cache_dir,
      local_files_only,
      revision,
    }?: import("./utils/hub.js").PretrainedOptions,
  ): Promise<Processor>;
}
/**
 * Named tuple to indicate the order we are using is (height x width), even though
 * the Graphics’ industry standard is (width x height).
 */
export type HeightWidth = [height: number, width: number];
export type ImageFeatureExtractorResult = {
  /**
   * The pixel values of the batched preprocessed images.
   */
  pixel_values: Tensor;
  /**
   * Array of two-dimensional tuples like [[480, 640]].
   */
  original_sizes: HeightWidth[];
  /**
   * Array of two-dimensional tuples like [[1000, 1330]].
   */
  reshaped_input_sizes: HeightWidth[];
};
export type DetrFeatureExtractorResultProps = {
  pixel_mask: Tensor;
};
export type DetrFeatureExtractorResult = ImageFeatureExtractorResult &
  DetrFeatureExtractorResultProps;
export type SamImageProcessorResult = {
  pixel_values: Tensor;
  original_sizes: HeightWidth[];
  reshaped_input_sizes: HeightWidth[];
  input_points?: Tensor;
  input_labels?: Tensor;
};
import { RawImage } from "./utils/image.js";
import { Tensor } from "./utils/tensor.js";
export {};
//# sourceMappingURL=processors.d.ts.map
