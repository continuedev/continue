
/**
 * @file Helper module for mathematical processing. 
 * 
 * These functions and classes are only used internally, 
 * meaning an end-user shouldn't need to access anything here.
 * 
 * @module utils/maths
 */

/**
 * @typedef {Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array} TypedArray
 * @typedef {BigInt64Array | BigUint64Array} BigTypedArray
 * @typedef {TypedArray | BigTypedArray} AnyTypedArray
 */

/**
 * @param {TypedArray} input
 */
export function interpolate_data(input, [in_channels, in_height, in_width], [out_height, out_width], mode = 'bilinear', align_corners = false) {
    // TODO use mode and align_corners

    // Output image dimensions
    const x_scale = out_width / in_width;
    const y_scale = out_height / in_height;

    // Output image
    // @ts-ignore
    const out_img = new input.constructor(out_height * out_width * in_channels);

    // Pre-calculate strides
    const inStride = in_height * in_width;
    const outStride = out_height * out_width;

    for (let i = 0; i < out_height; ++i) {
        for (let j = 0; j < out_width; ++j) {
            // Calculate output offset
            const outOffset = i * out_width + j;

            // Calculate input pixel coordinates
            const x = (j + 0.5) / x_scale - 0.5;
            const y = (i + 0.5) / y_scale - 0.5;

            // Calculate the four nearest input pixels
            // We also check if the input pixel coordinates are within the image bounds
            let x1 = Math.floor(x);
            let y1 = Math.floor(y);
            const x2 = Math.min(x1 + 1, in_width - 1);
            const y2 = Math.min(y1 + 1, in_height - 1);

            x1 = Math.max(x1, 0);
            y1 = Math.max(y1, 0);


            // Calculate the fractional distances between the input pixel and the four nearest pixels
            const s = x - x1;
            const t = y - y1;

            // Perform bilinear interpolation
            const w1 = (1 - s) * (1 - t);
            const w2 = s * (1 - t);
            const w3 = (1 - s) * t;
            const w4 = s * t;

            // Calculate the four nearest input pixel indices
            const yStride = y1 * in_width;
            const xStride = y2 * in_width;
            const idx1 = yStride + x1;
            const idx2 = yStride + x2;
            const idx3 = xStride + x1;
            const idx4 = xStride + x2;

            for (let k = 0; k < in_channels; ++k) {
                // Calculate channel offset
                const cOffset = k * inStride;

                out_img[k * outStride + outOffset] =
                    w1 * input[cOffset + idx1] +
                    w2 * input[cOffset + idx2] +
                    w3 * input[cOffset + idx3] +
                    w4 * input[cOffset + idx4];
            }
        }
    }

    return out_img;
}


/**
 * Helper method to transpose a `AnyTypedArray` directly
 * @template {AnyTypedArray} T 
 * @param {T} array 
 * @param {number[]} dims 
 * @param {number[]} axes 
 * @returns {[T, number[]]} The transposed array and the new shape.
 */
export function transpose_data(array, dims, axes) {
    // Calculate the new shape of the transposed array
    // and the stride of the original array
    const shape = new Array(axes.length);
    const stride = new Array(axes.length);

    for (let i = axes.length - 1, s = 1; i >= 0; --i) {
        stride[i] = s;
        shape[i] = dims[axes[i]];
        s *= shape[i];
    }

    // Precompute inverse mapping of stride
    const invStride = axes.map((_, i) => stride[axes.indexOf(i)]);

    // Create the transposed array with the new shape
    // @ts-ignore
    const transposedData = new array.constructor(array.length);

    // Transpose the original array to the new array
    for (let i = 0; i < array.length; ++i) {
        let newIndex = 0;
        for (let j = dims.length - 1, k = i; j >= 0; --j) {
            newIndex += (k % dims[j]) * invStride[j];
            k = Math.floor(k / dims[j]);
        }
        transposedData[newIndex] = array[i];
    }

    return [transposedData, shape];
}


/**
 * Compute the softmax of an array of numbers.
 * @template {TypedArray|number[]} T
 * @param {T} arr The array of numbers to compute the softmax of.
 * @returns {T} The softmax array.
 */
export function softmax(arr) {
    // Compute the maximum value in the array
    const maxVal = max(arr)[0];

    // Compute the exponentials of the array values
    const exps = arr.map(x => Math.exp(x - maxVal));

    // Compute the sum of the exponentials
    // @ts-ignore
    const sumExps = exps.reduce((acc, val) => acc + val, 0);

    // Compute the softmax values
    const softmaxArr = exps.map(x => x / sumExps);

    return /** @type {T} */(softmaxArr);
}

