/**
 * @file Processors are used to prepare non-textual inputs (e.g., image or audio) for a model.
 *
 * **Example:** Using a `WhisperProcessor` to prepare an audio input for a model.
 * ```javascript
 * import { AutoProcessor, read_audio } from '@xenova/transformers';
 *
 * let processor = await AutoProcessor.from_pretrained('openai/whisper-tiny.en');
 * let audio = await read_audio('https://huggingface.co/datasets/Narsil/asr_dummy/resolve/main/mlk.flac', 16000);
 * let { input_features } = await processor(audio);
 * // Tensor {
 * //   data: Float32Array(240000) [0.4752984642982483, 0.5597258806228638, 0.56434166431427, ...],
 * //   dims: [1, 80, 3000],
 * //   type: 'float32',
 * //   size: 240000,
 * // }
 * ```
 *
 * @module processors
 */
import {
  Callable,
  calculateDimensions,
  calculateReflectOffset,
} from "./utils/core.js";

import { getModelJSON } from "./utils/hub.js";

import { max, min, softmax } from "./utils/maths.js";

import { Tensor, cat, interpolate, stack, transpose } from "./utils/tensor.js";

// import { RawImage } from './utils/image.js';
import {
  mel_filter_bank,
  spectrogram,
  window_function,
} from "./utils/audio.js";

// Helper functions

/**
 * Converts bounding boxes from center format to corners format.
 *
 * @param {number[]} arr The coordinate for the center of the box and its width, height dimensions (center_x, center_y, width, height)
 * @returns {number[]} The coodinates for the top-left and bottom-right corners of the box (top_left_x, top_left_y, bottom_right_x, bottom_right_y)
 */
function center_to_corners_format([centerX, centerY, width, height]) {
  return [
    centerX - width / 2,
    centerY - height / 2,
    centerX + width / 2,
    centerY + height / 2,
  ];
}

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
function post_process_object_detection(
  outputs,
  threshold = 0.5,
  target_sizes = null,
  is_zero_shot = false,
) {
  const out_logits = outputs.logits;
  const out_bbox = outputs.pred_boxes;
  const [batch_size, num_boxes, num_classes] = out_logits.dims;

  if (target_sizes !== null && target_sizes.length !== batch_size) {
    throw Error(
      "Make sure that you pass in as many target sizes as the batch dimension of the logits",
    );
  }
  let toReturn = [];
  for (let i = 0; i < batch_size; ++i) {
    let target_size = target_sizes !== null ? target_sizes[i] : null;
    let info = {
      boxes: [],
      classes: [],
      scores: [],
    };
    let logits = out_logits[i];
    let bbox = out_bbox[i];

    for (let j = 0; j < num_boxes; ++j) {
      let logit = logits[j];

      let indices = [];
      let probs;
      if (is_zero_shot) {
        // Get indices of classes with high enough probability
        probs = logit.sigmoid().data;
        for (let k = 0; k < probs.length; ++k) {
          if (probs[k] > threshold) {
            indices.push(k);
          }
        }
      } else {
        // Get most probable class
        let maxIndex = max(logit.data)[1];

        if (maxIndex === num_classes - 1) {
          // This is the background class, skip it
          continue;
        }
        indices.push(maxIndex);

        // Compute softmax over classes
        probs = softmax(logit.data);
      }

      for (const index of indices) {
        // Some class has a high enough probability
        /** @type {number[]} */
        let box = bbox[j].data;

        // convert to [x0, y0, x1, y1] format
        box = center_to_corners_format(box);
        if (target_size !== null) {
          box = box.map((x, i) => x * target_size[(i + 1) % 2]);
        }

        info.boxes.push(box);
        info.classes.push(index);
        info.scores.push(probs[index]);
      }
    }
    toReturn.push(info);
  }
  return toReturn;
}

/**
 * Named tuple to indicate the order we are using is (height x width), even though
 * the Graphics’ industry standard is (width x height).
 * @typedef {[height: number, width: number]} HeightWidth
 */

/**
 * Helper function to validate audio inputs.
 * @param {any} audio The audio data.
 * @param {string} feature_extractor The name of the feature extractor.
 * @private
 */
function validate_audio_inputs(audio, feature_extractor) {
  if (!(audio instanceof Float32Array || audio instanceof Float64Array)) {
    throw new Error(
      `${feature_extractor} expects input to be a Float32Array or a Float64Array, but got ${audio?.constructor?.name ?? typeof audio} instead.` +
        `If using the feature extractor directly, remember to use \`read_audio(url, sampling_rate)\` to obtain the raw audio data of the file/url.`,
    );
  }
}

/**
 * Base class for feature extractors.
 *
 * @extends Callable
 */
export class FeatureExtractor extends Callable {
  /**
   * Constructs a new FeatureExtractor instance.
   *
   * @param {Object} config The configuration for the feature extractor.
   */
  constructor(config) {
    super();
    this.config = config;
  }
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
  constructor(config) {
    super(config);

    this.image_mean = this.config.image_mean ?? this.config.mean;
    this.image_std = this.config.image_std ?? this.config.std;

    this.resample = this.config.resample ?? 2; // 2 => bilinear
    this.do_rescale = this.config.do_rescale ?? true;
    this.rescale_factor = this.config.rescale_factor ?? 1 / 255;
    this.do_normalize = this.config.do_normalize;

    this.do_resize = this.config.do_resize;
    this.do_thumbnail = this.config.do_thumbnail;
    this.size = this.config.size;
    this.size_divisibility =
      this.config.size_divisibility ?? this.config.size_divisor;

    this.do_center_crop = this.config.do_center_crop;
    this.crop_size = this.config.crop_size;
    this.do_convert_rgb = this.config.do_convert_rgb ?? true;
    this.do_crop_margin = this.config.do_crop_margin;

    this.pad_size = this.config.pad_size;
    this.do_pad = this.config.do_pad;

    if (
      this.do_pad &&
      !this.pad_size &&
      this.size &&
      this.size.width !== undefined &&
      this.size.height !== undefined
    ) {
      // Should pad, but no pad size specified
      // We infer the pad size from the resize size
      this.pad_size = this.size;
    }
  }

  /**
   * Resize the image to make a thumbnail. The image is resized so that no dimension is larger than any
   * corresponding dimension of the specified size.
   * @param {RawImage} image The image to be resized.
   * @param {{height:number, width:number}} size The size `{"height": h, "width": w}` to resize the image to.
   * @param {string | 0 | 1 | 2 | 3 | 4 | 5} [resample=2] The resampling filter to use.
   * @returns {Promise<RawImage>} The resized image.
   */
  async thumbnail(image, size, resample = 2) {
    const input_height = image.height;
    const input_width = image.width;

    const output_height = size.height;
    const output_width = size.width;

    // We always resize to the smallest of either the input or output size.
    let height = Math.min(input_height, output_height);
    let width = Math.min(input_width, output_width);

    if (height === input_height && width === input_width) {
      return image;
    }
    if (input_height > input_width) {
      width = Math.floor((input_width * height) / input_height);
    } else if (input_width > input_height) {
      height = Math.floor((input_height * width) / input_width);
    }
    return await image.resize(width, height, { resample });
  }

