/**
 * @file Helper module for image processing.
 *
 * These functions and classes are only used internally,
 * meaning an end-user shouldn't need to access anything here.
 *
 * @module utils/image
 */

import { getFile } from "./hub.js";
import { env } from "../env.js";

// Will be empty (or not used) if running in browser or web-worker
import sharp from "sharp";

const BROWSER_ENV = typeof self !== "undefined";
const WEBWORKER_ENV =
  BROWSER_ENV && self.constructor.name === "DedicatedWorkerGlobalScope";

let createCanvasFunction;
let ImageDataClass;
let loadImageFunction;
if (BROWSER_ENV) {
  // Running in browser or web-worker
  createCanvasFunction = (
    /** @type {number} */ width,
    /** @type {number} */ height,
  ) => {
    if (!self.OffscreenCanvas) {
      throw new Error("OffscreenCanvas not supported by this browser.");
    }
    return new self.OffscreenCanvas(width, height);
  };
  loadImageFunction = self.createImageBitmap;
  ImageDataClass = self.ImageData;
} else if (sharp) {
  // Running in Node.js, electron, or other non-browser environment

  loadImageFunction = async (/**@type {sharp.Sharp}*/ img) => {
    const metadata = await img.metadata();
    const rawChannels = metadata.channels;

    let { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

    const newImage = new RawImage(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      info.channels,
    );
    if (rawChannels !== undefined && rawChannels !== info.channels) {
      // Make sure the new image has the same number of channels as the input image.
      // This is necessary for grayscale images.
      newImage.convert(rawChannels);
    }
    return newImage;
  };
} else {
  throw new Error("Unable to load image processing library.");
}

// Defined here: https://github.com/python-pillow/Pillow/blob/a405e8406b83f8bfb8916e93971edc7407b8b1ff/src/libImaging/Imaging.h#L262-L268
const RESAMPLING_MAPPING = {
  0: "nearest",
  1: "lanczos",
  2: "bilinear",
  3: "bicubic",
  4: "box",
  5: "hamming",
};

/**
 * Mapping from file extensions to MIME types.
 */
const CONTENT_TYPE_MAP = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
]);

export class RawImage {
  /**
   * Create a new `RawImage` object.
   * @param {Uint8ClampedArray|Uint8Array} data The pixel data.
   * @param {number} width The width of the image.
   * @param {number} height The height of the image.
   * @param {1|2|3|4} channels The number of channels.
   */
  constructor(data, width, height, channels) {
    this.data = data;
    this.width = width;
    this.height = height;
    this.channels = channels;
  }

  /**
   * Returns the size of the image (width, height).
   * @returns {[number, number]} The size of the image (width, height).
   */
  get size() {
    return [this.width, this.height];
  }

  /**
   * Helper method for reading an image from a variety of input types.
   * @param {RawImage|string|URL} input
   * @returns The image object.
   *
   * **Example:** Read image from a URL.
   * ```javascript
   * let image = await RawImage.read('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/football-match.jpg');
   * // RawImage {
   * //   "data": Uint8ClampedArray [ 25, 25, 25, 19, 19, 19, ... ],
   * //   "width": 800,
   * //   "height": 533,
   * //   "channels": 3
   * // }
   * ```
   */
  static async read(input) {
    if (input instanceof RawImage) {
      return input;
    } else if (typeof input === "string" || input instanceof URL) {
      return await this.fromURL(input);
    } else {
      throw new Error(`Unsupported input type: ${typeof input}`);
    }
  }

  /**
   * Read an image from a URL or file path.
   * @param {string|URL} url The URL or file path to read the image from.
   * @returns {Promise<RawImage>} The image object.
   */
  static async fromURL(url) {
    let response = await getFile(url);
    if (response.status !== 200) {
      throw new Error(
        `Unable to read image from "${url}" (${response.status} ${response.statusText})`,
      );
    }
    let blob = await response.blob();
    return this.fromBlob(blob);
  }

