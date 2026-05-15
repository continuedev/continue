class Calculator {
  private result: number;

  constructor() {
    this.result = 0;
  }

  /**
   * Validate that the input is a valid number.
   * @param number - The number to validate
   * @throws Error if the number is NaN, Infinity, or not a number type
   */
  private validateInput(number: number): void {
    if (typeof number !== "number" || !Number.isFinite(number)) {
      throw new TypeError("Invalid number input: expected a finite number");
    }
  }

  add(number: number): Calculator {
    this.validateInput(number);
    this.result += number;
    return this;
  }

  subtract(number: number): Calculator {
    this.validateInput(number);
    this.result -= number;
    return this;
  }

  multiply(number: number): Calculator {
    this.validateInput(number);
    this.result *= number;
    return this;
  }

  divide(number: number): Calculator {
    this.validateInput(number);
    if (number === 0) {
      throw new Error("Cannot divide by zero");
    }
    this.result /= number;
    return this;
  }

  getResult(): number {
    return this.result;
  }

  reset(): Calculator {
    this.result = 0;
    return this;
  }
}

export default Calculator;