  /**
   * Crops the margin of the image. Gray pixels are considered margin (i.e., pixels with a value below the threshold).
   * @param {RawImage} image The image to be cropped.
   * @param {number} gray_threshold Value below which pixels are considered to be gray.
   * @returns {Promise<RawImage>} The cropped image.
   */
  async crop_margin(image, gray_threshold = 200) {
    const gray_image = image.clone().grayscale();

    const minValue = min(gray_image.data)[0];
    const maxValue = max(gray_image.data)[0];
    const diff = maxValue - minValue;

    if (diff === 0) {
      return image;
    }

    const threshold = gray_threshold / 255;

    let x_min = gray_image.width,
      y_min = gray_image.height,
      x_max = 0,
      y_max = 0;
    for (let j = 0; j < gray_image.height; ++j) {
      const row = j * gray_image.width;
      for (let i = 0; i < gray_image.width; ++i) {
        if ((gray_image.data[row + i] - minValue) / diff < threshold) {
          // We have a non-zero pixel, so we update the min/max values accordingly
          x_min = Math.min(x_min, i);
          y_min = Math.min(y_min, j);
          x_max = Math.max(x_max, i);
          y_max = Math.max(y_max, j);
        }
      }
    }

    image = await image.crop([x_min, y_min, x_max, y_max]);
    return image;
  }

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
    pixelData,
    imgDims,
    padSize,
    { mode = "constant", center = false, constant_values = 0 } = {},
  ) {
    const [imageWidth, imageHeight, imageChannels] = imgDims;

    let paddedImageWidth, paddedImageHeight;
    if (typeof padSize === "number") {
      paddedImageWidth = padSize;
      paddedImageHeight = padSize;
    } else {
      paddedImageWidth = padSize.width;
      paddedImageHeight = padSize.height;
    }

    // Only add padding if there is a difference in size
    if (paddedImageWidth !== imageWidth || paddedImageHeight !== imageHeight) {
      const paddedPixelData = new Float32Array(
        paddedImageWidth * paddedImageHeight * imageChannels,
      );
      if (Array.isArray(constant_values)) {
        // Fill with constant values, cycling through the array
        for (let i = 0; i < paddedPixelData.length; ++i) {
          paddedPixelData[i] = constant_values[i % imageChannels];
        }
      } else if (constant_values !== 0) {
        paddedPixelData.fill(constant_values);
      }

      const [left, top] = center
        ? [
            Math.floor((paddedImageWidth - imageWidth) / 2),
            Math.floor((paddedImageHeight - imageHeight) / 2),
          ]
        : [0, 0];

      // Copy the original image into the padded image
      for (let i = 0; i < imageHeight; ++i) {
        const a = (i + top) * paddedImageWidth;
        const b = i * imageWidth;
        for (let j = 0; j < imageWidth; ++j) {
          const c = (a + j + left) * imageChannels;
          const d = (b + j) * imageChannels;
          for (let k = 0; k < imageChannels; ++k) {
            paddedPixelData[c + k] = pixelData[d + k];
          }
        }
      }

      if (mode === "symmetric") {
        if (center) {
          throw new Error(
            "`center` padding is not supported when `mode` is set to `symmetric`.",
          );
          // TODO: Implement this
        }
        const h1 = imageHeight - 1;
        const w1 = imageWidth - 1;
        for (let i = 0; i < paddedImageHeight; ++i) {
          const a = i * paddedImageWidth;
          const b = calculateReflectOffset(i, h1) * imageWidth;

          for (let j = 0; j < paddedImageWidth; ++j) {
            if (i < imageHeight && j < imageWidth) continue; // Do not overwrite original image
            const c = (a + j) * imageChannels;
            const d = (b + calculateReflectOffset(j, w1)) * imageChannels;

            // Copy channel-wise
            for (let k = 0; k < imageChannels; ++k) {
              paddedPixelData[c + k] = pixelData[d + k];
            }
          }
        }
      }

      // Update pixel data and image dimensions
      pixelData = paddedPixelData;
      imgDims = [paddedImageHeight, paddedImageWidth, imageChannels];
    }
    return [pixelData, imgDims];
  }

  /**
   * Rescale the image' pixel values by `this.rescale_factor`.
   * @param {Float32Array} pixelData The pixel data to rescale.
   * @returns {void}
   */
  rescale(pixelData) {
    for (let i = 0; i < pixelData.length; ++i) {
      pixelData[i] = this.rescale_factor * pixelData[i];
    }
  }

  /**
   * Find the target (width, height) dimension of the output image after
   * resizing given the input image and the desired size.
   * @param {RawImage} image The image to resize.
   * @param {any} size The size to use for resizing the image.
   * @returns {[number, number]} The target (width, height) dimension of the output image after resizing.
   */
  get_resize_output_image_size(image, size) {
    // `size` comes in many forms, so we need to handle them all here:
    // 1. `size` is an integer, in which case we resize the image to be a square

    const [srcWidth, srcHeight] = image.size;

    let shortest_edge;
    let longest_edge;

    if (this.do_thumbnail) {
      // NOTE: custom logic for `Donut` models
      const { height, width } = size;
      shortest_edge = Math.min(height, width);
    }
    // Support both formats for backwards compatibility
    else if (Number.isInteger(size)) {
      shortest_edge = size;
      longest_edge = this.config.max_size ?? shortest_edge;
    } else if (size !== undefined) {
      // Extract known properties from `size`
      shortest_edge = size.shortest_edge;
      longest_edge = size.longest_edge;
    }

    // If `longest_edge` and `shortest_edge` are set, maintain aspect ratio and resize to `shortest_edge`
    // while keeping the largest dimension <= `longest_edge`
    if (shortest_edge !== undefined || longest_edge !== undefined) {
      // http://opensourcehacker.com/2011/12/01/calculate-aspect-ratio-conserving-resize-for-images-in-javascript/
      // Try resize so that shortest edge is `shortest_edge` (target)
      const shortResizeFactor =
        shortest_edge === undefined
          ? 1 // If `shortest_edge` is not set, don't upscale
          : Math.max(shortest_edge / srcWidth, shortest_edge / srcHeight);

      const newWidth = srcWidth * shortResizeFactor;
      const newHeight = srcHeight * shortResizeFactor;

      // The new width and height might be greater than `longest_edge`, so
      // we downscale again to ensure the largest dimension is `longest_edge`
      const longResizeFactor =
        longest_edge === undefined
          ? 1 // If `longest_edge` is not set, don't downscale
          : Math.min(longest_edge / newWidth, longest_edge / newHeight);

      // To avoid certain floating point precision issues, we round to 2 decimal places
      const finalWidth = Math.floor(
        Number((newWidth * longResizeFactor).toFixed(2)),
      );
      const finalHeight = Math.floor(
        Number((newHeight * longResizeFactor).toFixed(2)),
      );

      return [finalWidth, finalHeight];
    } else if (
      size !== undefined &&
      size.width !== undefined &&
      size.height !== undefined
    ) {
      // If `width` and `height` are set, resize to those dimensions
      return [size.width, size.height];
    } else if (this.size_divisibility !== undefined) {
      // Rounds the height and width down to the closest multiple of size_divisibility
      const newWidth =
        Math.floor(srcWidth / this.size_divisibility) * this.size_divisibility;
      const newHeight =
        Math.floor(srcHeight / this.size_divisibility) * this.size_divisibility;
      return [newWidth, newHeight];
    } else {
      throw new Error(
        `Could not resize image due to unsupported \`this.size\` option in config: ${JSON.stringify(size)}`,
      );
    }
  }

  /**
   * Resizes the image.
   * @param {RawImage} image The image to resize.
   * @returns {Promise<RawImage>} The resized image.
   */
  async resize(image) {
    const [newWidth, newHeight] = this.get_resize_output_image_size(
      image,
      this.size,
    );
    return await image.resize(newWidth, newHeight, {
      resample: this.resample,
    });
  }

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
  async preprocess(
    image,
    {
      do_normalize = null,
      do_pad = null,
      do_convert_rgb = null,
      do_convert_grayscale = null,
    } = {},
  ) {
    if (this.do_crop_margin) {
      // NOTE: Specific to nougat processors. This is done before resizing,
      // and can be interpreted as a pre-preprocessing step.
      image = await this.crop_margin(image);
    }

    const [srcWidth, srcHeight] = image.size; // original image size

    // Convert image to RGB if specified in config.
    if (do_convert_rgb ?? this.do_convert_rgb) {
      image = image.rgb();
    } else if (do_convert_grayscale) {
      image = image.grayscale();
    }

    // TODO:
    // For efficiency reasons, it might be best to merge the resize and center crop operations into one.

    // Resize all images
    if (this.do_resize) {
      image = await this.resize(image);
    }

    // Resize the image using thumbnail method.
    if (this.do_thumbnail) {
      image = await this.thumbnail(image, this.size, this.resample);
    }

    if (this.do_center_crop) {
      let crop_width;
      let crop_height;
      if (Number.isInteger(this.crop_size)) {
        crop_width = this.crop_size;
        crop_height = this.crop_size;
      } else {
        crop_width = this.crop_size.width;
        crop_height = this.crop_size.height;
      }

      image = await image.center_crop(crop_width, crop_height);
    }

    /** @type {HeightWidth} */
    const reshaped_input_size = [image.height, image.width];

    let pixelData = Float32Array.from(image.data);
    let imgDims = [image.height, image.width, image.channels];

    if (this.do_rescale) {
      this.rescale(pixelData);
    }

    if (do_normalize ?? this.do_normalize) {
      let image_mean = this.image_mean;
      if (!Array.isArray(this.image_mean)) {
        image_mean = new Array(image.channels).fill(image_mean);
      }

      let image_std = this.image_std;
      if (!Array.isArray(this.image_std)) {
        image_std = new Array(image.channels).fill(image_mean);
      }

      if (
        image_mean.length !== image.channels ||
        image_std.length !== image.channels
      ) {
        throw new Error(
          `When set to arrays, the length of \`image_mean\` (${image_mean.length}) and \`image_std\` (${image_std.length}) must match the number of channels in the image (${image.channels}).`,
        );
      }

      for (let i = 0; i < pixelData.length; i += image.channels) {
        for (let j = 0; j < image.channels; ++j) {
          pixelData[i + j] =
            (pixelData[i + j] - this.image_mean[j]) / this.image_std[j];
        }
      }
    }

    // do padding after rescaling/normalizing
    if (do_pad ?? (this.do_pad && this.pad_size)) {
      const padded = this.pad_image(
        pixelData,
        [image.width, image.height, image.channels],
        this.pad_size,
      );
      [pixelData, imgDims] = padded; // Update pixel data and image dimensions
    }

    // Create HWC tensor
    const img = new Tensor("float32", pixelData, imgDims);

    // convert to channel dimension format:
    const transposed = transpose(img, [2, 0, 1]); // hwc -> chw

    return {
      original_size: [srcHeight, srcWidth],
      reshaped_input_size: reshaped_input_size,
      pixel_values: transposed,
    };
  }

  /**
   * Calls the feature extraction process on an array of images,
   * preprocesses each image, and concatenates the resulting
   * features into a single Tensor.
   * @param {RawImage[]} images The image(s) to extract features from.
   * @param {...any} args Additional arguments.
   * @returns {Promise<ImageFeatureExtractorResult>} An object containing the concatenated pixel values (and other metadata) of the preprocessed images.
   */
  async _call(images, ...args) {
    if (!Array.isArray(images)) {
      images = [images];
    }
    /** @type {PreprocessedImage[]} */
    const imageData = await Promise.all(images.map((x) => this.preprocess(x)));

    // Stack pixel values
    const pixel_values = stack(
      imageData.map((x) => x.pixel_values),
      0,
    );

    return {
      pixel_values: pixel_values,

      // Original sizes of images
      original_sizes: imageData.map((x) => x.original_size),

      // Reshaped sizes of images, before padding or cropping
      reshaped_input_sizes: imageData.map((x) => x.reshaped_input_size),
    };
  }
}

