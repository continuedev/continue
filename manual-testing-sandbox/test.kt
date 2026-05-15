class Test {
    private var result: Double = 0.0

    /**
     * Validates that the input is a valid number.
     */
    private fun validateInput(number: Double) {
        if (number.isNaN() || number.isInfinite()) {
            throw IllegalArgumentException("Invalid number: must be a finite number")
        }
    }

    fun add(number: Double): Test {
        validateInput(number)
        result += number
        return this
    }

    fun subtract(number: Double): Test {
        validateInput(number)
        result -= number
        return this
    }

    fun multiply(number: Double): Test {
        validateInput(number)
        result *= number
        return this
    }

    fun divide(number: Double): Test {
        validateInput(number)
        if (number == 0.0) {
            throw ArithmeticException("Cannot divide by zero")
        }
        result /= number
        return this
    }

    fun getResult(): Double {
        return result
    }

    fun reset(): Test {
        result = 0.0
        return this
    }
}