  /**
   * Helper method to create a new Image from a blob.
   * @param {Blob} blob The blob to read the image from.
   * @returns {Promise<RawImage>} The image object.
   */
  static async fromBlob(blob) {
    if (BROWSER_ENV) {
      // Running in environment with canvas
      let img = await loadImageFunction(blob);

      const ctx = createCanvasFunction(img.width, img.height).getContext("2d");

      // Draw image to context
      ctx.drawImage(img, 0, 0);

      return new this(
        ctx.getImageData(0, 0, img.width, img.height).data,
        img.width,
        img.height,
        4,
      );
    } else {
      // Use sharp.js to read (and possible resize) the image.
      let img = sharp(await blob.arrayBuffer());

      return await loadImageFunction(img);
    }
  }

  /**
   * Helper method to create a new Image from a tensor
   * @param {import('./tensor.js').Tensor} tensor
   */
  static fromTensor(tensor, channel_format = "CHW") {
    if (tensor.dims.length !== 3) {
      throw new Error(
        `Tensor should have 3 dimensions, but has ${tensor.dims.length} dimensions.`,
      );
    }

    if (channel_format === "CHW") {
      tensor = tensor.transpose(1, 2, 0);
    } else if (channel_format === "HWC") {
      // Do nothing
    } else {
      throw new Error(`Unsupported channel format: ${channel_format}`);
    }
    if (
      !(
        tensor.data instanceof Uint8ClampedArray ||
        tensor.data instanceof Uint8Array
      )
    ) {
      throw new Error(`Unsupported tensor type: ${tensor.type}`);
    }
    switch (tensor.dims[2]) {
      case 1:
      case 2:
      case 3:
      case 4:
        return new RawImage(
          tensor.data,
          tensor.dims[1],
          tensor.dims[0],
          tensor.dims[2],
        );
      default:
        throw new Error(`Unsupported number of channels: ${tensor.dims[2]}`);
    }
  }

  /**
   * Convert the image to grayscale format.
   * @returns {RawImage} `this` to support chaining.
   */
  grayscale() {
    if (this.channels === 1) {
      return this;
    }

    let newData = new Uint8ClampedArray(this.width * this.height * 1);
    switch (this.channels) {
      case 3: // rgb to grayscale
      case 4: // rgba to grayscale
        for (let i = 0, offset = 0; i < this.data.length; i += this.channels) {
          const red = this.data[i];
          const green = this.data[i + 1];
          const blue = this.data[i + 2];

          newData[offset++] = Math.round(
            0.2989 * red + 0.587 * green + 0.114 * blue,
          );
        }
        break;
      default:
        throw new Error(
          `Conversion failed due to unsupported number of channels: ${this.channels}`,
        );
    }
    return this._update(newData, this.width, this.height, 1);
  }

  /**
   * Convert the image to RGB format.
   * @returns {RawImage} `this` to support chaining.
   */
  rgb() {
    if (this.channels === 3) {
      return this;
    }

    let newData = new Uint8ClampedArray(this.width * this.height * 3);

    switch (this.channels) {
      case 1: // grayscale to rgb
        for (let i = 0, offset = 0; i < this.data.length; ++i) {
          newData[offset++] = this.data[i];
          newData[offset++] = this.data[i];
          newData[offset++] = this.data[i];
        }
        break;
      case 4: // rgba to rgb
        for (let i = 0, offset = 0; i < this.data.length; i += 4) {
          newData[offset++] = this.data[i];
          newData[offset++] = this.data[i + 1];
          newData[offset++] = this.data[i + 2];
        }
        break;
      default:
        throw new Error(
          `Conversion failed due to unsupported number of channels: ${this.channels}`,
        );
    }
    return this._update(newData, this.width, this.height, 3);
  }

  /**
   * Convert the image to RGBA format.
   * @returns {RawImage} `this` to support chaining.
   */
  rgba() {
    if (this.channels === 4) {
      return this;
    }

    let newData = new Uint8ClampedArray(this.width * this.height * 4);

    switch (this.channels) {
      case 1: // grayscale to rgba
        for (let i = 0, offset = 0; i < this.data.length; ++i) {
          newData[offset++] = this.data[i];
          newData[offset++] = this.data[i];
          newData[offset++] = this.data[i];
          newData[offset++] = 255;
        }
        break;
      case 3: // rgb to rgba
        for (let i = 0, offset = 0; i < this.data.length; i += 3) {
          newData[offset++] = this.data[i];
          newData[offset++] = this.data[i + 1];
          newData[offset++] = this.data[i + 2];
          newData[offset++] = 255;
        }
        break;
      default:
        throw new Error(
          `Conversion failed due to unsupported number of channels: ${this.channels}`,
        );
    }

    return this._update(newData, this.width, this.height, 4);
  }