export class SegformerFeatureExtractor extends ImageFeatureExtractor {
  /**
   * Converts the output of `SegformerForSemanticSegmentation` into semantic segmentation maps.
   * @param {*} outputs Raw outputs of the model.
   * @param {number[][]} [target_sizes=null] List of tuples corresponding to the requested final size
   * (height, width) of each prediction. If unset, predictions will not be resized.
   * @returns {{segmentation: Tensor; labels: number[]}[]} The semantic segmentation maps.
   */
  post_process_semantic_segmentation(outputs, target_sizes = null) {
    const logits = outputs.logits;
    const batch_size = logits.dims[0];

    if (target_sizes !== null && target_sizes.length !== batch_size) {
      throw Error(
        "Make sure that you pass in as many target sizes as the batch dimension of the logits",
      );
    }

    const toReturn = [];
    for (let i = 0; i < batch_size; ++i) {
      const target_size = target_sizes !== null ? target_sizes[i] : null;

      let data = logits[i];

      // 1. If target_size is not null, we need to resize the masks to the target size
      if (target_size !== null) {
        // resize the masks to the target size
        data = interpolate(data, target_size, "bilinear", false);
      }
      const [height, width] = target_size ?? data.dims.slice(-2);

      const segmentation = new Tensor("int32", new Int32Array(height * width), [
        height,
        width,
      ]);

      // Buffer to store current largest value
      const buffer = data[0].data;
      for (let j = 1; j < data.dims[0]; ++j) {
        const row = data[j].data;
        for (let k = 0; k < row.length; ++k) {
          if (row[k] > buffer[k]) {
            buffer[k] = row[k];
            segmentation.data[k] = j;
          }
        }
      }

      // Store which objects have labels
      // This is much more efficient that creating a set of the final values
      const hasLabel = new Array(data.dims[0]);
      const out = segmentation.data;
      for (let j = 0; j < out.length; ++j) {
        const index = out[j];
        hasLabel[index] = index;
      }
      /** @type {number[]} The unique list of labels that were detected */
      const labels = hasLabel.filter((x) => x !== undefined);

      toReturn.push({ segmentation, labels });
    }
    return toReturn;
  }
}
export class BitImageProcessor extends ImageFeatureExtractor {}
export class DPTFeatureExtractor extends ImageFeatureExtractor {}
export class GLPNFeatureExtractor extends ImageFeatureExtractor {}
export class CLIPFeatureExtractor extends ImageFeatureExtractor {}
export class ChineseCLIPFeatureExtractor extends ImageFeatureExtractor {}
export class SiglipImageProcessor extends ImageFeatureExtractor {}
export class ConvNextFeatureExtractor extends ImageFeatureExtractor {
  constructor(config) {
    super(config);

    /**
     * Percentage of the image to crop. Only has an effect if this.size < 384.
     */
    this.crop_pct = this.config.crop_pct ?? 224 / 256;
  }

