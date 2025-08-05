/**
 * Represents a basic match result with start and end character positions
 */
interface BasicMatchResult {
  /** The starting character index of the match in the file content */
  startIndex: number;
  /** The ending character index of the match in the file content */
  endIndex: number;
}

/**
 * Represents a match result with start and end character positions
 */
export interface SearchMatchResult extends BasicMatchResult {
  /** The name of the strategy that successfully matched */
  strategyName: string;
}

/**
 * Strategy function type for finding matches
 */
type MatchStrategy = (
  fileContent: string,
  searchContent: string,
) => BasicMatchResult | null;

/**
 * Exact string matching strategy
 */
function exactMatch(
  fileContent: string,
  searchContent: string,
): BasicMatchResult | null {
  const exactIndex = fileContent.indexOf(searchContent);
  if (exactIndex !== -1) {
    return {
      startIndex: exactIndex,
      endIndex: exactIndex + searchContent.length,
    };
  }
  return null;
}

/**
 * Trimmed content matching strategy
 * Finds content where the search content (when trimmed) matches content in the file,
 * and returns the span that includes the file content's whitespace
 */
function trimmedMatch(
  fileContent: string,
  searchContent: string,
): BasicMatchResult | null {
  const trimmedSearchContent = searchContent.trim();

  // Don't apply if search content has no leading/trailing whitespace to trim
  if (trimmedSearchContent === searchContent) {
    return null;
  }

  // Don't match if trimmed content is empty
  if (trimmedSearchContent === "") {
    return null;
  }

  // Look for the trimmed content in the file
  const trimmedContentIndex = fileContent.indexOf(trimmedSearchContent);
  if (trimmedContentIndex === -1) {
    return null;
  }

  // Find the boundaries that include surrounding whitespace (but not newlines)
  // Look backwards for horizontal whitespace (spaces and tabs)
  let startIndex = trimmedContentIndex;
  while (startIndex > 0 && /[ \t]/.test(fileContent[startIndex - 1])) {
    startIndex--;
  }

  // Look forwards for horizontal whitespace (spaces and tabs)
  let endIndex = trimmedContentIndex + trimmedSearchContent.length;
  while (endIndex < fileContent.length && /[ \t]/.test(fileContent[endIndex])) {
    endIndex++;
  }

  return {
    startIndex,
    endIndex,
  };
}

/**
 * Whitespace-ignored matching strategy
 * Removes all whitespace from both content and search, then finds the match
 */
function whitespaceIgnoredMatch(
  fileContent: string,
  searchContent: string,
): BasicMatchResult | null {
  // Remove all whitespace (spaces, tabs, newlines, etc.)
  const strippedFileContent = fileContent.replace(/\s/g, "");
  const strippedSearchContent = searchContent.replace(/\s/g, "");

  if (strippedSearchContent === "") {
    return null; // Empty search after stripping whitespace
  }

  const strippedIndex = strippedFileContent.indexOf(strippedSearchContent);
  if (strippedIndex === -1) {
    return null;
  }

  // Map the stripped position back to the original file content
  let originalStartIndex = 0;
  let strippedCharCount = 0;

  // Find the original position by counting non-whitespace characters
  for (let i = 0; i < fileContent.length; i++) {
    if (strippedCharCount === strippedIndex) {
      originalStartIndex = i;
      break;
    }
    if (!/\s/.test(fileContent[i])) {
      strippedCharCount++;
    }
  }

  // Find the end position by counting the length of the search content
  let originalEndIndex = originalStartIndex;
  let matchedChars = 0;

  for (
    let i = originalStartIndex;
    i < fileContent.length && matchedChars < strippedSearchContent.length;
    i++
  ) {
    if (!/\s/.test(fileContent[i])) {
      matchedChars++;
    }
    originalEndIndex = i + 1;
  }

  return {
    startIndex: originalStartIndex,
    endIndex: originalEndIndex,
  };
}

/**
 * Calculate the Jaro similarity between two strings
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  if (matchDistance < 0) return 0.0;

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3.0
  );
}

/**
 * Calculate the Jaro-Winkler similarity between two strings
 */
function jaroWinklerSimilarity(
  s1: string,
  s2: string,
  prefixScale = 0.1,
): number {
  const jaroSim = jaroSimilarity(s1, s2);

  if (jaroSim < 0.7) return jaroSim;

  // Calculate common prefix length (up to 4 characters)
  let prefixLength = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));

  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  return jaroSim + prefixLength * prefixScale * (1 - jaroSim);
}

