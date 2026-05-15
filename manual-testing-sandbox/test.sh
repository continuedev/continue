#!/bin/bash

# A calculator script that supports basic arithmetic operations
# Usage: ./test.sh [operator] [number1] [number2]
# Operators: +, -, *, /

set -euo pipefail

# Display usage information
usage() {
    echo "Usage: $0 [operator] [number1] [number2]"
    echo ""
    echo "Operators:"
    echo "  +  Addition"
    echo "  -  Subtraction"
    echo "  *  Multiplication"
    echo "  /  Division"
    echo ""
    echo "Examples:"
    echo "  $0 10 5 +"
    echo "  $0 10 3 -"
    exit 1
}

# Validate that a string is a valid number (integer or float)
is_valid_number() {
    local num="$1"
    if [[ "$num" =~ ^-?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$ ]]; then
        return 0
    else
        return 1
    fi
}

# Perform calculation with error handling
calculate() {
    local a="$1"
    local b="$2"
    local op="$3"

    # Validate inputs
    if ! is_valid_number "$a"; then
        echo "Error: '$a' is not a valid number" >&2
        return 1
    fi

    if ! is_valid_number "$b"; then
        echo "Error: '$b' is not a valid number" >&2
        return 1
    fi

    local result
    case "$op" in
        "+")
            result=$(echo "$a + $b" | bc -l)
            ;;
        "-")
            result=$(echo "$a - $b" | bc -l)
            ;;
        "*")
            result=$(echo "$a * $b" | bc -l)
            ;;
        "/")
            # Check for division by zero
            if [[ "$b" == "0" || "$b" == "0.0" || "$b" == "0.00" ]]; then
                echo "Error: Division by zero" >&2
                return 1
            fi
            result=$(echo "scale=10; $a / $b" | bc -l)
            # Remove trailing zeros
            result=$(echo "$result" | sed 's/\.\{0,1\}0*$//')
            ;;
        *)
            echo "Error: Invalid operator '$op'. Use +, -, *, or /" >&2
            return 1
            ;;
    esac

    echo "Result: $result"
}

# Main
if [[ $# -eq 3 ]]; then
    calculate "$1" "$2" "$3"
elif [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    usage
else
    echo "Error: Expected 3 arguments (number1, number2, operator)" >&2
    echo "" >&2
    usage
fi
