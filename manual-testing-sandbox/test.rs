use std::io;

fn main() {
    println!("Welcome to the Calculator!");

    loop {
        println!("Please enter an operator (+, -, *, /) or 'q' to quit:");
        let operator = read_input();

        if operator == "q" {
            break;
        }

        println!("Please enter the first number:");
        let num1 = read_input().parse::<f64>().unwrap();

        println!("Please enter the second number:");
        let num2 = read_input().parse::<f64>().unwrap();

        let result = match operator.as_str() {
            "+" => num1 + num2,
            "-" => num1 - num2,
            "*" => num1 * num2,
            "/" => num1 / num2,
            _ => {
                println!("Invalid operator. Please try again.");
                continue;
            }
        };

        println!("Result: {}", result);
    }
}

fn read_input() -> String {
    let mut input = String::new();
    io::stdin()
        .read_line(&mut input)
        .expect("Failed to read input");
    input.trim().to_string()
}
