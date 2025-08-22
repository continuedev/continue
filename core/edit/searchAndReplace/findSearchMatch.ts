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
 * Ordered list of matching strategies to try with their names
 */
const matchingStrategies: Array<{ strategy: MatchStrategy; name: string }> = [
  { strategy: exactMatch, name: "exactMatch" },
  { strategy: trimmedMatch, name: "trimmedMatch" },
  { strategy: whitespaceIgnoredMatch, name: "whitespaceIgnoredMatch" },
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
