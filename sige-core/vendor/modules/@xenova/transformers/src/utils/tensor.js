/**
 * @file Helper module for `Tensor` processing.
 *
 * These functions and classes are only used internally,
 * meaning an end-user shouldn't need to access anything here.
 *
 * @module utils/tensor
 */

import { ONNX } from "../backends/onnx.js";

import { interpolate_data, transpose_data } from "./maths.js";

const DataTypeMap = Object.freeze({
  float32: Float32Array,
  float64: Float64Array,
  string: Array, // string[]
  int8: Int8Array,
  uint8: Uint8Array,
  int16: Int16Array,
  uint16: Uint16Array,
  int32: Int32Array,
  uint32: Uint32Array,
  int64: BigInt64Array,
  uint64: BigUint64Array,
  bool: Uint8Array,
});

/**
 * @typedef {keyof typeof DataTypeMap} DataType
 * @typedef {import('./maths.js').AnyTypedArray | any[]} DataArray
 */

const ONNXTensor = ONNX.Tensor;

export class Tensor {
  /** @type {number[]} Dimensions of the tensor. */
  dims;

  /** @type {DataType} Type of the tensor. */
  type;

  /** @type {DataArray} The data stored in the tensor. */
  data;

  /** @type {number} The number of elements in the tensor. */
  size;

  /**
   * Create a new Tensor or copy an existing Tensor.
   * @param {[DataType, DataArray, number[]]|[import('onnxruntime-common').Tensor]} args
   */
  constructor(...args) {
    if (args[0] instanceof ONNXTensor) {
      // Create shallow copy
      Object.assign(this, args[0]);
    } else {
      // Create new tensor
      Object.assign(
        this,
        new ONNXTensor(
          /** @type {DataType} */ (args[0]),
          /** @type {Exclude<import('./maths.js').AnyTypedArray, Uint8ClampedArray>} */ (
            args[1]
          ),
          args[2],
        ),
      );
    }

    return new Proxy(this, {
      get: (obj, key) => {
        if (typeof key === "string") {
          let index = Number(key);
          if (Number.isInteger(index)) {
            // key is an integer (i.e., index)
            return obj._getitem(index);
          }
        }
        // @ts-ignore
        return obj[key];
      },
      set: (obj, key, value) => {
        // TODO allow setting of data

        // @ts-ignore
        return (obj[key] = value);
      },
    });
  }

  /**
   * Returns an iterator object for iterating over the tensor data in row-major order.
   * If the tensor has more than one dimension, the iterator will yield subarrays.
   * @returns {Iterator} An iterator object for iterating over the tensor data in row-major order.
   */
  *[Symbol.iterator]() {
    const [iterLength, ...iterDims] = this.dims;

    if (iterDims.length > 0) {
      const iterSize = iterDims.reduce((a, b) => a * b);
      for (let i = 0; i < iterLength; ++i) {
        yield this._subarray(i, iterSize, iterDims);
      }
    } else {
      yield* this.data;
    }
  }

  /**
   * Index into a Tensor object.
   * @param {number} index The index to access.
   * @returns {Tensor} The data at the specified index.
   */
  _getitem(index) {
    const [iterLength, ...iterDims] = this.dims;

    index = safeIndex(index, iterLength);

    if (iterDims.length > 0) {
      const iterSize = iterDims.reduce((a, b) => a * b);
      return this._subarray(index, iterSize, iterDims);
    } else {
      return new Tensor(this.type, [this.data[index]], iterDims);
    }
  }

  /**
   * @param {number|bigint} item The item to search for in the tensor
   * @returns {number} The index of the first occurrence of item in the tensor data.
   */
  indexOf(item) {
    for (let index = 0; index < this.data.length; ++index) {
      // Note: == instead of === so we can match Ints with BigInts
      if (this.data[index] == item) {
        return index;
      }
    }
    return -1;
  }

  /**
   * @param {number} index
   * @param {number} iterSize
   * @param {any} iterDims
   * @returns {Tensor}
   */
  _subarray(index, iterSize, iterDims) {
    const o1 = index * iterSize;
    const o2 = (index + 1) * iterSize;

    // We use subarray if available (typed array), otherwise we use slice (normal array)
    const data =
      "subarray" in this.data
        ? this.data.subarray(o1, o2)
        : this.data.slice(o1, o2);
    return new Tensor(this.type, data, iterDims);
  }