  /**
   * Resize the image to the given dimensions. This method uses the canvas API to perform the resizing.
   * @param {number} width The width of the new image.
   * @param {number} height The height of the new image.
   * @param {Object} options Additional options for resizing.
   * @param {0|1|2|3|4|5|string} [options.resample] The resampling method to use.
   * @returns {Promise<RawImage>} `this` to support chaining.
   */
  async resize(width, height, { resample = 2 } = {}) {
    // Ensure resample method is a string
    let resampleMethod = RESAMPLING_MAPPING[resample] ?? resample;

    if (BROWSER_ENV) {
      // TODO use `resample` in browser environment

      // Store number of channels before resizing
      let numChannels = this.channels;

      // Create canvas object for this image
      let canvas = this.toCanvas();

      // Actually perform resizing using the canvas API
      const ctx = createCanvasFunction(width, height).getContext("2d");

      // Draw image to context, resizing in the process
      ctx.drawImage(canvas, 0, 0, width, height);

      // Create image from the resized data
      let resizedImage = new RawImage(
        ctx.getImageData(0, 0, width, height).data,
        width,
        height,
        4,
      );

      // Convert back so that image has the same number of channels as before
      return resizedImage.convert(numChannels);
    } else {
      // Create sharp image from raw data, and resize
      let img = this.toSharp();

      switch (resampleMethod) {
        case "box":
        case "hamming":
          if (resampleMethod === "box" || resampleMethod === "hamming") {
            console.warn(
              `Resampling method ${resampleMethod} is not yet supported. Using bilinear instead.`,
            );
            resampleMethod = "bilinear";
          }

        case "nearest":
        case "bilinear":
        case "bicubic":
          // Perform resizing using affine transform.
          // This matches how the python Pillow library does it.
          img = img.affine([width / this.width, 0, 0, height / this.height], {
            interpolator: resampleMethod,
          });
          break;

        case "lanczos":
          // https://github.com/python-pillow/Pillow/discussions/5519
          // https://github.com/lovell/sharp/blob/main/docs/api-resize.md
          img = img.resize({
            width,
            height,
            fit: "fill",
            kernel: "lanczos3", // PIL Lanczos uses a kernel size of 3
          });
          break;

        default:
          throw new Error(
            `Resampling method ${resampleMethod} is not supported.`,
          );
      }

      return await loadImageFunction(img);
    }
  }

  async pad([left, right, top, bottom]) {
    left = Math.max(left, 0);
    right = Math.max(right, 0);
    top = Math.max(top, 0);
    bottom = Math.max(bottom, 0);

    if (left === 0 && right === 0 && top === 0 && bottom === 0) {
      // No padding needed
      return this;
    }

    if (BROWSER_ENV) {
      // Store number of channels before padding
      let numChannels = this.channels;

      // Create canvas object for this image
      let canvas = this.toCanvas();

      let newWidth = this.width + left + right;
      let newHeight = this.height + top + bottom;

      // Create a new canvas of the desired size.
      const ctx = createCanvasFunction(newWidth, newHeight).getContext("2d");

      // Draw image to context, padding in the process
      ctx.drawImage(
        canvas,
        0,
        0,
        this.width,
        this.height,
        left,
        top,
        newWidth,
        newHeight,
      );

      // Create image from the padded data
      let paddedImage = new RawImage(
        ctx.getImageData(0, 0, newWidth, newHeight).data,
        newWidth,
        newHeight,
        4,
      );

      // Convert back so that image has the same number of channels as before
      return paddedImage.convert(numChannels);
    } else {
      let img = this.toSharp().extend({ left, right, top, bottom });
      return await loadImageFunction(img);
    }
  }

