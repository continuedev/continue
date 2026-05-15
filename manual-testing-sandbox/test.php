<?php

/**
 * A calculator that supports fluent chaining of operations.
 */
class Calculator
{
    private float $result = 0.0;

    /**
     * Validates that the input is a valid number.
     *
     * @param float $number
     * @throws InvalidArgumentException if the number is NaN or Infinity
     */
    private function validateInput(float $number): void
    {
        if (!is_finite($number)) {
            throw new InvalidArgumentException('Invalid number: must be a finite number');
        }
    }

    /**
     * Adds a number to the result.
     *
     * @param float $number
     * @return self
     */
    public function add(float $number): self
    {
        $this->validateInput($number);
        $this->result += $number;
        return $this;
    }

    /**
     * Subtracts a number from the result.
     *
     * @param float $number
     * @return self
     */
    public function subtract(float $number): self
    {
        $this->validateInput($number);
        $this->result -= $number;
        return $this;
    }

    /**
     * Multiplies the result by a number.
     *
     * @param float $number
     * @return self
     */
    public function multiply(float $number): self
    {
        $this->validateInput($number);
        $this->result *= $number;
        return $this;
    }

    /**
     * Divides the result by a number.
     *
     * @param float $number
     * @return self
     * @throws DivisionByZeroError
     */
    public function divide(float $number): self
    {
        if ($number === 0.0) {
            throw new DivisionByZeroError('Division by zero is not allowed.');
        }
        $this->result /= $number;
        return $this;
    }

    /**
     * Gets the current result.
     *
     * @return float
     */
    public function getResult(): float
    {
        return $this->result;
    }

    /**
     * Resets the result to zero.
     *
     * @return self
     */
    public function reset(): self
    {
        $this->result = 0.0;
        return $this;
    }
}

// Example usage
try {
    $calc = new Calculator();
    $calc->add(10)->subtract(5);
    echo "Result: " . $calc->getResult() . "\n";

    // Test division by zero
    $calc->divide(0);
} catch (DivisionByZeroError $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