  /**
   * Returns the value of this tensor as a standard JavaScript Number. This only works
   * for tensors with one element. For other cases, see `Tensor.tolist()`.
   * @returns {number|bigint} The value of this tensor as a standard JavaScript Number.
   * @throws {Error} If the tensor has more than one element.
   */
  item() {
    if (this.data.length !== 1) {
      throw new Error(
        `a Tensor with ${this.data.length} elements cannot be converted to Scalar`,
      );
    }
    return this.data[0];
  }

  /**
   * Convert tensor data to a n-dimensional JS list
   * @returns {Array}
   */
  tolist() {
    return reshape(this.data, this.dims);
  }

  /**
   * Return a new Tensor with the sigmoid function applied to each element.
   * @returns {Tensor} The tensor with the sigmoid function applied.
   */
  sigmoid() {
    return this.clone().sigmoid_();
  }

  /**
   * Applies the sigmoid function to the tensor in place.
   * @returns {Tensor} Returns `this`.
   */
  sigmoid_() {
    for (let i = 0; i < this.data.length; ++i) {
      this.data[i] = 1 / (1 + Math.exp(-this.data[i]));
    }
    return this;
  }

  /**
   * Return a new Tensor with every element multiplied by a constant.
   * @param {number} val The value to multiply by.
   * @returns {Tensor} The new tensor.
   */
  mul(val) {
    return this.clone().mul_(val);
  }

  /**
   * Multiply the tensor by a constant in place.
   * @param {number} val The value to multiply by.
   * @returns {Tensor} Returns `this`.
   */
  mul_(val) {
    for (let i = 0; i < this.data.length; ++i) {
      this.data[i] *= val;
    }
    return this;
  }

  /**
   * Return a new Tensor with every element added by a constant.
   * @param {number} val The value to add by.
   * @returns {Tensor} The new tensor.
   */
  add(val) {
    return this.clone().add_(val);
  }

  /**
   * Add the tensor by a constant in place.
   * @param {number} val The value to add by.
   * @returns {Tensor} Returns `this`.
   */
  add_(val) {
    for (let i = 0; i < this.data.length; ++i) {
      this.data[i] += val;
    }
    return this;
  }
  clone() {
    return new Tensor(this.type, this.data.slice(), this.dims.slice());
  }

  slice(...slices) {
    // This allows for slicing with ranges and numbers
    let newTensorDims = [];
    let newOffsets = [];

    // slices is an array of numbers or arrays of numbers
    // e.g., slices = [0, [1, 3], null, [0, 3]]
    for (let sliceIndex = 0; sliceIndex < this.dims.length; ++sliceIndex) {
      let slice = slices[sliceIndex];

      if (slice === null || slice === undefined) {
        // null or undefined means take the whole dimension
        newOffsets.push([0, this.dims[sliceIndex]]);
        newTensorDims.push(this.dims[sliceIndex]);
      } else if (typeof slice === "number") {
        slice = safeIndex(slice, this.dims[sliceIndex], sliceIndex);

        // A number means take a single element
        newOffsets.push([slice, slice + 1]);
      } else if (Array.isArray(slice) && slice.length === 2) {
        // An array of length 2 means take a range of elements

        if (slice[0] > slice[1]) {
          throw new Error(`Invalid slice: ${slice}`);
        }

        let offsets = [
          Math.max(slice[0], 0),
          Math.min(slice[1], this.dims[sliceIndex]),
        ];

        newOffsets.push(offsets);
        newTensorDims.push(offsets[1] - offsets[0]);
      } else {
        throw new Error(`Invalid slice: ${slice}`);
      }
    }

    let newDims = newOffsets.map(([start, end]) => end - start);
    let newBufferSize = newDims.reduce((a, b) => a * b);

    // Allocate memory
    // @ts-ignore
    let data = new this.data.constructor(newBufferSize);

    // Precompute strides
    const stride = this.stride();

    for (let i = 0; i < newBufferSize; ++i) {
      let originalIndex = 0;
      for (let j = newDims.length - 1, num = i; j >= 0; --j) {
        const size = newDims[j];
        originalIndex += ((num % size) + newOffsets[j][0]) * stride[j];
        num = Math.floor(num / size);
      }
      data[i] = this.data[originalIndex];
    }
    return new Tensor(this.type, data, newTensorDims);
  }

  /**
   * Return a transposed version of this Tensor, according to the provided dimensions.
   * @param  {...number} dims Dimensions to transpose.
   * @returns {Tensor} The transposed tensor.
   */
  transpose(...dims) {
    return transpose(this, dims);
  }

