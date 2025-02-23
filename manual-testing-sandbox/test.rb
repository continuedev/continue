class Calculator
  attr_accessor :result

  def initialize
    @result = 0
  end

  def add(number)
    @result += number
    self
  end

  def subtract(number)
    @result -= number
    self
  end

  def get_result
    @result
  end

  def reset
    @result = 0
    self
  end
end

calc = Calculator.new
calc.add(5).subtract(3)
puts "Result: #{calc.get_result}"
