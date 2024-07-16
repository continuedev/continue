import { Chunk } from "@continuedev/core/index.js";

export function accuracy(results: Chunk[], expected: string[]): number {
  let score = 0;
  for (const result of results) {
    if (expected.includes(result.filepath)) {
      score += 1;
    }
  }
  return score / expected.length;
}
