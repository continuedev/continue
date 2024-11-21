import { RangeInFileWithContents } from "../../../commands/util.js";

import { AutocompleteSnippet, jaccardSimilarity } from "./index.js";

function* slidingWindow(
  content: string,
  windowSize: number,
): Generator<string> {
  const lines = content.split("\n");

  let charCount = 0;
  let currWindowLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= windowSize) {
      yield currWindowLines.join("\n");
      currWindowLines = [lines[i]];
      charCount = 0;
    } else {
      currWindowLines.push(lines[i]);
    }
    charCount += lines[i].length;
  }

  if (currWindowLines.length > 0) {
    yield currWindowLines.join("\n");
  }
}

/**
 * Match by similarity over sliding windows of recent documents.
 * @param recentFiles
 * @param prefix
 * @param suffix
 */
export async function slidingWindowMatcher(
  recentFiles: RangeInFileWithContents[],
  windowAroundCursor: string,
  topN: number,
  windowSize: number,
): Promise<AutocompleteSnippet[]> {
  // Sorted lowest similarity to highest
  const topMatches: Required<AutocompleteSnippet>[] = [];

  for (const { filepath, contents, range } of recentFiles) {
    for (const window of slidingWindow(contents, windowSize)) {
      const score = jaccardSimilarity(window, windowAroundCursor);

      // Insertion sort
      let i = -1;
      while (++i < topMatches.length && score > topMatches[i].score) {}
      topMatches.splice(i + 1, 0, { filepath, contents, score, range });
      if (topMatches.length > topN) {
        topMatches.shift();
      }
    }
  }

  // TODO: convert the arbitrary window frame to some whole AST node?
  return topMatches;
}
