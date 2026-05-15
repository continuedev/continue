/**
 * A calculator that supports fluent chaining of operations.
 */
public class Calculator {
    private double result;

    /**
     * Creates a new Calculator with initial result of 0.0.
     */
    public Calculator() {
        this.result = 0.0;
    }

    /**
     * Validates that the input is a valid number.
     * 
     * @param number the number to validate
     * @throws IllegalArgumentException if the number is NaN or Infinity
     */
    private void validateInput(double number) {
        if (Double.isNaN(number) || Double.isInfinite(number)) {
            throw new IllegalArgumentException("Invalid number: must be a finite number");
        }
    }

    /**
     * Adds a number to the result.
     *
     * @param number the number to add
     * @return this calculator instance for method chaining
     * @throws IllegalArgumentException if number is NaN or Infinity
     */
    public Calculator add(double number) {
        validateInput(number);
        result += number;
        return this;
    }

    /**
     * Subtracts a number from the result.
     *
     * @param number the number to subtract
     * @return this calculator instance for method chaining
     * @throws IllegalArgumentException if number is NaN or Infinity
     */
    public Calculator subtract(double number) {
        validateInput(number);
        result -= number;
        return this;
    }

    /**
     * Multiplies the result by a number.
     *
     * @param number the number to multiply by
     * @return this calculator instance for method chaining
     * @throws IllegalArgumentException if number is NaN or Infinity
     */
    public Calculator multiply(double number) {
        validateInput(number);
        result *= number;
        return this;
    }

    /**
     * Divides the result by a number.
     *
     * @param number the number to divide by
     * @return this calculator instance for method chaining
     * @throws IllegalArgumentException if number is NaN, Infinity, or zero
     */
    public Calculator divide(double number) {
        validateInput(number);
        if (number == 0.0) {
            throw new IllegalArgumentException("Cannot divide by zero");
        }
        result /= number;
        return this;
    }

    /**
     * Gets the current result.
     *
     * @return the current result
     */
    public double getResult() {
        return result;
    }

    /**
     * Resets the result to zero.
     *
     * @return this calculator instance for method chaining
     */
    public Calculator reset() {
        result = 0;
        return this;
    }

    /**
     * Main method to demonstrate calculator usage.
     *
     * @param args command line arguments (not used)
     */
    public static void main(String[] args) {
        Calculator calc = new Calculator();
        calc.add(10).subtract(5);
        System.out.println("Result: " + calc.getResult());
    }
}
