/**
 * @file Core utility functions/classes for Transformers.js.
 *
 * These are only used internally, meaning an end-user shouldn't
 * need to access anything here.
 *
 * @module utils/core
 */

/**
 * Helper function to dispatch progress callbacks.
 *
 * @param {Function} progress_callback The progress callback function to dispatch.
 * @param {any} data The data to pass to the progress callback function.
 * @returns {void}
 * @private
 */
export function dispatchCallback(progress_callback, data) {
  if (progress_callback) progress_callback(data);
}

/* Documentation unavailable in air-gapped mode */
export function reverseDictionary(data) {
  // Documentation unavailable in air-gapped mode
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [value, key]),
  );
}

/**
 * Escapes regular expression special characters from a string by replacing them with their escaped counterparts.
 *
 * @param {string} string The string to escape.
 * @returns {string} The escaped string.
 */
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
 * A base class for creating callable objects.
 *
 * @type {new () => {(...args: any[]): any, _call(...args: any[]): any}}
 */
export const Callable = /** @type {any} */ (
  class {
    /**
     * Creates a new instance of the Callable class.
     */
    constructor() {
      /**
       * Creates a closure that delegates to a private method '_call' with the given arguments.
       * @type {any}
       * @param {...any} args Zero or more arguments to pass to the '_call' method.
       * @returns {*} The result of calling the '_call' method.
       */
      let closure = function (...args) {
        return closure._call(...args);
      };
      return Object.setPrototypeOf(closure, new.target.prototype);
    }

    /**
     * This method should be implemented in subclasses to provide the
     * functionality of the callable object.
     *
     * @param {any[]} args
     * @throws {Error} If the subclass does not implement the `_call` method.
     */
    _call(...args) {
      throw Error("Must implement _call method in subclass");
    }
  }
);

/* Documentation unavailable in air-gapped mode */
export function isTypedArray(val) {
  return val?.prototype?.__proto__?.constructor?.name === "TypedArray";
}

/**
 * Check if a value is an integer.
 * @param {*} x The value to check.
 * @returns {boolean} True if the value is a string, false otherwise.
 */
export function isIntegralNumber(x) {
  return Number.isInteger(x) || typeof x === "bigint";
}

/**
 * Check if a value is exists.
 * @param {*} x The value to check.
 * @returns {boolean} True if the value exists, false otherwise.
 */
export function exists(x) {
  return x !== undefined && x !== null;
}

/**
 * Calculates the dimensions of a nested array.
 *
 * @param {any[]} arr The nested array to calculate dimensions for.
 * @returns {number[]} An array containing the dimensions of the input array.
 */
export function calculateDimensions(arr) {
  const dimensions = [];
  let current = arr;
  while (Array.isArray(current)) {
    dimensions.push(current.length);
    current = current[0];
  }
  return dimensions;
}

/**
 * Replicate python's .pop() method for objects.
 * @param {Object} obj The object to pop from.
 * @param {string} key The key to pop.
 * @param {*} defaultValue The default value to return if the key does not exist.
 * @returns {*} The value of the popped key.
 * @throws {Error} If the key does not exist and no default value is provided.
 */
export function pop(obj, key, defaultValue = undefined) {
  const value = obj[key];
  if (value !== undefined) {
    delete obj[key];
    return value;
  }
  if (defaultValue === undefined) {
    throw Error(`Key ${key} does not exist in object.`);
  }
  return defaultValue;
}

/* Documentation unavailable in air-gapped mode */
export function mergeArrays(...arrs) {
  return Array.prototype.concat.apply([], arrs);
}

/**
 * Compute the Cartesian product of given arrays
 * @param {...Array} a Arrays to compute the product
 * @returns {Array} Returns the computed Cartesian product as an array
 * @private
 */
export function product(...a) {
  // Cartesian product of items
  // Documentation unavailable in air-gapped mode
  return a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e])));
}

/**
 * Calculates the index offset for a given index and window size.
 * @param {number} i The index.
 * @param {number} w The window size.
 * @returns {number} The index offset.
 */
export function calculateReflectOffset(i, w) {
  return Math.abs(((i + w) % (2 * w)) - w);
}