  async resize(image) {
    const shortest_edge = this.size?.shortest_edge;
    if (shortest_edge === undefined) {
      throw new Error(`Size dictionary must contain 'shortest_edge' key.`);
    }

    if (shortest_edge < 384) {
      // maintain same ratio, resizing shortest edge to shortest_edge/crop_pct
      const resize_shortest_edge = Math.floor(shortest_edge / this.crop_pct);

      const [newWidth, newHeight] = this.get_resize_output_image_size(image, {
        shortest_edge: resize_shortest_edge,
      });

      image = await image.resize(newWidth, newHeight, {
        resample: this.resample,
      });

      // then crop to (shortest_edge, shortest_edge)
      image = await image.center_crop(shortest_edge, shortest_edge);
    } else {
      // warping (no cropping) when evaluated at 384 or larger
      image = await image.resize(shortest_edge, shortest_edge, {
        resample: this.resample,
      });
    }

    return image;
  }
}
export class ConvNextImageProcessor extends ConvNextFeatureExtractor {} // NOTE extends ConvNextFeatureExtractor
export class ViTFeatureExtractor extends ImageFeatureExtractor {}
export class ViTImageProcessor extends ImageFeatureExtractor {}

export class MobileViTFeatureExtractor extends ImageFeatureExtractor {}
export class OwlViTFeatureExtractor extends ImageFeatureExtractor {
  /** @type {post_process_object_detection} */
  post_process_object_detection(...args) {
    return post_process_object_detection(...args);
  }
}
export class DeiTFeatureExtractor extends ImageFeatureExtractor {}
export class BeitFeatureExtractor extends ImageFeatureExtractor {}
export class DonutFeatureExtractor extends ImageFeatureExtractor {
  pad_image(pixelData, imgDims, padSize, options = {}) {
    const [imageWidth, imageHeight, imageChannels] = imgDims;

    let image_mean = this.image_mean;
    if (!Array.isArray(this.image_mean)) {
      image_mean = new Array(imageChannels).fill(image_mean);
    }

    let image_std = this.image_std;
    if (!Array.isArray(image_std)) {
      image_std = new Array(imageChannels).fill(image_mean);
    }

    const constant_values = image_mean.map((x, i) => -x / this.image_std[i]);

    return super.pad_image(pixelData, imgDims, padSize, {
      center: true,

      // Since normalization is done after padding, we need to use certain constant values to ensure the same behaviour is observed.
      // For more information, see https://github.com/huggingface/transformers/blob/main/src/transformers/models/donut/image_processing_donut.py#L433-L451
      constant_values: constant_values,
      ...options,
    });
  }
}
export class NougatImageProcessor extends DonutFeatureExtractor {} // NOTE extends DonutFeatureExtractor

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
  async _call(images) {
    const result = await super._call(images);

    // TODO support differently-sized images, for now assume all images are the same size.
    // TODO support different mask sizes (not just 64x64)
    // Currently, just fill pixel mask with 1s
    const maskSize = [result.pixel_values.dims[0], 64, 64];
    const pixel_mask = new Tensor(
      "int64",
      new BigInt64Array(maskSize.reduce((a, b) => a * b)).fill(1n),
      maskSize,
    );

    return { ...result, pixel_mask };
  }

  /**
   * Post-processes the outputs of the model (for object detection).
   * @param {Object} outputs The outputs of the model that must be post-processed
   * @param {Tensor} outputs.logits The logits
   * @param {Tensor} outputs.pred_boxes The predicted boxes.
   * @return {Object[]} An array of objects containing the post-processed outputs.
   */

  /** @type {post_process_object_detection} */
  post_process_object_detection(...args) {
    return post_process_object_detection(...args);
  }

  /**
   * Binarize the given masks using `object_mask_threshold`, it returns the associated values of `masks`, `scores` and `labels`.
   * @param {Tensor} class_logits The class logits.
   * @param {Tensor} mask_logits The mask logits.
   * @param {number} object_mask_threshold A number between 0 and 1 used to binarize the masks.
   * @param {number} num_labels The number of labels.
   * @returns {[Tensor[], number[], number[]]} The binarized masks, the scores, and the labels.
   */
  remove_low_and_no_objects(
    class_logits,
    mask_logits,
    object_mask_threshold,
    num_labels,
  ) {
    let mask_probs_item = [];
    let pred_scores_item = [];
    let pred_labels_item = [];

    for (let j = 0; j < class_logits.dims[0]; ++j) {
      let cls = class_logits[j];
      let mask = mask_logits[j];

      let pred_label = max(cls.data)[1];
      if (pred_label === num_labels) {
        // Is the background, so we ignore it
        continue;
      }

      let scores = softmax(cls.data);
      let pred_score = scores[pred_label];
      if (pred_score > object_mask_threshold) {
        mask_probs_item.push(mask);
        pred_scores_item.push(pred_score);
        pred_labels_item.push(pred_label);
      }
    }

    return [mask_probs_item, pred_scores_item, pred_labels_item];
  }

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
    mask_labels,
    mask_probs,
    k,
    mask_threshold = 0.5,
    overlap_mask_area_threshold = 0.8,
  ) {
    // mask_k is a 1D array of indices, indicating where the mask is equal to k
    let mask_k = [];
    let mask_k_area = 0;
    let original_area = 0;

    // Compute the area of all the stuff in query k
    for (let i = 0; i < mask_labels.length; ++i) {
      if (mask_labels[i] === k) {
        mask_k.push(i);
        ++mask_k_area;
      }

      if (mask_probs[k].data[i] >= mask_threshold) {
        ++original_area;
      }
    }
    let mask_exists = mask_k_area > 0 && original_area > 0;

    // Eliminate disconnected tiny segments
    if (mask_exists) {
      // Perform additional check
      let area_ratio = mask_k_area / original_area;
      mask_exists = area_ratio > overlap_mask_area_threshold;
    }

    return [mask_exists, mask_k];
  }

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
    mask_probs,
    pred_scores,
    pred_labels,
    mask_threshold,
    overlap_mask_area_threshold,
    label_ids_to_fuse = null,
    target_size = null,
  ) {
    let [height, width] = target_size ?? mask_probs[0].dims;

    let segmentation = new Tensor("int32", new Int32Array(height * width), [
      height,
      width,
    ]);
    let segments = [];

    // 1. If target_size is not null, we need to resize the masks to the target size
    if (target_size !== null) {
      // resize the masks to the target size
      for (let i = 0; i < mask_probs.length; ++i) {
        mask_probs[i] = interpolate(
          mask_probs[i],
          target_size,
          "bilinear",
          false,
        );
      }
    }

    // 2. Weigh each mask by its prediction score
    // NOTE: `mask_probs` is updated in-place
    //
    // Temporary storage for the best label/scores for each pixel ([height, width]):
    let mask_labels = new Int32Array(mask_probs[0].data.length);
    let bestScores = new Float32Array(mask_probs[0].data.length);

    for (let i = 0; i < mask_probs.length; ++i) {
      let score = pred_scores[i];

      for (let j = 0; j < mask_probs[i].data.length; ++j) {
        mask_probs[i].data[j] *= score;
        if (mask_probs[i].data[j] > bestScores[j]) {
          mask_labels[j] = i;
          bestScores[j] = mask_probs[i].data[j];
        }
      }
    }

    let current_segment_id = 0;

    // let stuff_memory_list = {}
    for (let k = 0; k < pred_labels.length; ++k) {
      let pred_class = pred_labels[k];

      // TODO add `should_fuse`
      // let should_fuse = pred_class in label_ids_to_fuse

      // Check if mask exists and large enough to be a segment
      let [mask_exists, mask_k] = this.check_segment_validity(
        mask_labels,
        mask_probs,
        k,
        mask_threshold,
        overlap_mask_area_threshold,
      );

      if (!mask_exists) {
        // Nothing to see here
        continue;
      }

      // TODO
      // if (pred_class in stuff_memory_list) {
      //     current_segment_id = stuff_memory_list[pred_class]
      // } else {
      //     current_segment_id += 1;
      // }
      ++current_segment_id;

      // Add current object segment to final segmentation map
      for (let index of mask_k) {
        segmentation.data[index] = current_segment_id;
      }

      segments.push({
        id: current_segment_id,
        label_id: pred_class,
        // was_fused: should_fuse, TODO
        score: pred_scores[k],
      });

      // TODO
      // if(should_fuse){
      //     stuff_memory_list[pred_class] = current_segment_id
      // }
    }

    return [segmentation, segments];
  }

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
    outputs,
    threshold = 0.5,
    mask_threshold = 0.5,
    overlap_mask_area_threshold = 0.8,
    label_ids_to_fuse = null,
    target_sizes = null,
  ) {
    if (label_ids_to_fuse === null) {
      console.warn("`label_ids_to_fuse` unset. No instance will be fused.");
      label_ids_to_fuse = new Set();
    }

    const class_queries_logits = outputs.logits; // [batch_size, num_queries, num_classes+1]
    const masks_queries_logits = outputs.pred_masks; // [batch_size, num_queries, height, width]

    const mask_probs = masks_queries_logits.sigmoid(); // [batch_size, num_queries, height, width]

    let [batch_size, num_queries, num_labels] = class_queries_logits.dims;
    num_labels -= 1; // Remove last class (background)

    if (target_sizes !== null && target_sizes.length !== batch_size) {
      throw Error(
        "Make sure that you pass in as many target sizes as the batch dimension of the logits",
      );
    }

    let toReturn = [];
    for (let i = 0; i < batch_size; ++i) {
      let target_size = target_sizes !== null ? target_sizes[i] : null;

      let class_logits = class_queries_logits[i];
      let mask_logits = mask_probs[i];

      let [mask_probs_item, pred_scores_item, pred_labels_item] =
        this.remove_low_and_no_objects(
          class_logits,
          mask_logits,
          threshold,
          num_labels,
        );

      if (pred_labels_item.length === 0) {
        // No mask found
        let [height, width] = target_size ?? mask_logits.dims.slice(-2);

        let segmentation = new Tensor(
          "int32",
          new Int32Array(height * width).fill(-1),
          [height, width],
        );
        toReturn.push({
          segmentation: segmentation,
          segments_info: [],
        });
        continue;
      }

      // Get segmentation map and segment information of batch item
      let [segmentation, segments] = this.compute_segments(
        mask_probs_item,
        pred_scores_item,
        pred_labels_item,
        mask_threshold,
        overlap_mask_area_threshold,
        label_ids_to_fuse,
        target_size,
      );

      toReturn.push({
        segmentation: segmentation,
        segments_info: segments,
      });
    }

    return toReturn;
  }

  post_process_instance_segmentation() {
    // TODO
    throw Error("Not implemented yet");
  }
}