/**
 * Calculates the logarithm of the softmax function for the input array.
 * @template {TypedArray|number[]} T
 * @param {T} arr The input array to calculate the log_softmax function for.
 * @returns {T} The resulting log_softmax array.
 */
export function log_softmax(arr) {
    // Compute the softmax values
    const softmaxArr = softmax(arr);

    // Apply log formula to each element
    const logSoftmaxArr = softmaxArr.map(x => Math.log(x));

    return /** @type {T} */(logSoftmaxArr);
}

/**
 * Calculates the dot product of two arrays.
 * @param {number[]} arr1 The first array.
 * @param {number[]} arr2 The second array.
 * @returns {number} The dot product of arr1 and arr2.
 */
export function dot(arr1, arr2) {
    return arr1.reduce((acc, val, i) => acc + val * arr2[i], 0);
}


/**
 * Get the top k items from an iterable, sorted by descending order
 * @param {any[]|TypedArray} items The items to be sorted
 * @param {number|null} [top_k=0] The number of top items to return (default: 0 = return all)
 * @returns {[number, any][]} The top k items, sorted by descending order
 */
export function getTopItems(items, top_k = 0) {
    // if top == 0, return all

    items = Array.from(items)
        .map((x, i) => [i, x])            // Get indices ([index, score])
        .sort((a, b) => b[1] - a[1])      // Sort by log probabilities

    if (top_k !== null && top_k > 0) {
        items = items.slice(0, top_k);    // Get top k items
    }

    return items
}

/**
 * Computes the cosine similarity between two arrays.
 *
 * @param {number[]} arr1 The first array.
 * @param {number[]} arr2 The second array.
 * @returns {number} The cosine similarity between the two arrays.
 */
export function cos_sim(arr1, arr2) {
    // Calculate dot product of the two arrays
    const dotProduct = dot(arr1, arr2);

    // Calculate the magnitude of the first array
    const magnitudeA = magnitude(arr1);

    // Calculate the magnitude of the second array
    const magnitudeB = magnitude(arr2);

    // Calculate the cosine similarity
    const cosineSimilarity = dotProduct / (magnitudeA * magnitudeB);

    return cosineSimilarity;
}

/**
 * Calculates the magnitude of a given array.
 * @param {number[]} arr The array to calculate the magnitude of.
 * @returns {number} The magnitude of the array.
 */
export function magnitude(arr) {
    return Math.sqrt(arr.reduce((acc, val) => acc + val * val, 0));
}


/**
 * Returns the value and index of the minimum element in an array.
 * @param {number[]|TypedArray} arr array of numbers.
 * @returns {number[]} the value and index of the minimum element, of the form: [valueOfMin, indexOfMin]
 * @throws {Error} If array is empty.
 */
export function min(arr) {
    if (arr.length === 0) throw Error('Array must not be empty');
    let min = arr[0];
    let indexOfMin = 0;
    for (let i = 1; i < arr.length; ++i) {
        if (arr[i] < min) {
            min = arr[i];
            indexOfMin = i;
        }
    }
    return [min, indexOfMin];
}


/**
 * Returns the value and index of the maximum element in an array.
 * @param {number[]|AnyTypedArray} arr array of numbers.
 * @returns {[number, number]} the value and index of the maximum element, of the form: [valueOfMax, indexOfMax]
 * @throws {Error} If array is empty.
 */
export function max(arr) {
    if (arr.length === 0) throw Error('Array must not be empty');
    let max = arr[0];
    let indexOfMax = 0;
    for (let i = 1; i < arr.length; ++i) {
        if (arr[i] > max) {
            max = arr[i];
            indexOfMax = i;
        }
    }
    return [Number(max), indexOfMax];
}

function isPowerOfTwo(number) {
    // Check if the number is greater than 0 and has only one bit set to 1
    return (number > 0) && ((number & (number - 1)) === 0);
}

/**
 * Implementation of Radix-4 FFT.
 * 
 * P2FFT class provides functionality for performing Fast Fourier Transform on arrays
 * which are a power of two in length.
 * Code adapted from https://www.npmjs.com/package/fft.js
 */
