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
export function dispatchCallback(progress_callback: Function, data: any): void;
/**
 * Reverses the keys and values of an object.
 *
 * @param {Object} data The object to reverse.
 * @returns {Object} The reversed object.
 * @see https://ultimatecourses.com/blog/reverse-object-keys-and-values-in-javascript
 */
export function reverseDictionary(data: any): any;
/**
 * Escapes regular expression special characters from a string by replacing them with their escaped counterparts.
 *
 * @param {string} string The string to escape.
 * @returns {string} The escaped string.
 */
export function escapeRegExp(string: string): string;
/**
 * Check if a value is a typed array.
 * @param {*} val The value to check.
 * @returns {boolean} True if the value is a `TypedArray`, false otherwise.
 *
 * Adapted from https://stackoverflow.com/a/71091338/13989043
 */
export function isTypedArray(val: any): boolean;
/**
 * Check if a value is an integer.
 * @param {*} x The value to check.
 * @returns {boolean} True if the value is a string, false otherwise.
 */
export function isIntegralNumber(x: any): boolean;
/**
 * Check if a value is exists.
 * @param {*} x The value to check.
 * @returns {boolean} True if the value exists, false otherwise.
 */
export function exists(x: any): boolean;
/**
 * Calculates the dimensions of a nested array.
 *
 * @param {any[]} arr The nested array to calculate dimensions for.
 * @returns {number[]} An array containing the dimensions of the input array.
 */
export function calculateDimensions(arr: any[]): number[];
/**
 * Replicate python's .pop() method for objects.
 * @param {Object} obj The object to pop from.
 * @param {string} key The key to pop.
 * @param {*} defaultValue The default value to return if the key does not exist.
 * @returns {*} The value of the popped key.
 * @throws {Error} If the key does not exist and no default value is provided.
 */
export function pop(obj: any, key: string, defaultValue?: any): any;
/**
 * Efficiently merge arrays, creating a new copy.
 * Adapted from https://stackoverflow.com/a/6768642/13989043
 * @param  {Array[]} arrs Arrays to merge.
 * @returns {Array} The merged array.
 */
export function mergeArrays(...arrs: any[][]): any[];
/**
 * Compute the Cartesian product of given arrays
 * @param {...Array} a Arrays to compute the product
 * @returns {Array} Returns the computed Cartesian product as an array
 * @private
 */
export function product(...a: any[][]): any[];
/**
 * Calculates the index offset for a given index and window size.
 * @param {number} i The index.
 * @param {number} w The window size.
 * @returns {number} The index offset.
 */
export function calculateReflectOffset(i: number, w: number): number;
/**
 * A base class for creating callable objects.
 *
 * @type {new () => {(...args: any[]): any, _call(...args: any[]): any}}
 */
export const Callable: new () => {
  (...args: any[]): any;
  _call(...args: any[]): any;
};
//# sourceMappingURL=core.d.ts.map
