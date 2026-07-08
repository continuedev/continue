class Test {
    private var result: Double = 0.0

    fun add(number: Double): Test {
        result += number
        return this
    }

    fun subtract(number: Double): Test {
        result -= number
        return this
    }

    fun multiply(number: Double): Test {
        result *= number
        return this
    }

    fun divide(number: Double): Test {
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
