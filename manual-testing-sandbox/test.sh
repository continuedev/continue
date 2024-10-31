#!/bin/bash

function calculate {
    local a=$1
    local b=$2
    local op=$3
    local result

    case $op in
        "+") result=$((a + b)) ;;
        "-") result=$((a - b)) ;;
        "*") result=$((a * b)) ;;
        "/") result=$((a / b)) ;;
        *) echo "Invalid operator"; exit 1 ;;
    esac

    echo "Result: $result"
}

calculate 10 5 "+"
calculate 10 3 "-"
