import { FileWithContents } from "..";

const rx = /[\s.,\/#!$%\^&\*;:{}=\-_`~()\[\]]/g;
function getSymbolsForSnippet(snippet: string): Set<string> {
  const symbols = snippet
    .split(rx)
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return new Set(symbols);
}

/**
 * Calculate similarity as number of shared symbols divided by total number of unique symbols between both.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const aSet = getSymbolsForSnippet(a);
  const bSet = getSymbolsForSnippet(b);
  const union = new Set([...aSet, ...bSet]).size;

  // Avoid division by zero
  if (union === 0) {
    return 0;
  }

  let intersection = 0;
  for (const symbol of aSet) {
    if (bSet.has(symbol)) {
      intersection++;
    }
  }

  return intersection / union;
}

/**
 * Rank code snippets to be used in tab-autocomplete prompt. Returns a sorted version of the snippet array.
 */
export function rankSnippets(
  snippets: FileWithContents[],
  windowAroundCursor: string
): FileWithContents[] {
  const scores = snippets.map((snippet) => ({
    score: jaccardSimilarity(snippet.contents, windowAroundCursor),
    snippet,
  }));
  return scores.sort((a, b) => a.score - b.score).map((s) => s.snippet);
}
