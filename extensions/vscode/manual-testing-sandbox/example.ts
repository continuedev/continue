
// Importing factorial and repeat functions from factorial module
import { factorial, repeat } from "./factorial";

// Function to calculate fibonacci series
function fib(n) {
    if (n <= 1) return n;
    return fib(n - 2) + fib(n - 1);
}

// Using repeat function to repeat "a" 5 times
let d = repeat(5, "a");
console.log(d);

// Using factorial function to calculate factorial of 3
let e = factorial(3);