  // TODO: rename transpose to permute
  // TODO: implement transpose

  // TODO add .max() and .min() methods

  /**
   * Returns the sum of each row of the input tensor in the given dimension dim.
   *
   * @param {number} [dim=null] The dimension or dimensions to reduce. If `null`, all dimensions are reduced.
   * @param {boolean} keepdim Whether the output tensor has `dim` retained or not.
   * @returns The summed tensor
   */
  sum(dim = null, keepdim = false) {
    return this.norm(1, dim, keepdim);
  }

  /**
   * Returns the matrix norm or vector norm of a given tensor.
   * @param {number|string} [p='fro'] The order of norm
   * @param {number} [dim=null] Specifies which dimension of the tensor to calculate the norm across.
   * If dim is None, the norm will be calculated across all dimensions of input.
   * @param {boolean} [keepdim=false] Whether the output tensors have dim retained or not.
   * @returns {Tensor} The norm of the tensor.
   */
  norm(p = "fro", dim = null, keepdim = false) {
    if (p === "fro") {
      // NOTE: Since we only support integer dims, Frobenius norm produces the same result as p=2.
      p = 2;
    } else if (typeof p === "string") {
      throw Error(`Unsupported norm: ${p}`);
    }

    if (dim === null) {
      // @ts-ignore
      let val = this.data.reduce((a, b) => a + b ** p, 0) ** (1 / p);
      return new Tensor(this.type, [val], []);
    }

    // Negative indexing
    dim = safeIndex(dim, this.dims.length);

    // Calculate the shape of the resulting array after summation
    const resultDims = this.dims.slice(); // Copy the original dimensions
    resultDims[dim] = 1; // Remove the specified axis

    // Create a new array to store the accumulated values
    // @ts-ignore
    const result = new this.data.constructor(this.data.length / this.dims[dim]);

    // Iterate over the data array
    for (let i = 0; i < this.data.length; ++i) {
      // Calculate the index in the resulting array
      let resultIndex = 0;

      for (
        let j = this.dims.length - 1, num = i, resultMultiplier = 1;
        j >= 0;
        --j
      ) {
        const size = this.dims[j];
        if (j !== dim) {
          const index = num % size;
          resultIndex += index * resultMultiplier;
          resultMultiplier *= resultDims[j];
        }
        num = Math.floor(num / size);
      }

      // Accumulate the value at the current index
      result[resultIndex] += this.data[i] ** p;
    }

    if (p !== 1) {
      for (let i = 0; i < result.length; ++i) {
        result[i] = result[i] ** (1 / p);
      }
    }

    if (!keepdim) {
      resultDims.splice(dim, 1);
    }

    return new Tensor(this.type, result, resultDims);
  }

  /**
   * Performs `L_p` normalization of inputs over specified dimension. Operates in place.
   * @param {number} [p=2] The exponent value in the norm formulation
   * @param {number} [dim=1] The dimension to reduce
   * @returns {Tensor} `this` for operation chaining.
   */
  normalize_(p = 2.0, dim = 1) {
    dim = safeIndex(dim, this.dims.length);

    const norm = this.norm(p, dim, true);

    for (let i = 0; i < this.data.length; ++i) {
      // Calculate the index in the resulting array
      let resultIndex = 0;

      for (
        let j = this.dims.length - 1, num = i, resultMultiplier = 1;
        j >= 0;
        --j
      ) {
        const size = this.dims[j];
        if (j !== dim) {
          const index = num % size;
          resultIndex += index * resultMultiplier;
          resultMultiplier *= this.dims[j];
        }
        num = Math.floor(num / size);
      }

      // Divide by normalized value
      this.data[i] /= norm.data[resultIndex];
    }

    return this;
  }

  /**
   * Performs `L_p` normalization of inputs over specified dimension.
   * @param {number} [p=2] The exponent value in the norm formulation
   * @param {number} [dim=1] The dimension to reduce
   * @returns {Tensor} The normalized tensor.
   */
  normalize(p = 2.0, dim = 1) {
    return this.clone().normalize_(p, dim);
  }

  /**
   * Compute and return the stride of this tensor.
   * Stride is the jump necessary to go from one element to the next one in the specified dimension dim.
   * @returns {number[]} The stride of this tensor.
   */
  stride() {
    return dimsToStride(this.dims);
  }

