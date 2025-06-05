/**
 * Transposes a tensor according to the provided axes.
 * @param {any} tensor The input tensor to transpose.
 * @param {Array} axes The axes to transpose the tensor along.
 * @returns {Tensor} The transposed tensor.
 */
export function transpose(tensor: any, axes: any[]): Tensor;
/**
 * Interpolates an Tensor to the given size.
 * @param {Tensor} input The input tensor to interpolate. Data must be channel-first (i.e., [c, h, w])
 * @param {number[]} size The output size of the image
 * @param {string} mode The interpolation mode
 * @param {boolean} align_corners Whether to align corners.
 * @returns {Tensor} The interpolated tensor.
 */
export function interpolate(
  input: Tensor,
  [out_height, out_width]: number[],
  mode?: string,
  align_corners?: boolean,
): Tensor;
/**
 * Perform mean pooling of the last hidden state followed by a normalization step.
 * @param {Tensor} last_hidden_state Tensor of shape [batchSize, seqLength, embedDim]
 * @param {Tensor} attention_mask Tensor of shape [batchSize, seqLength]
 * @returns {Tensor} Returns a new Tensor of shape [batchSize, embedDim].
 */
export function mean_pooling(
  last_hidden_state: Tensor,
  attention_mask: Tensor,
): Tensor;
/**
 * Concatenates an array of tensors along a specified dimension.
 * @param {Tensor[]} tensors The array of tensors to concatenate.
 * @param {number} dim The dimension to concatenate along.
 * @returns {Tensor} The concatenated tensor.
 */
export function cat(tensors: Tensor[], dim?: number): Tensor;
/**
 * Stack an array of tensors along a specified dimension.
 * @param {Tensor[]} tensors The array of tensors to stack.
 * @param {number} dim The dimension to stack along.
 * @returns {Tensor} The stacked tensor.
 */
export function stack(tensors: Tensor[], dim?: number): Tensor;
/**
 * Calculates the standard deviation and mean over the dimensions specified by dim. dim can be a single dimension or `null` to reduce over all dimensions.
 * @param {Tensor} input the input tenso
 * @param {number|null} dim the dimension to reduce. If None, all dimensions are reduced.
 * @param {number} correction difference between the sample size and sample degrees of freedom. Defaults to Bessel's correction, correction=1.
 * @param {boolean} keepdim whether the output tensor has dim retained or not.
 * @returns {Tensor[]} A tuple of (std, mean) tensors.
 */
export function std_mean(
  input: Tensor,
  dim?: number | null,
  correction?: number,
  keepdim?: boolean,
): Tensor[];
/**
 * Returns the mean value of each row of the input tensor in the given dimension dim.
 * @param {Tensor} input the input tensor.
 * @param {number|null} dim the dimension to reduce.
 * @param {boolean} keepdim whether the output tensor has dim retained or not.
 * @returns A new tensor with means taken along the specified dimension.
 */
export function mean(
  input: Tensor,
  dim?: number | null,
  keepdim?: boolean,
): Tensor;
/**
 *
 * Measures similarity between two temporal sequences (e.g., input audio and output tokens
 * to generate token-level timestamps).
 * @param {Tensor} matrix
 * @returns {number[][]}
 */
export function dynamicTimeWarping(matrix: Tensor): number[][];
/**
 * Returns a tensor filled with the scalar value 1, with the shape defined by the variable argument size.
 * @param {number[]} size A sequence of integers defining the shape of the output tensor.
 */
export function ones(size: number[]): Tensor;
/**
 * Returns a tensor filled with the scalar value 1, with the same size as input.
 * @param {Tensor} tensor The size of input will determine size of the output tensor.
 * @returns The ones tensor.
 */