  async crop([x_min, y_min, x_max, y_max]) {
    // Ensure crop bounds are within the image
    x_min = Math.max(x_min, 0);
    y_min = Math.max(y_min, 0);
    x_max = Math.min(x_max, this.width - 1);
    y_max = Math.min(y_max, this.height - 1);

    // Do nothing if the crop is the entire image
    if (
      x_min === 0 &&
      y_min === 0 &&
      x_max === this.width - 1 &&
      y_max === this.height - 1
    ) {
      return this;
    }

    const crop_width = x_max - x_min + 1;
    const crop_height = y_max - y_min + 1;

    if (BROWSER_ENV) {
      // Store number of channels before resizing
      const numChannels = this.channels;

      // Create canvas object for this image
      const canvas = this.toCanvas();

      // Create a new canvas of the desired size. This is needed since if the
      // image is too small, we need to pad it with black pixels.
      const ctx = createCanvasFunction(crop_width, crop_height).getContext(
        "2d",
      );

      // Draw image to context, cropping in the process
      ctx.drawImage(
        canvas,
        x_min,
        y_min,
        crop_width,
        crop_height,
        0,
        0,
        crop_width,
        crop_height,
      );

      // Create image from the resized data
      const resizedImage = new RawImage(
        ctx.getImageData(0, 0, crop_width, crop_height).data,
        crop_width,
        crop_height,
        4,
      );

      // Convert back so that image has the same number of channels as before
      return resizedImage.convert(numChannels);
    } else {
      // Create sharp image from raw data
      const img = this.toSharp().extract({
        left: x_min,
        top: y_min,
        width: crop_width,
        height: crop_height,
      });

      return await loadImageFunction(img);
    }
  }

  async center_crop(crop_width, crop_height) {
    // If the image is already the desired size, return it
    if (this.width === crop_width && this.height === crop_height) {
      return this;
    }

    // Determine bounds of the image in the new canvas
    let width_offset = (this.width - crop_width) / 2;
    let height_offset = (this.height - crop_height) / 2;

    if (BROWSER_ENV) {
      // Store number of channels before resizing
      let numChannels = this.channels;

      // Create canvas object for this image
      let canvas = this.toCanvas();

      // Create a new canvas of the desired size. This is needed since if the
      // image is too small, we need to pad it with black pixels.
      const ctx = createCanvasFunction(crop_width, crop_height).getContext(
        "2d",
      );

      let sourceX = 0;
      let sourceY = 0;
      let destX = 0;
      let destY = 0;

      if (width_offset >= 0) {
        sourceX = width_offset;
      } else {
        destX = -width_offset;
      }

      if (height_offset >= 0) {
        sourceY = height_offset;
      } else {
        destY = -height_offset;
      }

      // Draw image to context, cropping in the process
      ctx.drawImage(
        canvas,
        sourceX,
        sourceY,
        crop_width,
        crop_height,
        destX,
        destY,
        crop_width,
        crop_height,
      );

      // Create image from the resized data
      let resizedImage = new RawImage(
        ctx.getImageData(0, 0, crop_width, crop_height).data,
        crop_width,
        crop_height,
        4,
      );

      // Convert back so that image has the same number of channels as before
      return resizedImage.convert(numChannels);
    } else {
      // Create sharp image from raw data
      let img = this.toSharp();

      if (width_offset >= 0 && height_offset >= 0) {
        // Cropped image lies entirely within the original image
        img = img.extract({
          left: Math.floor(width_offset),
          top: Math.floor(height_offset),
          width: crop_width,
          height: crop_height,
        });
      } else if (width_offset <= 0 && height_offset <= 0) {
        // Cropped image lies entirely outside the original image,
        // so we add padding
        let top = Math.floor(-height_offset);
        let left = Math.floor(-width_offset);
        img = img.extend({
          top: top,
          left: left,

          // Ensures the resulting image has the desired dimensions
          right: crop_width - this.width - left,
          bottom: crop_height - this.height - top,
        });
      } else {
        // Cropped image lies partially outside the original image.
        // We first pad, then crop.

        let y_padding = [0, 0];
        let y_extract = 0;
        if (height_offset < 0) {
          y_padding[0] = Math.floor(-height_offset);
          y_padding[1] = crop_height - this.height - y_padding[0];
        } else {
          y_extract = Math.floor(height_offset);
        }

        let x_padding = [0, 0];
        let x_extract = 0;
        if (width_offset < 0) {
          x_padding[0] = Math.floor(-width_offset);
          x_padding[1] = crop_width - this.width - x_padding[0];
        } else {
          x_extract = Math.floor(width_offset);
        }

        img = img
          .extend({
            top: y_padding[0],
            bottom: y_padding[1],
            left: x_padding[0],
            right: x_padding[1],
          })
          .extract({
            left: x_extract,
            top: y_extract,
            width: crop_width,
            height: crop_height,
          });
      }

      return await loadImageFunction(img);
    }
  }