  /**
   * Returns a tensor with all specified dimensions of input of size 1 removed.
   *
   * NOTE: The returned tensor shares the storage with the input tensor, so changing the contents of one will change the contents of the other.
   * If you would like a copy, use `tensor.clone()` before squeezing.
   *
   * @param {number} [dim=null] If given, the input will be squeezed only in the specified dimensions.
   * @returns The squeezed tensor
   */
  squeeze(dim = null) {
    return new Tensor(this.type, this.data, calc_squeeze_dims(this.dims, dim));
  }

  /**
   * In-place version of @see {@link Tensor.squeeze}
   */
  squeeze_(dim = null) {
    this.dims = calc_squeeze_dims(this.dims, dim);
    return this;
  }

  /**
   * Returns a new tensor with a dimension of size one inserted at the specified position.
   *
   * NOTE: The returned tensor shares the same underlying data with this tensor.
   *
   * @param {number} dim The index at which to insert the singleton dimension
   * @returns The unsqueezed tensor
   */
  unsqueeze(dim = null) {
    return new Tensor(
      this.type,
      this.data,
      calc_unsqueeze_dims(this.dims, dim),
    );
  }

  /**
   * In-place version of @see {@link Tensor.unsqueeze}
   */
  unsqueeze_(dim = null) {
    this.dims = calc_unsqueeze_dims(this.dims, dim);
    return this;
  }

  /**
   * In-place version of @see {@link Tensor.flatten}
   */
  flatten_(start_dim = 0, end_dim = -1) {
    // TODO validate inputs
    end_dim = (end_dim + this.dims.length) % this.dims.length;

    let dimsToKeepBefore = this.dims.slice(0, start_dim);
    let dimsToFlatten = this.dims.slice(start_dim, end_dim + 1);
    let dimsToKeepAfter = this.dims.slice(end_dim + 1);

    this.dims = [
      ...dimsToKeepBefore,
      dimsToFlatten.reduce((a, b) => a * b, 1),
      ...dimsToKeepAfter,
    ];
    return this;
  }

  /**
   * Flattens input by reshaping it into a one-dimensional tensor.
   * If `start_dim` or `end_dim` are passed, only dimensions starting with `start_dim`
   * and ending with `end_dim` are flattened. The order of elements in input is unchanged.
   * @param {number} start_dim the first dim to flatten
   * @param {number} end_dim the last dim to flatten
   * @returns The flattened tensor.
   */
  flatten(start_dim = 0, end_dim = -1) {
    return this.clone().flatten_(start_dim, end_dim);
  }

  /**
   * Returns a new tensor with the same data as the `self` tensor but of a different `shape`.
   * @param  {...number} dims the desired size
   * @returns {Tensor} The tensor with the same data but different shape
   */
  view(...dims) {
    // TODO: validate dims
    let inferredIndex = -1;
    for (let i = 0; i < dims.length; ++i) {
      if (dims[i] === -1) {
        if (inferredIndex !== -1) {
          throw new Error("Only one dimension can be inferred");
        }
        inferredIndex = i;
      }
    }

    if (inferredIndex !== -1) {
      // Some dimension must be inferred
      const productOther = dims.reduce((product, curr, index) => {
        return index !== inferredIndex ? product * curr : product;
      }, 1);

      dims[inferredIndex] = this.data.length / productOther;
    }
    return new Tensor(this.type, this.data, dims); // NOTE: uses same underlying storage
  }

  neg_() {
    for (let i = 0; i < this.data.length; ++i) {
      this.data[i] = -this.data[i];
    }
    return this;
  }
  neg() {
    return this.clone().neg_();
  }

  /**
   * In-place version of @see {@link Tensor.clamp}
   */
  clamp_(min, max) {
    for (let i = 0; i < this.data.length; ++i) {
      this.data[i] = Math.min(Math.max(this.data[i], min), max);
    }
    return this;
  }

  /**
   * Clamps all elements in input into the range [ min, max ]
   * @param {number} min lower-bound of the range to be clamped to
   * @param {number} max upper-bound of the range to be clamped to
   * @returns the output tensor.
   */
  clamp(min, max) {
    return this.clone().clamp_(min, max);
  }

  /**
   * In-place version of @see {@link Tensor.round}
   */
  round_() {
    for (let i = 0; i < this.data.length; ++i) {
      this.data[i] = Math.round(this.data[i]);
    }
    return this;
  }

  /**
   * Rounds elements of input to the nearest integer.
   * @returns the output tensor.
   */
  round() {
    return this.clone().round_();
  }

