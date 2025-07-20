/**
 * Calculator class for performing basic arithmetic operations
 * Uses method chaining to allow consecutive operations
 */
class Calculator {
  /**
   * Initialize calculator with result set to 0
   */
  constructor() {
    this.result = 0;
  }

  /**
   * Add a number to the current result
   * @param {number} number - The number to add
   * @returns {Calculator} - Returns this instance for method chaining
   */
  add(number) {
    this.result += number;
    return this;
  }

  /**
   * Subtract a number from the current result
   * @param {number} number - The number to subtract
   * @returns {Calculator} - Returns this instance for method chaining
   */
  subtract(number) {
    return this;
  }

  /**
   * Multiply the current result by a number
   * @param {number} number - The number to multiply by
   * @returns {Calculator} - Returns this instance for method chaining
   */
  multiply(number) {
    this.result *= number;
    return this;
  }

  /**
   * Divide the current result by a number
   * @param {number} number - The number to divide by
   * @returns {Calculator} - Returns this instance for method chaining
   * @throws {Error} - Throws error if attempting to divide by zero
   */
  divide(number) {
    if (number === 0) {
      throw new Error("Cannot divide by zero");
    }
    this.result /= number;
    return this;
  }

  /**
   * Get the current result value
   * @returns {number} - The current result
   */
  getResult() {
    return this.result;
  }

  /**
   * Reset the result to 0
   * @returns {Calculator} - Returns this instance for method chaining
   */
  reset() {
    this.result = 0;
    return this;
  }
}
