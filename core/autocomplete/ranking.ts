import { RangeInFileWithContents } from "../commands/util";

export type AutocompleteSnippet = RangeInFileWithContents & {
  score: number;
};

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
  ranges: RangeInFileWithContents[],
  windowAroundCursor: string
): AutocompleteSnippet[] {
  const snippets = ranges.map((snippet) => ({
    score: jaccardSimilarity(snippet.contents, windowAroundCursor),
    ...snippet,
  }));
  const uniqueSnippets = deduplicateSnippets(snippets);
  return uniqueSnippets.sort((a, b) => a.score - b.score);
}

/**
 * Deduplicate code snippets by merging overlapping ranges into a single range.
 */
export function deduplicateSnippets(
  snippets: AutocompleteSnippet[]
): AutocompleteSnippet[] {
  // Group by file
  const fileGroups: { [key: string]: AutocompleteSnippet[] } = {};
  for (const snippet of snippets) {
    if (!fileGroups[snippet.filepath]) {
      fileGroups[snippet.filepath] = [];
    }
    fileGroups[snippet.filepath].push(snippet);
  }

  // Merge overlapping ranges
  const allRanges = [];
  for (const file of Object.keys(fileGroups)) {
    allRanges.push(...mergeSnippetsByRange(fileGroups[file]));
  }
  return allRanges;
}

function mergeSnippetsByRange(
  snippets: AutocompleteSnippet[]
): AutocompleteSnippet[] {
  if (snippets.length === 0) {
    return snippets;
  }

  const sorted = snippets.sort(
    (a, b) => a.range.start.line - b.range.start.line
  );
  const merged: AutocompleteSnippet[] = [];

  while (sorted.length > 0) {
    const next = sorted.shift()!;
    const last = merged[merged.length - 1];
    if (merged.length > 0 && last.range.end.line >= next.range.start.line) {
      // Merge with previous snippet
      last.score = Math.max(last.score, next.score);
      last.range.end = next.range.end;
      last.contents = mergeOverlappingRangeContents(last, next);
    } else {
      merged.push(next);
    }
  }

  return merged;
}

function mergeOverlappingRangeContents(
  first: RangeInFileWithContents,
  second: RangeInFileWithContents
): string {
  const firstLines = first.contents.split("\n");
  const numOverlapping = first.range.end.line - second.range.start.line;
  return firstLines.slice(-numOverlapping).join("\n") + "\n" + second.contents;
}