  /**
   * Performs Tensor dtype conversion.
   * @param {DataType} type The desired data type.
   * @returns {Tensor} The converted tensor.
   */
  to(type) {
    // If the self Tensor already has the correct dtype, then self is returned.
    if (this.type === type) return this;

    // Otherwise, the returned tensor is a copy of self with the desired dtype.
    if (!DataTypeMap.hasOwnProperty(type)) {
      throw new Error(`Unsupported type: ${type}`);
    }
    // @ts-ignore
    return new Tensor(type, DataTypeMap[type].from(this.data), this.dims);
  }
}

/**
 * This creates a nested array of a given type and depth (see examples).
 *
 * @example
 *   NestArray<string, 1>; // string[]
 * @example
 *   NestArray<number, 2>; // number[][]
 * @example
 *   NestArray<string, 3>; // string[][][] etc.
 * @template T
 * @template {number} Depth
 * @template {never[]} [Acc=[]]
 * @typedef {Acc['length'] extends Depth ? T : NestArray<T[], Depth, [...Acc, never]>} NestArray
 */

/**
 * Reshapes a 1-dimensional array into an n-dimensional array, according to the provided dimensions.
 *
 * @example
 *   reshape([10                    ], [1      ]); // Type: number[]      Value: [10]
 *   reshape([1, 2, 3, 4            ], [2, 2   ]); // Type: number[][]    Value: [[1, 2], [3, 4]]
 *   reshape([1, 2, 3, 4, 5, 6, 7, 8], [2, 2, 2]); // Type: number[][][]  Value: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]]
 *   reshape([1, 2, 3, 4, 5, 6, 7, 8], [4, 2   ]); // Type: number[][]    Value: [[1, 2], [3, 4], [5, 6], [7, 8]]
 * @param {T[]|DataArray} data The input array to reshape.
 * @param {DIM} dimensions The target shape/dimensions.
 * @template T
 * @template {[number]|number[]} DIM
 * @returns {NestArray<T, DIM["length"]>} The reshaped array.
 */
function reshape(data, dimensions) {
  const totalElements = data.length;
  const dimensionSize = dimensions.reduce((a, b) => a * b);

  if (totalElements !== dimensionSize) {
    throw Error(
      `cannot reshape array of size ${totalElements} into shape (${dimensions})`,
    );
  }

  /** @type {any} */
  let reshapedArray = data;

  for (let i = dimensions.length - 1; i >= 0; i--) {
    reshapedArray = reshapedArray.reduce(
      (acc, val) => {
        let lastArray = acc[acc.length - 1];

        if (lastArray.length < dimensions[i]) {
          lastArray.push(val);
        } else {
          acc.push([val]);
        }

        return acc;
      },
      [[]],
    );
  }

  return reshapedArray[0];
}

/**
 * Transposes a tensor according to the provided axes.
 * @param {any} tensor The input tensor to transpose.
 * @param {Array} axes The axes to transpose the tensor along.
 * @returns {Tensor} The transposed tensor.
 */
export function transpose(tensor, axes) {
  const [transposedData, shape] = transpose_data(
    tensor.data,
    tensor.dims,
    axes,
  );
  return new Tensor(tensor.type, transposedData, shape);
}

/**
 * Interpolates an Tensor to the given size.
 * @param {Tensor} input The input tensor to interpolate. Data must be channel-first (i.e., [c, h, w])
 * @param {number[]} size The output size of the image
 * @param {string} mode The interpolation mode
 * @param {boolean} align_corners Whether to align corners.
 * @returns {Tensor} The interpolated tensor.
 */
export function interpolate(
  input,
  [out_height, out_width],
  mode = "bilinear",
  align_corners = false,
) {
  // Input image dimensions
  const in_channels = input.dims.at(-3) ?? 1;
  const in_height = input.dims.at(-2);
  const in_width = input.dims.at(-1);

  let output = interpolate_data(
    /** @type {import('./maths.js').TypedArray}*/ (input.data),
    [in_channels, in_height, in_width],
    [out_height, out_width],
    mode,
    align_corners,
  );
  return new Tensor(input.type, output, [in_channels, out_height, out_width]);
}

/**
 * Perform mean pooling of the last hidden state followed by a normalization step.
 * @param {Tensor} last_hidden_state Tensor of shape [batchSize, seqLength, embedDim]
 * @param {Tensor} attention_mask Tensor of shape [batchSize, seqLength]
 * @returns {Tensor} Returns a new Tensor of shape [batchSize, embedDim].
 */
