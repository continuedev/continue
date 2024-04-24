import { factorial, repeat } from "./factorial";

function fib(n) {
    if (n <= 1) return n;
    return fib(n - 2) + fib(n - 1);
}

let d = repeat(5, "a");
console.log(d);

let e = factorial(3);
console.log(e);