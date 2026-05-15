class Calculator {
  constructor() {
    this.result = 0;
  }

  /**
   * Add a number to the result.
   * @param {number} number - The number to add
   * @returns {Calculator} This calculator instance
   */
  add(number) {
    if (typeof number !== "number" || !Number.isFinite(number)) {
      throw new TypeError("Expected a valid number");
    }
    this.result += number;
    return this;
  }

  /**
   * Subtract a number from the result.
   * @param {number} number - The number to subtract
   * @returns {Calculator} This calculator instance
   */
  subtract(number) {
    if (typeof number !== "number" || !Number.isFinite(number)) {
      throw new TypeError("Expected a valid number");
    }
    this.result -= number;
    return this;
  }

  /**
   * Multiply the result by a number.
   * @param {number} number - The number to multiply by
   * @returns {Calculator} This calculator instance
   */
  multiply(number) {
    if (typeof number !== "number" || !Number.isFinite(number)) {
      throw new TypeError("Expected a valid number");
    }
    this.result *= number;
    return this;
  }

  /**
   * Divide the result by a number.
   * @param {number} number - The number to divide by
   * @returns {Calculator} This calculator instance
   * @throws {Error} If dividing by zero
   */
  divide(number) {
    if (typeof number !== "number" || !Number.isFinite(number)) {
      throw new TypeError("Expected a valid number");
    }
    if (number === 0) {
      throw new RangeError("Cannot divide by zero");
    }
    this.result /= number;
    return this;
  }

  /**
   * Get the current result.
   * @returns {number} The current result
   */
  getResult() {
    return this.result;
  }

  /**
   * Reset the result to zero.
   * @returns {Calculator} This calculator instance
   */
  reset() {
    this.result = 0;
    return this;
  }
}

module.exports = Calculator;