export function mean_pooling(last_hidden_state, attention_mask) {
  // last_hidden_state: [batchSize, seqLength, embedDim]
  // attention_mask:    [batchSize, seqLength]

  let shape = [last_hidden_state.dims[0], last_hidden_state.dims[2]];
  // @ts-ignore
  let returnedData = new last_hidden_state.data.constructor(
    shape[0] * shape[1],
  );
  let [batchSize, seqLength, embedDim] = last_hidden_state.dims;

  let outIndex = 0;
  for (let i = 0; i < batchSize; ++i) {
    let offset = i * embedDim * seqLength;

    for (let k = 0; k < embedDim; ++k) {
      let sum = 0;
      let count = 0;

      let attnMaskOffset = i * seqLength;
      let offset2 = offset + k;
      // Pool over all words in sequence
      for (let j = 0; j < seqLength; ++j) {
        // index into attention mask
        let attn = Number(attention_mask.data[attnMaskOffset + j]);

        count += attn;
        sum += last_hidden_state.data[offset2 + j * embedDim] * attn;
      }

      let avg = sum / count;
      returnedData[outIndex++] = avg;
    }
  }

  return new Tensor(last_hidden_state.type, returnedData, shape);
}

/**
 * Helper function to calculate new dimensions when performing a squeeze operation.
 * @param {number[]} dims The dimensions of the tensor.
 * @param {number|number[]|null} dim The dimension(s) to squeeze.
 * @returns The new dimensions.
 * @private
 */
function calc_squeeze_dims(dims, dim) {
  dims = dims.slice();
  if (dim === null) {
    dims = dims.filter((d) => d !== 1);
  } else if (typeof dim === "number") {
    if (dims[dim] === 1) {
      dims.splice(dim, 1);
    }
  } else if (Array.isArray(dim)) {
    dims = dims.filter((x, i) => {
      return x !== 1 || !dim.includes(i);
    });
  }
  return dims;
}

/**
 * Helper function to calculate new dimensions when performing an unsqueeze operation.
 * @param {number[]} dims The dimensions of the tensor.
 * @param {number} dim The dimension to unsqueeze.
 * @returns The new dimensions.
 * @private
 */
function calc_unsqueeze_dims(dims, dim) {
  // Dimension out of range (e.g., "expected to be in range of [-4, 3], but got 4")
  // + 1 since we allow inserting at the end (i.e. dim = -1)
  dim = safeIndex(dim, dims.length + 1);
  dims = dims.slice();
  // Insert 1 into specified dimension
  dims.splice(dim, 0, 1);
  return dims;
}

/**
 * Safely calculate the index for an array of a given size, allowing negative indexing.
 * @param {number} index The index that will be used.
 * @param {number} size The size of the array.
 * @param {number} [dimension=null] The dimension that the index is for (optional).
 * @returns {number} The index, guaranteed to be non-negative and less than `arrayLength`.
 *
 * @throws {Error} If the index is out of range.
 * @private
 */
function safeIndex(index, size, dimension = null) {
  if (index < -size || index >= size) {
    throw new Error(
      `IndexError: index ${index} is out of bounds for dimension${dimension === null ? "" : " " + dimension} with size ${size}`,
    );
  }

  if (index < 0) {
    // Negative indexing, ensuring positive index
    index = ((index % size) + size) % size;
  }
  return index;
}

/**
 * Concatenates an array of tensors along a specified dimension.
 * @param {Tensor[]} tensors The array of tensors to concatenate.
 * @param {number} dim The dimension to concatenate along.
 * @returns {Tensor} The concatenated tensor.
 */
export function cat(tensors, dim = 0) {
  dim = safeIndex(dim, tensors[0].dims.length);

  // TODO do validation of shapes

  const resultDims = tensors[0].dims.slice();
  resultDims[dim] = tensors.reduce((a, b) => a + b.dims[dim], 0);

  // Create a new array to store the accumulated values
  const resultSize = resultDims.reduce((a, b) => a * b, 1);
  // @ts-ignore
  const result = new tensors[0].data.constructor(resultSize);

  // Create output tensor of same type as first
  const resultType = tensors[0].type;

  if (dim === 0) {
    // Handle special case for performance reasons

    let offset = 0;
    for (let t of tensors) {
      result.set(t.data, offset);
      offset += t.data.length;
    }
  } else {
    let currentDim = 0;

    for (let t = 0; t < tensors.length; ++t) {
      let tensor = tensors[t];

      // Iterate over the data array
      for (let i = 0; i < tensor.data.length; ++i) {
        // Calculate the index in the resulting array
        let resultIndex = 0;

        for (
          let j = tensor.dims.length - 1, num = i, resultMultiplier = 1;
          j >= 0;
          --j
        ) {
          const size = tensor.dims[j];
          let index = num % size;
          if (j === dim) {
            index += currentDim;
          }
          resultIndex += index * resultMultiplier;
          resultMultiplier *= resultDims[j];
          num = Math.floor(num / size);
        }
        // Accumulate the value at the current index
        result[resultIndex] = tensor.data[i];
      }

      currentDim += tensor.dims[dim];
    }
  }
  return new Tensor(resultType, result, resultDims);
}

