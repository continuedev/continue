/**
 * Represents a basic match result with start and end character positions
 */
interface BasicMatchResult {
  /** The starting character index of the match in the file content */
  startIndex: number;
  /** The ending character index of the match in the file content (NOT inclusive - e.g. like slice)*/
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
 */
function trimmedMatch(
  fileContent: string,
  searchContent: string,
): BasicMatchResult | null {
  const trimmedSearchContent = searchContent.trim();
  const trimmedIndex = fileContent.indexOf(trimmedSearchContent);
  if (trimmedIndex !== -1) {
    return {
      startIndex: trimmedIndex,
      endIndex: trimmedIndex + trimmedSearchContent.length,
    };
  }
  return null;
}

/**
 * Case-insensitive matching strategy
 */
function caseInsensitiveMatch(
  fileContent: string,
  searchContent: string,
): BasicMatchResult | null {
  const lowerFileContent = fileContent.toLowerCase();
  const lowerSearchContent = searchContent.toLowerCase();
  const index = lowerFileContent.indexOf(lowerSearchContent);
  if (index !== -1) {
    return {
      startIndex: index,
      endIndex: index + searchContent.length,
    };
  }
  return null;
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
  let originalStartIndex = -1;
  let strippedCharCount = 0;

  // Find the original start position by counting non-whitespace characters
  for (let i = 0; i < fileContent.length; i++) {
    if (!/\s/.test(fileContent[i])) {
      if (strippedCharCount === strippedIndex) {
        originalStartIndex = i;
        break;
      }
      strippedCharCount++;
    }
  }

  if (originalStartIndex === -1) {
    return null; // Should not happen if strippedIndex was valid
  }

  // Find the end position by counting through all characters (including whitespace)
  // that correspond to the stripped search content length
  let originalEndIndex = originalStartIndex;
  let matchedNonWhitespaceChars = 0;

  for (let i = originalStartIndex; i < fileContent.length; i++) {
    if (!/\s/.test(fileContent[i])) {
      matchedNonWhitespaceChars++;
      if (matchedNonWhitespaceChars === strippedSearchContent.length) {
        originalEndIndex = i + 1;
        break;
      }
    }
    // Always update end index to include current position (whether whitespace or not)
    originalEndIndex = i + 1;
  }

  return {
    startIndex: originalStartIndex,
    endIndex: originalEndIndex,
  };
}

/**
 * Calculate the Jaro similarity between two strings
 * TODO Restore this functionality - current implementation has some kind of bug where it only returns one line for the match
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
  { strategy: caseInsensitiveMatch, name: "caseInsensitiveMatch" },
  { strategy: whitespaceIgnoredMatch, name: "whitespaceIgnoredMatch" },
  // { strategy: findFuzzyMatch, name: "jaroWinklerFuzzyMatch" },
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
  const trimmedSearchContent = searchContent.trim();

  if (trimmedSearchContent === "") {
    // Empty search content matches the beginning of the file
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

/**
 * Find all matches for search content in file content.
 * Uses the same matching strategies as findSearchMatch, applied iteratively.
 *
 * @param fileContent - The complete content of the file to search in
 * @param searchContent - The content to search for
 * @returns Array of match results with character positions, empty array if no matches found
 */
export function findSearchMatches(
  fileContent: string,
  searchContent: string,
): SearchMatchResult[] {
  const matches: SearchMatchResult[] = [];

  // Special case: empty search string always matches at position 0
  if (searchContent.trim() === "") {
    return [{ startIndex: 0, endIndex: 0, strategyName: "emptySearch" }];
  }

  let remainingContent = fileContent;
  let currentOffset = 0;

  while (remainingContent.length > 0) {
    const match = findSearchMatch(remainingContent, searchContent);

    if (match === null) {
      break;
    }

    // Adjust match positions to account for the current offset
    const adjustedMatch: SearchMatchResult = {
      startIndex: match.startIndex + currentOffset,
      endIndex: match.endIndex + currentOffset,
      strategyName: match.strategyName,
    };

    // Prevent infinite loops by ensuring we're making progress
    // If the new match starts at or before the last match's start position, break
    if (
      matches.length > 0 &&
      adjustedMatch.startIndex <= matches[matches.length - 1].startIndex
    ) {
      break;
    }

    matches.push(adjustedMatch);

    // Update offset and truncate content after the current match
    currentOffset = adjustedMatch.endIndex;
    remainingContent = fileContent.slice(currentOffset);
  }

  return matches;
}