class P2FFT {
    /**
     * @param {number} size The size of the input array. Must be a power of two larger than 1.
     * @throws {Error} FFT size must be a power of two larger than 1.
     */
    constructor(size) {
        this.size = size | 0; // convert to a 32-bit signed integer
        if (this.size <= 1 || !isPowerOfTwo(this.size))
            throw new Error('FFT size must be a power of two larger than 1');

        this._csize = size << 1;

        this.table = new Float64Array(this.size * 2);
        for (let i = 0; i < this.table.length; i += 2) {
            const angle = Math.PI * i / this.size;
            this.table[i] = Math.cos(angle);
            this.table[i + 1] = -Math.sin(angle);
        }

        // Find size's power of two
        let power = 0;
        for (let t = 1; this.size > t; t <<= 1)
            ++power;

        // Calculate initial step's width:
        //   * If we are full radix-4, it is 2x smaller to give inital len=8
        //   * Otherwise it is the same as `power` to give len=4
        this._width = power % 2 === 0 ? power - 1 : power;

        // Pre-compute bit-reversal patterns
        this._bitrev = new Int32Array(1 << this._width);
        for (let j = 0; j < this._bitrev.length; ++j) {
            this._bitrev[j] = 0;
            for (let shift = 0; shift < this._width; shift += 2) {
                const revShift = this._width - shift - 2;
                this._bitrev[j] |= ((j >>> shift) & 3) << revShift;
            }
        }
    }

    /**
     * Create a complex number array with size `2 * size`
     *
     * @returns {Float64Array} A complex number array with size `2 * size`
     */
    createComplexArray() {
        return new Float64Array(this._csize);
    }

    /**
     * Converts a complex number representation stored in a Float64Array to an array of real numbers.
     * 
     * @param {Float64Array} complex The complex number representation to be converted.
     * @param {number[]} [storage] An optional array to store the result in.
     * @returns {number[]} An array of real numbers representing the input complex number representation.
     */
    fromComplexArray(complex, storage) {
        const res = storage || new Array(complex.length >>> 1);
        for (let i = 0; i < complex.length; i += 2)
            res[i >>> 1] = complex[i];
        return res;
    }

    /**
     * Convert a real-valued input array to a complex-valued output array.
     * @param {Float64Array} input The real-valued input array.
     * @param {Float64Array} [storage] Optional buffer to store the output array.
     * @returns {Float64Array} The complex-valued output array.
     */
    toComplexArray(input, storage) {
        const res = storage || this.createComplexArray();
        for (let i = 0; i < res.length; i += 2) {
            res[i] = input[i >>> 1];
            res[i + 1] = 0;
        }
        return res;
    }

    /**
     * Completes the spectrum by adding its mirrored negative frequency components.
     * @param {Float64Array} spectrum The input spectrum.
     * @returns {void}
     */
    completeSpectrum(spectrum) {
        const size = this._csize;
        const half = size >>> 1;
        for (let i = 2; i < half; i += 2) {
            spectrum[size - i] = spectrum[i];
            spectrum[size - i + 1] = -spectrum[i + 1];
        }
    }

    /**
     * Performs a Fast Fourier Transform (FFT) on the given input data and stores the result in the output buffer.
     * 
     * @param {Float64Array} out The output buffer to store the result.
     * @param {Float64Array} data The input data to transform.
     * 
     * @throws {Error} Input and output buffers must be different.
     * 
     * @returns {void}
     */
    transform(out, data) {
        if (out === data)
            throw new Error('Input and output buffers must be different');

        this._transform4(out, data, 1 /* DONE */);
    }

    /**
     * Performs a real-valued forward FFT on the given input buffer and stores the result in the given output buffer.
     * The input buffer must contain real values only, while the output buffer will contain complex values. The input and
     * output buffers must be different.
     *
     * @param {Float64Array} out The output buffer.
     * @param {Float64Array} data The input buffer containing real values.
     *
     * @throws {Error} If the input and output buffers are the same.
     */
    realTransform(out, data) {
        if (out === data)
            throw new Error('Input and output buffers must be different');

        this._realTransform4(out, data, 1 /* DONE */);
    }