/**
 * Find the best fuzzy match for search content in file content using Jaro-Winkler
 */
function findFuzzyMatch(
  fileContent: string,
  searchContent: string,
  threshold: number = 0.9,
): BasicMatchResult | null {
  const searchLines = searchContent.split("\n");
  const fileLines = fileContent.split("\n");

  let bestMatch: BasicMatchResult | null = null;
  let bestSimilarity = 0;

  // Try matching the search content as a whole block
  const searchBlock = searchContent.trim();
  if (searchBlock.length > 5) {
    // Require minimum length for meaningful matches
    // Use sliding window approach for multi-line search
    for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
      const candidateLines = fileLines.slice(i, i + searchLines.length);
      const candidateBlock = candidateLines.join("\n").trim();

      if (candidateBlock.length < 5) continue; // Skip very short blocks

      const similarity = jaroWinklerSimilarity(searchBlock, candidateBlock);

      if (similarity >= threshold && similarity > bestSimilarity) {
        // Calculate character positions
        const linesBeforeMatch = fileLines.slice(0, i);
        const startIndex =
          linesBeforeMatch.join("\n").length +
          (linesBeforeMatch.length > 0 ? 1 : 0);
        const endIndex = startIndex + candidateBlock.length;

        bestMatch = {
          startIndex,
          endIndex,
        };
        bestSimilarity = similarity;
      }
    }
  }

  // Also try line-by-line matching for better granularity
  for (
    let searchLineIdx = 0;
    searchLineIdx < searchLines.length;
    searchLineIdx++
  ) {
    const searchLine = searchLines[searchLineIdx].trim();
    if (searchLine.length === 0 || searchLine.length < 3) continue; // Skip very short lines

    for (let fileLineIdx = 0; fileLineIdx < fileLines.length; fileLineIdx++) {
      const fileLine = fileLines[fileLineIdx].trim();
      if (fileLine.length === 0 || fileLine.length < 3) continue; // Skip very short lines

      const similarity = jaroWinklerSimilarity(searchLine, fileLine);

      if (similarity >= threshold && similarity > bestSimilarity) {
        // Calculate character positions for the line
        const linesBeforeMatch = fileLines.slice(0, fileLineIdx);
        const startIndex =
          linesBeforeMatch.join("\n").length +
          (linesBeforeMatch.length > 0 ? 1 : 0);
        const endIndex = startIndex + fileLines[fileLineIdx].length;

        bestMatch = {
          startIndex,
          endIndex,
        };
        bestSimilarity = similarity;
      }
    }
  }

  return bestMatch;
}

/**
 * Ordered list of matching strategies to try with their names
 */
const matchingStrategies: Array<{ strategy: MatchStrategy; name: string }> = [
  { strategy: exactMatch, name: "exactMatch" },
  { strategy: trimmedMatch, name: "trimmedMatch" },
  { strategy: whitespaceIgnoredMatch, name: "whitespaceIgnoredMatch" },
  { strategy: findFuzzyMatch, name: "jaroWinklerFuzzyMatch" },
];

/**
 * Find the exact match position for search content in file content.
 * Uses multiple matching strategies in order of preference.
 *
 * Matching Strategy:
 * 1. If search content is empty, matches at the beginning of file (position 0)
 * 2. Try each matching strategy in order until one succeeds
 *
 * @param fileContent - The complete content of the file to search in
 * @param searchContent - The content to search for
 * @param config - Configuration options for matching behavior
 * @returns Match result with character positions, or null if no match found
 */
export function findSearchMatch(
  fileContent: string,
  searchContent: string,
): SearchMatchResult | null {
  // Handle truly empty search content
  if (searchContent === "") {
    return { startIndex: 0, endIndex: 0, strategyName: "emptySearch" };
  }

  // Handle whitespace-only search content that trims to empty
  const trimmedSearchContent = searchContent.trim();
  if (trimmedSearchContent === "") {
    // Check if the whitespace-only search content has an exact match first
    const exactIndex = fileContent.indexOf(searchContent);
    if (exactIndex !== -1) {
      return {
        startIndex: exactIndex,
        endIndex: exactIndex + searchContent.length,
        strategyName: "exactMatch",
      };
    }
    // If no exact match for whitespace-only content, treat as empty search
    return { startIndex: 0, endIndex: 0, strategyName: "emptySearch" };
  }

  // Try each matching strategy in order
  for (const { strategy, name } of matchingStrategies) {
    const result = strategy(fileContent, searchContent);
    if (result !== null) {
      return { ...result, strategyName: name };
    }
  }

  return null;
}
