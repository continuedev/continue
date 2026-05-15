# frozen_string_literal: true

# A simple calculator with fluent interface.
class Calculator
  # @return [Float] The current result
  attr_reader :result

  def initialize
    @result = 0.0
  end

  # Add a number to the result.
  # @param number [Numeric] The number to add
  # @return [self]
  # @raise [TypeError] If number is not numeric
  def add(number)
    raise TypeError, "Expected a numeric value, got #{number.class}" unless number.is_a?(Numeric)
    @result += number.to_f
    self
  end

  # Subtract a number from the result.
  # @param number [Numeric] The number to subtract
  # @return [self]
  # @raise [TypeError] If number is not numeric
  def subtract(number)
    raise TypeError, "Expected a numeric value, got #{number.class}" unless number.is_a?(Numeric)
    @result -= number.to_f
    self
  end

  # Multiply the result by a number.
  # @param number [Numeric] The number to multiply by
  # @return [self]
  # @raise [TypeError] If number is not numeric
  def multiply(number)
    raise TypeError, "Expected a numeric value, got #{number.class}" unless number.is_a?(Numeric)
    @result *= number.to_f
    self
  end

  # Divide the result by a number.
  # @param number [Numeric] The number to divide by
  # @return [self]
  # @raise [ZeroDivisionError] If dividing by zero
  # @raise [TypeError] If number is not numeric
  def divide(number)
    raise TypeError, "Expected a numeric value, got #{number.class}" unless number.is_a?(Numeric)
    raise ZeroDivisionError, "Cannot divide by zero" if number == 0
    @result /= number.to_f
    self
  end

  # Reset the result to zero.
  # @return [self]
  def reset
    @result = 0.0
    self
  end
end

# Example usage
calc = Calculator.new
calc.add(5).subtract(3)
puts "Result: #{calc.result}"