    /**
     * Performs an inverse FFT transformation on the given `data` array, and stores the result in `out`.
     * The `out` array must be a different buffer than the `data` array. The `out` array will contain the
     * result of the transformation. The `data` array will not be modified.
     * 
     * @param {Float64Array} out The output buffer for the transformed data.
     * @param {Float64Array} data The input data to transform.
     * @throws {Error} If `out` and `data` refer to the same buffer.
     * @returns {void}
     */
    inverseTransform(out, data) {
        if (out === data)
            throw new Error('Input and output buffers must be different');

        this._transform4(out, data, -1 /* DONE */);
        for (let i = 0; i < out.length; ++i)
            out[i] /= this.size;
    }

    /**
     * Performs a radix-4 implementation of a discrete Fourier transform on a given set of data.
     *
     * @param {Float64Array} out The output buffer for the transformed data.
     * @param {Float64Array} data The input buffer of data to be transformed.
     * @param {number} inv A scaling factor to apply to the transform.
     * @returns {void}
     */
    _transform4(out, data, inv) {
        // radix-4 implementation

        const size = this._csize;

        // Initial step (permute and transform)
        const width = this._width;
        let step = 1 << width;
        let len = (size / step) << 1;

        let outOff;
        let t;
        const bitrev = this._bitrev;
        if (len === 4) {
            for (outOff = 0, t = 0; outOff < size; outOff += len, ++t) {
                const off = bitrev[t];
                this._singleTransform2(data, out, outOff, off, step);
            }
        } else {
            // len === 8
            for (outOff = 0, t = 0; outOff < size; outOff += len, ++t) {
                const off = bitrev[t];
                this._singleTransform4(data, out, outOff, off, step, inv);
            }
        }

        // Loop through steps in decreasing order
        for (step >>= 2; step >= 2; step >>= 2) {
            len = (size / step) << 1;
            const quarterLen = len >>> 2;

            // Loop through offsets in the data
            for (outOff = 0; outOff < size; outOff += len) {
                // Full case
                const limit = outOff + quarterLen - 1;
                for (let i = outOff, k = 0; i < limit; i += 2, k += step) {
                    const A = i;
                    const B = A + quarterLen;
                    const C = B + quarterLen;
                    const D = C + quarterLen;

                    // Original values
                    const Ar = out[A];
                    const Ai = out[A + 1];
                    const Br = out[B];
                    const Bi = out[B + 1];
                    const Cr = out[C];
                    const Ci = out[C + 1];
                    const Dr = out[D];
                    const Di = out[D + 1];

                    const tableBr = this.table[k];
                    const tableBi = inv * this.table[k + 1];
                    const MBr = Br * tableBr - Bi * tableBi;
                    const MBi = Br * tableBi + Bi * tableBr;

                    const tableCr = this.table[2 * k];
                    const tableCi = inv * this.table[2 * k + 1];
                    const MCr = Cr * tableCr - Ci * tableCi;
                    const MCi = Cr * tableCi + Ci * tableCr;

                    const tableDr = this.table[3 * k];
                    const tableDi = inv * this.table[3 * k + 1];
                    const MDr = Dr * tableDr - Di * tableDi;
                    const MDi = Dr * tableDi + Di * tableDr;

                    // Pre-Final values
                    const T0r = Ar + MCr;
                    const T0i = Ai + MCi;
                    const T1r = Ar - MCr;
                    const T1i = Ai - MCi;
                    const T2r = MBr + MDr;
                    const T2i = MBi + MDi;
                    const T3r = inv * (MBr - MDr);
                    const T3i = inv * (MBi - MDi);

                    // Final values
                    out[A] = T0r + T2r;
                    out[A + 1] = T0i + T2i;
                    out[B] = T1r + T3i;
                    out[B + 1] = T1i - T3r;
                    out[C] = T0r - T2r;
                    out[C + 1] = T0i - T2i;
                    out[D] = T1r - T3i;
                    out[D + 1] = T1i + T3r;
                }
            }
        }
    }

    /**
     * Performs a radix-2 implementation of a discrete Fourier transform on a given set of data.
     *
     * @param {Float64Array} data The input buffer of data to be transformed.
     * @param {Float64Array} out The output buffer for the transformed data.
     * @param {number} outOff The offset at which to write the output data.
     * @param {number} off The offset at which to begin reading the input data.
     * @param {number} step The step size for indexing the input data.
     * @returns {void}
     */
    _singleTransform2(data, out, outOff, off, step) {
        // radix-2 implementation
        // NOTE: Only called for len=4

        const evenR = data[off];
        const evenI = data[off + 1];
        const oddR = data[off + step];
        const oddI = data[off + step + 1];

        out[outOff] = evenR + oddR;
        out[outOff + 1] = evenI + oddI;
        out[outOff + 2] = evenR - oddR;
        out[outOff + 3] = evenI - oddI;
    }

