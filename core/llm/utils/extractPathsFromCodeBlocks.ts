/**
 * Extracts file paths from markdown code blocks
 */
export function extractPathsFromCodeBlocks(content: string): string[] {
  const paths: string[] = [];

  // Match code block opening patterns:
  // 1. ```language filepath
  // 2. ```filepath
  // 3. ```language filepath (range)

  // First match all code block starts
  const codeBlockStarts = content.match(/```[^\n]+/g) || [];

  for (const blockStart of codeBlockStarts) {
    // Try to extract a valid filename with extension
    const filenameMatches = blockStart.match(/([^\s()```]+\.[a-zA-Z0-9]+)/);

    if (filenameMatches && filenameMatches[1]) {
      const filename = filenameMatches[1];

      // Verify this is a legitimate filename (not part of something else)
      if (
        // Check if valid extension
        /\.[a-zA-Z0-9]+$/.test(filename) &&
        // Make sure it's not a URL
        !filename.includes("://") &&
        // Avoid duplicates
        !paths.includes(filename)
      ) {
        paths.push(filename);
      }
    }
  }
  return paths;
}