export class YolosFeatureExtractor extends ImageFeatureExtractor {
  /** @type {post_process_object_detection} */
  post_process_object_detection(...args) {
    return post_process_object_detection(...args);
  }
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
  reshape_input_points(input_points, original_sizes, reshaped_input_sizes) {
    // Make deep copy to avoid altering user's input
    input_points = structuredClone(input_points);
    let shape = calculateDimensions(input_points);

    // TODO: add support for 2D input_points
    if (shape.length === 3) {
      // Correct user's input
      shape = [1, ...shape];
      input_points = [input_points];
    } else if (shape.length !== 4) {
      throw Error(
        "The input_points must be a 4D tensor of shape `batch_size`, `point_batch_size`, `nb_points_per_image`, `2`.",
      );
    }

    // Reshape input points
    for (let i = 0; i < input_points.length; ++i) {
      // batch_size
      let originalImageSize = original_sizes[i];
      let reshapedImageSize = reshaped_input_sizes[i];

      let resizeFactors = [
        reshapedImageSize[0] / originalImageSize[0],
        reshapedImageSize[1] / originalImageSize[1],
      ];

      for (let j = 0; j < input_points[i].length; ++j) {
        // point_batch_size
        for (let k = 0; k < input_points[i][j].length; ++k) {
          // nb_points_per_image
          for (let w = 0; w < input_points[i][j][k].length; ++w) {
            // 2
            input_points[i][j][k][w] *= resizeFactors[w];
          }
        }
      }
    }

    return new Tensor(
      "float32",
      Float32Array.from(input_points.flat(Infinity)),
      shape,
    );
  }

