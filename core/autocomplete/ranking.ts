import { Range } from "..";
import { RangeInFileWithContents } from "../commands/util";
import { countTokens } from "../llm/countTokens";

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
  windowAroundCursor: string,
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
  snippets: AutocompleteSnippet[],
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
  snippets: AutocompleteSnippet[],
): AutocompleteSnippet[] {
  if (snippets.length === 0) {
    return snippets;
  }

  const sorted = snippets.sort(
    (a, b) => a.range.start.line - b.range.start.line,
  );
  const merged: AutocompleteSnippet[] = [];

  while (sorted.length > 0) {
    const next = sorted.shift()!;
    const last = merged[merged.length - 1];
    if (merged.length > 0 && last.range.end.line >= next.range.start.line) {
      // Merge with previous snippet
      last.score = Math.max(last.score, next.score);
      try {
        last.range.end = next.range.end;
      } catch (e) {
        console.log("Error merging ranges", e);
      }
      last.contents = mergeOverlappingRangeContents(last, next);
    } else {
      merged.push(next);
    }
  }

  return merged;
}

function mergeOverlappingRangeContents(
  first: RangeInFileWithContents,
  second: RangeInFileWithContents,
): string {
  const firstLines = first.contents.split("\n");
  const numOverlapping = first.range.end.line - second.range.start.line;
  return firstLines.slice(-numOverlapping).join("\n") + "\n" + second.contents;
}

/**
 * Fill the allowed space with snippets
 */
export function fillPromptWithSnippets(
  snippets: AutocompleteSnippet[],
  maxSnippetTokens: number,
  modelName: string,
): AutocompleteSnippet[] {
  let tokensRemaining = maxSnippetTokens;
  const keptSnippets: AutocompleteSnippet[] = [];
  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i];
    const tokenCount = countTokens(snippet.contents, modelName);
    if (tokensRemaining - tokenCount >= 0) {
      tokensRemaining -= tokenCount;
      keptSnippets.push(snippet);
    } else {
      continue;
    }
  }

  return keptSnippets;
}

function rangeIntersectionByLines(a: Range, b: Range): Range | null {
  const startLine = Math.max(a.start.line, b.start.line);
  const endLine = Math.min(a.end.line, b.end.line);
  if (startLine >= endLine) {
    return null;
  } else {
    return {
      start: {
        line: startLine,
        character: 0,
      },
      end: {
        line: endLine,
        character: 0,
      },
    };
  }
}

/**
 * Remove one range from another range, which may lead to returning two disjoint ranges
 */
function rangeDifferenceByLines(orig: Range, remove: Range): Range[] {
  if (
    orig.start.line >= remove.start.line &&
    orig.end.line <= remove.end.line
  ) {
    // / | | /
    return [];
  } else if (
    orig.start.line <= remove.start.line &&
    orig.end.line >= remove.end.line
  ) {
    // | / / |
    // Splits the range
    return [
      {
        start: orig.start,
        end: remove.start,
      },
      {
        start: remove.end,
        end: orig.end,
      },
    ];
  } else if (
    orig.start.line >= remove.start.line &&
    orig.end.line >= remove.end.line
  ) {
    // \ | / |
    return [
      {
        start: remove.end,
        end: orig.end,
      },
    ];
  } else if (
    orig.start.line <= remove.start.line &&
    orig.end.line <= remove.end.line
  ) {
    // | / | /
    return [
      {
        start: orig.start,
        end: remove.start,
      },
    ];
  } else {
    return [orig];
  }
}

export function removeRangeFromSnippets(
  snippets: AutocompleteSnippet[],
  filepath: string,
  range: Range,
): AutocompleteSnippet[] {
  const finalSnippets: AutocompleteSnippet[] = [];
  for (let snippet of snippets) {
    if (snippet.filepath !== filepath) {
      finalSnippets.push(snippet);
      continue;
    }

    const intersection = rangeIntersectionByLines(range, snippet.range);
    if (!intersection) {
      finalSnippets.push(snippet);
    } else {
      finalSnippets.push(
        ...rangeDifferenceByLines(snippet.range, intersection).map((range) => ({
          ...snippet,
          range,
        })),
      );
    }
  }

  return finalSnippets;
}
