class test {
    private var result: Double = 0.0

    fun add(number: Double): test {
        result += number
        return this
    }

    fun subtract(number: Double): test {
        result -= number
        return this
    }

    fun multiply(number: Double): test {
        result *= number
        return this
    }

    fun divide(number: Double): test {
        if (number == 0.0) {
            throw IllegalArgumentException("Cannot divide by zero")
        }
        result /= number
        return this
    }

    fun getResult(): Double {
        return result
    }

    fun reset(): test {
        result = 0.0
        return this
    }
}