  /**
   *
   * @param {any} input_labels
   * @param {Tensor} input_points
   * @returns {Tensor}
   */
  add_input_labels(input_labels, input_points) {
    let shape = calculateDimensions(input_labels);
    if (shape.length === 2) {
      // Correct user's input
      shape = [1, ...shape];
      input_labels = [input_labels];
    } else if (shape.length !== 3) {
      throw Error(
        "The input_points must be a 4D tensor of shape `batch_size`, `point_batch_size`, `nb_points_per_image`, `2`.",
      );
    }

    if (shape.some((x, i) => x !== input_points.dims[i])) {
      throw Error(
        `The first ${shape.length} dimensions of 'input_points' and 'input_labels' must be the same.`,
      );
    }
    return new Tensor("int64", input_labels.flat(Infinity).map(BigInt), shape);
  }
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
  async _call(images, input_points = null, input_labels = null) {
    // TODO allow user to use preprocessed images
    /** @type {SamImageProcessorResult} */
    const processed = await super._call(images);

    if (input_points) {
      processed.input_points = this.reshape_input_points(
        input_points,
        processed.original_sizes,
        processed.reshaped_input_sizes,
      );
    }

    if (input_labels) {
      if (!processed.input_points) {
        throw Error(
          "`input_points` must be provided if `input_labels` are provided.",
        );
      }
      processed.input_labels = this.add_input_labels(
        input_labels,
        processed.input_points,
      );
    }

    return processed;
  }

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
    masks,
    original_sizes,
    reshaped_input_sizes,
    { mask_threshold = 0.0, binarize = true, pad_size = null } = {},
  ) {
    // masks: [1, 1, 3, 256, 256]

    const output_masks = [];

    pad_size = pad_size ?? this.pad_size;

    const target_image_size = [pad_size.height, pad_size.width];

    for (let i = 0; i < original_sizes.length; ++i) {
      const original_size = original_sizes[i];
      const reshaped_input_size = reshaped_input_sizes[i];

      const mask = masks[i]; // [b, c, h, w]

      // TODO: improve
      const interpolated_masks = [];
      for (let j = 0; j < mask.dims[0]; ++j) {
        const m = mask[j]; // 3d tensor

        // Upscale mask to padded size
        let interpolated_mask = interpolate(
          m,
          target_image_size,
          "bilinear",
          false,
        );

        // Crop mask
        interpolated_mask = interpolated_mask.slice(
          null,
          [0, reshaped_input_size[0]],
          [0, reshaped_input_size[1]],
        );

        // Downscale mask
        interpolated_mask = interpolate(
          interpolated_mask,
          original_size,
          "bilinear",
          false,
        );

        if (binarize) {
          const binarizedMaskData = new Uint8Array(
            interpolated_mask.data.length,
          );
          for (let i = 0; i < interpolated_mask.data.length; ++i) {
            if (interpolated_mask.data[i] > mask_threshold) {
              binarizedMaskData[i] = 1;
            }
          }
          interpolated_mask = new Tensor(
            "bool",
            binarizedMaskData,
            interpolated_mask.dims,
          );
        }

        interpolated_masks.push(interpolated_mask);
      }

      output_masks.push(stack(interpolated_masks));
    }

    return output_masks;
  }
}

export class Swin2SRImageProcessor extends ImageFeatureExtractor {
  pad_image(pixelData, imgDims, padSize, options = {}) {
    // NOTE: In this case, `padSize` represents the size of the sliding window for the local attention.
    // In other words, the image is padded so that its width and height are multiples of `padSize`.
    const [imageWidth, imageHeight, imageChannels] = imgDims;

    return super.pad_image(
      pixelData,
      imgDims,
      {
        // NOTE: For Swin2SR models, the original python implementation adds padding even when the image's width/height is already
        // a multiple of `pad_size`. However, this is most likely a bug (PR: https://github.com/mv-lab/swin2sr/pull/19).
        // For this reason, we only add padding when the image's width/height is not a multiple of `pad_size`.
        width: imageWidth + ((padSize - (imageWidth % padSize)) % padSize),
        height: imageHeight + ((padSize - (imageHeight % padSize)) % padSize),
      },
      {
        mode: "symmetric",
        center: false,
        constant_values: -1,
        ...options,
      },
    );
  }
}

export class VitMatteImageProcessor extends ImageFeatureExtractor {
  /**
   * Calls the feature extraction process on an array of images, preprocesses
   * each image, and concatenates the resulting features into a single Tensor.
   * @param {RawImage[]} images The image(s) to extract features from.
   * @param {RawImage[]} trimaps The trimaps(s) to extract features from.
   * @returns {Promise<ImageFeatureExtractorResult>} An object containing the concatenated pixel values of the preprocessed images.
   */
  async _call(images, trimaps) {
    if (!Array.isArray(images)) {
      images = [images];
    }
    if (!Array.isArray(trimaps)) {
      trimaps = [trimaps];
    }

    const imageData = await Promise.all(images.map((x) => this.preprocess(x)));
    const trimapData = await Promise.all(
      trimaps.map((x) =>
        this.preprocess(x, {
          do_normalize: false,
          do_convert_rgb: false,
          do_convert_grayscale: true,
        }),
      ),
    );

    // Stack pixel values
    const pixel_values = stack(
      imageData.map(
        // Concatenate images and trimaps
        (x, i) => cat([x.pixel_values, trimapData[i].pixel_values], 0),
      ),
      0,
    );

    return {
      pixel_values: pixel_values,

      // Original sizes of images
      original_sizes: imageData.map((x) => x.original_size),

      // Reshaped sizes of images, before padding or cropping
      reshaped_input_sizes: imageData.map((x) => x.reshaped_input_size),
    };
  }
}

export class WhisperFeatureExtractor extends FeatureExtractor {
  constructor(config) {
    super(config);

    // Prefer given `mel_filters` from preprocessor_config.json, or calculate them if they don't exist.
    this.config.mel_filters ??= mel_filter_bank(
      Math.floor(1 + this.config.n_fft / 2), // num_frequency_bins
      this.config.feature_size, // num_mel_filters
      0.0, // min_frequency
      8000.0, // max_frequency
      this.config.sampling_rate, // sampling_rate
      "slaney", // norm
      "slaney", // mel_scale
    );

    this.window = window_function(this.config.n_fft, "hann");
  }

  /**
   * Computes the log-Mel spectrogram of the provided audio waveform.
   * @param {Float32Array|Float64Array} waveform The audio waveform to process.
   * @returns {{data: Float32Array, dims: number[]}} An object containing the log-Mel spectrogram data as a Float32Array and its dimensions as an array of numbers.
   */
  _extract_fbank_features(waveform) {
    const { data, dims } = spectrogram(
      waveform,
      this.window, // window
      this.config.n_fft, // frame_length
      this.config.hop_length, // hop_length
      {
        power: 2.0,
        mel_filters: this.config.mel_filters,
        log_mel: "log10",

        // Custom
        max_num_frames: this.config.nb_max_frames, // 3000
      },
    );

    const maxValue = max(data)[0];

    for (let i = 0; i < data.length; ++i) {
      data[i] = (Math.max(data[i], maxValue - 8.0) + 4.0) / 4.0;
    }

    return { data, dims };
  }