/**
 * Stack an array of tensors along a specified dimension.
 * @param {Tensor[]} tensors The array of tensors to stack.
 * @param {number} dim The dimension to stack along.
 * @returns {Tensor} The stacked tensor.
 */
export function stack(tensors, dim = 0) {
  // TODO do validation of shapes
  // NOTE: stack expects each tensor to be equal size
  return cat(
    tensors.map((t) => t.unsqueeze(dim)),
    dim,
  );
}

/**
 * Calculates the standard deviation and mean over the dimensions specified by dim. dim can be a single dimension or `null` to reduce over all dimensions.
 * @param {Tensor} input the input tenso
 * @param {number|null} dim the dimension to reduce. If None, all dimensions are reduced.
 * @param {number} correction difference between the sample size and sample degrees of freedom. Defaults to Bessel's correction, correction=1.
 * @param {boolean} keepdim whether the output tensor has dim retained or not.
 * @returns {Tensor[]} A tuple of (std, mean) tensors.
 */
export function std_mean(input, dim = null, correction = 1, keepdim = false) {
  if (dim === null) {
    // None to reduce over all dimensions.
    // @ts-ignore
    const sum = input.data.reduce((a, b) => a + b, 0);
    const mean = sum / input.data.length;
    // @ts-ignore
    const std = Math.sqrt(
      input.data.reduce((a, b) => a + (b - mean) ** 2, 0) /
        (input.data.length - correction),
    );

    const meanTensor = new Tensor(
      input.type,
      [mean],
      [
        /* scalar */
      ],
    );
    const stdTensor = new Tensor(
      input.type,
      [std],
      [
        /* scalar */
      ],
    );

    return [stdTensor, meanTensor];
  }

  // Negative indexing
  dim = safeIndex(dim, input.dims.length);

  const meanTensor = mean(input, dim, keepdim);

  // Calculate the shape of the resulting array after summation
  const resultDims = input.dims.slice(); // Copy the original dimensions
  resultDims[dim] = 1; // Remove the specified axis

  // Create a new array to store the accumulated values
  // @ts-ignore
  const result = new input.data.constructor(
    input.data.length / input.dims[dim],
  );

  // Iterate over the data array
  for (let i = 0; i < input.data.length; ++i) {
    // Calculate the index in the resulting array
    let resultIndex = 0;

    for (
      let j = input.dims.length - 1, num = i, resultMultiplier = 1;
      j >= 0;
      --j
    ) {
      const size = input.dims[j];
      if (j !== dim) {
        const index = num % size;
        resultIndex += index * resultMultiplier;
        resultMultiplier *= resultDims[j];
      }
      num = Math.floor(num / size);
    }

    // Accumulate the value at the current index
    result[resultIndex] += (input.data[i] - meanTensor.data[resultIndex]) ** 2;
  }

  for (let i = 0; i < result.length; ++i) {
    result[i] = Math.sqrt(result[i] / (input.dims[dim] - correction));
  }

  if (!keepdim) {
    resultDims.splice(dim, 1);
  }

  const stdTensor = new Tensor(input.type, result, resultDims);

  return [stdTensor, meanTensor];
}

/**
 * Returns the mean value of each row of the input tensor in the given dimension dim.
 * @param {Tensor} input the input tensor.
 * @param {number|null} dim the dimension to reduce.
 * @param {boolean} keepdim whether the output tensor has dim retained or not.
 * @returns A new tensor with means taken along the specified dimension.
 */
