
// Importing factorial and repeat functions from factorial module
import { factorial, repeat } from "./factorial";

// Function to calculate fibonacci series using memoization (dynamic programming)
function fib(n, mem = {}) {
    if (n in mem) return mem[n];  // Return from memory if available
    if (n <= 2) return n > 0 ? 1 : 0; // Base case: Fibonacci series starts with 1 for positive numbers and 0 or 1 otherwise
    mem[n] = fib(n - 1, mem) + fib(n - 2, mem); // Memorize the result to avoid redundant calculations in future recursive calls
    return mem[n];
}

// Using repeat function to repeat "a" 5 times
let d = repeat(5, "a");
console.log(d);

// Using factorial function to calculate factorial of 3
let factResult = factorial(3);



