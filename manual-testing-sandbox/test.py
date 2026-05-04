class Calculator:
    def __init__(self):
        self.result = 0

    def add(self, number):
        self.result += number
        return self

    def subtract(self, number):
        self.result -= number
        return self

    def multiply(self, number):
        self.result *= number
        return self

    def divide(self, number):
        if number == 0:
            raise ValueError("Cannot divide by zero")
        self.result /= number
        return self

    def reset(self):
        self.result = 0
        return self

    def get_result(self):
        return self.result