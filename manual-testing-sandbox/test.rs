use std::io;

#[derive(Debug)]
enum CalculatorError {
    InvalidInput(String),
    DivisionByZero,
    ParseError(std::num::ParseFloatError),
}

impl std::fmt::Display for CalculatorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CalculatorError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            CalculatorError::DivisionByZero => write!(f, "Error: Division by zero"),
            CalculatorError::ParseError(e) => write!(f, "Error parsing number: {}", e),
        }
    }
}

fn read_input() -> Result<String, CalculatorError> {
    let mut input = String::new();
    io::stdin()
        .read_line(&mut input)
        .map_err(|e| CalculatorError::InvalidInput(format!("Failed to read input: {}", e)))?;
    Ok(input.trim().to_string())
}

fn parse_number(input: &str) -> Result<f64, CalculatorError> {
    input
        .trim()
        .parse::<f64>()
        .map_err(CalculatorError::ParseError)
}

fn calculate(num1: f64, num2: f64, operator: &str) -> Result<f64, CalculatorError> {
    match operator {
        "+" => Ok(num1 + num2),
        "-" => Ok(num1 - num2),
        "*" => Ok(num1 * num2),
        "/" => {
            if num2 == 0.0 {
                Err(CalculatorError::DivisionByZero)
            } else {
                Ok(num1 / num2)
            }
        }
        _ => Err(CalculatorError::InvalidInput(format!(
            "Invalid operator: '{}'. Use +, -, *, or /",
            operator
        ))),
    }
}

fn main() {
    println!("Welcome to the Calculator!");

    loop {
        println!("\nPlease enter an operator (+, -, *, /) or 'q' to quit:");
        let operator = match read_input() {
            Ok(input) => input,
            Err(e) => {
                eprintln!("{}", e);
                continue;
            }
        };

        if operator == "q" || operator == "quit" {
            println!("Goodbye!");
            break;
        }

        println!("\nPlease enter the first number:");
        let num1 = match read_input() {
            Ok(input) => match parse_number(&input) {
                Ok(n) => n,
                Err(e) => {
                    eprintln!("{}", e);
                    continue;
                }
            },
            Err(e) => {
                eprintln!("{}", e);
                continue;
            }
        };

        println!("\nPlease enter the second number:");
        let num2 = match read_input() {
            Ok(input) => match parse_number(&input) {
                Ok(n) => n,
                Err(e) => {
                    eprintln!("{}", e);
                    continue;
                }
            },
            Err(e) => {
                eprintln!("{}", e);
                continue;
            }
        };

        match calculate(num1, num2, &operator) {
            Ok(result) => {
                // Format the result to remove unnecessary trailing zeros
                let formatted_result = if result.fract() == 0.0 {
                    format!("{}", result as i64)
                } else {
                    format!("{}", result)
                };
                println!("\nResult: {}", formatted_result);
            }
            Err(e) => {
                eprintln!("{}", e);
            }
        }
    }
}
