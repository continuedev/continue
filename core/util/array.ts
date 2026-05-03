/**
 * Pure array utilities.
 * Ported from Marcel (src/utils/array.ts).
 */

/**
 * Intersperse a separator between every element of an array.
 * @example intersperse([1,2,3], () => 0) → [1, 0, 2, 0, 3]
 */
export function intersperse<A>(as: A[], separator: (index: number) => A): A[] {
  return as.flatMap((a, i) => (i ? [separator(i), a] : [a]));
}

/**
 * Count the number of elements satisfying a predicate.
 * @example count([1,2,3,4], x => x % 2 === 0) → 2
 */
export function count<T>(arr: readonly T[], pred: (x: T) => unknown): number {
  let n = 0;
  for (const x of arr) n += +!!pred(x);
  return n;
}

/**
 * Remove duplicate values from an iterable, returning a new array.
 * @example uniq([1, 2, 1, 3]) → [1, 2, 3]
 */
export function uniq<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)];
}
