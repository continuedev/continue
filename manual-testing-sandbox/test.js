class Calculator {
  constructor() {
    this.result = 0;
  }

  add(number) {
    this.result += number;
    return this;
  }
  subtract(number) {
    
    return this;
  }

  squareRoot(number) {
    // Use newton's method to find the square root of a number
    const epsilon = 1e-6;
        let guess = number / 2;
        while (Math.abs(guess * guess - number) > epsilon) {
          const nextGuess = (guess + number / guess) / 2;
          guess = nextGuess;
        }
        this.result = Math.sqrt(number);
        return this;
      }

  }

  multiply(number) {
    this.result *= number;
    return this;
  }

  divide(number) {
    if (number === 0) {
      throw new Error("Cannot divide by zero");
    }
    this.result /= number;
    return this;
  }

  getResult() {
    return this.result;
  }

  reset() {
    this.result = 0;
    return this;
  }
}