  /**
   * Asynchronously extracts features from a given audio using the provided configuration.
   * @param {Float32Array|Float64Array} audio The audio data as a Float32Array/Float64Array.
   * @returns {Promise<{ input_features: Tensor }>} A Promise resolving to an object containing the extracted input features as a Tensor.
   */
  async _call(audio) {
    validate_audio_inputs(audio, "WhisperFeatureExtractor");

    let waveform;
    if (audio.length > this.config.n_samples) {
      console.warn(
        "Attempting to extract features for audio longer than 30 seconds. " +
          "If using a pipeline to extract transcript from a long audio clip, " +
          "remember to specify `chunk_length_s` and/or `stride_length_s`.",
      );
      waveform = audio.slice(0, this.config.n_samples);
    } else {
      // pad with zeros
      waveform = new Float32Array(this.config.n_samples);
      waveform.set(audio);
    }

    const { data, dims } = this._extract_fbank_features(waveform);

    return {
      input_features: new Tensor("float32", data, [1, ...dims]),
    };
  }
}

export class Wav2Vec2FeatureExtractor extends FeatureExtractor {
  /**
   * @param {Float32Array} input_values
   * @returns {Float32Array}
   */
  _zero_mean_unit_var_norm(input_values) {
    // TODO support batch?
    const sum = input_values.reduce((a, b) => a + b, 0);
    const mean = sum / input_values.length;
    const variance =
      input_values.reduce((a, b) => a + (b - mean) ** 2, 0) /
      input_values.length;
    return input_values.map((x) => (x - mean) / Math.sqrt(variance + 1e-7));
  }

  /**
   * Asynchronously extracts features from a given audio using the provided configuration.
   * @param {Float32Array|Float64Array} audio The audio data as a Float32Array/Float64Array.
   * @returns {Promise<{ input_values: Tensor; attention_mask: Tensor }>} A Promise resolving to an object containing the extracted input features and attention mask as Tensors.
   */
  async _call(audio) {
    validate_audio_inputs(audio, "Wav2Vec2FeatureExtractor");

    if (audio instanceof Float64Array) {
      audio = new Float32Array(audio);
    }

    let input_values = audio;

    // zero-mean and unit-variance normalization
    if (this.config.do_normalize) {
      input_values = this._zero_mean_unit_var_norm(input_values);
    }

    // TODO: allow user to pass in attention mask
    const shape = [1, input_values.length];
    return {
      input_values: new Tensor("float32", input_values, shape),
      attention_mask: new Tensor(
        "int64",
        new BigInt64Array(input_values.length).fill(1n),
        shape,
      ),
    };
  }
}

export class ASTFeatureExtractor extends FeatureExtractor {
  constructor(config) {
    super(config);

    const sampling_rate = this.config.sampling_rate;
    const mel_filters = mel_filter_bank(
      256, // num_frequency_bins
      this.config.num_mel_bins, // num_mel_filters
      20, // min_frequency
      Math.floor(sampling_rate / 2), // max_frequency
      sampling_rate, // sampling_rate
      null, // norm
      "kaldi", // mel_scale
      true, // triangularize_in_mel_space
    );

    // Do padding:
    for (let i = 0; i < mel_filters.length; ++i) {
      mel_filters[i].push(0);
    }
    this.mel_filters = mel_filters;

    this.window = window_function(400, "hann", {
      periodic: false,
    });

    this.mean = this.config.mean;
    this.std = this.config.std;
  }

  /**
   * Computes the log-Mel spectrogram of the provided audio waveform.
   * @param {Float32Array|Float64Array} waveform The audio waveform to process.
   * @param {number} max_length The maximum number of frames to return.
   * @returns {{data: Float32Array, dims: number[]}} An object containing the log-Mel spectrogram data as a Float32Array and its dimensions as an array of numbers.
   */
  _extract_fbank_features(waveform, max_length) {
    // NOTE: We don't pad/truncate since that is passed in as `max_num_frames`
    return spectrogram(
      waveform,
      this.window, // window
      400, // frame_length
      160, // hop_length
      {
        fft_length: 512,
        power: 2.0,
        center: false,
        preemphasis: 0.97,
        mel_filters: this.mel_filters,
        log_mel: "log",
        mel_floor: 1.192092955078125e-7,
        remove_dc_offset: true,

        // Custom
        max_num_frames: max_length,
        transpose: true,
      },
    );
  }

  /**
   * Asynchronously extracts features from a given audio using the provided configuration.
   * @param {Float32Array|Float64Array} audio The audio data as a Float32Array/Float64Array.
   * @returns {Promise<{ input_values: Tensor }>} A Promise resolving to an object containing the extracted input features as a Tensor.
   */
  async _call(audio) {
    validate_audio_inputs(audio, "ASTFeatureExtractor");

    const features = this._extract_fbank_features(
      audio,
      this.config.max_length,
    );
    if (this.config.do_normalize) {
      // Normalize the input audio spectrogram to have mean=0, std=0.5
      const denom = this.std * 2;
      for (let i = 0; i < features.data.length; ++i) {
        features.data[i] = (features.data[i] - this.mean) / denom;
      }
    }

    return {
      input_values: new Tensor("float32", features.data, [1, ...features.dims]),
    };
  }
}

export class ClapFeatureExtractor extends FeatureExtractor {
  constructor(config) {
    super(config);

    this.mel_filters = mel_filter_bank(
      this.config.nb_frequency_bins, // num_frequency_bins
      this.config.feature_size, // num_mel_filters
      this.config.frequency_min, // min_frequency
      this.config.frequency_max, // max_frequency
      this.config.sampling_rate, // sampling_rate
      null, // norm
      "htk", // mel_scale
    );

    this.mel_filters_slaney = mel_filter_bank(
      this.config.nb_frequency_bins, // num_frequency_bins
      this.config.feature_size, // num_mel_filters
      this.config.frequency_min, // min_frequency
      this.config.frequency_max, // max_frequency
      this.config.sampling_rate, // sampling_rate
      "slaney", // norm
      "slaney", // mel_scale
    );

    this.window = window_function(this.config.fft_window_size, "hann");
  }

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
  _get_input_mel(waveform, max_length, truncation, padding) {
    /** @type {{ data: Float32Array; dims: number[]}} */
    let input_mel;
    let longer = false;
    const diff = waveform.length - max_length;
    if (diff > 0) {
      if (truncation === "rand_trunc") {
        longer = true;
        const idx = Math.floor(Math.random() * (diff + 1));
        waveform = waveform.subarray(idx, idx + max_length);

        input_mel = this._extract_fbank_features(
          waveform,
          this.mel_filters_slaney,
          this.config.nb_max_samples,
        );
        input_mel.dims = [1, ...input_mel.dims]; // "unsqueeze"
      } else {
        // TODO implement fusion strategy
        throw new Error(`Truncation strategy "${truncation}" not implemented`);
      }
    } else {
      if (diff < 0) {
        let padded = new Float64Array(max_length); // already padded with zeros
        padded.set(waveform);

        if (padding === "repeat") {
          for (let i = waveform.length; i < max_length; i += waveform.length) {
            padded.set(
              waveform.subarray(0, Math.min(waveform.length, max_length - i)),
              i,
            );
          }
        } else if (padding === "repeatpad") {
          for (let i = waveform.length; i < -diff; i += waveform.length) {
            padded.set(waveform, i);
          }
        }
        waveform = padded;
      }

      if (truncation === "fusion") {
        throw new Error(`Truncation strategy "${truncation}" not implemented`);
      }

      input_mel = this._extract_fbank_features(
        waveform,
        this.mel_filters_slaney,
        this.config.nb_max_samples,
      );
      input_mel.dims = [1, ...input_mel.dims]; // "unsqueeze"
    }

    return {
      ...input_mel,
      longer,
    };
  }

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
  _extract_fbank_features(waveform, mel_filters, max_length = null) {
    // NOTE: We don't pad/truncate since that is passed in as `max_num_frames`
    return spectrogram(
      waveform,
      this.window, // window
      this.config.fft_window_size, // frame_length
      this.config.hop_length, // hop_length
      {
        power: 2.0,
        mel_filters,
        log_mel: "dB",

        // Custom
        max_num_frames: max_length,
        do_pad: false,
        transpose: true,
      },
    );
  }

