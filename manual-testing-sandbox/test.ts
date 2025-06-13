class Calculator {
  private result: number;

  constructor() {
    this.result = 0;
  }

  add(number: number): Calculator {
    this.result += number;
    return this;
  }

  subtract(number: number): Calculator {
    this.result -= number;
    return this;
  }

  multiply(number: number): Calculator {
    this.result *= number;
    return this;
  }

  divide(number: number): Calculator {
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
