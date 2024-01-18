function fib(n) {
    if (n <= 1) return n;
    return fib(n - 2) + fib(n - 1);
}

function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}