import { FileWithContents } from "..";
import { symbolSimilarity } from "./ranking";

function* slidingWindow(
  content: string,
  windowSize: number
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
 * @param recentDocuments
 * @param prefix
 * @param suffix
 */
export async function slidingWindowMatcher(
  recentDocuments: FileWithContents[],
  prefix: string,
  suffix: string,
  topN: number,
  slidingWindowPrefixPercentage: number,
  windowSize: number
): Promise<FileWithContents[]> {
  // Sorted lowest similarity to highest
  const topMatches: (FileWithContents & { similarity: number })[] = [];

  for (const { filepath, contents } of recentDocuments) {
    for (const window of slidingWindow(contents, windowSize)) {
      const similarity = symbolSimilarity(
        window,
        prefix.slice(-windowSize * slidingWindowPrefixPercentage) +
          suffix.slice(windowSize * (1 - slidingWindowPrefixPercentage))
      );

      // Insertion sort
      let i = -1;
      while (
        ++i < topMatches.length &&
        similarity > topMatches[i].similarity
      ) {}
      topMatches.splice(i + 1, 0, { filepath, contents, similarity });
      if (topMatches.length > topN) {
        topMatches.shift();
      }
    }
  }

  return topMatches;
}
