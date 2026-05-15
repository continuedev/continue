using System;

public class Program
{
    public static void Main(string[] args)
    {
        Console.WriteLine("Hello World!");
        Calculator calc = new Calculator();
        calc.Add(5).Subtract(3);
        Console.WriteLine("Result: " + calc.GetResult());
    }
}

/// <summary>
/// A calculator that supports fluent chaining of operations.
/// </summary>
public class Calculator
{
    private double result;

    /// <summary>
    /// Validates that the input is a valid number.
    /// </summary>
    /// <param name="number">The number to validate.</param>
    /// <exception cref="ArgumentException">Thrown when the number is NaN or Infinity.</exception>
    private void ValidateInput(double number)
    {
        if (double.IsNaN(number) || double.IsInfinity(number))
            throw new ArgumentException("Invalid number: must be a finite number", nameof(number));
    }

    /// <summary>
    /// Adds a number to the result.
    /// </summary>
    /// <param name="number">The number to add.</param>
    /// <returns>This calculator instance for method chaining.</returns>
    public Calculator Add(double number)
    {
        ValidateInput(number);
        result += number;
        return this;
    }

    /// <summary>
    /// Subtracts a number from the result.
    /// </summary>
    /// <param name="number">The number to subtract.</param>
    /// <returns>This calculator instance for method chaining.</returns>
    public Calculator Subtract(double number)
    {
        ValidateInput(number);
        result -= number;
        return this;
    }

    /// <summary>
    /// Multiplies the result by a number.
    /// </summary>
    /// <param name="number">The number to multiply by.</param>
    /// <returns>This calculator instance for method chaining.</returns>
    public Calculator Multiply(double number)
    {
        ValidateInput(number);
        result *= number;
        return this;
    }

    /// <summary>
    /// Divides the result by a number.
    /// </summary>
    /// <param name="number">The number to divide by.</param>
    /// <returns>This calculator instance for method chaining.</returns>
    /// <exception cref="DivideByZeroException">Thrown when dividing by zero.</exception>
    public Calculator Divide(double number)
    {
        ValidateInput(number);
        if (number == 0)
            throw new DivideByZeroException("Cannot divide by zero");
        result /= number;
        return this;
    }

    /// <summary>
    /// Gets the current result.
    /// </summary>
    /// <returns>The current result.</returns>
    public double GetResult()
    {
        return result;
    }

    /// <summary>
    /// Resets the result to zero.
    /// </summary>
    /// <returns>This calculator instance for method chaining.</returns>
    public Calculator Reset()
    {
        result = 0;
        return this;
    }
}