  /**
   * Asynchronously extracts features from a given audio using the provided configuration.
   * @param {Float32Array|Float64Array} audio The audio data as a Float32Array/Float64Array.
   * @returns {Promise<{ input_features: Tensor }>} A Promise resolving to an object containing the extracted input features as a Tensor.
   */
  async _call(audio, { max_length = null } = {}) {
    validate_audio_inputs(audio, "ClapFeatureExtractor");

    // convert to mel spectrogram, truncate and pad if needed.
    const padded_inputs = this._get_input_mel(
      audio,
      max_length ?? this.config.nb_max_samples,
      this.config.truncation,
      this.config.padding,
    );

    return {
      input_features: new Tensor("float32", padded_inputs.data, [
        1,
        ...padded_inputs.dims,
      ]),
    };
  }
}

export class SpeechT5FeatureExtractor extends FeatureExtractor {}

/**
 * Represents a Processor that extracts features from an input.
 * @extends Callable
 */
export class Processor extends Callable {
  /**
   * Creates a new Processor with the given feature extractor.
   * @param {FeatureExtractor} feature_extractor The function used to extract features from the input.
   */
  constructor(feature_extractor) {
    super();
    this.feature_extractor = feature_extractor;
    // TODO use tokenizer here?
  }

  /**
   * Calls the feature_extractor function with the given input.
   * @param {any} input The input to extract features from.
   * @param {...any} args Additional arguments.
   * @returns {Promise<any>} A Promise that resolves with the extracted features.
   */
  async _call(input, ...args) {
    return await this.feature_extractor(input, ...args);
  }
}

export class SamProcessor extends Processor {
  /**
   * @borrows SamImageProcessor#_call as _call
   */
  async _call(...args) {
    return await this.feature_extractor(...args);
  }

  /**
   * @borrows SamImageProcessor#post_process_masks as post_process_masks
   */
  post_process_masks(...args) {
    // @ts-ignore
    return this.feature_extractor.post_process_masks(...args);
  }
  /**
   * @borrows SamImageProcessor#reshape_input_points as reshape_input_points
   */
  reshape_input_points(...args) {
    // @ts-ignore
    return this.feature_extractor.reshape_input_points(...args);
  }
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
  async _call(audio) {
    return await this.feature_extractor(audio);
  }
}

export class Wav2Vec2ProcessorWithLM extends Processor {
  /**
   * Calls the feature_extractor function with the given audio input.
   * @param {any} audio The audio input to extract features from.
   * @returns {Promise<any>} A Promise that resolves with the extracted features.
   */
  async _call(audio) {
    return await this.feature_extractor(audio);
  }
}

export class SpeechT5Processor extends Processor {
  /**
   * Calls the feature_extractor function with the given input.
   * @param {any} input The input to extract features from.
   * @returns {Promise<any>} A Promise that resolves with the extracted features.
   */
  async _call(input) {
    return await this.feature_extractor(input);
  }
}

export class OwlViTProcessor extends Processor {}

//////////////////////////////////////////////////
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
  static FEATURE_EXTRACTOR_CLASS_MAPPING = {
    WhisperFeatureExtractor,
    ViTFeatureExtractor,
    MobileViTFeatureExtractor,
    OwlViTFeatureExtractor,
    CLIPFeatureExtractor,
    ChineseCLIPFeatureExtractor,
    SiglipImageProcessor,
    ConvNextFeatureExtractor,
    ConvNextImageProcessor,
    SegformerFeatureExtractor,
    BitImageProcessor,
    DPTFeatureExtractor,
    GLPNFeatureExtractor,
    BeitFeatureExtractor,
    DeiTFeatureExtractor,
    DetrFeatureExtractor,
    YolosFeatureExtractor,
    DonutFeatureExtractor,
    NougatImageProcessor,

    ViTImageProcessor,
    VitMatteImageProcessor,
    SamImageProcessor,
    Swin2SRImageProcessor,
    Wav2Vec2FeatureExtractor,
    SpeechT5FeatureExtractor,
    ASTFeatureExtractor,
    ClapFeatureExtractor,
  };

  static PROCESSOR_CLASS_MAPPING = {
    WhisperProcessor,
    Wav2Vec2ProcessorWithLM,
    SamProcessor,
    SpeechT5Processor,
    OwlViTProcessor,
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
    let preprocessorConfig =
      config ??
      (await getModelJSON(
        pretrained_model_name_or_path,
        "preprocessor_config.json",
        true,
        {
          progress_callback,
          config,
          cache_dir,
          local_files_only,
          revision,
        },
      ));

    // Determine feature extractor class
    // TODO: Ensure backwards compatibility with old configs
    let key =
      preprocessorConfig.feature_extractor_type ??
      preprocessorConfig.image_processor_type;
    let feature_extractor_class = this.FEATURE_EXTRACTOR_CLASS_MAPPING[key];

    if (!feature_extractor_class) {
      if (preprocessorConfig.size !== undefined) {
        // Assume ImageFeatureExtractor
        console.warn(
          `Feature extractor type "${key}" not found, assuming ImageFeatureExtractor due to size parameter in config.`,
        );
        feature_extractor_class = ImageFeatureExtractor;
      } else {
        throw new Error(`Unknown Feature Extractor type: ${key}`);
      }
    }

    // If no associated processor class, use default
    let processor_class =
      this.PROCESSOR_CLASS_MAPPING[preprocessorConfig.processor_class] ??
      Processor;

    // Instantiate processor and feature extractor
    let feature_extractor = new feature_extractor_class(preprocessorConfig);
    return new processor_class(feature_extractor);
  }
}
//////////////////////////////////////////////////