export function mean(input, dim = null, keepdim = false) {
  if (dim === null) {
    // None to reduce over all dimensions.
    // @ts-ignore
    let val = input.data.reduce((a, b) => a + b, 0);
    return new Tensor(
      input.type,
      [val / input.data.length],
      [
        /* scalar */
      ],
    );
  }

  // Negative indexing
  dim = safeIndex(dim, input.dims.length);

  // Calculate the shape of the resulting array after summation
  const resultDims = input.dims.slice(); // Copy the original dimensions
  resultDims[dim] = 1; // Remove the specified axis

  // Create a new array to store the accumulated values
  // @ts-ignore
  const result = new input.data.constructor(
    input.data.length / input.dims[dim],
  );

  // Iterate over the data array
  for (let i = 0; i < input.data.length; ++i) {
    // Calculate the index in the resulting array
    let resultIndex = 0;

    for (
      let j = input.dims.length - 1, num = i, resultMultiplier = 1;
      j >= 0;
      --j
    ) {
      const size = input.dims[j];
      if (j !== dim) {
        const index = num % size;
        resultIndex += index * resultMultiplier;
        resultMultiplier *= resultDims[j];
      }
      num = Math.floor(num / size);
    }

    // Accumulate the value at the current index
    result[resultIndex] += input.data[i];
  }

  if (input.dims[dim] !== 1) {
    for (let i = 0; i < result.length; ++i) {
      result[i] = result[i] / input.dims[dim];
    }
  }

  if (!keepdim) {
    resultDims.splice(dim, 1);
  }

  return new Tensor(input.type, result, resultDims);
}

/**
 *
 * Measures similarity between two temporal sequences (e.g., input audio and output tokens
 * to generate token-level timestamps).
 * @param {Tensor} matrix
 * @returns {number[][]}
 */
export function dynamicTimeWarping(matrix) {
  const [output_length, input_length] = matrix.dims;

  const outputShape = [output_length + 1, input_length + 1];

  const cost = new Tensor(
    "float32",
    new Float32Array(outputShape[0] * outputShape[1]).fill(Infinity),
    outputShape,
  );

  const trace = new Tensor(
    "float32",
    new Float32Array(outputShape[0] * outputShape[1]).fill(-1),
    outputShape,
  );

  // same as `cost[0][0] = 0`;
  cost[0].data[0] = 0;

  for (let j = 1; j < input_length + 1; ++j) {
    for (let i = 1; i < output_length + 1; ++i) {
      const c0 = cost[i - 1][j - 1].item();
      const c1 = cost[i - 1][j].item();
      const c2 = cost[i][j - 1].item();

      let c, t;
      if (c0 < c1 && c0 < c2) {
        c = c0;
        t = 0;
      } else if (c1 < c0 && c1 < c2) {
        c = c1;
        t = 1;
      } else {
        c = c2;
        t = 2;
      }

      cost[i].data[j] = matrix[i - 1][j - 1].item() + c;
      trace[i].data[j] = t;
    }
  }

  // backtrace
  let i = output_length;
  let j = input_length;

  // @ts-ignore
  trace.data.fill(2, 0, outputShape[1]); // trace[0, :] = 2
  for (let i = 0; i < outputShape[0]; ++i) {
    // trace[:, 0] = 1
    trace[i].data[0] = 1;
  }

  let text_indices = [];
  let time_indices = [];

  while (i > 0 || j > 0) {
    text_indices.push(i - 1);
    time_indices.push(j - 1);

    const t = trace[i][j].item();
    switch (t) {
      case 0:
        --i;
        --j;
        break;
      case 1:
        --i;
        break;
      case 2:
        --j;
        break;
      default:
        throw new Error(
          `Internal error in dynamic time warping. Unexpected trace[${i}, ${j}]. Please file a bug report.`,
        );
    }
  }

  text_indices.reverse();
  time_indices.reverse();

  return [text_indices, time_indices];
}

function dimsToStride(dims) {
  const stride = new Array(dims.length);
  for (let i = dims.length - 1, s2 = 1; i >= 0; --i) {
    stride[i] = s2;
    s2 *= dims[i];
  }
  return stride;
}

/**
 * Returns a tensor filled with the scalar value 1, with the shape defined by the variable argument size.
 * @param {number[]} size A sequence of integers defining the shape of the output tensor.
 */
export function ones(size) {
  const numElements = size.reduce((a, b) => a * b, 1);
  return new Tensor("int64", new BigInt64Array(numElements).fill(1n), size);
}

/**
 * Returns a tensor filled with the scalar value 1, with the same size as input.
 * @param {Tensor} tensor The size of input will determine size of the output tensor.
 * @returns The ones tensor.
 */
export function ones_like(tensor) {
  return ones(tensor.dims);
}
