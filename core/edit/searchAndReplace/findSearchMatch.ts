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
 * Find the exact match position for search content in file content.
 * Uses simple exact matching with trimmed newlines for MVP.
 * 
 * Matching Strategy:
 * 1. If search content is empty, matches at the beginning of file (position 0)
 * 2. Try exact string match first
 * 3. Fallback to trimmed content match if exact match fails
 * 
 * @param fileContent - The complete content of the file to search in
 * @param searchContent - The content to search for
 * @returns Match result with character positions, or null if no match found
 */
export function findSearchMatch(
  fileContent: string, 
  searchContent: string
): SearchMatchResult | null {
  // Strip leading/trailing newlines for basic matching strategy
  const trimmedSearchContent = searchContent.trim();
  
  if (trimmedSearchContent === '') {
    // Empty search content matches the beginning of the file
    return { startIndex: 0, endIndex: 0 };
  }
  
  // Try exact match first
  const exactIndex = fileContent.indexOf(searchContent);
  if (exactIndex !== -1) {
    return {
      startIndex: exactIndex,
      endIndex: exactIndex + searchContent.length
    };
  }
  
  // Fallback: try trimmed content match
  const trimmedIndex = fileContent.indexOf(trimmedSearchContent);
  if (trimmedIndex !== -1) {
    return {
      startIndex: trimmedIndex,
      endIndex: trimmedIndex + trimmedSearchContent.length
    };
  }
  
  return null;
}