    /**
     * Performs radix-4 transformation on input data of length 8
     *
     * @param {Float64Array} data Input data array of length 8
     * @param {Float64Array} out Output data array of length 8
     * @param {number} outOff Index of output array to start writing from
     * @param {number} off Index of input array to start reading from
     * @param {number} step Step size between elements in input array
     * @param {number} inv Scaling factor for inverse transform
     * 
     * @returns {void}
     */
    _singleTransform4(data, out, outOff, off, step, inv) {
        // radix-4
        // NOTE: Only called for len=8
        const step2 = step * 2;
        const step3 = step * 3;

        // Original values
        const Ar = data[off];
        const Ai = data[off + 1];
        const Br = data[off + step];
        const Bi = data[off + step + 1];
        const Cr = data[off + step2];
        const Ci = data[off + step2 + 1];
        const Dr = data[off + step3];
        const Di = data[off + step3 + 1];

        // Pre-Final values
        const T0r = Ar + Cr;
        const T0i = Ai + Ci;
        const T1r = Ar - Cr;
        const T1i = Ai - Ci;
        const T2r = Br + Dr;
        const T2i = Bi + Di;
        const T3r = inv * (Br - Dr);
        const T3i = inv * (Bi - Di);

        // Final values
        out[outOff] = T0r + T2r;
        out[outOff + 1] = T0i + T2i;
        out[outOff + 2] = T1r + T3i;
        out[outOff + 3] = T1i - T3r;
        out[outOff + 4] = T0r - T2r;
        out[outOff + 5] = T0i - T2i;
        out[outOff + 6] = T1r - T3i;
        out[outOff + 7] = T1i + T3r;
    }

    /**
     * Real input radix-4 implementation
     * @param {Float64Array} out Output array for the transformed data
     * @param {Float64Array} data Input array of real data to be transformed
     * @param {number} inv The scale factor used to normalize the inverse transform
     */
    _realTransform4(out, data, inv) {
        // Real input radix-4 implementation
        const size = this._csize;

        // Initial step (permute and transform)
        const width = this._width;
        let step = 1 << width;
        let len = (size / step) << 1;

        let outOff;
        let t;
        const bitrev = this._bitrev;
        if (len === 4) {
            for (outOff = 0, t = 0; outOff < size; outOff += len, ++t) {
                const off = bitrev[t];
                this._singleRealTransform2(data, out, outOff, off >>> 1, step >>> 1);
            }
        } else {
            // len === 8
            for (outOff = 0, t = 0; outOff < size; outOff += len, ++t) {
                const off = bitrev[t];
                this._singleRealTransform4(data, out, outOff, off >>> 1, step >>> 1, inv);
            }
        }

        // TODO: Optimize once https://github.com/indutny/fft.js/issues/25 is fixed
        // Loop through steps in decreasing order
        for (step >>= 2; step >= 2; step >>= 2) {
            len = (size / step) << 1;
            const quarterLen = len >>> 2;

            // Loop through offsets in the data
            for (outOff = 0; outOff < size; outOff += len) {
                // Full case
                const limit = outOff + quarterLen - 1;
                for (let i = outOff, k = 0; i < limit; i += 2, k += step) {
                    const A = i;
                    const B = A + quarterLen;
                    const C = B + quarterLen;
                    const D = C + quarterLen;

                    // Original values
                    const Ar = out[A];
                    const Ai = out[A + 1];
                    const Br = out[B];
                    const Bi = out[B + 1];
                    const Cr = out[C];
                    const Ci = out[C + 1];
                    const Dr = out[D];
                    const Di = out[D + 1];

                    const tableBr = this.table[k];
                    const tableBi = inv * this.table[k + 1];
                    const MBr = Br * tableBr - Bi * tableBi;
                    const MBi = Br * tableBi + Bi * tableBr;

                    const tableCr = this.table[2 * k];
                    const tableCi = inv * this.table[2 * k + 1];
                    const MCr = Cr * tableCr - Ci * tableCi;
                    const MCi = Cr * tableCi + Ci * tableCr;

                    const tableDr = this.table[3 * k];
                    const tableDi = inv * this.table[3 * k + 1];
                    const MDr = Dr * tableDr - Di * tableDi;
                    const MDi = Dr * tableDi + Di * tableDr;

                    // Pre-Final values
                    const T0r = Ar + MCr;
                    const T0i = Ai + MCi;
                    const T1r = Ar - MCr;
                    const T1i = Ai - MCi;
                    const T2r = MBr + MDr;
                    const T2i = MBi + MDi;
                    const T3r = inv * (MBr - MDr);
                    const T3i = inv * (MBi - MDi);

                    // Final values
                    out[A] = T0r + T2r;
                    out[A + 1] = T0i + T2i;
                    out[B] = T1r + T3i;
                    out[B + 1] = T1i - T3r;
                    out[C] = T0r - T2r;
                    out[C + 1] = T0i - T2i;
                    out[D] = T1r - T3i;
                    out[D + 1] = T1i + T3r;
                }
            }
        }
    }

