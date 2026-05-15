"""A simple calculator with fluent interface."""


class Calculator:
    """A simple calculator that supports chaining operations.
    
    Example:
        >>> calc = Calculator()
        >>> calc.add(10).subtract(5)
        >>> calc.result
        5
    """
    
    def __init__(self) -> None:
        """Initialize the calculator with a result of 0."""
        self._result: float = 0

    @property
    def result(self) -> float:
        """Get the current result.
        
        Returns:
            The current calculated result.
        """
        return self._result

    def add(self, number: int | float) -> 'Calculator':
        """Add a number to the result.
        
        Args:
            number: The number to add.
            
        Returns:
            Self for method chaining.
            
        Raises:
            TypeError: If number is not a valid numeric type.
        """
        if not isinstance(number, (int, float)) or isinstance(number, bool):
            raise TypeError(f"Expected a number, got {type(number).__name__}")
        self._result += float(number)
        return self

    def subtract(self, number: int | float) -> 'Calculator':
        """Subtract a number from the result.
        
        Args:
            number: The number to subtract.
            
        Returns:
            Self for method chaining.
            
        Raises:
            TypeError: If number is not a valid numeric type.
        """
        if not isinstance(number, (int, float)) or isinstance(number, bool):
            raise TypeError(f"Expected a number, got {type(number).__name__}")
        self._result -= float(number)
        return self

    def multiply(self, number: int | float) -> 'Calculator':
        """Multiply the result by a number.
        
        Args:
            number: The number to multiply by.
            
        Returns:
            Self for method chaining.
            
        Raises:
            TypeError: If number is not a valid numeric type.
        """
        if not isinstance(number, (int, float)) or isinstance(number, bool):
            raise TypeError(f"Expected a number, got {type(number).__name__}")
        self._result *= float(number)
        return self

    def divide(self, number: int | float) -> 'Calculator':
        """Divide the result by a number.
        
        Args:
            number: The number to divide by.
            
        Returns:
            Self for method chaining.
            
        Raises:
            TypeError: If number is not a valid numeric type.
            ZeroDivisionError: If number is zero.
        """
        if not isinstance(number, (int, float)) or isinstance(number, bool):
            raise TypeError(f"Expected a number, got {type(number).__name__}")
        if number == 0:
            raise ZeroDivisionError("Cannot divide by zero")
        self._result /= float(number)
        return self

    def reset(self) -> 'Calculator':
        """Reset the result to zero.
        
        Returns:
            Self for method chaining.
        """
        self._result = 0
        return self