  async toBlob(type = "image/png", quality = 1) {
    if (!BROWSER_ENV) {
      throw new Error("toBlob() is only supported in browser environments.");
    }

    const canvas = this.toCanvas();
    return await canvas.convertToBlob({ type, quality });
  }

  toCanvas() {
    if (!BROWSER_ENV) {
      throw new Error("toCanvas() is only supported in browser environments.");
    }

    // Clone, and convert data to RGBA before drawing to canvas.
    // This is because the canvas API only supports RGBA
    let cloned = this.clone().rgba();

    // Create canvas object for the cloned image
    let clonedCanvas = createCanvasFunction(cloned.width, cloned.height);

    // Draw image to context
    let data = new ImageDataClass(cloned.data, cloned.width, cloned.height);
    clonedCanvas.getContext("2d").putImageData(data, 0, 0);

    return clonedCanvas;
  }

  /**
   * Helper method to update the image data.
   * @param {Uint8ClampedArray} data The new image data.
   * @param {number} width The new width of the image.
   * @param {number} height The new height of the image.
   * @param {1|2|3|4|null} [channels] The new number of channels of the image.
   * @private
   */
  _update(data, width, height, channels = null) {
    this.data = data;
    this.width = width;
    this.height = height;
    if (channels !== null) {
      this.channels = channels;
    }
    return this;
  }

  /**
   * Clone the image
   * @returns {RawImage} The cloned image
   */
  clone() {
    return new RawImage(
      this.data.slice(),
      this.width,
      this.height,
      this.channels,
    );
  }

  /**
   * Helper method for converting image to have a certain number of channels
   * @param {number} numChannels The number of channels. Must be 1, 3, or 4.
   * @returns {RawImage} `this` to support chaining.
   */
  convert(numChannels) {
    if (this.channels === numChannels) return this; // Already correct number of channels

    switch (numChannels) {
      case 1:
        this.grayscale();
        break;
      case 3:
        this.rgb();
        break;
      case 4:
        this.rgba();
        break;
      default:
        throw new Error(
          `Conversion failed due to unsupported number of channels: ${this.channels}`,
        );
    }
    return this;
  }

  /**
   * Save the image to the given path.
   * @param {string} path The path to save the image to.
   */
  async save(path) {
    if (BROWSER_ENV) {
      if (WEBWORKER_ENV) {
        throw new Error("Unable to save an image from a Web Worker.");
      }

      const extension = path.split(".").pop().toLowerCase();
      const mime = CONTENT_TYPE_MAP.get(extension) ?? "image/png";

      // Convert image to Blob
      const blob = await this.toBlob(mime);

      // Convert the canvas content to a data URL
      const dataURL = URL.createObjectURL(blob);

      // Create an anchor element with the data URL as the href attribute
      const downloadLink = document.createElement("a");
      downloadLink.href = dataURL;

      // Set the download attribute to specify the desired filename for the downloaded image
      downloadLink.download = path;

      // Trigger the download
      downloadLink.click();

      // Clean up: remove the anchor element from the DOM
      downloadLink.remove();
    } else if (!env.useFS) {
      throw new Error(
        "Unable to save the image because filesystem is disabled in this environment.",
      );
    } else {
      const img = this.toSharp();
      return await img.toFile(path);
    }
  }

  toSharp() {
    if (BROWSER_ENV) {
      throw new Error(
        "toSharp() is only supported in server-side environments.",
      );
    }

    return sharp(this.data, {
      raw: {
        width: this.width,
        height: this.height,
        channels: this.channels,
      },
    });
  }
}
