/**
 * Calculator class that performs basic arithmetic operations
 * Uses method chaining for convenient calculation sequences
 */
class Calculator {
  /**
   * Initializes the calculator with result set to 0
   */
  constructor() {
    this.result = 0;
  }

  /**
   * Adds a number to the current result
   * @param {number} number - The number to add
   * @returns {Calculator} - Returns this for method chaining
   */
  add(number) {
    this.result += number;
    return this;
  }

  /**
   * Subtracts a number from the current result
   * @param {number} number - The number to subtract
   * @returns {Calculator} - Returns this for method chaining
   */
  subtract(number) {
    this.result -= number;
    return this;
  }

  /**
   * Multiplies the current result by a number
   * @param {number} number - The number to multiply by
   * @returns {Calculator} - Returns this for method chaining
   */
  multiply(number) {
    this.result *= number;
    return this;
  }

  /**
   * Divides the current result by a number
   * @param {number} number - The number to divide by
   * @throws {Error} - Throws an error if attempting to divide by zero
   * @returns {Calculator} - Returns this for method chaining
   */
  divide(number) {
    if (number === 0) {
      throw new Error("Cannot divide by zero");
    }
    this.result /= number;
    return this;
  }

  /**
   * Gets the current result value
   * @returns {number} - The current calculation result
   */
  getResult() {
    return this.result;
  }

  /**
   * Resets the result to 0
   * @returns {Calculator} - Returns this for method chaining
   */
  reset() {
    this.result = 0;
    return this;
  }
}
