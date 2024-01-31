export function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

export function repeat(n: number, a: string) {
    return a.repeat(n);
}