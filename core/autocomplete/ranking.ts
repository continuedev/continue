import { FileWithContents } from "..";

function getSymbolsForSnippet(snippet: string): Set<string> {
  const symbols = snippet
    .split(
      new RegExp(
        `[s\.\:\'\,\;\"\*\&\^\|\\\#\@\$\!\%\(\)\[\]\{\}\<\>\/\?\+\-\/]`,
        "g"
      )
    )
    .map((s) => s.trim());
  return new Set(symbols);
}

/**
 * Calculate similarity as number of shared symbols divided by total number of unique symbols between both.
 */
export function symbolSimilarity(a: string, b: string): number {
  const aSet = getSymbolsForSnippet(a);
  const bSet = getSymbolsForSnippet(b);
  const totalSet = new Set([...aSet, ...bSet]);

  // Avoid division by zero
  if (totalSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const symbol of aSet) {
    if (bSet.has(symbol)) {
      intersection++;
    }
  }

  return intersection / totalSet.size;
}

/**
 * Rank code snippets to be used in tab-autocomplete prompt. Returns a sorted version of the snippet array.
 */
export function rankSnippets(
  snippets: FileWithContents[],
  prefix: string,
  suffix: string,
  slidingWindowPrefixPercentage: number,
  windowSize: number
): FileWithContents[] {
  const scores = snippets.map((snippet) => {
    const b =
      prefix.slice(-windowSize * slidingWindowPrefixPercentage) +
      suffix.slice(0, windowSize * (1 - slidingWindowPrefixPercentage));

    return {
      score: symbolSimilarity(snippet.contents, b),
      snippet,
    };
  });
  return scores.sort((a, b) => a.score - b.score).map((s) => s.snippet);
}
