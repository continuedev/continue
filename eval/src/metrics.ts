import { Chunk } from "@continuedev/core/index.js";

export function accuracy(results: Chunk[], expected: string[]): number {
  let score = 0;
  const uniqueFilepaths = new Set<string>(results.map((r) => r.filepath));
  for (const filepath of uniqueFilepaths) {
    if (expected.includes(filepath)) {
      score += 1;
    }
  }
  return score / expected.length;
}

export function accuracyVsNumResults(
  results: Chunk[],
  expected: string[],
): number[] {
  const accuracies: number[] = [];

  for (let i = results.length; i > 0; i--) {
    const partialResults = results.slice(i - 1);
    accuracies.push(accuracy(partialResults, expected));
  }

  return accuracies;
}