    /**
     * Performs a single real input radix-2 transformation on the provided data
     * 
     * @param {Float64Array} data The input data array
     * @param {Float64Array} out The output data array
     * @param {number} outOff The output offset
     * @param {number} off The input offset
     * @param {number} step The step
     * 
     * @returns {void}
     */
    _singleRealTransform2(data, out, outOff, off, step) {
        // radix-2 implementation
        // NOTE: Only called for len=4

        const evenR = data[off];
        const oddR = data[off + step];

        out[outOff] = evenR + oddR;
        out[outOff + 1] = 0;
        out[outOff + 2] = evenR - oddR;
        out[outOff + 3] = 0;
    }

    /**
     * Computes a single real-valued transform using radix-4 algorithm.
     * This method is only called for len=8.
     *
     * @param {Float64Array} data The input data array.
     * @param {Float64Array} out The output data array.
     * @param {number} outOff The offset into the output array.
     * @param {number} off The offset into the input array.
     * @param {number} step The step size for the input array.
     * @param {number} inv The value of inverse.
     */
    _singleRealTransform4(data, out, outOff, off, step, inv) {
        // radix-4
        // NOTE: Only called for len=8
        const step2 = step * 2;
        const step3 = step * 3;

        // Original values
        const Ar = data[off];
        const Br = data[off + step];
        const Cr = data[off + step2];
        const Dr = data[off + step3];

        // Pre-Final values
        const T0r = Ar + Cr;
        const T1r = Ar - Cr;
        const T2r = Br + Dr;
        const T3r = inv * (Br - Dr);

        // Final values
        out[outOff] = T0r + T2r;
        out[outOff + 1] = 0;
        out[outOff + 2] = T1r;
        out[outOff + 3] = -T3r;
        out[outOff + 4] = T0r - T2r;
        out[outOff + 5] = 0;
        out[outOff + 6] = T1r;
        out[outOff + 7] = T3r;
    }
}

/**
 * NP2FFT class provides functionality for performing Fast Fourier Transform on arrays
 * which are not a power of two in length. In such cases, the chirp-z transform is used.
 * 
 * For more information, see: https://math.stackexchange.com/questions/77118/non-power-of-2-ffts/77156#77156
 */
class NP2FFT {

    /**
     * Constructs a new NP2FFT object.
     * @param {number} fft_length The length of the FFT
     */
    constructor(fft_length) {
        // Helper variables
        const a = 2 * (fft_length - 1);
        const b = 2 * (2 * fft_length - 1);
        const nextP2 = 2 ** (Math.ceil(Math.log2(b)))
        this.bufferSize = nextP2;
        this._a = a;

        // Define buffers
        // Compute chirp for transform
        const chirp = new Float64Array(b);
        const ichirp = new Float64Array(nextP2);
        this._chirpBuffer = new Float64Array(nextP2);
        this._buffer1 = new Float64Array(nextP2);
        this._buffer2 = new Float64Array(nextP2);
        this._outBuffer1 = new Float64Array(nextP2);
        this._outBuffer2 = new Float64Array(nextP2);

        // Compute complex exponentiation
        const theta = -2 * Math.PI / fft_length;
        const baseR = Math.cos(theta);
        const baseI = Math.sin(theta);

        // Precompute helper for chirp-z transform
        for (let i = 0; i < b >> 1; ++i) {
            // Compute complex power:
            const e = (i + 1 - fft_length) ** 2 / 2.0;

            // Compute the modulus and argument of the result
            const result_mod = Math.sqrt(baseR ** 2 + baseI ** 2) ** e;
            const result_arg = e * Math.atan2(baseI, baseR);

            // Convert the result back to rectangular form
            // and assign to chirp and ichirp
            const i2 = 2 * i;
            chirp[i2] = result_mod * Math.cos(result_arg);
            chirp[i2 + 1] = result_mod * Math.sin(result_arg);

            // conjugate
            ichirp[i2] = chirp[i2];
            ichirp[i2 + 1] = - chirp[i2 + 1];
        }
        this._slicedChirpBuffer = chirp.subarray(a, b);

        // create object to perform Fast Fourier Transforms
        // with `nextP2` complex numbers
        this._f = new P2FFT(nextP2 >> 1);
        this._f.transform(this._chirpBuffer, ichirp);
    }

