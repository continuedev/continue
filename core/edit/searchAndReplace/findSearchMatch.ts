/**
 * Represents a match result with start and end character positions
 */
export interface SearchMatchResult {
  /** The starting character index of the match in the file content */
  startIndex: number;
  /** The ending character index of the match in the file content */
  endIndex: number;
}

/**
 * Strategy function type for finding matches
 */
type MatchStrategy = (
  fileContent: string,
  searchContent: string,
) => SearchMatchResult | null;

/**
 * Exact string matching strategy
 */
function exactMatch(
  fileContent: string,
  searchContent: string,
): SearchMatchResult | null {
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
): SearchMatchResult | null {
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
 * Whitespace-ignored matching strategy
 * Removes all whitespace from both content and search, then finds the match
 */
function whitespaceIgnoredMatch(
  fileContent: string,
  searchContent: string,
): SearchMatchResult | null {
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
 * Ordered list of matching strategies to try
 */
const matchingStrategies: MatchStrategy[] = [
  exactMatch,
  trimmedMatch,
  whitespaceIgnoredMatch,
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
 * @returns Match result with character positions, or null if no match found
 */
export function findSearchMatch(
  fileContent: string,
  searchContent: string,
): SearchMatchResult | null {
  const trimmedSearchContent = searchContent.trim();

  if (trimmedSearchContent === "") {
    // Empty search content matches the beginning of the file
    return { startIndex: 0, endIndex: 0 };
  }

  // Try each matching strategy in order
  for (const strategy of matchingStrategies) {
    const result = strategy(fileContent, searchContent);
    if (result !== null) {
      return result;
    }
  }

  return null;
}