export function ones_like(tensor: Tensor): Tensor;
export class Tensor {
  /**
   * Create a new Tensor or copy an existing Tensor.
   * @param {[DataType, DataArray, number[]]|[import('onnxruntime-common').Tensor]} args
   */
  constructor(
    ...args:
      | [DataType, DataArray, number[]]
      | [import("onnxruntime-common").Tensor]
  );
  /** @type {number[]} Dimensions of the tensor. */
  dims: number[];
  /** @type {DataType} Type of the tensor. */
  type: DataType;
  /** @type {DataArray} The data stored in the tensor. */
  data: DataArray;
  /** @type {number} The number of elements in the tensor. */
  size: number;
  /**
   * Index into a Tensor object.
   * @param {number} index The index to access.
   * @returns {Tensor} The data at the specified index.
   */
  _getitem(index: number): Tensor;
  /**
   * @param {number|bigint} item The item to search for in the tensor
   * @returns {number} The index of the first occurrence of item in the tensor data.
   */
  indexOf(item: number | bigint): number;
  /**
   * @param {number} index
   * @param {number} iterSize
   * @param {any} iterDims
   * @returns {Tensor}
   */
  _subarray(index: number, iterSize: number, iterDims: any): Tensor;
  /**
   * Returns the value of this tensor as a standard JavaScript Number. This only works
   * for tensors with one element. For other cases, see `Tensor.tolist()`.
   * @returns {number|bigint} The value of this tensor as a standard JavaScript Number.
   * @throws {Error} If the tensor has more than one element.
   */
  item(): number | bigint;
  /**
   * Convert tensor data to a n-dimensional JS list
   * @returns {Array}
   */
  tolist(): any[];
  /**
   * Return a new Tensor with the sigmoid function applied to each element.
   * @returns {Tensor} The tensor with the sigmoid function applied.
   */
  sigmoid(): Tensor;
  /**
   * Applies the sigmoid function to the tensor in place.
   * @returns {Tensor} Returns `this`.
   */
  sigmoid_(): Tensor;
  /**
   * Return a new Tensor with every element multiplied by a constant.
   * @param {number} val The value to multiply by.
   * @returns {Tensor} The new tensor.
   */
  mul(val: number): Tensor;
  /**
   * Multiply the tensor by a constant in place.
   * @param {number} val The value to multiply by.
   * @returns {Tensor} Returns `this`.
   */
  mul_(val: number): Tensor;
  /**
   * Return a new Tensor with every element added by a constant.
   * @param {number} val The value to add by.
   * @returns {Tensor} The new tensor.
   */
  add(val: number): Tensor;
  /**
   * Add the tensor by a constant in place.
   * @param {number} val The value to add by.
   * @returns {Tensor} Returns `this`.
   */
  add_(val: number): Tensor;
  clone(): Tensor;
  slice(...slices: any[]): Tensor;
  /**
   * Return a transposed version of this Tensor, according to the provided dimensions.
   * @param  {...number} dims Dimensions to transpose.
   * @returns {Tensor} The transposed tensor.
   */
  transpose(...dims: number[]): Tensor;
  /**
   * Returns the sum of each row of the input tensor in the given dimension dim.
   *
   * @param {number} [dim=null] The dimension or dimensions to reduce. If `null`, all dimensions are reduced.
   * @param {boolean} keepdim Whether the output tensor has `dim` retained or not.
   * @returns The summed tensor
   */
  sum(dim?: number, keepdim?: boolean): Tensor;
  /**
   * Returns the matrix norm or vector norm of a given tensor.
   * @param {number|string} [p='fro'] The order of norm
   * @param {number} [dim=null] Specifies which dimension of the tensor to calculate the norm across.
   * If dim is None, the norm will be calculated across all dimensions of input.
   * @param {boolean} [keepdim=false] Whether the output tensors have dim retained or not.
   * @returns {Tensor} The norm of the tensor.
   */
  norm(p?: number | string, dim?: number, keepdim?: boolean): Tensor;
  /**
   * Performs `L_p` normalization of inputs over specified dimension. Operates in place.
   * @param {number} [p=2] The exponent value in the norm formulation
   * @param {number} [dim=1] The dimension to reduce
   * @returns {Tensor} `this` for operation chaining.
   */
  normalize_(p?: number, dim?: number): Tensor;
  /**
   * Performs `L_p` normalization of inputs over specified dimension.
   * @param {number} [p=2] The exponent value in the norm formulation
   * @param {number} [dim=1] The dimension to reduce
   * @returns {Tensor} The normalized tensor.
   */
  normalize(p?: number, dim?: number): Tensor;
  /**
   * Compute and return the stride of this tensor.
   * Stride is the jump necessary to go from one element to the next one in the specified dimension dim.
   * @returns {number[]} The stride of this tensor.
   */
  stride(): number[];
  /**
   * Returns a tensor with all specified dimensions of input of size 1 removed.
   *
   * NOTE: The returned tensor shares the storage with the input tensor, so changing the contents of one will change the contents of the other.
   * If you would like a copy, use `tensor.clone()` before squeezing.
   *
   * @param {number} [dim=null] If given, the input will be squeezed only in the specified dimensions.
   * @returns The squeezed tensor
   */
  squeeze(dim?: number): Tensor;
  /**
   * In-place version of @see {@link Tensor.squeeze}
   */
  squeeze_(dim?: any): this;
  /**
   * Returns a new tensor with a dimension of size one inserted at the specified position.
   *
   * NOTE: The returned tensor shares the same underlying data with this tensor.
   *
   * @param {number} dim The index at which to insert the singleton dimension
   * @returns The unsqueezed tensor
   */
  unsqueeze(dim?: number): Tensor;
  /**
   * In-place version of @see {@link Tensor.unsqueeze}
   */
  unsqueeze_(dim?: any): this;
  /**
   * In-place version of @see {@link Tensor.flatten}
   */
  flatten_(start_dim?: number, end_dim?: number): this;
  /**
   * Flattens input by reshaping it into a one-dimensional tensor.
   * If `start_dim` or `end_dim` are passed, only dimensions starting with `start_dim`
   * and ending with `end_dim` are flattened. The order of elements in input is unchanged.
   * @param {number} start_dim the first dim to flatten
   * @param {number} end_dim the last dim to flatten
   * @returns The flattened tensor.
   */
  flatten(start_dim?: number, end_dim?: number): Tensor;
  /**
   * Returns a new tensor with the same data as the `self` tensor but of a different `shape`.
   * @param  {...number} dims the desired size
   * @returns {Tensor} The tensor with the same data but different shape
   */
  view(...dims: number[]): Tensor;
  neg_(): this;
  neg(): Tensor;
  /**
   * In-place version of @see {@link Tensor.clamp}
   */
  clamp_(min: any, max: any): this;
  /**
   * Clamps all elements in input into the range [ min, max ]
   * @param {number} min lower-bound of the range to be clamped to
   * @param {number} max upper-bound of the range to be clamped to
   * @returns the output tensor.
   */
  clamp(min: number, max: number): Tensor;
  /**
   * In-place version of @see {@link Tensor.round}
   */
  round_(): this;
  /**
   * Rounds elements of input to the nearest integer.
   * @returns the output tensor.
   */
  round(): Tensor;
  /**
   * Performs Tensor dtype conversion.
   * @param {DataType} type The desired data type.
   * @returns {Tensor} The converted tensor.
   */
  to(type: DataType): Tensor;
  /**
   * Returns an iterator object for iterating over the tensor data in row-major order.
   * If the tensor has more than one dimension, the iterator will yield subarrays.
   * @returns {Iterator} An iterator object for iterating over the tensor data in row-major order.
   */
  [Symbol.iterator](): Iterator<any, any, undefined>;
}
/**
 * This creates a nested array of a given type and depth (see examples).
 */
export type NestArray<
  T,
  Depth extends number,
  Acc extends never[] = [],
> = Acc["length"] extends Depth ? T : NestArray<T[], Depth, [...Acc, never]>;
export type DataType = keyof typeof DataTypeMap;
export type DataArray = import("./maths.js").AnyTypedArray | any[];
declare const DataTypeMap: Readonly<{
  float32: Float32ArrayConstructor;
  float64: Float64ArrayConstructor;
  string: ArrayConstructor;
  int8: Int8ArrayConstructor;
  uint8: Uint8ArrayConstructor;
  int16: Int16ArrayConstructor;
  uint16: Uint16ArrayConstructor;
  int32: Int32ArrayConstructor;
  uint32: Uint32ArrayConstructor;
  int64: BigInt64ArrayConstructor;
  uint64: BigUint64ArrayConstructor;
  bool: Uint8ArrayConstructor;
}>;
export {};
//# sourceMappingURL=tensor.d.ts.map