    _transform(output, input, real) {
        const ib1 = this._buffer1;
        const ib2 = this._buffer2;
        const ob2 = this._outBuffer1;
        const ob3 = this._outBuffer2;
        const cb = this._chirpBuffer;
        const sb = this._slicedChirpBuffer;
        const a = this._a;

        if (real) {
            // Real multiplication
            for (let j = 0; j < sb.length; j += 2) {
                const j2 = j + 1
                const j3 = j >> 1;

                const a_real = input[j3];
                ib1[j] = a_real * sb[j];
                ib1[j2] = a_real * sb[j2];
            }
        } else {
            // Complex multiplication
            for (let j = 0; j < sb.length; j += 2) {
                const j2 = j + 1
                ib1[j] = input[j] * sb[j] - input[j2] * sb[j2];
                ib1[j2] = input[j] * sb[j2] + input[j2] * sb[j];
            }
        }
        this._f.transform(ob2, ib1);

        for (let j = 0; j < cb.length; j += 2) {
            const j2 = j + 1;

            ib2[j] = ob2[j] * cb[j] - ob2[j2] * cb[j2];
            ib2[j2] = ob2[j] * cb[j2] + ob2[j2] * cb[j];
        }
        this._f.inverseTransform(ob3, ib2);

        for (let j = 0; j < ob3.length; j += 2) {
            const a_real = ob3[j + a];
            const a_imag = ob3[j + a + 1];
            const b_real = sb[j];
            const b_imag = sb[j + 1];

            output[j] = a_real * b_real - a_imag * b_imag;
            output[j + 1] = a_real * b_imag + a_imag * b_real;
        }
    }

    transform(output, input) {
        this._transform(output, input, false);
    }

    realTransform(output, input) {
        this._transform(output, input, true);
    }
}

export class FFT {
    constructor(fft_length) {
        this.fft_length = fft_length;
        this.isPowerOfTwo = isPowerOfTwo(fft_length);
        if (this.isPowerOfTwo) {
            this.fft = new P2FFT(fft_length);
            this.outputBufferSize = 2 * fft_length;
        } else {
            this.fft = new NP2FFT(fft_length);
            this.outputBufferSize = this.fft.bufferSize;
        }
    }

    realTransform(out, input) {
        this.fft.realTransform(out, input);
    }

    transform(out, input) {
        this.fft.transform(out, input);
    }
}


/**
 * Performs median filter on the provided data. Padding is done by mirroring the data.
 * @param {AnyTypedArray} data The input array
 * @param {number} windowSize The window size
 */
export function medianFilter(data, windowSize) {

    if (windowSize % 2 === 0 || windowSize <= 0) {
        throw new Error('Window size must be a positive odd number');
    }

    // @ts-ignore
    const outputArray = new data.constructor(data.length);

    // @ts-ignore
    const buffer = new data.constructor(windowSize); // Reusable array for storing values

    const halfWindowSize = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; ++i) {
        let valuesIndex = 0;

        for (let j = -halfWindowSize; j <= halfWindowSize; ++j) {
            let index = i + j;
            if (index < 0) {
                index = Math.abs(index);
            } else if (index >= data.length) {
                index = 2 * (data.length - 1) - index;
            }

            buffer[valuesIndex++] = data[index];
        }

        buffer.sort();
        outputArray[i] = buffer[halfWindowSize];
    }

    return outputArray;
}

/**
 * Helper function to round a number to a given number of decimals
 * @param {number} num The number to round
 * @param {number} decimals The number of decimals
 * @returns {number} The rounded number
 */
export function round(num, decimals) {
    const pow = Math.pow(10, decimals);
    return Math.round(num * pow) / pow;
}
